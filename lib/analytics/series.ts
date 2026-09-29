import { formatDayShort, formatNumber } from './format';
import type { DailyRow } from './types';

/**
 * One day of the chart, ready to render.
 *
 * `label` is formatted here, on the server, rather than in the Recharts tick
 * formatter — the browser's ICU may not match Node's, and a mismatch would
 * surface as a hydration warning on the dashboard's centrepiece.
 *
 * The three `*Label` fields exist for the same reason, one step further: the
 * tooltip must read « 1 200 » and not « 1200 », and the value it shows is part
 * of the server-rendered payload. One per metric rather than one for the active
 * one, because which metric is active is local client state the server cannot
 * know.
 */
export interface SeriesPoint {
  day: string;
  label: string;
  scans: number;
  uniques: number;
  leads: number;
  scansLabel: string;
  uniquesLabel: string;
  leadsLabel: string;
}

/**
 * ~3 years. Anything longer is a caller mistake — `resolvePeriod('tout')`
 * resolves `from` to the epoch — and the recovery is to start where the data
 * starts rather than enumerate 20 000 empty days into a chart.
 */
export const MAX_SERIES_DAYS = 1100;

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The Paris calendar date of an instant, as 'YYYY-MM-DD'.
 *
 * 'en-CA' is the trick: it is the one common locale whose date order is already
 * ISO, so no re-assembly from parts is needed. Same technique as the Edge
 * Function's visitor-hash date, deliberately — the two must agree.
 */
export function parisDay(at: Date): string {
  return PARIS_DAY.format(at);
}

/** Day arithmetic in UTC, where every day is exactly 24 h. Paris days are not. */
function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function spanDays(startIso: string, endIso: string): number {
  return (Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`)) / 86_400_000;
}

/**
 * The continuous list of Paris calendar dates a chart should draw.
 *
 * Extracted from `fillDailySeries` because the campaigns table needs the SAME
 * window for every row. Two sparklines side by side are only comparable if they
 * span the same days: a campaign launched three days ago whose curve started at
 * its own first scan would render at the same width as one running for six
 * months, and the eye would read the two as equivalent. One window, computed
 * once, handed to every row.
 *
 * `from = null` means "start where the data starts", which is what the 'tout'
 * preset needs: its resolved `from` is the epoch. `presentDays` is the set of
 * days that actually carry data — it does not need to be sorted or unique.
 *
 * The last day is included even though it is only partial. A dashboard that hid
 * today would be stranger than one that shows it filling up.
 */
export function seriesWindow(presentDays: string[], from: Date | null, to: Date): string[] {
  const present = [...new Set(presentDays)].sort();

  let start = from ? parisDay(from) : present[0];
  if (!start) return [];

  const end = parisDay(to);
  if (spanDays(start, end) > MAX_SERIES_DAYS) {
    if (present.length === 0) return [];
    start = present[0];
  }

  // `end < start` needs no special case: the loop simply yields nothing.
  const days: string[] = [];
  for (let day = start; day <= end; day = nextDay(day)) days.push(day);
  return days;
}

/**
 * Turn the sparse RPC result into a continuous daily series.
 *
 * `client_scans_daily` omits days with no activity. Charted as-is, a gap
 * becomes a straight line between two real values — a quiet week would render
 * as a gentle slope instead of a flat zero. Every missing day is materialised
 * at zero.
 */
export function fillDailySeries(rows: DailyRow[], from: Date | null, to: Date): SeriesPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));

  return seriesWindow([...byDay.keys()], from, to).map((day) => {
    const found = byDay.get(day);
    const scans = found?.scans ?? 0;
    const uniques = found?.uniques ?? 0;
    const leads = found?.leads ?? 0;
    return {
      day,
      label: formatDayShort(day),
      scans,
      uniques,
      leads,
      scansLabel: formatNumber(scans),
      uniquesLabel: formatNumber(uniques),
      leadsLabel: formatNumber(leads),
    };
  });
}
