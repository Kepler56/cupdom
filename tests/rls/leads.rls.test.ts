/**
 * Leads / consents / funnel RLS integration test (Spec 3A, migration 0007).
 *
 * Proves: members READ leads/consents/funnel-events (view-everyone); owns_campaign_leads is
 * true-for-owner / false-for-other; NO member or anon write path exists; anon cannot read;
 * the service-role dedup UPSERT refreshes last_activity_at (not a new row) while a different
 * campaign yields a separate lead; and the campaign_funnel rollup counts correctly.
 *
 * Requires migrations 0001+0002+0006+0007 applied and the member env, plus the service-role key
 * (the only write path is the Edge Function = service role). Seed-heavy assertions skip without it.
 *   SUPABASE_URL / SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)
 *   TEST_MEMBER_A_EMAIL / TEST_MEMBER_A_PASSWORD
 *   TEST_MEMBER_B_EMAIL / TEST_MEMBER_B_PASSWORD
 *   SUPABASE_SERVICE_ROLE_KEY
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
const MARKER = `3A-RLS ${Date.now()}`;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const slug = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

async function signIn(email: string, password: string) {
  const client = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!configured || !SERVICE)('3A leads/consents/funnel RLS', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let svc: SupabaseClient;
  let aId = '';
  let bId = '';
  let CMP = '';
  let CMP2 = '';
  const slugs: string[] = [];

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    ({ client: b, userId: bId } = await signIn(B_EMAIL!, B_PASSWORD!));
    svc = createClient(URL!, SERVICE!, { auth: { persistSession: false, autoRefreshToken: false } });

    // A owns contact KA → deal DA → campaign CMP (and CMP2 for the separate-campaign test).
    const { data: ka } = await a
      .from('contacts')
      .insert({ owner_id: aId, company: `${MARKER} ${Math.random().toString(36).slice(2, 7)}` })
      .select('id')
      .single();
    const { data: da } = await a.from('deals').insert({ contact_id: ka!.id, title: MARKER }).select('id').single();
    CMP = slug();
    CMP2 = slug();
    slugs.push(CMP, CMP2);
    for (const s of [CMP, CMP2]) {
      await svc
        .from('qr_campaigns')
        .insert({ slug: s, sponsor_name: MARKER, destination_url: 'https://offer.example', active: true, deal_id: da!.id });
    }
  });

  afterAll(async () => {
    // guard_campaign_delete() raises if a campaign still has qr_scans, and the
    // campaign_funnel test below seeds some. That raise aborts the WHOLE delete
    // statement, so every slug — and every lead hanging off it — survives the
    // run. `cross@x.fr` then accumulates +2 per run and AC-11 fails on the next
    // one. Scans first, and surface a failed cleanup instead of swallowing it.
    await svc.from('qr_scans').delete().in('campaign_slug', slugs);
    const { error } = await svc.from('qr_campaigns').delete().in('slug', slugs); // cascades leads/consents/funnel
    if (error) throw new Error(`campaign cleanup failed: ${error.message}`);
    for (const client of [a, b]) if (client) await client.from('contacts').delete().like('company', `${MARKER}%`);
  });

  it('service-role can write leads/consents/funnel; members read them (view-everyone)', async () => {
    const lead = await svc
      .from('leads')
      .insert({ campaign_slug: CMP, first_name: 'Marie', email: 'marie@x.fr', phone: '0612345678' })
      .select('id')
      .single();
    expect(lead.error).toBeNull();
    await svc.from('lead_consents').insert({ lead_id: lead.data!.id, campaign_slug: CMP, sponsor_name: MARKER, consent_text: 'OK', consent_version: 'v1' });
    await svc.from('funnel_events').insert([
      { campaign_slug: CMP, kind: 'form_view', visitor_hash: 'h1' },
      { campaign_slug: CMP, kind: 'form_submit', visitor_hash: 'h1' },
      { campaign_slug: CMP, kind: 'offer_reached', visitor_hash: 'h1' },
    ]);

    for (const client of [a, b]) {
      expect((await client.from('leads').select('id').eq('campaign_slug', CMP)).data ?? []).toHaveLength(1);
      expect(((await client.from('lead_consents').select('id').eq('campaign_slug', CMP)).data ?? []).length).toBeGreaterThanOrEqual(1);
      expect(((await client.from('funnel_events').select('id').eq('campaign_slug', CMP)).data ?? []).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('owns_campaign_leads is true for the owner, false for another member', async () => {
    const ownerRes = await a.rpc('owns_campaign_leads', { p_slug: CMP });
    expect(ownerRes.data).toBe(true);
    const otherRes = await b.rpc('owns_campaign_leads', { p_slug: CMP });
    expect(otherRes.data).toBe(false);
  });

  it('no member write path: A and B cannot insert leads/consents/funnel directly', async () => {
    for (const client of [a, b]) {
      expect((await client.from('leads').insert({ campaign_slug: CMP, email: 'x@y.fr' })).error).not.toBeNull();
      expect((await client.from('lead_consents').insert({ campaign_slug: CMP, consent_text: 'x' })).error).not.toBeNull();
      expect((await client.from('funnel_events').insert({ campaign_slug: CMP, kind: 'form_view' })).error).not.toBeNull();
    }
  });

  it('anon cannot read or insert leads/consents/funnel', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    expect((await anon.from('leads').select('id')).data ?? []).toHaveLength(0);
    expect((await anon.from('lead_consents').select('id')).data ?? []).toHaveLength(0);
    expect((await anon.from('funnel_events').select('id')).data ?? []).toHaveLength(0);
    expect((await anon.from('leads').insert({ campaign_slug: CMP, email: 'a@b.fr' })).error).not.toBeNull();
  });

  it('dedup upsert refreshes last_activity_at without creating a duplicate (AC-10)', async () => {
    const email = 'dedup@x.fr';
    const first = await svc
      .from('leads')
      .upsert({ campaign_slug: CMP, email, first_name: 'A1', last_activity_at: new Date('2026-06-01T00:00:00Z').toISOString() }, { onConflict: 'campaign_slug,email', ignoreDuplicates: false })
      .select('id, first_seen_at, last_activity_at')
      .single();
    expect(first.error).toBeNull();

    const second = await svc
      .from('leads')
      .upsert({ campaign_slug: CMP, email, first_name: 'A2', last_activity_at: new Date('2026-06-09T00:00:00Z').toISOString() }, { onConflict: 'campaign_slug,email', ignoreDuplicates: false })
      .select('id, first_seen_at, last_activity_at')
      .single();
    expect(second.error).toBeNull();
    expect(second.data!.id).toBe(first.data!.id); // same row
    expect(new Date(second.data!.last_activity_at).getTime()).toBeGreaterThan(new Date(first.data!.last_activity_at).getTime());
    expect(second.data!.first_seen_at).toBe(first.data!.first_seen_at); // unchanged

    const rows = await svc.from('leads').select('id').eq('campaign_slug', CMP).eq('email', email);
    expect(rows.data ?? []).toHaveLength(1);
  });

  it('the same email on a DIFFERENT campaign is a separate lead (AC-11)', async () => {
    const email = 'cross@x.fr';
    await svc.from('leads').insert({ campaign_slug: CMP, email });
    await svc.from('leads').insert({ campaign_slug: CMP2, email });
    const total = await svc.from('leads').select('id, campaign_slug').eq('email', email);
    expect(total.data ?? []).toHaveLength(2);
  });

  it('campaign_funnel rolls up distribues/scannes/vu/soumis/atteinte (AC-14)', async () => {
    // distributed_count + 2 distinct non-bot scanners + the 3 funnel events seeded above.
    await svc.from('qr_campaigns').update({ distributed_count: 500 }).eq('slug', CMP);
    await svc.from('qr_scans').insert([
      { campaign_slug: CMP, is_bot: false, visitor_hash: 'v1' },
      { campaign_slug: CMP, is_bot: false, visitor_hash: 'v2' },
      { campaign_slug: CMP, is_bot: false, visitor_hash: 'v2' }, // repeat → still 2 distinct
      { campaign_slug: CMP, is_bot: true, visitor_hash: 'bot1' }, // bot excluded
    ]);
    // add a second form_view + form_submit so counts are 3/2/1 as specified.
    await svc.from('funnel_events').insert([
      { campaign_slug: CMP, kind: 'form_view', visitor_hash: 'h2' },
      { campaign_slug: CMP, kind: 'form_view', visitor_hash: 'h3' },
      { campaign_slug: CMP, kind: 'form_submit', visitor_hash: 'h2' },
    ]);

    const { data } = await a.from('campaign_funnel').select('*').eq('campaign_slug', CMP).single();
    expect(data!.distribues).toBe(500);
    expect(data!.scannes).toBe(2);
    expect(data!.formulaire_vu).toBe(3);
    expect(data!.formulaire_soumis).toBe(2);
    expect(data!.offre_atteinte).toBe(1);
  });
});
