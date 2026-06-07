// Data feed for the 1F `campaigns` + `scan_leads` export datasets (Spec 3A Task 8).
// 1F owns the registry shape (datasets.ts); this module owns the row types + loaders, so the
// CSV mirrors what the CRM shows (scope-filtered, owner resolved upstream). Also exports the
// per-campaign lead CSV columns reused by the leads table's "Exporter les leads" button.
import { createClient } from '@/lib/supabase/client';
import { listScopeCampaigns } from '@/lib/campaigns/campaigns';
import { loadCampaignStats } from '@/lib/campaigns/stats';
import type { CampaignState, CsvColumn, Lead } from '@/types/domain';

const fmtDate = (v: string | null | undefined): string =>
  v ? new Intl.DateTimeFormat('fr-FR').format(new Date(v)) : '';

// ── Per-campaign lead hand-off CSV (AC-12) ──────────────────────────────────
export type LeadExportRow = Pick<Lead, 'firstName' | 'lastName' | 'email' | 'phone' | 'firstSeenAt'>;

export const leadCsvColumns: CsvColumn<LeadExportRow>[] = [
  { header: 'Prénom', value: (l) => l.firstName },
  { header: 'Nom', value: (l) => l.lastName },
  { header: 'Email', value: (l) => l.email },
  { header: 'Téléphone', value: (l) => l.phone },
  { header: 'Capturé le', value: (l) => fmtDate(l.firstSeenAt) },
];

// ── Row types the datasets registry accessors read ──────────────────────────
export interface CampaignExportRow {
  name: string;
  contactName: string | null;
  dealTitle: string | null;
  statut: CampaignState;
  scans: number;
  leads: number;
  createdAt: string;
}

export interface ScanLeadRow {
  name: string;
  scans: number;
  leads: number;
  conversionRate: number; // leads / scans (0 when scans = 0)
}

/** Count leads per campaign slug (single read; RLS member-read). */
export async function countLeadsBySlug(slugs: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (slugs.length === 0) return out;
  const supabase = createClient();
  const { data } = await supabase.from('leads').select('campaign_slug').in('campaign_slug', slugs);
  for (const r of (data as { campaign_slug: string }[] | null ?? [])) {
    out[r.campaign_slug] = (out[r.campaign_slug] ?? 0) + 1;
  }
  return out;
}

/** Scope-filtered campaign rows for the `campaigns` export dataset. */
export async function loadCampaignsExport(scopeMatches: (ownerId: string) => boolean): Promise<CampaignExportRow[]> {
  const visible = (await listScopeCampaigns()).filter((c) => scopeMatches(c.ownerId ?? ''));
  const slugs = visible.map((c) => c.slug);
  const [stats, leadCounts] = await Promise.all([loadCampaignStats(slugs), countLeadsBySlug(slugs)]);
  return visible.map((c) => ({
    name: c.name ?? c.sponsorName,
    contactName: c.contactCompany ?? c.sponsorName,
    dealTitle: c.dealTitle,
    statut: c.state,
    scans: stats[c.slug]?.totalScans ?? 0,
    leads: leadCounts[c.slug] ?? 0,
    createdAt: c.createdAt,
  }));
}

/** Scope-filtered per-campaign aggregate for the `scan_leads` export dataset. */
export async function loadScanLeadsExport(scopeMatches: (ownerId: string) => boolean): Promise<ScanLeadRow[]> {
  const visible = (await listScopeCampaigns()).filter((c) => scopeMatches(c.ownerId ?? ''));
  const slugs = visible.map((c) => c.slug);
  const [stats, leadCounts] = await Promise.all([loadCampaignStats(slugs), countLeadsBySlug(slugs)]);
  return visible.map((c) => {
    const scans = stats[c.slug]?.totalScans ?? 0;
    const leads = leadCounts[c.slug] ?? 0;
    return { name: c.name ?? c.sponsorName, scans, leads, conversionRate: scans === 0 ? 0 : leads / scans };
  });
}
