import { describe, expect, it } from 'vitest';
import { fillDailySeries, parisDay } from '@/lib/analytics/series';
import type { DailyRow } from '@/lib/analytics/types';

const row = (day: string, scans: number, uniques = scans, leads = 0): DailyRow => ({ day, scans, uniques, leads });

describe('parisDay', () => {
  // The whole product hangs on this: a nightclub scan at 00:30 Paris in summer
  // is 22:30 UTC the PREVIOUS day. Bucketed in UTC the peak lands on the wrong
  // night, and the heatmap that is meant to sell the product tells a lie.
  it('assigns a late-evening UTC instant to the next Paris day in summer', () => {
    expect(parisDay(new Date('2026-08-19T22:30:00Z'))).toBe('2026-08-20');
  });

  it('assigns the same instant correctly in winter', () => {
    expect(parisDay(new Date('2026-01-19T22:30:00Z'))).toBe('2026-01-19');
  });
});

describe('fillDailySeries', () => {
  it('inserts zero-valued days between two rows', () => {
    const series = fillDailySeries(
      [row('2026-08-17', 5), row('2026-08-20', 9)],
      new Date('2026-08-17T00:00:00Z'),
      new Date('2026-08-20T12:00:00Z'),
    );
    expect(series.map((p) => p.day)).toEqual(['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20']);
    expect(series.map((p) => p.scans)).toEqual([5, 0, 0, 9]);
  });

  it('keeps every column of an existing row', () => {
    // 20:00 UTC, not 23:00: at 23:00 UTC it is already 01:00 the NEXT day in
    // Paris, which would legitimately produce a second bucket.
    const series = fillDailySeries([row('2026-08-17', 5, 4, 2)], new Date('2026-08-17T00:00:00Z'), new Date('2026-08-17T20:00:00Z'));
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ scans: 5, uniques: 4, leads: 2 });
  });

  // A campaign that started mid-period must SHOW that it started mid-period.
  it('covers the full window including empty days before the first row', () => {
    const series = fillDailySeries([row('2026-08-19', 3)], new Date('2026-08-17T00:00:00Z'), new Date('2026-08-19T12:00:00Z'));
    expect(series.map((p) => p.day)).toEqual(['2026-08-17', '2026-08-18', '2026-08-19']);
    expect(series[0].scans).toBe(0);
  });

  // resolvePeriod('tout') returns the epoch as `from`. Enumerating from 1970
  // would build 20 000 points. Callers pass null, and the series starts where
  // the data does.
  it('starts at the first row when `from` is null', () => {
    const series = fillDailySeries([row('2026-08-18', 1), row('2026-08-19', 2)], null, new Date('2026-08-19T12:00:00Z'));
    expect(series.map((p) => p.day)).toEqual(['2026-08-18', '2026-08-19']);
  });

  it('returns an empty series when `from` is null and there are no rows', () => {
    expect(fillDailySeries([], null, new Date('2026-08-19T12:00:00Z'))).toEqual([]);
  });

  // Defence in depth for the same trap: if a caller forgets and passes the
  // epoch, fall back to the data rather than looping for three decades.
  it('falls back to the first row when the requested window is absurdly long', () => {
    const series = fillDailySeries([row('2026-08-18', 1)], new Date(0), new Date('2026-08-19T12:00:00Z'));
    expect(series.map((p) => p.day)).toEqual(['2026-08-18', '2026-08-19']);
  });

  it('attaches a pre-formatted fr-FR label to every point', () => {
    const series = fillDailySeries([row('2026-08-19', 1)], new Date('2026-08-19T00:00:00Z'), new Date('2026-08-19T12:00:00Z'));
    expect(series[0].label).toBe('19 août');
  });

  // The chart's tooltip is a Client Component and must never call Intl itself,
  // so every value it can display is formatted here. U+202F, not a plain space:
  // the whole point is that '1 200' would be a regression nobody sees in review.
  it('attaches a server-formatted fr-FR string for each metric', () => {
    const series = fillDailySeries(
      [row('2026-08-19', 1200, 950, 1000)],
      new Date('2026-08-19T00:00:00Z'),
      new Date('2026-08-19T12:00:00Z'),
    );
    expect(series[0].scansLabel).toBe('1\u202F200');
    expect(series[0].uniquesLabel).toBe('950');
    expect(series[0].leadsLabel).toBe('1\u202F000');
  });

  // Gap-filled days are rendered too, so their labels must exist as well.
  it('formats the zero of a gap-filled day rather than leaving it undefined', () => {
    const series = fillDailySeries(
      [row('2026-08-19', 5)],
      new Date('2026-08-18T00:00:00Z'),
      new Date('2026-08-19T12:00:00Z'),
    );
    expect(series[0]).toMatchObject({ scansLabel: '0', uniquesLabel: '0', leadsLabel: '0' });
  });

  // Day enumeration is done in UTC arithmetic precisely so that the 25-hour and
  // 23-hour Paris days cannot duplicate or swallow a bucket.
  it('crosses the autumn DST boundary without duplicating or skipping a day', () => {
    const series = fillDailySeries([], new Date('2026-10-24T00:00:00Z'), new Date('2026-10-26T12:00:00Z'));
    expect(series.map((p) => p.day)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });
});
