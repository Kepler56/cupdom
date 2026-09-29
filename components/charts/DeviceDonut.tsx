'use client';

import dynamic from 'next/dynamic';
import { EmptyState } from '@/components/molecules/EmptyState';
import { CHART_SERIES } from '@/lib/charte';
import type { Ranking } from '@/lib/analytics/ranking';

// Lazy-load the recharts arc; ssr:false keeps recharts out of the initial bundle.
// The skeleton fills the SAME fixed 40×40 box, so there is no layout shift, and
// the legend (which carries the numbers) renders immediately.
const DeviceDonutChart = dynamic(() => import('./DeviceDonutChart').then((m) => m.DeviceDonutChart), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-full bg-canvas" />,
});

/**
 * The one donut in the portal. Device type is the rare dimension where
 * part-of-a-whole is the actual question — « dois-je construire pour iPhone ? »
 * — and where three or four categories make the arc readable.
 *
 * The legend carries the numbers, pre-formatted on the server. In jsdom the arc
 * does not render at all (ResponsiveContainer measures 0x0), which is why the
 * unit test asserts on the legend.
 */
export function DeviceDonut({ ranking }: { ranking: Ranking }) {
  if (ranking.rows.length === 0) {
    return (
      <EmptyState title="Pas encore de données">
        Dès les premiers scans de la période, la répartition apparaît ici.
      </EmptyState>
    );
  }

  // Scans arrived but every one of them is « Inconnu »: the ring would be a
  // single full circle labelled « Inconnu — 100 % », which reads as a finding
  // rather than as a gap. Distinct copy from the no-data case above, because
  // « nous ne savons pas » and « il n’y a rien encore » are different claims.
  if (ranking.empty) {
    return (
      <EmptyState title="Information indisponible">
        Les scans de la période n’ont pas permis de déterminer cette information.
      </EmptyState>
    );
  }

  const data = ranking.rows.map((row, i) => ({
    name: row.label,
    value: row.scans,
    colour: CHART_SERIES[i % CHART_SERIES.length],
  }));

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
      <div className="h-40 w-40 shrink-0">
        <DeviceDonutChart data={data} />
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {ranking.rows.map((row, i) => (
          <li key={row.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CHART_SERIES[i % CHART_SERIES.length] }}
            />
            <span className="flex-1 text-text-body">{row.label}</span>
            <span className="font-bold text-text">{row.scansLabel}</span>
            <span className="w-12 text-right text-xs text-text-muted">{row.shareLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
