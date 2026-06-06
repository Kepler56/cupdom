import { describe, expect, it, vi } from 'vitest';
import { EC_LEVEL, qrMatrix, toPng, toSvg } from '@/lib/campaigns/qr';
import { scanUrl } from '@/lib/campaigns/redirectUrl';

function serialize(m: ReturnType<typeof qrMatrix>): string {
  let s = `${m.size}:`;
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) s += m.isDark(r, c) ? '1' : '0';
  return s;
}

describe('campaign QR', () => {
  it('uses error-correction level H (print + screen parity)', () => {
    expect(EC_LEVEL).toBe('H');
  });

  it('toSvg returns a standalone SVG for the scan URL', () => {
    const svg = toSvg(scanUrl('abcd23'));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<rect'); // has dark modules
  });

  it('is deterministic: the same slug yields the same matrix and SVG (immutable QR, AC-10)', () => {
    const a = qrMatrix(scanUrl('abcd23'));
    const b = qrMatrix(scanUrl('abcd23'));
    expect(serialize(a)).toBe(serialize(b));
    expect(toSvg(scanUrl('abcd23'))).toBe(toSvg(scanUrl('abcd23')));
    // A different slug produces a different matrix (the URL is actually encoded).
    expect(serialize(qrMatrix(scanUrl('zzzz99')))).not.toBe(serialize(a));
  });

  it('toPng renders an image/png Blob (canvas mocked)', async () => {
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getCtx = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement['getContext']>);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((cb: BlobCallback) => cb(new Blob(['png'], { type: 'image/png' })));

    const blob = await toPng(scanUrl('abcd23'), 4);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);

    getCtx.mockRestore();
    toBlob.mockRestore();
  });
});
