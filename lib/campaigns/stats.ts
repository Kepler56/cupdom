import { createClient } from '@/lib/supabase/client';
import type { CampaignState, CampaignStats } from '@/types/domain';

/** Minimal scan shape the rollup needs (read under RLS member-read). */
export interface ScanLite {
  isBot: boolean;
  visitorHash: string | null;
  stateAtScan: CampaignState | null;
}

/** Zeroed stats for a slug with no scans (delete enabled). */
export function emptyStats(slug: string): CampaignStats {
  return {
    slug,
    totalScans: 0,
    uniquesPerDay: 0,
    bots: 0,
    activeScans: 0,
    termineeScans: 0,
    leads: 0,
    hasScans: false,
  };
}

/**
 * Pure rollup of one campaign's scans (AC-25/27). `totalScans` excludes bots;
 * `uniquesPerDay` dedupes visitor_hash among non-bot rows (the hash already encodes
 * the UTC date); the Active/Terminée split is by `campaign_state_at_scan`. `hasScans`
 * is true when ANY row exists (incl. bots) — delete-guard parity (AC-15). `leads` is 0
 * until Spec 3 supplies the leads table (future source: count(leads where slug = …)).
 */
export function rollupScans(slug: string, rows: ScanLite[]): CampaignStats {
  let totalScans = 0;
  let bots = 0;
  let activeScans = 0;
  let termineeScans = 0;
  const uniques = new Set<string>();

  for (const r of rows) {
    if (r.isBot) {
      bots++;
      continue;
    }
    totalScans++;
    if (r.visitorHash) uniques.add(r.visitorHash);
    if (r.stateAtScan === 'Active') activeScans++;
    else if (r.stateAtScan === 'Terminée') termineeScans++;
  }

  return {
    slug,
    totalScans,
    uniquesPerDay: uniques.size,
    bots,
    activeScans,
    termineeScans,
    leads: 0,
    hasScans: rows.length > 0,
  };
}

/** Headline totals across a set of campaigns (per-campaign uniques summed). */
export interface HeadlineTotals {
  totalScans: number;
  uniquesPerDay: number;
  bots: number;
  activeScans: number;
  termineeScans: number;
  leads: number;
}

/** Sum a list of per-campaign stats for the list-page headline strip (AC-25). */
export function sumStats(list: CampaignStats[]): HeadlineTotals {
  return list.reduce<HeadlineTotals>(
    (acc, s) => ({
      totalScans: acc.totalScans + s.totalScans,
      uniquesPerDay: acc.uniquesPerDay + s.uniquesPerDay,
      bots: acc.bots + s.bots,
      activeScans: acc.activeScans + s.activeScans,
      termineeScans: acc.termineeScans + s.termineeScans,
      leads: acc.leads + s.leads,
    }),
    { totalScans: 0, uniquesPerDay: 0, bots: 0, activeScans: 0, termineeScans: 0, leads: 0 },
  );
}

type ScanRow = { campaign_slug: string; is_bot: boolean | null; visitor_hash: string | null; campaign_state_at_scan: CampaignState | null };

/** Per-slug stats for the given campaigns (single grouped read; slugs with no scans → emptyStats). */
export async function loadCampaignStats(slugs: string[]): Promise<Record<string, CampaignStats>> {
  const out: Record<string, CampaignStats> = {};
  for (const s of slugs) out[s] = emptyStats(s);
  if (slugs.length === 0) return out;

  const supabase = createClient();
  const [scans, leads] = await Promise.all([
    supabase.from('qr_scans').select('campaign_slug, is_bot, visitor_hash, campaign_state_at_scan').in('campaign_slug', slugs),
    supabase.from('leads').select('campaign_slug').in('campaign_slug', slugs),
  ]);
  if (scans.error) throw scans.error;

  const bySlug = new Map<string, ScanLite[]>();
  for (const r of (scans.data as ScanRow[] | null ?? [])) {
    const arr = bySlug.get(r.campaign_slug) ?? [];
    arr.push({ isBot: Boolean(r.is_bot), visitorHash: r.visitor_hash, stateAtScan: r.campaign_state_at_scan });
    bySlug.set(r.campaign_slug, arr);
  }
  for (const [slug, rows] of bySlug) out[slug] = rollupScans(slug, rows);

  // Real captured-lead count per campaign (rollupScans leaves leads = 0 as a pure placeholder).
  for (const r of (leads.data as { campaign_slug: string }[] | null ?? [])) {
    if (out[r.campaign_slug]) out[r.campaign_slug].leads += 1;
  }
  return out;
}
