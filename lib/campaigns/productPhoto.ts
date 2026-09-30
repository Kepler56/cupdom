// Product photo rules for a campaign (the image on the public lead form).
// Pure — no Supabase import — so the checks are unit-testable on their own.

/**
 * 2 Mo: the `sponsor-media` bucket's own file-size limit (see migration 0021's
 * prerequisite note). A larger client cap would only let the upload fail later on
 * the server with a vaguer error. Raise both together if the bucket is widened.
 */
export const PRODUCT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

// Raster only. SVG is excluded: it can carry script and would be served from the
// Supabase origin that the CSP allow-lists for images.
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export const PRODUCT_PHOTO_ACCEPT = Object.keys(EXT).join(',');

export type PhotoCheck = { ok: true; ext: string } | { ok: false; error: string };

export function validateProductPhoto(file: { type: string; size: number }): PhotoCheck {
  const ext = EXT[file.type];
  if (!ext) return { ok: false, error: 'Formats acceptés : PNG, JPEG ou WebP.' };
  if (file.size > PRODUCT_PHOTO_MAX_BYTES) return { ok: false, error: 'La photo doit peser moins de 2 Mo.' };
  return { ok: true, ext };
}

/**
 * `products/{slug}/{timestamp}.{ext}` — a fresh path on every replace, so no CDN
 * edge keeps serving the previous image under the same URL.
 */
export function productPhotoPath(slug: string, ext: string, now: number = Date.now()): string {
  return `products/${slug}/${now}.${ext}`;
}
