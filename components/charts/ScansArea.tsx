'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { CHARTE } from '@/lib/charte';
import type { SeriesPoint } from '@/lib/analytics/series';

// Lazy-load the recharts half (recharts + d3 is the portal's heaviest client dep).
// ssr:false keeps it out of the server HTML and the route's initial JS; it loads
// after paint, behind a skeleton that fills the SAME fixed-height box below, so
// there is no layout shift. The toggle bar (no recharts) renders immediately.
const ScansAreaChart = dynamic(() => import('./ScansAreaChart').then((m) => m.ScansAreaChart), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-[var(--radius-card)] bg-canvas" />,
});

/**
 * One accent dominates per metric, and none of them is a colour the charte
 * forbids as a fill: Jaune Soleil for volume, Bleu Roi for people, Rose Flash
 * for the contacts that are the point of the whole product.
 *
 * `labelKey` names the server-formatted string on each SeriesPoint, so the
 * tooltip shows « 1 200 » rather than the raw datum.
 */
const METRICS = [
  { id: 'scans', label: 'Scans', color: CHARTE.jaune, labelKey: 'scansLabel' },
  { id: 'uniques', label: 'Personnes touchées', color: CHARTE.bleu, labelKey: 'uniquesLabel' },
  { id: 'leads', label: 'Contacts', color: CHARTE.rose, labelKey: 'leadsLabel' },
] as const satisfies readonly { id: string; label: string; color: string; labelKey: keyof SeriesPoint }[];

type MetricId = (typeof METRICS)[number]['id'];

/**
 * The metric switch is LOCAL state, not a URL parameter — unlike the period and
 * the campaign filter. It re-draws data the server already sent; it does not
 * change what is fetched, so putting it in the URL would add a navigation for
 * nothing.
 *
 * X-axis labels and every tooltip value arrive pre-formatted from the server
 * (`point.label`, `point.scansLabel` and friends). Formatting them here would
 * call Intl in the browser, whose ICU data may differ from Node's, and the
 * mismatch would surface as a hydration error on the dashboard's centrepiece.
 *
 * The Y axis is the one exception, and deliberately so — see the comment on its
 * tickFormatter below.
 */
export function ScansArea({ series }: { series: SeriesPoint[] }) {
  const [metric, setMetric] = useState<MetricId>('scans');
  const active = METRICS.find((m) => m.id === metric) ?? METRICS[0];

  return (
    <div>
      <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-canvas p-1 sm:inline-flex">
        {METRICS.map((m) => {
          const selected = m.id === metric;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setMetric(m.id)}
              className={[
                'rounded-full px-3 py-1.5 text-sm transition-colors',
                selected ? 'bg-surface font-medium text-text' : 'text-text-muted hover:text-text',
              ].join(' ')}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="h-56 w-full sm:h-64">
        <ScansAreaChart series={series} active={active} />
      </div>
    </div>
  );
}
