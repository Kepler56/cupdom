import { formatKpiValue, trendPct } from '@/lib/kpis';
import type { KpiCardData } from '@/types/domain';

export interface Totals {
  scans: number;
  uniques: number;
  leads: number;
}

const DASH = '—';
const pct = (part: number, whole: number) => `${Math.round((part / whole) * 100)} %`;

/**
 * The six campaign tiles (spec §5). Ratios render « — » when an input is missing or
 * zero: « 0 € par lead » would claim the campaign was free, and NaN is never a figure.
 */
export function deriveCampaignKpis(
  a: { current: Totals; previous: Totals | null },
  c: { investedAmountEur: number | null; distributedCount: number | null },
): KpiCardData[] {
  const { current: cur, previous: prev } = a;
  const t = (k: keyof Totals) => (prev ? trendPct(cur[k], prev[k]) : null);
  return [
    { key: 'c_scans', label: 'Scans', value: formatKpiValue(cur.scans, 'number'), trendPct: t('scans') },
    { key: 'c_uniques', label: 'Scans uniques', value: formatKpiValue(cur.uniques, 'number'), trendPct: t('uniques') },
    { key: 'c_leads', label: 'Leads', value: formatKpiValue(cur.leads, 'number'), trendPct: t('leads') },
    { key: 'c_rate', label: 'Taux scan → lead', value: cur.uniques > 0 ? pct(cur.leads, cur.uniques) : DASH, trendPct: null },
    {
      key: 'c_cpl',
      label: 'Coût par lead',
      value: c.investedAmountEur && cur.leads > 0 ? formatKpiValue(c.investedAmountEur / cur.leads, 'eur') : DASH,
      trendPct: null,
    },
    {
      key: 'c_per_cup',
      label: 'Leads / gobelet distribué',
      value: c.distributedCount && c.distributedCount > 0 ? pct(cur.leads, c.distributedCount) : DASH,
      trendPct: null,
    },
  ];
}
