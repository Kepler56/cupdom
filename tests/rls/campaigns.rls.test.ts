/**
 * Campaign model RLS integration test (Spec 2A, migration 0006).
 *
 * Proves the legacy-safe owner gate on qr_campaigns (effective owner = linked
 * contact's owner via deal_id → contact_id → owns_contact), the legacy escape
 * hatch (deal_id is null → all-member writable), the re-point WITH CHECK, the
 * append-only campaign_events auto-log, the zero-scans DELETE guard, ON DELETE
 * SET NULL scan retention, and the ACTIVATED archive_contact active-campaign guard.
 *
 * Requires migrations 0001+0002+0005+0006 applied and the same env as the other
 * RLS suites, plus (for scan-dependent assertions) the service-role key:
 *   SUPABASE_URL / SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)
 *   TEST_MEMBER_A_EMAIL / TEST_MEMBER_A_PASSWORD
 *   TEST_MEMBER_B_EMAIL / TEST_MEMBER_B_PASSWORD
 *   SUPABASE_SERVICE_ROLE_KEY  (optional — scan fabrication/cleanup; those checks skip without it)
 * Skipped when the member env is absent. Run: pnpm test:rls
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const A_EMAIL = process.env.TEST_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.TEST_MEMBER_A_PASSWORD;
const B_EMAIL = process.env.TEST_MEMBER_B_EMAIL;
const B_PASSWORD = process.env.TEST_MEMBER_B_PASSWORD;

const configured = Boolean(URL && ANON && A_EMAIL && A_PASSWORD && B_EMAIL && B_PASSWORD);
const MARKER = `2A-RLS ${Date.now()}`;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const slug = () =>
  Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

async function signIn(email: string, password: string) {
  const client = createClient(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

async function makeContact(client: SupabaseClient, ownerId: string): Promise<string> {
  const { data, error } = await client
    .from('contacts')
    .insert({ owner_id: ownerId, company: `${MARKER} ${Math.random().toString(36).slice(2, 7)}` })
    .select('id')
    .single();
  if (error) throw new Error(`seed contact failed: ${error.message}`);
  return data.id as string;
}

async function makeDeal(client: SupabaseClient, contactId: string): Promise<string> {
  const { data, error } = await client
    .from('deals')
    .insert({ contact_id: contactId, title: MARKER })
    .select('id')
    .single();
  if (error) throw new Error(`seed deal failed: ${error.message}`);
  return data.id as string;
}

/** Insert a campaign as `client`; returns the row or the supabase error. */
function insertCampaign(
  client: SupabaseClient,
  fields: { dealId: string | null; sponsor?: string; active?: boolean },
) {
  return client
    .from('qr_campaigns')
    .insert({
      slug: slug(),
      sponsor_name: fields.sponsor ?? MARKER,
      destination_url: 'https://example.com/offer',
      active: fields.active ?? true,
      deal_id: fields.dealId,
    })
    .select('slug')
    .single();
}

