import { describe, expect, it } from 'vitest';
import { emptyStats, rollupScans, type ScanLite } from '@/lib/campaigns/stats';

const scan = (over: Partial<ScanLite> = {}): ScanLite => ({
  isBot: false,
  visitorHash: 'h1',
  stateAtScan: 'Active',
  ...over,
});

describe('rollupScans', () => {
  it('excludes bots from totalScans but counts them in bots; hasScans includes bots', () => {
    const rows = [scan(), scan({ isBot: true }), scan({ isBot: true })];
    const s = rollupScans('abc234', rows);
    expect(s.totalScans).toBe(1);
    expect(s.bots).toBe(2);
    expect(s.hasScans).toBe(true); // any row (incl. bot) → delete disabled
  });

  it('uniquesPerDay dedupes visitor_hash among non-bot rows only', () => {
    const rows = [
      scan({ visitorHash: 'a' }),
      scan({ visitorHash: 'a' }), // repeat → one unique
      scan({ visitorHash: 'b' }),
      scan({ isBot: true, visitorHash: 'c' }), // bot, ignored
    ];
    const s = rollupScans('abc234', rows);
    expect(s.totalScans).toBe(3);
    expect(s.uniquesPerDay).toBe(2);
  });

  it('splits non-bot scans by campaign_state_at_scan; split sums ≤ total', () => {
    const rows = [
      scan({ stateAtScan: 'Active' }),
      scan({ stateAtScan: 'Active' }),
      scan({ stateAtScan: 'Terminée' }),
      scan({ stateAtScan: null }), // untagged legacy/pre-2B scan
    ];
    const s = rollupScans('abc234', rows);
    expect(s.activeScans).toBe(2);
    expect(s.termineeScans).toBe(1);
    expect(s.activeScans + s.termineeScans).toBeLessThanOrEqual(s.totalScans);
    expect(s.leads).toBe(0); // Spec 3 owns leads
  });

  it('emptyStats has zero everything and hasScans false', () => {
    const s = emptyStats('abc234');
    expect(s).toMatchObject({ totalScans: 0, bots: 0, uniquesPerDay: 0, hasScans: false });
  });
});
