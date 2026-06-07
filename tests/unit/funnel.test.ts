import { describe, expect, it } from 'vitest';
import { buildFunnel } from '@/lib/funnel';
import type { FunnelSources } from '@/types/domain';

const src = (over: Partial<FunnelSources> = {}): FunnelSources => ({
  distribues: 100,
  scannes: 80,
  formulaireVu: 60,
  formulaireSoumis: 20,
  offreAtteinte: 18,
  ...over,
});

describe('buildFunnel', () => {
  it('computes per-step % and the biggest drop index', () => {
    const f = buildFunnel(src());
    expect(f.steps.map((s) => s.pctOfPrev)).toEqual([100, 80, 75, 33, 90]);
    expect(f.steps.map((s) => s.pctOfTop)).toEqual([100, 80, 60, 20, 18]);
    expect(f.biggestDropIdx).toBe(3); // formulaire_soumis, 67% drop
    expect(f.steps[3].dropFromPrev).toBe(67);
  });

  it('all-zero → no biggest drop, no NaN', () => {
    const f = buildFunnel({ distribues: 0, scannes: 0, formulaireVu: 0, formulaireSoumis: 0, offreAtteinte: 0 });
    expect(f.biggestDropIdx).toBeNull();
    for (const s of f.steps) {
      expect(Number.isNaN(s.pctOfTop)).toBe(false);
      expect(s.pctOfTop).toBe(0);
    }
  });

  it('distribues=0 uses the first non-zero step (scannes) as the bar baseline', () => {
    const f = buildFunnel(src({ distribues: 0, scannes: 80 }));
    expect(f.steps[1].pctOfTop).toBe(100); // scannes is the baseline
    expect(f.steps[2].pctOfTop).toBe(75); // 60/80
  });

  it('an over-100% step clamps the bar to 100 but keeps the raw count', () => {
    const f = buildFunnel(src({ distribues: 50, scannes: 80 }));
    expect(f.steps[1].pctOfTop).toBe(100); // 80/50 = 160 → clamped
    expect(f.steps[1].count).toBe(80); // raw count unchanged
    expect(f.steps[1].pctOfPrev).toBe(160); // raw ratio reported honestly
  });

  it('ties resolve to the earliest step', () => {
    // two equal 50% drops: scannes 50/100, formulaireVu 25/50 → both drop 50
    const f = buildFunnel({ distribues: 100, scannes: 50, formulaireVu: 25, formulaireSoumis: 25, offreAtteinte: 25 });
    expect(f.steps[1].dropFromPrev).toBe(50);
    expect(f.steps[2].dropFromPrev).toBe(50);
    expect(f.biggestDropIdx).toBe(1); // earliest
  });
});
