import { createClient } from '@/lib/supabase/client';
import type { Lead } from '@/types/domain';

type LeadRow = {
  id: string;
  campaign_slug: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  first_seen_at: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

function mapLead(r: LeadRow): Lead {
  return {
    id: r.id,
    campaignSlug: r.campaign_slug,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    firstSeenAt: r.first_seen_at,
    lastActivityAt: r.last_activity_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Leads captured on a campaign, newest activity first (RLS returns rows to any member; AC-12/13). */
export async function listCampaignLeads(slug: string): Promise<Lead[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('campaign_slug', slug)
    .order('last_activity_at', { ascending: false });
  if (error) throw error;
  return (data as LeadRow[] | null ?? []).map(mapLead);
}

// Owner-entered "Distribués" lives on qr_campaigns — reuse the 2A setter:
export { setDistributedCount } from '@/lib/campaigns/campaigns';
