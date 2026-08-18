/**
 * Client-portal RLS integration test (Spec 5, migration 0009) — NEGATIVE SPACE.
 *
 * Everything a portal client must NOT be able to reach. Kept separate from the
 * positive suite so the security boundary reads as one file. Each assertion is a
 * claim we would otherwise merely be trusting (Spec §7.2).
 *
 * Requires migrations 0001+0002+0006+0007+0009, the member env and the service-role key.
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
const MARKER = `p5iso-${Date.now()}`;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const newSlug = () =>
  Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

describe.skipIf(!configured)('Spec 5 client portal RLS — isolation', () => {
  let svc: SupabaseClient;
  let member: SupabaseClient;
  let memberId = '';

  // Two separate sponsors, each with its own portal login.
  let contactA = '';
  let contactB = '';
  let slugA = '';
  let slugB = '';
  let clientA: TestClientAccount | undefined;
  let clientB: TestClientAccount | undefined;
  let inactive: TestClientAccount | undefined;
  const seededSlugs: string[] = [];

  beforeAll(async () => {
    svc = createClient(URL!, SERVICE!, { auth: { persistSession: false, autoRefreshToken: false } });

    member = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await member.auth.signInWithPassword({ email: A_EMAIL!, password: A_PASSWORD! });
    if (signedIn.error) throw new Error(`member sign-in failed: ${signedIn.error.message}`);
    memberId = signedIn.data.user!.id;

    for (const tag of ['A', 'B'] as const) {
      const contact = await member
        .from('contacts')
        .insert({ owner_id: memberId, company: `${MARKER} ${tag}` })
        .select('id')
        .single();
      if (contact.error) throw new Error(`contact ${tag} insert failed: ${contact.error.message}`);
      const deal = await member
        .from('deals')
        .insert({ contact_id: contact.data!.id, title: `${MARKER} ${tag}` })
        .select('id')
        .single();
      if (deal.error) throw new Error(`deal ${tag} insert failed: ${deal.error.message}`);
      const slug = newSlug();
      seededSlugs.push(slug);
      const campaign = await svc.from('qr_campaigns').insert({
        slug,
        sponsor_name: `${MARKER} ${tag}`,
        destination_url: 'https://offre.example',
        active: true,
        deal_id: deal.data!.id,
        venue: 'ProbeVenue',
      });
      if (campaign.error) throw new Error(`campaign ${tag} insert failed: ${campaign.error.message}`);
      const lead = await svc.from('leads').insert({ campaign_slug: slug, email: `lead-${tag}-${MARKER}@x.fr` });
      if (lead.error) throw new Error(`lead ${tag} insert failed: ${lead.error.message}`);
      const scan = await svc.from('qr_scans').insert({ campaign_slug: slug, is_bot: false, visitor_hash: `v-${tag}` });
      if (scan.error) throw new Error(`scan ${tag} insert failed: ${scan.error.message}`);

      if (tag === 'A') {
        contactA = contact.data!.id;
        slugA = slug;
      } else {
        contactB = contact.data!.id;
        slugB = slug;
      }
    }

    clientA = await createTestClient(svc, URL!, ANON!, { contactId: contactA, marker: `${MARKER}-a` });
    clientB = await createTestClient(svc, URL!, ANON!, { contactId: contactB, marker: `${MARKER}-b` });
    inactive = await createTestClient(svc, URL!, ANON!, {
      contactId: contactA,
      marker: `${MARKER}-off`,
      active: false,
    });
  });

  afterAll(async () => {
    if (svc && seededSlugs.length) {
      // qr_scans must go first: guard_campaign_delete() raises (and aborts the
      // whole delete...in(...) statement) if a campaign being deleted still has
      // qr_scans rows, which would leave every seeded campaign behind.
      const scansDel = await svc.from('qr_scans').delete().in('campaign_slug', seededSlugs);
      if (scansDel.error) throw new Error(`qr_scans cleanup failed: ${scansDel.error.message}`);
      const campaignsDel = await svc.from('qr_campaigns').delete().in('slug', seededSlugs);
      if (campaignsDel.error) throw new Error(`qr_campaigns cleanup failed: ${campaignsDel.error.message}`);
    }
    await destroyTestClient(svc, clientA);
    await destroyTestClient(svc, clientB);
    await destroyTestClient(svc, inactive);
    if (svc) await svc.from('contacts').delete().like('company', `${MARKER}%`);
  });

  it('client A cannot see client B\'s campaign', async () => {
    const { data } = await clientA!.client.from('qr_campaigns').select('slug').eq('slug', slugB);
    expect(data ?? []).toHaveLength(0);
  });

  it('client A cannot see client B\'s leads', async () => {
    const { data } = await clientA!.client.from('leads').select('id').eq('campaign_slug', slugB);
    expect(data ?? []).toHaveLength(0);
  });

  it('a client cannot read raw qr_scans or funnel_events at all', async () => {
    expect((await clientA!.client.from('qr_scans').select('id')).data ?? []).toHaveLength(0);
    expect((await clientA!.client.from('funnel_events').select('id')).data ?? []).toHaveLength(0);
  });

  it('a client cannot read any CRM table', async () => {
    for (const table of [
      'contacts',
      'deals',
      'crm_data',
      'campaign_events',
      'lead_consents',
      'profiles',
    ]) {
      const { data } = await clientA!.client.from(table).select('*').limit(1);
      expect(data ?? [], `client must not read ${table}`).toHaveLength(0);
    }
  });

  it('a client cannot see another client\'s client_accounts row', async () => {
    const { data } = await clientA!.client.from('client_accounts').select('id, contact_id');
    expect(data ?? []).toHaveLength(1);
    expect(data![0].contact_id).toBe(contactA);
  });

  it('a client has no write path anywhere', async () => {
    // NOTE: RLS enforces INSERT via a WITH CHECK clause that raises 42501, but it
    // enforces UPDATE/DELETE by filtering the target rows to zero — no error, no
    // rows affected. So each probe below asserts the outcome (no error where one
    // is expected, and — always — no actual change via a service-role re-read),
    // not just the presence of an `.error`. "The data did not change" is a
    // strictly stronger guarantee than "an error was raised".

    // leads INSERT — genuinely raises (WITH CHECK), confirm via svc that nothing landed.
    const leadInsert = await clientA!.client.from('leads').insert({ campaign_slug: slugA, email: 'x@y.fr' });
    expect(leadInsert.error, 'client must not be able to insert a lead').not.toBeNull();
    const leadCheck = await svc.from('leads').select('id').eq('campaign_slug', slugA).eq('email', 'x@y.fr');
    expect(leadCheck.data ?? [], 'no lead must have been inserted').toHaveLength(0);

    // qr_campaigns UPDATE — RLS filters to zero rows, no error; confirm via svc.
    const campaignUpdate = await clientA!.client
      .from('qr_campaigns')
      .update({ venue: 'HACKED' })
      .eq('slug', slugA)
      .select('slug');
    expect(campaignUpdate.data ?? [], 'client must not be able to update a campaign').toHaveLength(0);
    const campaignAfter = await svc.from('qr_campaigns').select('venue').eq('slug', slugA).single();
    expect(campaignAfter.error, 'campaign must still exist after the update attempt').toBeNull();
    expect(campaignAfter.data!.venue, 'client must not be able to modify a campaign').toBe('ProbeVenue');

    // client_accounts UPDATE — genuinely raises (WITH CHECK), confirm via svc that nothing changed.
    const accountUpdate = await clientA!.client
      .from('client_accounts')
      .update({ active: true })
      .eq('contact_id', contactA);
    expect(accountUpdate.error, 'client must not be able to update client_accounts').not.toBeNull();
    const accountAfter = await svc.from('client_accounts').select('active').eq('id', clientA!.accountId).single();
    expect(accountAfter.error, 'client_accounts row must still exist after the update attempt').toBeNull();
    expect(accountAfter.data!.active, 'client_accounts row must not have been modified').toBe(true);

    // qr_campaigns DELETE — RLS filters to zero rows, no error; confirm via svc.
    const campaignDelete = await clientA!.client.from('qr_campaigns').delete().eq('slug', slugA).select('slug');
    expect(campaignDelete.data ?? [], 'client must not be able to delete a campaign').toHaveLength(0);
    const campaignStillThere = await svc.from('qr_campaigns').select('slug').eq('slug', slugA).maybeSingle();
    expect(campaignStillThere.error, 'campaign existence check must not error').toBeNull();
    expect(campaignStillThere.data, 'campaign must still exist after the delete attempt').not.toBeNull();
  });

  it('an inactive account resolves to no client and sees nothing', async () => {
    expect((await inactive!.client.rpc('is_client')).data).toBe(false);
    expect((await inactive!.client.from('qr_campaigns').select('slug')).data ?? []).toHaveLength(0);
    expect((await inactive!.client.from('leads').select('id')).data ?? []).toHaveLength(0);
  });

  it('a CRM member gains no client access and is_cupdom_member is false for a client', async () => {
    expect((await member.rpc('is_client')).data).toBe(false);

    // is_cupdom_member() is defined in supabase_sql.md, outside the numbered
    // migrations, so we cannot assume the client role holds EXECUTE on it.
    // Either outcome proves the point: it returns false, or it is not callable.
    const res = await clientA!.client.rpc('is_cupdom_member');
    if (res.error === null) {
      expect(res.data).toBe(false);
    } else {
      expect(res.error.message).toMatch(/permission denied|not find the function/i);
    }
  });
});
