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
});
