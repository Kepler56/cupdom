import { createClient } from '@/lib/supabase/client';
import { resolvePeriod, type PeriodPreset } from '@/lib/analytics/period';
import { fillDailySeries, type SeriesPoint } from '@/lib/analytics/series';
import { buildHeatmap, type Heatmap } from '@/lib/analytics/heatmap';
import { buildRanking, type Ranking } from '@/lib/analytics/ranking';
import type { DailyRow, GeoRow, HourlyRow, OverviewRow, TechRow } from '@/lib/analytics/types';
import type { Totals } from '@/lib/campaigns/campaignKpis';

export interface CampaignAnalytics {
  overview: { current: Totals; previous: Totals | null };
  series: SeriesPoint[];
  heatmap: Heatmap;
  cities: Ranking;
  devices: Ranking;
  os: Ranking;
}

const ZERO: Totals = { scans: 0, uniques: 0, leads: 0 };
const totals = (r?: OverviewRow): Totals => (r ? { scans: r.scans, uniques: r.uniques, leads: r.leads } : ZERO);

async function rows<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await p;
  if (error) throw error;
  return (data as T[] | null) ?? [];
}

/** All campaign-page analytics in ONE parallel batch (spec §5) — 5 RPCs, one round-trip of latency. */
export async function loadCampaignAnalytics(
  slug: string,
  preset: PeriodPreset,
  createdAt: string,
  now: Date = new Date(),
): Promise<CampaignAnalytics> {
  const range = resolvePeriod(preset, now);
  // « Tout » = since the campaign exists, not since 1970 (keeps the series short and honest).
  const from = preset === 'tout' ? new Date(createdAt) : range.from;
  const p = { p_slug: slug, p_from: from.toISOString(), p_to: range.to.toISOString() };
  const supabase = createClient();

  const [overview, daily, hourly, geo, tech] = await Promise.all([
    rows<OverviewRow>(
      supabase.rpc('crm_campaign_overview', {
        ...p,
        p_prev_from: range.prevFrom.toISOString(),
        p_prev_to: range.prevTo.toISOString(),
      }),
    ),
    rows<DailyRow>(supabase.rpc('crm_campaign_daily', p)),
    rows<HourlyRow>(supabase.rpc('crm_campaign_hourly', p)),
    rows<GeoRow>(supabase.rpc('crm_campaign_geo', { ...p, p_level: 'city' })),
    rows<TechRow>(supabase.rpc('crm_campaign_tech', p)),
  ]);

  const techRanking = (dim: string) =>
    buildRanking(tech.filter((r) => r.dimension === dim).map((r) => ({ label: r.label, scans: r.scans })));

  return {
    overview: {
      current: totals(overview.find((r) => r.bucket === 'current')),
      previous: range.hasPrevious ? totals(overview.find((r) => r.bucket === 'previous')) : null,
    },
    series: fillDailySeries(daily, from, range.to),
    heatmap: buildHeatmap(hourly),
    cities: buildRanking(geo, 8),
    devices: techRanking('device_type'),
    os: techRanking('os'),
  };
}
