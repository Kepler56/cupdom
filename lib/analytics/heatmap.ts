import { HEATMAP_RAMP } from '@/lib/charte';
import { formatNumber, formatPercent } from './format';
import type { HourlyRow } from './types';

/**
 * ISO order: index 0 = lundi … 6 = dimanche, matching `dow` 1..7.
 *
 * The ORDER is load-bearing, not cosmetic: `Heatmap.tsx` renders one row per
 * entry and reads that row's cells as `cells[index * 24 + h]`, so swapping two
 * labels would silently mislabel every row of the grid. Pinned by a test for
 * that reason.
 */
export const DOW_LABELS = Object.freeze(['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']);
export const DOW_LABELS_LONG = Object.freeze([
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
]);

/** Below this many scans in the whole window, a "peak" is a coincidence. */
export const MIN_HEATMAP_VOLUME = 30;

const HOURS = 24;
const DAYS = 7;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * Interpolate the charte's sequential ramp: Crème → Jaune → Orange → Encre.
 *
 * Intensity 0 lands on Crème deliberately — the page's own ground — so a quiet
 * hour dissolves into the card instead of drawing a box around nothing.
 *
 * This ramp places jaune next to orange, which the charte forbids for the
 * wordmark. That interdiction is about logo legibility; as a sequential ramp
 * this ordering is perceptually correct, and the deviation is user-approved
 * (spec §3.2).
 */
export function heatColour(intensity: number): string {
  const t = clamp01(intensity);
  const stops = HEATMAP_RAMP;
  const segments = stops.length - 1;
  const scaled = t * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const local = scaled - index;

  const from = hexToRgb(stops[index]);
  const to = hexToRgb(stops[index + 1]);
  return toHex([
    from[0] + (to[0] - from[0]) * local,
    from[1] + (to[1] - from[1]) * local,
    from[2] + (to[2] - from[2]) * local,
  ]);
}

export interface HeatCell {
  /** 1 = lundi … 7 = dimanche. */
  dow: number;
  hour: number;
  scans: number;
  /** 0..1 relative to the busiest cell. */
  intensity: number;
  colour: string;
  /** French description, used as the cell's title AND its accessible name. */
  title: string;
}

export interface Heatmap {
  cells: HeatCell[];
  max: number;
  total: number;
  totalLabel: string;
  peak: { dow: number; hour: number; scans: number; label: string; scansLabel: string } | null;
  enoughData: boolean;
}

/**
 * The 7 × 24 grid.
 *
 * `client_scans_hourly` omits cells with no scans, so a naive render would be a
 * scatter of squares rather than a heatmap. Every cell is materialised.
 *
 * Colour alone never carries the information: each cell's `title` states the
 * day, hour and count, and the companion weekday and hourly charts present the
 * same data in a form that does not depend on hue at all.
 */
export function buildHeatmap(rows: HourlyRow[]): Heatmap {
  const byKey = new Map(rows.map((r) => [`${r.dow}:${r.hour}`, r.scans]));
  const max = rows.reduce((m, r) => (r.scans > m ? r.scans : m), 0);
  const total = rows.reduce((s, r) => s + r.scans, 0);

  const cells: HeatCell[] = [];
  for (let dow = 1; dow <= DAYS; dow += 1) {
    for (let hour = 0; hour < HOURS; hour += 1) {
      const scans = byKey.get(`${dow}:${hour}`) ?? 0;
      const intensity = max > 0 ? scans / max : 0;
      cells.push({
        dow,
        hour,
        scans,
        intensity,
        colour: heatColour(intensity),
        title: `${DOW_LABELS_LONG[dow - 1]} ${hour} h — ${formatNumber(scans)} ${scans === 1 ? 'scan' : 'scans'}`,
      });
    }
  }

  const enoughData = total >= MIN_HEATMAP_VOLUME;
  const busiest = cells.reduce((best, c) => (c.scans > best.scans ? c : best), cells[0]);

  return {
    cells,
    max,
    total,
    totalLabel: formatNumber(total),
    peak:
      enoughData && busiest && busiest.scans > 0
        ? {
            dow: busiest.dow,
            hour: busiest.hour,
            scans: busiest.scans,
            label: `${DOW_LABELS_LONG[busiest.dow - 1]} ${busiest.hour} h`,
            scansLabel: formatNumber(busiest.scans),
          }
        : null,
    enoughData,
  };
}

/** The 24-hour profile, every weekday collapsed together. Always 24 entries. */
export function hourlyTotals(rows: HourlyRow[]) {
  const totals = new Array(HOURS).fill(0) as number[];
  for (const r of rows) totals[r.hour] += r.scans;
  const sum = totals.reduce((s, n) => s + n, 0);

  return totals.map((scans, hour) => ({
    hour,
    label: `${hour} h`,
    scans,
    scansLabel: formatNumber(scans),
    share: sum > 0 ? scans / sum : 0,
  }));
}

/** Per-weekday totals in ISO order. Always seven entries. */
export function weekdayTotals(rows: HourlyRow[]) {
  const totals = new Array(DAYS).fill(0) as number[];
  for (const r of rows) totals[r.dow - 1] += r.scans;
  const sum = totals.reduce((s, n) => s + n, 0);

  return totals.map((scans, index) => {
    const share = sum > 0 ? scans / sum : 0;
    return {
      dow: index + 1,
      label: DOW_LABELS_LONG[index],
      scans,
      scansLabel: formatNumber(scans),
      share,
      shareLabel: formatPercent(share),
    };
  });
}
