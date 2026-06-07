import { createClient } from '@/lib/supabase/client';
import { FUNNEL_STAGES, type Funnel, type FunnelSources, type FunnelStage, type FunnelStageId, type FunnelStep } from '@/types/domain';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Pure: turn the five raw counters into on-screen funnel steps (Spec 4 AC-9). The bar baseline is
 * the FIRST non-zero step (Distribués can legitimately be below Scannés, or 0), so pctOfTop is never
 * assumed monotonic; pctOfPrev is the raw per-step conversion (may exceed 100 if a step grows), while
 * dropFromPrev = max(0, 100 - pctOfPrev). biggestDropIdx = the largest drop > 0 (earliest on tie).
 */
export function buildFunnel(src: FunnelSources): Funnel {
  const counts = [src.distribues, src.scannes, src.formulaireVu, src.formulaireSoumis, src.offreAtteinte];
  const baseline = counts.find((c) => c > 0) ?? 0;

  const steps: FunnelStep[] = FUNNEL_STAGES.map((stage, i) => {
    const count = counts[i];
    const pctOfTop = baseline > 0 ? clamp(Math.round((count / baseline) * 100), 0, 100) : 0;
    const prev = i === 0 ? count : counts[i - 1];
    // No previous traffic → no measurable drop (pctOfPrev = 100): an all-zero or grown-from-zero
    // step is never the "biggest abandonment".
    const pctOfPrev = i === 0 || prev === 0 ? 100 : Math.round((count / prev) * 100);
    return {
      key: stage.id,
      label: stage.label,
      count,
      pctOfTop,
      pctOfPrev,
      dropFromPrev: Math.max(0, 100 - pctOfPrev),
    };
  });

  let biggestDropIdx: number | null = null;
  let max = 0;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].dropFromPrev > max) {
      max = steps[i].dropFromPrev;
      biggestDropIdx = i;
    }
  }
  return { steps, biggestDropIdx };
}

type FunnelRow = Record<FunnelStageId, number> & { campaign_slug: string };

/**
 * The ordered five-stage funnel for one campaign (AC-14), read from the single
 * `public.campaign_funnel` view (security_invoker → respects the caller's RLS). Data only —
 * Spec 4 builds the chart. `distribues` already comes from qr_campaigns.distributed_count.
 */
export async function loadCampaignFunnel(slug: string): Promise<FunnelStage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('campaign_funnel')
    .select('*')
    .eq('campaign_slug', slug)
    .maybeSingle();
  if (error) throw error;
  const row = (data as FunnelRow | null) ?? null;
  return FUNNEL_STAGES.map((s) => ({ ...s, count: row ? row[s.id] ?? 0 : 0 }));
}

const toSources = (row: FunnelRow | null): FunnelSources => ({
  distribues: row?.distribues ?? 0,
  scannes: row?.scannes ?? 0,
  formulaireVu: row?.formulaire_vu ?? 0,
  formulaireSoumis: row?.formulaire_soumis ?? 0,
  offreAtteinte: row?.offre_atteinte ?? 0,
});

/** Raw funnel counters for one campaign (fed to buildFunnel on the detail page, AC-9). */
export async function loadFunnelSources(slug: string): Promise<FunnelSources> {
  const supabase = createClient();
  const { data } = await supabase.from('campaign_funnel').select('*').eq('campaign_slug', slug).maybeSingle();
  return toSources((data as FunnelRow | null) ?? null);
}

/** Funnel counters for many campaigns in one round-trip (Deals-tab nested stats, AC-7). */
export async function loadFunnelSourcesMany(slugs: string[]): Promise<Record<string, FunnelSources>> {
  const out: Record<string, FunnelSources> = {};
  if (slugs.length === 0) return out;
  const supabase = createClient();
  const { data } = await supabase.from('campaign_funnel').select('*').in('campaign_slug', slugs);
  for (const row of (data as (FunnelRow & { campaign_slug: string })[] | null ?? [])) {
    out[row.campaign_slug] = toSources(row);
  }
  return out;
}
