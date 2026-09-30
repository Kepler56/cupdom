// Client-side downscale of a product photo before upload. Phone photos are 3–8 Mo and the
// `sponsor-media` bucket caps at 2 Mo; a 1600 px WebP/JPEG at q0.85 lands well under that
// and is still sharp at the lead form's widest (440 px card, 2× DPR).

export const PHOTO_MAX_SIDE = 1600;
const QUALITY = 0.85;
const RESIZABLE = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** Fit (w, h) inside max×max, preserving aspect ratio, never upscaling. Pure. */
export function fitWithin(width: number, height: number, max: number = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Returns a re-encoded, downscaled copy of `file` (WebP, or JPEG where the browser cannot
 * encode WebP). Anything that cannot be decoded or re-encoded comes back UNCHANGED, so the
 * caller's type/size validation still runs and shows its clear error.
 */
export async function resizePhoto(file: File): Promise<File> {
  if (!RESIZABLE.has(file.type) || typeof document === 'undefined') return file;
  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    return file;
  }
  try {
    const { width, height } = fitWithin(decoded.width, decoded.height);
    if (width === 0) return file;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let blob = await toBlob(canvas, 'image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');
    if (!blob || (blob.type !== 'image/jpeg' && blob.type !== 'image/webp')) return file;

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return file;
  } finally {
    decoded.close();
  }
}
