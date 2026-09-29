import { formatKpiValue, trendPct } from '@/lib/kpis';
import type { KpiCardData } from '@/types/domain';

export interface Totals {
  scans: number;
  uniques: number;
  leads: number;
}

const DASH = '—';
/**
 * Campaign ratios are often tiny (0.3 % of cups distributed become leads), so under 10 %
 * they keep one decimal — a whole-number round would show « 0 % » for a live campaign.
 * At 10 % and above a decimal is noise, so they stay whole.
 */
const pct1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (part: number, whole: number) => {
  const v = Math.round((part / whole) * 1000) / 10; // round to 0.1 first: 9.96 → « 10 % », not « 10,0 % »
  return v < 10 ? `${pct1.format(v)} %` : `${Math.round(v)} %`;
};

/**
 * Cost per lead keeps cents. Local on purpose: lib/kpis.ts's whole-euro format serves the
 * CRM's other pages, but 30 € over 100 leads must read « 0,30 € », never « 0 € ».
 */
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      value: c.investedAmountEur && cur.leads > 0 ? eur2.format(c.investedAmountEur / cur.leads) : DASH,
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
