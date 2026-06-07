import { createClient } from '@/lib/supabase/client';
import { listContactsWithStatus } from '@/lib/contacts';
import { listScopeDeals } from '@/lib/deals';
import { listScopeCampaigns } from '@/lib/campaigns/campaigns';
import { CLOSED_STAGES } from '@/types/domain';
import type { KpiInput } from '@/lib/kpis';

const DAY = 86_400_000;

type ScopeMatches = (ownerId: string) => boolean;

/** Counts in two 30-day windows + a 30-point daily series from a list of ISO timestamps. */
function windows(timestamps: string[], now: number) {
  const start30 = now - 30 * DAY;
  const start60 = now - 60 * DAY;
  const series = new Array<number>(30).fill(0);
  let cur = 0;
  let prev = 0;
  for (const ts of timestamps) {
    const t = new Date(ts).getTime();
    if (t >= start30) {
      cur++;
      const dayIdx = 29 - Math.min(29, Math.floor((now - t) / DAY));
      if (dayIdx >= 0 && dayIdx < 30) series[dayIdx]++;
    } else if (t >= start60) {
      prev++;
    }
  }
  return { cur, prev, series };
}

/**
 * Build the four KPI inputs for the current scope (Spec 4 §4.1). Scans/leads are restricted to the
 * scope-visible campaigns; contacts/pipeline to the scope-visible owners. Best-effort: missing data
 * degrades to zeros rather than throwing.
 */
export async function loadKpiInput(scopeMatches: ScopeMatches, now: number = Date.now()): Promise<KpiInput> {
  const supabase = createClient();

  const [contacts, deals, campaigns] = await Promise.all([
    listContactsWithStatus(),
    listScopeDeals(),
    listScopeCampaigns(),
  ]);

  const contactsActifs = contacts.filter((c) => scopeMatches(c.ownerId) && c.statut !== 'Perdu').length;
  const pipelineEur = deals
    .filter((d) => scopeMatches(d.ownerId) && !CLOSED_STAGES.includes(d.stage))
    .reduce((sum, d) => sum + (d.valueEur ?? 0), 0);

  const slugs = campaigns.filter((c) => scopeMatches(c.ownerId ?? '')).map((c) => c.slug);
  if (slugs.length === 0) {
    return { contactsActifs, scans30: 0, scansPrev30: 0, scanSeries: [], leads30: 0, leadsPrev30: 0, leadSeries: [], pipelineEur };
  }

  const since = new Date(now - 60 * DAY).toISOString();
  const [{ data: scanRows }, { data: leadRows }] = await Promise.all([
    supabase.from('qr_scans').select('scanned_at, is_bot').in('campaign_slug', slugs).gte('scanned_at', since),
    supabase.from('leads').select('first_seen_at').in('campaign_slug', slugs).gte('first_seen_at', since),
  ]);

  const scanTs = (scanRows as { scanned_at: string; is_bot: boolean | null }[] | null ?? [])
    .filter((r) => !r.is_bot)
    .map((r) => r.scanned_at);
  const leadTs = (leadRows as { first_seen_at: string }[] | null ?? []).map((r) => r.first_seen_at);

  const s = windows(scanTs, now);
  const l = windows(leadTs, now);

  return {
    contactsActifs,
    scans30: s.cur,
    scansPrev30: s.prev,
    scanSeries: s.series,
    leads30: l.cur,
    leadsPrev30: l.prev,
    leadSeries: l.series,
    pipelineEur,
  };
}
