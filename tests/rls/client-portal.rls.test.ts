/**
 * Client-portal RLS integration test (Spec 5, migration 0009) — POSITIVE SPACE.
 *
 * Proves a portal client sees exactly their own campaigns, leads and aggregates,
 * and that the helper functions and RPCs behave. The things a client must NOT
 * reach live in client-portal-isolation.rls.test.ts.
 *
 * Requires migrations 0001+0002+0006+0007+0009 applied, the member env, and the
 * service-role key (the only write path into client_accounts).
 *   SUPABASE_URL / SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)
 *   TEST_MEMBER_A_EMAIL / TEST_MEMBER_A_PASSWORD
 *   SUPABASE_SERVICE_ROLE_KEY
 * Skipped when the env is absent. Run: pnpm test:rls
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createTestClient, destroyTestClient, type TestClientAccount } from './helpers/clientAccounts';

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const A_EMAIL = process.env.TEST_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.TEST_MEMBER_A_PASSWORD;

const configured = Boolean(URL && ANON && SERVICE && A_EMAIL && A_PASSWORD);
const MARKER = `p5-${Date.now()}`;

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const newSlug = () =>
  Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

describe.skipIf(!configured)('Spec 5 client portal RLS — positive space', () => {
  let svc: SupabaseClient;
  let member: SupabaseClient;
  let memberId = '';
  let contactId = '';
  let portal: TestClientAccount | undefined;
  let OWNED = '';    // campaign linked to the client's contact
  let ORPHAN = '';   // campaign with deal_id NULL — invisible to every client
  const seededSlugs: string[] = [];

  beforeAll(async () => {
    svc = createClient(URL!, SERVICE!, { auth: { persistSession: false, autoRefreshToken: false } });

    member = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await member.auth.signInWithPassword({ email: A_EMAIL!, password: A_PASSWORD! });
    if (signedIn.error) throw new Error(`member sign-in failed: ${signedIn.error.message}`);
    memberId = signedIn.data.user!.id;

    const contact = await member
      .from('contacts')
      .insert({ owner_id: memberId, company: `${MARKER} Sponsor` })
      .select('id')
      .single();
    if (contact.error) throw new Error(`contact insert failed: ${contact.error.message}`);
    contactId = contact.data!.id;

    portal = await createTestClient(svc, URL!, ANON!, { contactId, marker: MARKER });

    const deal = await member
      .from('deals')
      .insert({ contact_id: contactId, title: `${MARKER} deal` })
      .select('id')
      .single();
    if (deal.error) throw new Error(`deal insert failed: ${deal.error.message}`);

    OWNED = newSlug();
    ORPHAN = newSlug();
    seededSlugs.push(OWNED, ORPHAN);

    const camps = await svc.from('qr_campaigns').insert([
      {
        slug: OWNED,
        sponsor_name: `${MARKER} Sponsor`,
        destination_url: 'https://offre.example',
        active: true,
        deal_id: deal.data!.id,
        distributed_count: 500,
        invested_amount_eur: 1200,
        venue: 'Rex Club',
      },
      {
        slug: ORPHAN,
        sponsor_name: `${MARKER} Orphan`,
        destination_url: 'https://orphan.example',
        active: true,
        deal_id: null,
      },
    ]);
    if (camps.error) throw new Error(`campaign seed failed: ${camps.error.message}`);

    const leadsSeed = await svc.from('leads').insert([
      { campaign_slug: OWNED, first_name: 'Marie', email: `marie-${MARKER}@x.fr` },
      { campaign_slug: ORPHAN, first_name: 'Orphan', email: `orphan-${MARKER}@x.fr` },
    ]);
    if (leadsSeed.error) throw new Error(`leads seed failed: ${leadsSeed.error.message}`);

    const scanSeed = await svc.from('qr_scans').insert([
      { campaign_slug: OWNED, is_bot: false, visitor_hash: 'v1' },
      { campaign_slug: OWNED, is_bot: false, visitor_hash: 'v2' },
      { campaign_slug: OWNED, is_bot: false, visitor_hash: 'v2' }, // repeat → still 2 uniques
      { campaign_slug: OWNED, is_bot: true, visitor_hash: 'bot1' }, // bot: excluded everywhere
    ]);
    if (scanSeed.error) throw new Error(`scan seed failed: ${scanSeed.error.message}`);

    const funnelSeed = await svc.from('funnel_events').insert([
      { campaign_slug: OWNED, kind: 'form_view', visitor_hash: 'h1' },
      { campaign_slug: OWNED, kind: 'form_view', visitor_hash: 'h2' },
      { campaign_slug: OWNED, kind: 'form_submit', visitor_hash: 'h1' },
      { campaign_slug: OWNED, kind: 'offer_reached', visitor_hash: 'h1' },
    ]);
    if (funnelSeed.error) throw new Error(`funnel seed failed: ${funnelSeed.error.message}`);
  });

  afterAll(async () => {
    if (svc && seededSlugs.length) await svc.from('qr_campaigns').delete().in('slug', seededSlugs);
    await destroyTestClient(svc, portal);
    if (svc && contactId) await svc.from('contacts').delete().eq('id', contactId);
  });

  it('a client reads its OWN client_accounts row', async () => {
    const { data, error } = await portal!.client
      .from('client_accounts')
      .select('id, contact_id, active, must_change_password');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    expect(data![0].contact_id).toBe(contactId);
  });

  it('a member reads client_accounts (the CRM must show who has access)', async () => {
    const { data, error } = await member.from('client_accounts').select('id').eq('contact_id', contactId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it('anon reads no client_accounts row', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await anon.from('client_accounts').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('current_client_contact resolves to the linked contact; is_client is true', async () => {
    const contact = await portal!.client.rpc('current_client_contact');
    expect(contact.error).toBeNull();
    expect(contact.data).toBe(contactId);

    const isClient = await portal!.client.rpc('is_client');
    expect(isClient.error).toBeNull();
    expect(isClient.data).toBe(true);
  });

  it('a CRM member is not a client: current_client_contact is null, is_client false', async () => {
    expect((await member.rpc('current_client_contact')).data).toBeNull();
    expect((await member.rpc('is_client')).data).toBe(false);
  });

  it('client_guard raises for a caller who is not a client', async () => {
    const { error } = await member.rpc('client_guard', { p_slug: null });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('accès refusé');
  });

  it('a client sees ONLY campaigns reachable from its contact', async () => {
    const { data, error } = await portal!.client.from('qr_campaigns').select('slug');
    expect(error).toBeNull();
    const slugs = (data ?? []).map((r) => r.slug);
    expect(slugs).toContain(OWNED);
    expect(slugs).not.toContain(ORPHAN);
  });

  it('an unlinked campaign (deal_id NULL) is invisible to every client', async () => {
    const { data } = await portal!.client.from('qr_campaigns').select('slug').eq('slug', ORPHAN);
    expect(data ?? []).toHaveLength(0);
  });

  it('a client reads the leads of its own campaigns only', async () => {
    const { data, error } = await portal!.client.from('leads').select('email, campaign_slug');
    expect(error).toBeNull();
    const slugs = (data ?? []).map((r) => r.campaign_slug);
    expect(slugs).toContain(OWNED);
    expect(slugs).not.toContain(ORPHAN);
  });

  it('the new campaign columns are readable by the owning client', async () => {
    const { data, error } = await portal!.client
      .from('qr_campaigns')
      .select('invested_amount_eur, venue')
      .eq('slug', OWNED)
      .single();
    expect(error).toBeNull();
    expect(Number(data!.invested_amount_eur)).toBe(1200);
    expect(data!.venue).toBe('Rex Club');
  });

  it('client_campaigns returns the client\'s campaigns with rollups, bots excluded', async () => {
    const { data, error } = await portal!.client.rpc('client_campaigns');
    expect(error).toBeNull();
    const rows = data as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.slug)).toContain(OWNED);
    expect(rows.map((r) => r.slug)).not.toContain(ORPHAN);

    const owned = rows.find((r) => r.slug === OWNED)!;
    expect(Number(owned.scans)).toBe(3); // 4 rows minus the bot
    expect(Number(owned.uniques)).toBe(2); // v1, v2
    expect(Number(owned.leads)).toBe(1);
    expect(Number(owned.distributed_count)).toBe(500);
    expect(Number(owned.invested_amount_eur)).toBe(1200);
    expect(owned.venue).toBe('Rex Club');
  });

  it('client_funnel returns the five lifetime stage counts', async () => {
    const { data, error } = await portal!.client.rpc('client_funnel', { p_slug: OWNED });
    expect(error).toBeNull();
    const f = (data as Array<Record<string, unknown>>)[0];
    expect(Number(f.distribues)).toBe(500);
    expect(Number(f.scannes)).toBe(2); // distinct non-bot visitor_hash
    expect(Number(f.formulaire_vu)).toBe(2);
    expect(Number(f.formulaire_soumis)).toBe(1);
    expect(Number(f.offre_atteinte)).toBe(1);
  });

  it('client_funnel refuses a campaign the caller does not own', async () => {
    const { error } = await portal!.client.rpc('client_funnel', { p_slug: ORPHAN });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('accès refusé');
  });

  it('a member calling a client RPC is refused', async () => {
    const { error } = await member.rpc('client_campaigns');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('accès refusé');
  });

  it('client_scans_daily buckets by day and excludes bots', async () => {
    const { data, error } = await portal!.client.rpc('client_scans_daily', {
      p_from: '2000-01-01T00:00:00Z',
      p_to: '2100-01-01T00:00:00Z',
      p_slug: OWNED,
    });
    expect(error).toBeNull();
    const rows = data as Array<Record<string, unknown>>;
    const totalScans = rows.reduce((n, r) => n + Number(r.scans), 0);
    const totalLeads = rows.reduce((n, r) => n + Number(r.leads), 0);
    expect(totalScans).toBe(3); // the bot row is excluded
    expect(totalLeads).toBe(1);
  });

  it('client_scans_hourly buckets in Europe/Paris, not UTC (DST-safe)', async () => {
    // 2026-07-03T22:30:00Z is FRIDAY 22:30 UTC but SATURDAY 00:30 in Paris (UTC+2).
    // A UTC bucket would say vendredi 22h; the correct answer is samedi 0h.
    const dstSlug = OWNED;
    await svc.from('qr_scans').insert({
      campaign_slug: dstSlug,
      is_bot: false,
      visitor_hash: 'dst-1',
      scanned_at: '2026-07-03T22:30:00Z',
    });

    const { data, error } = await portal!.client.rpc('client_scans_hourly', {
      p_from: '2026-07-03T00:00:00Z',
      p_to: '2026-07-05T00:00:00Z',
      p_slug: dstSlug,
    });
    expect(error).toBeNull();
    const rows = data as Array<{ dow: number; hour: number; scans: number }>;
    const saturdayMidnight = rows.find((r) => Number(r.dow) === 6 && Number(r.hour) === 0);
    expect(saturdayMidnight, 'expected a samedi 0h bucket (Paris), not vendredi 22h (UTC)').toBeDefined();
    expect(rows.find((r) => Number(r.dow) === 5 && Number(r.hour) === 22)).toBeUndefined();
  });

  it('client_scans_daily refuses a campaign the caller does not own', async () => {
    const { error } = await portal!.client.rpc('client_scans_daily', {
      p_from: '2000-01-01T00:00:00Z',
      p_to: '2100-01-01T00:00:00Z',
      p_slug: ORPHAN,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('accès refusé');
  });

  it('client_scans_geo groups by the requested level and labels unknowns', async () => {
    await svc.from('qr_scans').insert([
      { campaign_slug: OWNED, is_bot: false, visitor_hash: 'g1', country: 'FR', city: 'Paris' },
      { campaign_slug: OWNED, is_bot: false, visitor_hash: 'g2', country: 'FR', city: 'Paris' },
      { campaign_slug: OWNED, is_bot: false, visitor_hash: 'g3', country: 'FR', city: 'Lyon' },
    ]);

    const byCity = await portal!.client.rpc('client_scans_geo', {
      p_from: '2000-01-01T00:00:00Z',
      p_to: '2100-01-01T00:00:00Z',
      p_slug: OWNED,
      p_level: 'city',
    });
    expect(byCity.error).toBeNull();
    const cities = byCity.data as Array<{ label: string; scans: number }>;
    expect(cities.find((r) => r.label === 'Paris')).toBeDefined();
    expect(Number(cities.find((r) => r.label === 'Paris')!.scans)).toBe(2);
    expect(cities.find((r) => r.label === 'Inconnu')).toBeDefined(); // the earlier city-less scans

    const byVenue = await portal!.client.rpc('client_scans_geo', {
      p_from: '2000-01-01T00:00:00Z',
      p_to: '2100-01-01T00:00:00Z',
      p_slug: OWNED,
      p_level: 'venue',
    });
    expect((byVenue.data as Array<{ label: string }>).map((r) => r.label)).toContain('Rex Club');
  });

  it('client_scans_geo rejects an invalid level rather than returning nothing', async () => {
    const { error } = await portal!.client.rpc('client_scans_geo', {
      p_from: '2000-01-01T00:00:00Z',
      p_to: '2100-01-01T00:00:00Z',
      p_slug: OWNED,
      p_level: 'planet',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('niveau invalide');
  });

  it('client_scans_tech returns one row per dimension value', async () => {
    await svc.from('qr_scans').insert([
      { campaign_slug: OWNED, is_bot: false, visitor_hash: 't1', device_type: 'mobile', os: 'iOS', browser: 'Safari', language: 'fr' },
      { campaign_slug: OWNED, is_bot: false, visitor_hash: 't2', device_type: 'mobile', os: 'iOS', browser: 'Safari', language: 'fr' },
    ]);
    const { data, error } = await portal!.client.rpc('client_scans_tech', {
      p_from: '2000-01-01T00:00:00Z',
      p_to: '2100-01-01T00:00:00Z',
      p_slug: OWNED,
    });
    expect(error).toBeNull();
    const rows = data as Array<{ dimension: string; label: string; scans: number }>;
    expect(new Set(rows.map((r) => r.dimension))).toEqual(
      new Set(['device_type', 'os', 'browser', 'language']),
    );
    const ios = rows.find((r) => r.dimension === 'os' && r.label === 'iOS')!;
    expect(Number(ios.scans)).toBe(2);
  });

  it('client_overview returns a current and a previous bucket', async () => {
    const { data, error } = await portal!.client.rpc('client_overview', {
      p_from: '2000-01-01T00:00:00Z',
      p_to: '2100-01-01T00:00:00Z',
      p_prev_from: '1990-01-01T00:00:00Z',
      p_prev_to: '2000-01-01T00:00:00Z',
      p_slug: OWNED,
    });
    expect(error).toBeNull();
    const rows = data as Array<{ bucket: string; scans: number; leads: number }>;
    expect(rows.map((r) => r.bucket).sort()).toEqual(['current', 'previous']);
    expect(Number(rows.find((r) => r.bucket === 'current')!.leads)).toBe(1);
    expect(Number(rows.find((r) => r.bucket === 'previous')!.scans)).toBe(0);
  });

  it('client_mark_login stamps last_login_at on the caller\'s own row only', async () => {
    const { error } = await portal!.client.rpc('client_mark_login');
    expect(error).toBeNull();

    const { data } = await svc
      .from('client_accounts')
      .select('last_login_at')
      .eq('auth_user_id', portal!.authUserId)
      .single();
    expect(data!.last_login_at).not.toBeNull();
  });

  it('client_mark_password_changed clears must_change_password for the caller', async () => {
    await svc
      .from('client_accounts')
      .update({ must_change_password: true })
      .eq('auth_user_id', portal!.authUserId);

    const { error } = await portal!.client.rpc('client_mark_password_changed');
    expect(error).toBeNull();

    const { data } = await svc
      .from('client_accounts')
      .select('must_change_password')
      .eq('auth_user_id', portal!.authUserId)
      .single();
    expect(data!.must_change_password).toBe(false);
  });

  it('a member calling the session RPCs changes nothing', async () => {
    const before = await svc
      .from('client_accounts')
      .select('must_change_password')
      .eq('auth_user_id', portal!.authUserId)
      .single();

    await member.rpc('client_mark_password_changed'); // no row matches auth.uid()

    const after = await svc
      .from('client_accounts')
      .select('must_change_password')
      .eq('auth_user_id', portal!.authUserId)
      .single();
    expect(after.data!.must_change_password).toBe(before.data!.must_change_password);
  });
});
