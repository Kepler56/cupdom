import { formatNumber, formatPercent } from './format';

/**
 * The shared "ranked list with shares" primitive.
 *
 * Geography and technology are the same question — which values dominate this
 * column, and by how much — asked of different columns, so they share one
 * implementation rather than two that drift.
 */
export interface RankedRow {
  label: string;
  scans: number;
  scansLabel: string;
  /** Null for dimensions the database does not count people for (technology). */
  uniques: number | null;
  uniquesLabel: string | null;
  /** 0..1 of the total. */
  share: number;
  shareLabel: string;
  /** True for the rolled-up tail row. */
  isOther: boolean;
}

export interface Ranking {
  rows: RankedRow[];
  total: number;
  totalLabel: string;
  /** True when the dimension carries no information and the section should not render. */
  empty: boolean;
  /**
   * False when the whole dimension rests on too few scans for its percentages
   * to mean anything. Spec §4.6-3: the shares are still shown, because hiding
   * them would be its own kind of lie, but the UI says how thin the base is.
   */
  enoughData: boolean;
}

/** Past this many bars the eye stops ranking and starts scanning. The rest is rolled up. */
export const MAX_RANKED_ROWS = 12;

/** The RPCs coalesce a missing dimension value to this rather than NULL. */
export const UNKNOWN_LABEL = 'Inconnu';

/** Below this many scans a ranking is a list of coincidences. */
export const MIN_RANKING_VOLUME = 20;

const OTHER_LABEL = 'Autres';

export function buildRanking(
  input: { label: string; scans: number; uniques?: number | null }[],
  limit = MAX_RANKED_ROWS,
): Ranking {
  const total = input.reduce((sum, r) => sum + r.scans, 0);
  const sorted = [...input].sort((a, b) => b.scans - a.scans || a.label.localeCompare(b.label, 'fr'));

  const head = sorted.slice(0, limit);
  const tail = sorted.slice(limit);

  const rows = head.map((r) => toRow(r.label, r.scans, r.uniques ?? null, total, false));

  if (tail.length > 0) {
    // Never truncate silently: a list cut at twelve reads as "that was all of
    // them". The tail keeps the shares summing to 100 % and admits the cut.
    const scans = tail.reduce((sum, r) => sum + r.scans, 0);
    // Summing distinct counts OVERSTATES — one person can appear in two
    // buckets. This is a ceiling, and only ever appears on a rolled-up row.
    const uniques = tail.some((r) => r.uniques === null || r.uniques === undefined)
      ? null
      : tail.reduce((sum, r) => sum + (r.uniques ?? 0), 0);
    rows.push(toRow(OTHER_LABEL, scans, uniques, total, true));
  }

  return {
    rows,
    total,
    totalLabel: formatNumber(total),
    empty: rows.length === 0 || rows.every((r) => r.label === UNKNOWN_LABEL),
    enoughData: total >= MIN_RANKING_VOLUME,
  };
}

function toRow(
  label: string,
  scans: number,
  uniques: number | null,
  total: number,
  isOther: boolean,
): RankedRow {
  const share = total > 0 ? scans / total : 0;
  return {
    label,
    scans,
    scansLabel: formatNumber(scans),
    uniques,
    uniquesLabel: uniques === null ? null : formatNumber(uniques),
    share,
    shareLabel: formatPercent(share),
    isOther,
  };
}
