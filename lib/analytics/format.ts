/**
 * Every user-visible number in the portal passes through here.
 *
 * Two reasons this is centralised, and both matter:
 *
 * 1. The separators are not what anyone types by hand. Intl gives a NARROW
 *    no-break space (U+202F) between thousands and a REGULAR no-break space
 *    (U+00A0) before % and €. The tests assert the exact code points, because
 *    the wrong space is invisible in review and visible in production.
 * 2. ICU data differs between Node and browsers. Formatting inside a Client
 *    Component would risk a hydration mismatch on the very numbers this product
 *    exists to show, so charts receive pre-formatted strings from the server and
 *    never call Intl themselves.
 */

const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const POINTS = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });

// Formatter construction is not free and the digit/sign combinations are few.
const percentCache = new Map<string, Intl.NumberFormat>();

function percentFormatter(digits: number, signed: boolean): Intl.NumberFormat {
  const key = `${digits}|${signed}`;
  let formatter = percentCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('fr-FR', {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: signed ? 'exceptZero' : 'auto',
    });
    percentCache.set(key, formatter);
  }
  return formatter;
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

export function formatPercent(ratio: number, digits = 0): string {
  return percentFormatter(digits, false).format(ratio);
}

export function formatSignedPercent(ratio: number, digits = 0): string {
  return percentFormatter(digits, true).format(ratio);
}

/**
 * A rate as a percentage, or an em dash when there is nothing to divide by.
 *
 * The em dash is the load-bearing half. With nobody reached there is no rate to
 * state, and « 0 % » would be a claim about a captation that has not yet had a
 * chance to happen. Both the « Taux de captation » tile and the campaigns
 * table's Taux column had written this rule out longhand, which is one place
 * too many for a rule this easy to get subtly wrong.
 */
export function formatRate(part: number, whole: number): string {
  return whole > 0 ? formatPercent(part / whole) : '—';
}

/**
 * A change in a RATE, expressed in points.
 *
 * 20 % → 25 % is "+5 pts". Calling it "+25 %" would be a different and much
 * larger-sounding claim, and the client would be right to challenge it.
 */
export function formatPoints(delta: number): string {
  return `${POINTS.format(delta * 100)}\u00A0pts`;
}

export function formatEuros(value: number): string {
  return EUROS.format(value);
}

// timeZone: 'UTC' is load-bearing. The input is already a Paris calendar date
// produced by the RPC; parsed as UTC midnight and formatted in UTC it cannot
// drift backwards a day on a host west of Greenwich.
const DAY_SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_LONG = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** `iso` is a 'YYYY-MM-DD' Paris calendar date, as returned by client_scans_daily. */
export function formatDayShort(iso: string): string {
  return DAY_SHORT.format(new Date(`${iso}T00:00:00Z`));
}

export function formatDayLong(iso: string): string {
  return DAY_LONG.format(new Date(`${iso}T00:00:00Z`));
}
