import { createClient } from '@/lib/supabase/client';
import { normalizeUrl } from '@/lib/links';
import { makeSlug } from '@/lib/campaigns/slug';
import { emptyStats, loadCampaignStats } from '@/lib/campaigns/stats';
import type { Campaign, CampaignRowVM, CampaignState, CampaignStats, Profile } from '@/types/domain';

/** Campaign joined to its effective owner (linked contact's owner) + display fields. */
export interface CampaignWithOwner extends Campaign {
  ownerId: string | null; // null = legacy/unlinked row (deal_id is null)
  contactCompany: string | null; // linked contact's current company (Sponsor column)
  dealTitle: string | null; // linked deal label
}

type CampaignRow = {
  slug: string;
  sponsor_name: string;
  name: string | null;
  product: string | null;
  destination_url: string;
  active: boolean;
  deal_id: string | null;
  distributed_count: number | null;
  created_at: string;
  invested_amount_eur: number | null;
  venue: string | null;
};

type JoinedRow = CampaignRow & {
  deals: { title: string | null; contacts: { owner_id: string; company: string | null } | null } | null;
};

const COLS = 'slug, sponsor_name, name, product, destination_url, active, deal_id, distributed_count, created_at, invested_amount_eur, venue';
const JOIN_COLS = `${COLS}, deals(title, contacts(owner_id, company))`;

function mapCampaign(r: CampaignRow): Campaign {
  return {
    slug: r.slug,
    sponsorName: r.sponsor_name,
    name: r.name,
    product: r.product,
    destinationUrl: r.destination_url,
    state: r.active ? 'Active' : 'Terminée',
    dealId: r.deal_id,
    distributedCount: r.distributed_count,
    createdAt: r.created_at,
    investedAmountEur: r.invested_amount_eur,
    venue: r.venue,
  };
}

/** Validate + normalize an http/https destination (AC-4). Returns null when not http/https. */
export function httpDestinationOrNull(raw: string): string | null {
  const s = normalizeUrl(raw.trim());
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

/** All campaigns with their effective owner + deal/contact display fields. Scope filtered client-side. */
export async function listScopeCampaigns(): Promise<CampaignWithOwner[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('qr_campaigns')
    .select(JOIN_COLS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // PostgREST returns to-one embeds as objects; supabase-js types them as arrays — cast through unknown.
  return (data as unknown as JoinedRow[] | null ?? []).map((r) => ({
    ...mapCampaign(r),
    ownerId: r.deals?.contacts?.owner_id ?? null,
    contactCompany: r.deals?.contacts?.company ?? r.sponsor_name,
    dealTitle: r.deals?.title ?? null,
  }));
}

// ── Create + duplicate-destination handling (AC-2/4/5/6/7) ───────────────────

export interface CampaignCreateInput {
  dealId: string;
  contactCompany: string;
  name: string;
  destinationUrl: string;
  product?: string;
}

export type CreateOutcome =
  | { status: 'ok'; campaign: Campaign }
  | { status: 'invalid_url' }
  | { status: 'duplicate_active'; existing: Campaign }
  | { status: 'duplicate_terminee'; existing: Campaign };

/** Campaigns already pointing at `normalizedUrl` (any owner; read-all via RLS). */
async function findByDestination(normalizedUrl: string): Promise<Campaign[]> {
  const supabase = createClient();
  const { data } = await supabase.from('qr_campaigns').select(COLS).eq('destination_url', normalizedUrl);
  return (data as CampaignRow[] | null ?? []).map(mapCampaign);
}

/** Insert a brand-new Active campaign, retrying on a slug collision (opaque PK). */
async function insertNew(input: CampaignCreateInput, destination: string): Promise<Campaign> {
  const supabase = createClient();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('qr_campaigns')
      .insert({
        slug: makeSlug(),
        sponsor_name: input.contactCompany,
        name: input.name.trim() === '' ? null : input.name.trim(),
        product: input.product?.trim() ? input.product.trim() : null,
        destination_url: destination,
        active: true,
        deal_id: input.dealId,
      })
      .select(COLS)
      .single();
    if (!error) return mapCampaign(data as CampaignRow);
    if (error.code === '23505') {
      lastError = error;
      continue;
    } // slug PK collision → retry
    throw error; // RLS / validation → surface
  }
  throw lastError ?? new Error('création impossible');
}

/**
 * Create a campaign. Validates the destination, then (unless `force`) checks for an
 * existing campaign on the same destination and returns a duplicate status so the UI
 * can branch (reactivate / warn). With `force: true` it inserts regardless (override, AC-7).
 */
export async function createCampaign(
  input: CampaignCreateInput,
  opts: { force?: boolean } = {},
): Promise<CreateOutcome> {
  const destination = httpDestinationOrNull(input.destinationUrl);
  if (!destination) return { status: 'invalid_url' };

  if (!opts.force) {
    const existing = await findByDestination(destination);
    if (existing.length > 0) {
      const active = existing.find((c) => c.state === 'Active');
      if (active) return { status: 'duplicate_active', existing: active };
      return { status: 'duplicate_terminee', existing: existing[0] };
    }
  }
  return { status: 'ok', campaign: await insertNew(input, destination) };
}

// ── Lifecycle (AC-11/12/13) ──────────────────────────────────────────────────

/** Toggle Active⇄Terminée via the `active` boolean (the DB trigger logs the event). */
export async function setCampaignState(slug: string, state: CampaignState): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('qr_campaigns').update({ active: state === 'Active' }).eq('slug', slug);
  if (error) throw error;
}

