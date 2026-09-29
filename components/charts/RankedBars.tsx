import { EmptyState } from '@/components/molecules/EmptyState';
import type { Ranking } from '@/lib/analytics/ranking';

/**
 * The one wording for « this base is too thin to read as percentages », shared
 * so the caveat cannot drift between the place a ranking renders it and the
 * place a card renders it once for several rankings.
 */
export function LowDataNote({ className }: { className?: string }) {
  return (
    <p className={`text-xs text-text-muted${className ? ` ${className}` : ''}`}>
      Encore trop peu de scans sur cette période pour que ces pourcentages soient significatifs.
    </p>
  );
}

/**
 * A ranked list is a table of one dimension. Hand-rolled rather than Recharts:
 * the label, the bar, the count and the share all belong on one line, which a
 * chart library fights rather than helps.
 *
 * Bars are scaled to the LEADER, not to the total. A dimension whose top value
 * holds 30 % would otherwise render as a row of slivers with no visible
 * ranking — the share text carries the absolute proportion.
 *
 * `suppressLowDataNote` is for the one case where several rankings share a
 * denominator: the four technology dimensions all count the same scans, so
 * letting each render its own caveat prints it three times beside a donut that
 * prints none. The « Comment » card states it once and silences the rankings.
 * It never suppresses the caveat where a card holds a single ranking.
 */
export function RankedBars({
  ranking,
  colour,
  suppressLowDataNote = false,
}: {
  ranking: Ranking;
  colour: string;
  suppressLowDataNote?: boolean;
}) {
  if (ranking.rows.length === 0) {
    return (
      <EmptyState title="Pas encore de données">
        Dès les premiers scans de la période, le classement apparaît ici.
      </EmptyState>
    );
  }

  // `empty` is the OTHER kind of nothing: scans arrived, but every one of them
  // landed in the « Inconnu » bucket, so the only bar we could draw would read
  // « Inconnu — 100 % ». Its copy is deliberately not the no-data copy — « nous
  // n’avons pas pu déterminer » and « pas encore de données » are two different
  // statements, and conflating them tells the client the wrong thing about
  // their own campaign.
  if (ranking.empty) {
    return (
      <EmptyState title="Information indisponible">
        Les scans de la période n’ont pas permis de déterminer cette information.
      </EmptyState>
    );
  }

  const leader = ranking.rows[0].scans || 1;

  return (
    <>
      {!ranking.enoughData && !suppressLowDataNote && <LowDataNote className="mb-3" />}
      <ol className="flex flex-col gap-3">
        {ranking.rows.map((row) => (
          <li key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className={row.isOther ? 'text-text-muted' : 'text-text-body'}>{row.label}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                {row.uniquesLabel && (
                  // « ~ » on the rolled-up row only. Its uniques is the SUM of
                  // per-bucket distinct counts, and one person can appear in
                  // two buckets, so it is a documented ceiling rather than a
                  // count — rendering it identically to the exact rows above
                  // would present an over-count as a measurement.
                  <span className="text-xs text-text-muted">
                    {row.isOther ? '~' : ''}
                    {row.uniquesLabel} {row.uniques === 1 ? 'personne' : 'personnes'}
                  </span>
                )}
                <span className="text-sm font-bold text-text">{row.scansLabel}</span>
                <span className="w-12 text-right text-xs text-text-muted">{row.shareLabel}</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-canvas">
              <div
                data-bar
                className="h-2.5 rounded-full"
                style={{
                  width: `${((row.scans / leader) * 100).toFixed(1)}%`,
                  backgroundColor: colour,
                  opacity: row.isOther ? 0.45 : 1,
                }}
              />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
