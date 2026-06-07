import { KPI_LABEL_FR, type KpiCardData } from '@/types/domain';

/** Already scope-filtered, pre-counted inputs for the four Aperçu KPI cards (Spec 4 §4.1). */
export interface KpiInput {
  contactsActifs: number; // non-archived contacts whose statut ∈ {Prospect, En cours, Client} (not Perdu)
  scans30: number;
  scansPrev30: number;
  scanSeries?: number[]; // 30 daily points for the sparkline
  leads30: number;
  leadsPrev30: number;
  leadSeries?: number[];
  pipelineEur: number; // sum of value_eur over OPEN deals in scope
}

const nfFr = new Intl.NumberFormat('fr-FR');
const eurFr = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function formatKpiValue(value: number, kind: 'number' | 'eur'): string {
  return kind === 'eur' ? eurFr.format(value) : nfFr.format(value);
}

/** Signed % change vs the prior window. Zero-safe: both 0 → null; prev 0 & cur>0 → +100. */
export function trendPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

/** The four KPI cards in fixed order: contacts actifs · scans 30j · leads 30j · pipeline €. */
export function deriveKpis(input: KpiInput): KpiCardData[] {
  return [
    {
      key: 'contacts_actifs',
      label: KPI_LABEL_FR.contacts_actifs,
      value: formatKpiValue(input.contactsActifs, 'number'),
      trendPct: null, // snapshot, no trend
    },
    {
      key: 'scans_30j',
      label: KPI_LABEL_FR.scans_30j,
      value: formatKpiValue(input.scans30, 'number'),
      trendPct: trendPct(input.scans30, input.scansPrev30),
      trendSeries: input.scanSeries,
    },
    {
      key: 'leads_30j',
      label: KPI_LABEL_FR.leads_30j,
      value: formatKpiValue(input.leads30, 'number'),
      trendPct: trendPct(input.leads30, input.leadsPrev30),
      trendSeries: input.leadSeries,
    },
    {
      key: 'pipeline_eur',
      label: KPI_LABEL_FR.pipeline_eur,
      value: formatKpiValue(input.pipelineEur, 'eur'),
      trendPct: null, // snapshot
    },
  ];
}