describe.skipIf(!configured)('2A campaigns RLS', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let svc: SupabaseClient | null = null;
  let aId = '';
  let bId = '';
  const slugs: string[] = []; // track every created slug for cleanup

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    ({ client: b, userId: bId } = await signIn(B_EMAIL!, B_PASSWORD!));
    if (SERVICE) {
      svc = createClient(URL!, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    }
  });

  afterAll(async () => {
    // Service-role cleanup removes scanned campaigns the delete-guard would otherwise block.
    if (svc) {
      await svc.from('qr_scans').delete().in('campaign_slug', slugs);
      await svc.from('qr_campaigns').delete().in('slug', slugs);
    }
    for (const client of [a, b]) {
      if (!client) continue;
      await client.from('qr_campaigns').delete().in('slug', slugs); // unscanned, legacy/owned
      await client.from('contacts').delete().like('company', `${MARKER}%`);
    }
  });

  it('insert is owner-gated; legacy (deal_id null) is all-member writable; read is all-member', async () => {
    const ka = await makeContact(a, aId);
    const da = await makeDeal(a, ka);

    const own = await insertCampaign(a, { dealId: da });
    expect(own.error).toBeNull();
    if (own.data) slugs.push(own.data.slug);

    // A inserts on B's deal → with-check fails.
    const kb = await makeContact(b, bId);
    const db = await makeDeal(b, kb);
    const forged = await insertCampaign(a, { dealId: db });
    expect(forged.error).not.toBeNull();

    // Legacy escape hatch: deal_id null insert ok for any member (preserves old index.html path).
    const legacy = await insertCampaign(a, { dealId: null });
    expect(legacy.error).toBeNull();
    if (legacy.data) slugs.push(legacy.data.slug);

    // Read-all: B sees A's linked campaign.
    const read = await b.from('qr_campaigns').select('slug').eq('slug', own.data!.slug).single();
    expect(read.error).toBeNull();
  });

  it('update is owner-gated; legacy is member-writable; re-point to an unowned deal is blocked', async () => {
    const ka = await makeContact(a, aId);
    const da = await makeDeal(a, ka);
    const { data: c } = await insertCampaign(a, { dealId: da });
    slugs.push(c!.slug);

    // B cannot edit A's campaign destination.
    const bUpd = await b
      .from('qr_campaigns')
      .update({ destination_url: 'https://evil.example' })
      .eq('slug', c!.slug)
      .select('slug');
    expect(bUpd.data ?? []).toHaveLength(0);

    // A toggles its own active true→false.
    const aToggle = await a.from('qr_campaigns').update({ active: false }).eq('slug', c!.slug).select('slug').single();
    expect(aToggle.error).toBeNull();

    // Legacy row: any member may update.
    const { data: leg } = await insertCampaign(b, { dealId: null });
    slugs.push(leg!.slug);
    const aEditLegacy = await a.from('qr_campaigns').update({ name: 'x' }).eq('slug', leg!.slug).select('slug').single();
    expect(aEditLegacy.error).toBeNull();

    // Re-point guard: A cannot move its campaign onto B's deal (WITH CHECK).
    const kb = await makeContact(b, bId);
    const db = await makeDeal(b, kb);
    const repoint = await a.from('qr_campaigns').update({ deal_id: db }).eq('slug', c!.slug).select('slug');
    expect(repoint.data ?? []).toHaveLength(0);
  });

  it('lifecycle/destination changes auto-log to append-only campaign_events with actor + detail', async () => {
    const ka = await makeContact(a, aId);
    const da = await makeDeal(a, ka);
    const { data: c } = await insertCampaign(a, { dealId: da });
    slugs.push(c!.slug);

    await a.from('qr_campaigns').update({ active: false }).eq('slug', c!.slug); // deactivate
    await a.from('qr_campaigns').update({ destination_url: 'https://example.com/v2' }).eq('slug', c!.slug);

    const { data: events } = await a
      .from('campaign_events')
      .select('kind, actor_id, detail')
      .eq('campaign_slug', c!.slug);
    const kinds = (events ?? []).map((e) => e.kind).sort();
    expect(kinds).toEqual(['create', 'deactivate', 'destination_change'].sort());
    for (const e of events ?? []) expect(e.actor_id).toBe(aId);
    expect((events ?? []).find((e) => e.kind === 'destination_change')?.detail).toContain('→');

    // Append-only: update/delete on an event is denied (0 rows).
    const eid = (await a.from('campaign_events').select('id').eq('campaign_slug', c!.slug).limit(1).single()).data!.id;
    const upd = await a.from('campaign_events').update({ detail: 'tamper' }).eq('id', eid).select('id');
    expect(upd.data ?? []).toHaveLength(0);
    const del = await a.from('campaign_events').delete().eq('id', eid).select('id');
    expect(del.data ?? []).toHaveLength(0);
  });

  it('delete: ok with zero scans; non-owner blocked; with ≥1 scan the guard raises', async () => {
    const ka = await makeContact(a, aId);
    const da = await makeDeal(a, ka);

    // zero-scans delete ok
    const { data: c1 } = await insertCampaign(a, { dealId: da });
    const del1 = await a.from('qr_campaigns').delete().eq('slug', c1!.slug).select('slug');
    expect(del1.data ?? []).toHaveLength(1);

    // non-owner delete blocked (0 rows), independent of scans
    const { data: c2 } = await insertCampaign(a, { dealId: da });
    slugs.push(c2!.slug);
    const delB = await b.from('qr_campaigns').delete().eq('slug', c2!.slug).select('slug');
    expect(delB.data ?? []).toHaveLength(0);
  });

  it.skipIf(!SERVICE)('delete guard raises on a scanned campaign; scan is retained on deal delete', async () => {
    const ka = await makeContact(a, aId);
    const da = await makeDeal(a, ka);
    const { data: c } = await insertCampaign(a, { dealId: da });
    slugs.push(c!.slug);

    await svc!.from('qr_scans').insert({ campaign_slug: c!.slug, is_bot: false, visitor_hash: 'h1' });

    // A deletes a scanned campaign → guard raises (check_violation), campaign still exists.
    const del = await a.from('qr_campaigns').delete().eq('slug', c!.slug);
    expect(del.error).not.toBeNull();
    const still = await a.from('qr_campaigns').select('slug').eq('slug', c!.slug).single();
    expect(still.error).toBeNull();

    // ON DELETE SET NULL: delete the parent deal (service role) → campaign detaches, scan survives.
    await svc!.from('deals').delete().eq('id', da);
    const detached = await svc!.from('qr_campaigns').select('deal_id').eq('slug', c!.slug).single();
    expect(detached.data!.deal_id).toBeNull();
    const scan = await svc!.from('qr_scans').select('id').eq('campaign_slug', c!.slug);
    expect((scan.data ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('archive guard ON: an active campaign blocks archive_contact; deactivating unblocks it', async () => {
    const ka = await makeContact(a, aId);
    const da = await makeDeal(a, ka);
    const { data: c } = await insertCampaign(a, { dealId: da, active: true });
    slugs.push(c!.slug);

    const blocked = await a.rpc('archive_contact', { p_contact: ka });
    expect(blocked.error).not.toBeNull(); // "Désactivez la campagne active…"

    await a.from('qr_campaigns').update({ active: false }).eq('slug', c!.slug);
    const ok = await a.rpc('archive_contact', { p_contact: ka });
    expect(ok.error).toBeNull();
  });

  it('anon cannot read or insert campaigns / events', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    expect((await anon.from('qr_campaigns').select('slug')).data ?? []).toHaveLength(0);
    expect((await anon.from('campaign_events').select('id')).data ?? []).toHaveLength(0);
    const ins = await anon.from('qr_campaigns').insert({ slug: slug(), sponsor_name: 'x', destination_url: 'https://x.fr' });
    expect(ins.error).not.toBeNull();
  });
});
