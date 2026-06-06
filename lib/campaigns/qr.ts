/**
 * In-browser QR rendering for campaign scan URLs (Spec 2A, AC-9/10).
 * Uses `qrcode-generator@1.4.4` (CLAUDE.md mandates this lib; the npm `qrcode`
 * browser bundle 404s). Error-correction level `H` matches `generate_qr.py` and
 * the print path. Because the slug is immutable, `qrMatrix(scanUrl(slug))` is
 * deterministic — editing a destination never changes the QR.
 */
import qrcode from 'qrcode-generator';

/** Error-correction level used everywhere (print + screen). */
export const EC_LEVEL = 'H' as const;
/** Quiet-zone width in modules (the QR spec minimum). */
export const QUIET_ZONE = 4;

export interface QrMatrix {
  /** Module grid edge length (without quiet zone). */
  size: number;
  /** True when module (row, col) is dark. */
  isDark: (row: number, col: number) => boolean;
}

/** Build the QR module matrix for `text` at EC level H (typeNumber 0 = auto-fit). */
export function qrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, EC_LEVEL);
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return { size, isDark: (r, c) => qr.isDark(r, c) };
}

/** A standalone black-on-white SVG string (quiet zone included, crisp edges). */
export function toSvg(text: string): string {
  const { size, isDark } = qrMatrix(text);
  const dim = size + QUIET_ZONE * 2;
  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isDark(r, c)) rects += `<rect x="${c + QUIET_ZONE}" y="${r + QUIET_ZONE}" width="1" height="1"/>`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects}</g>` +
    `</svg>`
  );
}

/** Render the matrix to a PNG Blob via canvas. `scale` = pixels per module. Browser only. */
export async function toPng(text: string, scale = 8): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('toPng must run in the browser (client component / event handler).');
  }
  const { size, isDark } = qrMatrix(text);
  const dim = (size + QUIET_ZONE * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isDark(r, c)) ctx.fillRect((c + QUIET_ZONE) * scale, (r + QUIET_ZONE) * scale, scale, scale);
    }
  }
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob a échoué'))), 'image/png');
  });
}

/** Download a string/Blob payload as a file (client-only; mirrors lib/export/downloadCsv). */
export function downloadBlob(filename: string, blob: Blob): void {
  if (typeof document === 'undefined') {
    throw new Error('downloadBlob must run in the browser.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