/** Edit the destination (slug/QR untouched; the trigger logs destination_change). */
export async function editDestination(slug: string, url: string): Promise<{ ok: boolean; reason?: 'invalid_url' }> {
  const destination = httpDestinationOrNull(url);
  if (!destination) return { ok: false, reason: 'invalid_url' };
  const supabase = createClient();
  const { error } = await supabase.from('qr_campaigns').update({ destination_url: destination }).eq('slug', slug);
  if (error) throw error;
  return { ok: true };
}

/** Owner-entered "Distribués" funnel input (Spec 3 reads it; no event logged). */
export async function setDistributedCount(slug: string, n: number | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('qr_campaigns').update({ distributed_count: n }).eq('slug', slug);
  if (error) throw error;
}

/**
 * « Montant investi » — the one input behind the portal's cost-per-contact tile
 * (Spec 5 §4.7). Deliberately distinct from deals.value_eur: that figure is a
 * sales number and must never leak to a sponsor automatically.
 *
 * null CLEARS it. Zero does not: zero would render « 0,00 € par contact », which
 * claims the campaign was free. Absent and free are different statements.
 *
 * Clamped to >= 0 here rather than only in the input: a negative amount would
 * feed the portal's cost-per-contact tile, which a paying sponsor reads, and
 * `invested_amount_eur` carries no CHECK constraint — this is the only guard.
 * A negative figure is treated as an entry error (typo, paste), not a request
 * to clear the field, so it clamps to 0 rather than becoming null.
 */
export async function setInvestedAmount(slug: string, amount: number | null): Promise<void> {
  const safe = amount === null ? null : Math.max(0, amount);
  const { error } = await createClient().from('qr_campaigns').update({ invested_amount_eur: safe }).eq('slug', slug);
  if (error) throw error;
}

/**
 * « Lieu / événement » — unlocks the portal's venue ranking (Spec 5 §4.8).
 *
 * Trimmed, and an empty string becomes null: the ranking groups by this value,
 * so « Rex Club » and « Rex Club » with a trailing space would render as two
 * separate venues, and '' would render as an unnamed row.
 */
export async function setVenue(slug: string, venue: string | null): Promise<void> {
  const cleaned = venue?.trim() ?? '';
  const { error } = await createClient().from('qr_campaigns').update({ venue: cleaned === '' ? null : cleaned }).eq('slug', slug);
  if (error) throw error;
}

/** Delete a campaign. The DB guard blocks deletion once it has any scan → reason 'has_scans'. */
export async function deleteCampaign(slug: string): Promise<{ ok: boolean; reason?: 'has_scans' }> {
  const supabase = createClient();
  const { error } = await supabase.from('qr_campaigns').delete().eq('slug', slug);
  if (!error) return { ok: true };
  // BEFORE DELETE guard raises check_violation (SQLSTATE 23514) when scans exist.
  if (error.code === '23514' || /scan/i.test(error.message)) return { ok: false, reason: 'has_scans' };
  throw error;
}

// ── Row view-models (reused by the list page AND the Spec 3A export, AC-25) ───

/**
 * Pure mapper: campaigns + their stats + the profile map → list row view-models. The
 * effective owner's name/colour are resolved for the OwnerChip; legacy rows keep null.
 * Spec 3A's export loader reuses this so the CSV mirrors exactly what the list shows
 * (1F "export mirrors visibility" contract) — it only adds the Leads count on top.
 */
export function toCampaignRowVMs(
  campaigns: CampaignWithOwner[],
  stats: Record<string, CampaignStats>,
  profiles: Record<string, Profile>,
): CampaignRowVM[] {
  return campaigns.map((c) => {
    const owner = c.ownerId ? profiles[c.ownerId] : undefined;
    return {
      ...c,
      ownerName: owner?.displayName ?? null,
      ownerColor: owner?.color ?? null,
      stats: stats[c.slug] ?? emptyStats(c.slug),
    };
  });
}

/**
 * Convenience selector: load all campaigns, apply a scope predicate (+ optional deal
 * filter), load stats for just the visible set, and return ready-to-render/export rows.
 * Spec 3A's `loadCampaignsExport` builds on this.
 */
export async function loadCampaignRows(
  scopeMatches: (ownerId: string) => boolean,
  profiles: Record<string, Profile>,
  opts: { dealId?: string | null } = {},
): Promise<CampaignRowVM[]> {
  const all = await listScopeCampaigns();
  const visible = all
    .filter((c) => scopeMatches(c.ownerId ?? '')) // legacy (null) → only matches in "Tous"
    .filter((c) => !opts.dealId || c.dealId === opts.dealId);
  const stats = await loadCampaignStats(visible.map((c) => c.slug));
  return toCampaignRowVMs(visible, stats, profiles);
}
