'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHARTE } from '@/lib/charte';
import { formatNumber } from '@/lib/analytics/format';
import type { SeriesPoint } from '@/lib/analytics/series';

export interface ScansAreaMetric {
  id: string;
  label: string;
  color: string;
  labelKey: keyof SeriesPoint;
}

/**
 * The recharts half of ScansArea, split into its own module so its parent can
 * `next/dynamic(..., { ssr: false })` it: recharts (+ its d3 sub-deps, the
 * heaviest client dependency in the portal) then drops out of the route's initial
 * bundle and loads after paint, behind a skeleton that fills the SAME fixed-height
 * box — so there is no layout shift.
 *
 * Everything about the drawing is unchanged from the original inline chart; only
 * the enclosing <div> moved up to the parent so the skeleton and the chart share
 * one fixed-height container.
 */
export function ScansAreaChart({ series, active }: { series: SeriesPoint[]; active: ScansAreaMetric }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id={`fill-${active.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={active.color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={active.color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHARTE.border} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
          tick={{ fill: CHARTE.textMuted, fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fill: CHARTE.textMuted, fontSize: 12 }}
          // The one place a pure formatter runs in the browser, and it cannot
          // cause a hydration mismatch: the tick values are derived from the
          // measured domain, and ResponsiveContainer measures its parent —
          // during SSR it renders nothing at all, so no axis tick is ever
          // part of the hydrated tree for React to compare against. (With
          // ssr:false the chart never renders on the server at all, which only
          // makes this more true.)
          tickFormatter={formatNumber}
        />
        <Tooltip
          cursor={{ stroke: CHARTE.border }}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${CHARTE.border}`,
            background: CHARTE.blanc,
            fontSize: 13,
          }}
          labelStyle={{ color: CHARTE.encre, fontWeight: 600 }}
          // The raw `value` is deliberately ignored. The point being hovered
          // carries a server-formatted string for each metric; reading the
          // one matching the active metric keeps the tooltip in fr-FR
          // without an Intl call in the browser.
          formatter={(_value, _name, item) => {
            const point = item?.payload as SeriesPoint | undefined;
            return [point ? point[active.labelKey] : '', active.label] as [string, string];
          }}
        />
        <Area
          type="monotone"
          dataKey={active.id}
          stroke={active.color}
          strokeWidth={2}
          fill={`url(#fill-${active.id})`}
          // The dashboard is read, not animated. A chart that slides in on
          // every period change is slower to compare against the last one.
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
