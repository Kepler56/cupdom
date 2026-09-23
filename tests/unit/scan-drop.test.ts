import { describe, expect, it } from 'vitest';
import {
  countWindows,
  classifyWindow,
  detectScanDrop,
  DEFAULT_SCAN_DROP_CONFIG,
  type ScanEvent,
} from '@/lib/scan-drop/detect';

const NOW = new Date('2026-09-23T01:00:00.000Z');
const W = DEFAULT_SCAN_DROP_CONFIG.windowMinutes; // 10 min

/** A scan `minsAgo` minutes before NOW. */
function scan(minsAgo: number, isBot = false): ScanEvent {
  return { scannedAt: new Date(NOW.getTime() - minsAgo * 60_000), isBot };
}

describe('countWindows', () => {
  it('splits scans into the burst [2W,W) and drop [W,0] windows', () => {
    const series = [
      scan(15), // burst window (10–20 min ago)
      scan(12), // burst
      scan(11), // burst
      scan(9), // drop window (0–10 min ago)
      scan(2), // drop
    ];
    expect(countWindows(series, NOW, W)).toEqual({ burst: 3, drop: 2 });
  });

  it('excludes bot scans from both windows', () => {
    const series = [scan(15), scan(15, true), scan(5), scan(5, true)];
    expect(countWindows(series, NOW, W)).toEqual({ burst: 1, drop: 1 });
  });

  it('ignores scans older than 2W or in the future', () => {
    const series = [scan(25), scan(21), scan(-1), scan(15), scan(5)];
    expect(countWindows(series, NOW, W)).toEqual({ burst: 1, drop: 1 });
  });

  it('treats the W boundary as belonging to the drop window (inclusive lower bound)', () => {
    // exactly W minutes ago is the shared edge: drop is [now-W, now], burst is [.., now-W).
    expect(countWindows([scan(W)], NOW, W)).toEqual({ burst: 0, drop: 1 });
  });
});

describe('classifyWindow', () => {
  const cfg = DEFAULT_SCAN_DROP_CONFIG; // peak 5, ratio 0.2

  it('fires on a clean cliff: full burst then zero', () => {
    expect(classifyWindow({ burst: 8, drop: 0 }, cfg)).toEqual({ fire: true });
  });

  it('does NOT fire on a gradual tail-off', () => {
    // 8 then 6 is a decay, not a cliff: 6 > floor(0.2*8)=1.
    expect(classifyWindow({ burst: 8, drop: 6 }, cfg)).toEqual({ fire: false });
  });

  it('does NOT fire when the burst never reached the threshold', () => {
    expect(classifyWindow({ burst: 3, drop: 0 }, cfg)).toEqual({ fire: false });
  });

  it('fires when the drop falls below 20% of the burst', () => {
    // burst 10 → floor(0.2*10)=2; drop 1 <= 2 → fire.
    expect(classifyWindow({ burst: 10, drop: 1 }, cfg)).toEqual({ fire: true });
  });

  it('fires when the drop lands exactly on the floor', () => {
    expect(classifyWindow({ burst: 10, drop: 2 }, cfg)).toEqual({ fire: true });
  });

  it('does NOT fire when the drop is one above the floor', () => {
    expect(classifyWindow({ burst: 10, drop: 3 }, cfg)).toEqual({ fire: false });
  });

  it('honours a hard-stop config (dropRatio 0 = must fall to exactly zero)', () => {
    const hard = { ...cfg, dropRatio: 0 };
    expect(classifyWindow({ burst: 6, drop: 0 }, hard)).toEqual({ fire: true });
    expect(classifyWindow({ burst: 6, drop: 1 }, hard)).toEqual({ fire: false });
  });

  it('respects a custom peakThreshold', () => {
    const strict = { ...cfg, peakThreshold: 20 };
    expect(classifyWindow({ burst: 10, drop: 0 }, strict)).toEqual({ fire: false });
  });
});

describe('detectScanDrop (end to end on a series)', () => {
  it('fires on a real cliff series and reports the counts', () => {
    // 8 non-bot scans in the burst window, none in the drop window.
    const series: ScanEvent[] = [];
    for (let i = 0; i < 8; i++) series.push(scan(11 + i * 0.5)); // all within [10,20)
    const result = detectScanDrop(series, NOW);
    expect(result).toEqual({ fire: true, counts: { burst: 8, drop: 0 } });
  });

  it('does not fire when scans are still coming in', () => {
    const series = [scan(15), scan(14), scan(13), scan(12), scan(11), scan(4), scan(3), scan(2)];
    const result = detectScanDrop(series, NOW);
    expect(result.fire).toBe(false);
  });

  it('does not fire on a burst of pure bot traffic', () => {
    const series = [scan(15, true), scan(14, true), scan(13, true), scan(12, true), scan(11, true)];
    expect(detectScanDrop(series, NOW).fire).toBe(false);
  });
});
