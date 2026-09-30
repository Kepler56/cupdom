import { describe, expect, it } from 'vitest';
import { alreadyFits, fitWithin, PHOTO_MAX_SIDE, resizePhoto } from '@/lib/campaigns/resizePhoto';

describe('fitWithin', () => {
  it('scales a landscape phone photo so the long side is 1600', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait photo on its height', () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales a small image', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(PHOTO_MAX_SIDE, 10)).toEqual({ width: PHOTO_MAX_SIDE, height: 10 });
  });

  it('preserves the aspect ratio (within rounding)', () => {
    const { width, height } = fitWithin(5000, 1234);
    expect(width).toBe(1600);
    expect(Math.abs(width / height - 5000 / 1234)).toBeLessThan(0.01);
  });

  it('keeps at least 1 px on an extreme panorama and handles empty input', () => {
    expect(fitWithin(100000, 10).height).toBe(1);
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe('resizePhoto', () => {
  it('returns a non-resizable file (e.g. SVG) unchanged so validation reports it', async () => {
    const f = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    expect(await resizePhoto(f)).toBe(f);
  });

  it('returns the original when the image cannot be decoded (jsdom has no decoder)', async () => {
    const f = new File(['not an image'], 'a.png', { type: 'image/png' });
    expect(await resizePhoto(f)).toBe(f);
  });
});

describe('alreadyFits (upload the original, no re-encode)', () => {
  const MB = 1024 * 1024;
  it('small in pixels and bytes → keep the original', () => {
    expect(alreadyFits(1200, 900, 500 * 1024)).toBe(true);
    expect(alreadyFits(PHOTO_MAX_SIDE, PHOTO_MAX_SIDE, 2 * MB)).toBe(true);
  });
  it('too many pixels → re-encode, even if light', () => {
    expect(alreadyFits(PHOTO_MAX_SIDE + 1, 100, 100 * 1024)).toBe(false);
    expect(alreadyFits(100, 4032, 100 * 1024)).toBe(false);
  });
  it('too heavy → re-encode, even if small in pixels', () => {
    expect(alreadyFits(1000, 800, 2 * MB + 1)).toBe(false);
  });
});
