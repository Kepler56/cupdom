import { describe, expect, it } from 'vitest';
import { PRODUCT_PHOTO_MAX_BYTES, productPhotoPath, validateProductPhoto } from '@/lib/campaigns/productPhoto';

describe('validateProductPhoto', () => {
  it('accepts png, jpeg and webp with the matching extension', () => {
    expect(validateProductPhoto({ type: 'image/png', size: 10 })).toEqual({ ok: true, ext: 'png' });
    expect(validateProductPhoto({ type: 'image/jpeg', size: 10 })).toEqual({ ok: true, ext: 'jpg' });
    expect(validateProductPhoto({ type: 'image/webp', size: 10 })).toEqual({ ok: true, ext: 'webp' });
  });

  it('rejects svg, gif and non-images', () => {
    for (const type of ['image/svg+xml', 'image/gif', 'application/pdf', '']) {
      const r = validateProductPhoto({ type, size: 10 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/PNG, JPEG ou WebP/);
    }
  });

  it('accepts exactly the cap and rejects one byte over', () => {
    expect(validateProductPhoto({ type: 'image/png', size: PRODUCT_PHOTO_MAX_BYTES }).ok).toBe(true);
    const r = validateProductPhoto({ type: 'image/png', size: PRODUCT_PHOTO_MAX_BYTES + 1 });
    expect(r).toEqual({ ok: false, error: 'La photo doit peser moins de 2 Mo.' });
  });
});

describe('productPhotoPath', () => {
  it('is products/{slug}/{timestamp}.{ext}', () => {
    expect(productPhotoPath('on-x4', 'jpg', 1700000000000)).toBe('products/on-x4/1700000000000.jpg');
  });
});
