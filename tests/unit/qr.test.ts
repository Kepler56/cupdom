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

/**
 * CROSS-REPOSITORY GOLDEN — keep in sync with cupdom-dashboard.
 *
 * The portal renders a preview of the code physically printed on the cover, from
 * its own copy of this logic (cupdom-dashboard/lib/qr.ts). There is no shared
 * package between the two repositories, so nothing structurally prevents them
 * from drifting apart — and a preview that scans differently from the object in
 * the sponsor's hand is worse than no preview at all.
 *
 * Both repos pin the SAME digest for the SAME payload. If either side changes
 * its base URL default, its error-correction level, its quiet zone, or starts
 * percent-encoding the slug, exactly one of these two tests goes red and names
 * the other repo.
 *
 * Recomputing the golden is a deliberate act: if you change it here, change it
 * in cupdom-dashboard/tests/unit/qr.test.ts in the same commit.
 */
describe('cross-repo QR golden (must match cupdom-dashboard)', () => {
  const PAYLOAD = 'https://cupdom.fr/s/demo-rex-club';
  const GOLDEN_SIZE = 33;
  const GOLDEN_SHA256 = '157424d28ebff982e854fbeb7fd548be8848fae69f19b371407289a103a1a1d5';

  async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  it('scanUrl produces the golden payload', () => {
    // Guards the half of the drift risk that has nothing to do with QR encoding:
    // the origin default and the absence of percent-encoding.
    expect(scanUrl('demo-rex-club')).toBe(PAYLOAD);
  });

  it('the module matrix matches the digest pinned in cupdom-dashboard', async () => {
    const m = qrMatrix(PAYLOAD);
    expect(m.size).toBe(GOLDEN_SIZE);
    expect(await sha256Hex(serialize(m))).toBe(GOLDEN_SHA256);
  });
});
