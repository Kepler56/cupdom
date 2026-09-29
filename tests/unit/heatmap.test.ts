import { describe, expect, it } from 'vitest';
import {
  buildHeatmap,
  DOW_LABELS,
  DOW_LABELS_LONG,
  heatColour,
  hourlyTotals,
  weekdayTotals,
} from '@/lib/analytics/heatmap';
import { CHARTE } from '@/lib/charte';
import type { HourlyRow } from '@/lib/analytics/types';

const row = (dow: number, hour: number, scans: number): HourlyRow => ({ dow, hour, scans });

// Heatmap.tsx renders one row per DOW_LABELS entry and reads its cells as
// `cells[index * 24 + h]`, so the array's POSITION is the contract between the
// grid and its row headers. Reordering it would mislabel every row of the
// heatmap with nothing failing anywhere.
describe('DOW_LABELS', () => {
  it('is in ISO order, lundi first', () => {
    expect([...DOW_LABELS]).toEqual(['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']);
  });

  it('is index-aligned with its long form', () => {
    expect([...DOW_LABELS_LONG]).toEqual([
      'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
    ]);
  });
});

describe('heatColour', () => {
  it('starts at the canvas colour so an empty cell disappears into the card', () => {
    expect(heatColour(0).toUpperCase()).toBe(CHARTE.creme.toUpperCase());
  });

  it('ends at ink', () => {
    expect(heatColour(1).toUpperCase()).toBe(CHARTE.encre.toUpperCase());
  });

  it('interpolates between the ramp stops', () => {
    const mid = heatColour(0.5);
    expect(mid).toMatch(/^#[0-9A-F]{6}$/i);
    expect(mid.toUpperCase()).not.toBe(CHARTE.creme.toUpperCase());
    expect(mid.toUpperCase()).not.toBe(CHARTE.encre.toUpperCase());
  });

  it('clamps out-of-range intensities rather than producing garbage', () => {
    expect(heatColour(-1).toUpperCase()).toBe(CHARTE.creme.toUpperCase());
    expect(heatColour(4).toUpperCase()).toBe(CHARTE.encre.toUpperCase());
  });
});

describe('buildHeatmap', () => {
  // The RPC omits cells with no scans. A grid missing its quiet hours is not a
  // heatmap, it is a scatter of squares.
  it('always produces the full 7 × 24 grid', () => {
    expect(buildHeatmap([row(6, 23, 40)]).cells).toHaveLength(168);
  });

  it('fills absent cells with zero', () => {
    const h = buildHeatmap([row(6, 23, 40)]);
    const quiet = h.cells.find((c) => c.dow === 1 && c.hour === 4);
    expect(quiet?.scans).toBe(0);
    expect(quiet?.intensity).toBe(0);
  });

  it('orders cells lundi→dimanche, 0h→23h', () => {
    const h = buildHeatmap([]);
    expect(h.cells[0]).toMatchObject({ dow: 1, hour: 0 });
    expect(h.cells[23]).toMatchObject({ dow: 1, hour: 23 });
    expect(h.cells[167]).toMatchObject({ dow: 7, hour: 23 });
  });

  it('scales intensity against the busiest cell', () => {
    const h = buildHeatmap([row(6, 23, 40), row(2, 12, 10)]);
    expect(h.max).toBe(40);
    expect(h.cells.find((c) => c.dow === 6 && c.hour === 23)?.intensity).toBe(1);
    expect(h.cells.find((c) => c.dow === 2 && c.hour === 12)?.intensity).toBeCloseTo(0.25);
  });

  it('describes each cell in French for the tooltip and screen readers', () => {
    const h = buildHeatmap([row(6, 23, 40)]);
    expect(h.cells.find((c) => c.dow === 6 && c.hour === 23)?.title).toBe('samedi 23 h — 40 scans');
  });

  it('uses the singular for a lone scan', () => {
    const h = buildHeatmap([row(1, 3, 1)]);
    expect(h.cells.find((c) => c.dow === 1 && c.hour === 3)?.title).toBe('lundi 3 h — 1 scan');
  });

  it('names the peak cell', () => {
    const h = buildHeatmap([row(6, 23, 40), row(5, 22, 35), row(2, 12, 5)]);
    expect(h.peak).toMatchObject({ dow: 6, hour: 23, scans: 40 });
    expect(h.peak?.label).toBe('samedi 23 h');
  });

  // Spec §4.6-3. « Votre pic : mardi 4 h » computed on three scans is a
  // coincidence wearing a conclusion's clothes.
  it('names no peak below the volume floor', () => {
    expect(buildHeatmap([row(2, 4, 3)]).peak).toBeNull();
    expect(buildHeatmap([row(2, 4, 3)]).enoughData).toBe(false);
  });

  it('survives an empty result without dividing by zero', () => {
    const h = buildHeatmap([]);
    expect(h.max).toBe(0);
    expect(h.total).toBe(0);
    expect(h.peak).toBeNull();
    expect(h.cells.every((c) => c.intensity === 0)).toBe(true);
  });
});

describe('hourlyTotals', () => {
  it('returns all 24 hours even when most are empty', () => {
    const t = hourlyTotals([row(6, 23, 40)]);
    expect(t).toHaveLength(24);
    expect(t[23].scans).toBe(40);
    expect(t[4].scans).toBe(0);
  });

  it('collapses the same hour across every weekday', () => {
    const t = hourlyTotals([row(5, 23, 10), row(6, 23, 30)]);
    expect(t[23].scans).toBe(40);
  });

  it('labels hours in the French 24-hour form', () => {
    expect(hourlyTotals([]) [9].label).toBe('9 h');
  });

  // Components never format their own numbers — HourlyBars needs a
  // pre-formatted string to consume, mirroring weekdayTotals' scansLabel.
  it('pre-formats the count so the component never formats it itself', () => {
    const t = hourlyTotals([row(6, 23, 40)]);
    expect(t[23].scansLabel).toBe('40');
    expect(t[4].scansLabel).toBe('0');
  });
});

describe('weekdayTotals', () => {
  it('returns all seven days in ISO order', () => {
    const t = weekdayTotals([]);
    expect(t.map((d) => d.label)).toEqual([
      'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
    ]);
  });

  it('sums each day across its hours and shares against the week', () => {
    const t = weekdayTotals([row(6, 23, 30), row(6, 1, 10), row(1, 12, 10)]);
    expect(t[5].scans).toBe(40);
    expect(t[5].share).toBeCloseTo(0.8);
    expect(t[5].shareLabel).toBe('80\u00A0%');
  });
});
