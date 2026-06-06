import { createClient } from '@/lib/supabase/client';
import type { CampaignEvent, CampaignEventKind } from '@/types/domain';

type EventRow = {
  id: string;
  campaign_slug: string;
  actor_id: string | null;
  kind: CampaignEventKind;
  detail: string | null;
  created_at: string;
};

function mapEvent(r: EventRow): CampaignEvent {
  return {
    id: r.id,
    campaignSlug: r.campaign_slug,
    actorId: r.actor_id,
    kind: r.kind,
    detail: r.detail,
    createdAt: r.created_at,
  };
}

/** Append-only lifecycle log for one campaign, newest first (AC-17). */
export async function listCampaignEvents(slug: string): Promise<CampaignEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('campaign_events')
    .select('id, campaign_slug, actor_id, kind, detail, created_at')
    .eq('campaign_slug', slug)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as EventRow[] | null ?? []).map(mapEvent);
}
