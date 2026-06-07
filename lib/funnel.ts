import { createClient } from '@/lib/supabase/client';
import { FUNNEL_STAGES, type FunnelStage, type FunnelStageId } from '@/types/domain';

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
