/**
 * Lead GDPR retention / erasure / purge RLS+RPC integration test (Spec 3B, migration 0008).
 *
 * Proves: erase_lead owner gate (owner ok / non-owner raises / anon denied); run_lead_anonymisation
 * nulls PII past 36 months while KEEPING the row + funnel counts; a refreshed last_activity_at defers
 * anonymisation (AC-17); run_contact_purge removes a purged contact's leads' PII but retains the
 * qr_scans aggregates and the (now detached) qr_campaigns row; cron-only functions are not callable
 * by authenticated.
 *
 * Requires migrations 0001+0002+0005+0006+0007+0008 + the member env + the service-role key.
 *   SUPABASE_URL / SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)
 *   TEST_MEMBER_A_EMAIL / TEST_MEMBER_A_PASSWORD
 *   TEST_MEMBER_B_EMAIL / TEST_MEMBER_B_PASSWORD
 *   SUPABASE_SERVICE_ROLE_KEY
 * Skipped when absent. Run: pnpm test:rls
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
const MARKER = `3B-RLS ${Date.now()}`;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const slug = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const monthsAgo = (m: number) => new Date(Date.now() - m * 30 * 24 * 3600_000).toISOString();

async function signIn(email: string, password: string) {
  const client = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

const PII = { first_name: 'Marie', last_name: 'Curie', email: 'marie@x.fr', phone: '0612345678' };

describe.skipIf(!configured || !SERVICE)('3B lead GDPR retention/erasure/purge', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let svc: SupabaseClient;
  let aId = '';
  const slugs: string[] = [];

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    ({ client: b } = await signIn(B_EMAIL!, B_PASSWORD!));
    svc = createClient(URL!, SERVICE!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  afterAll(async () => {
    await svc.from('qr_campaigns').delete().in('slug', slugs); // cascades leads/funnel
    if (a) await a.from('contacts').delete().like('company', `${MARKER}%`);
  });

  /** A-owned contact → deal → active campaign; returns the campaign slug + the contact id. */
  async function seedCampaign(): Promise<{ s: string; contactId: string }> {
    const { data: ka } = await a
      .from('contacts')
      .insert({ owner_id: aId, company: `${MARKER} ${Math.random().toString(36).slice(2, 7)}` })
      .select('id')
      .single();
    const { data: da } = await a.from('deals').insert({ contact_id: ka!.id, title: MARKER }).select('id').single();
    const s = slug();
    slugs.push(s);
    await svc
      .from('qr_campaigns')
      .insert({ slug: s, sponsor_name: MARKER, destination_url: 'https://offer.example', active: true, deal_id: da!.id });
    return { s, contactId: ka!.id };
  }

  async function seedLead(s: string, extra: Record<string, unknown> = {}): Promise<string> {
    const { data } = await svc.from('leads').insert({ campaign_slug: s, ...PII, ...extra }).select('id').single();
    return data!.id as string;
  }

  it('erase_lead: owner nulls the four PII columns, keeps the row + funnel (AC-15)', async () => {
    const { s } = await seedCampaign();
    const lead = await seedLead(s);
    await svc.from('funnel_events').insert({ campaign_slug: s, kind: 'form_view', visitor_hash: 'h1' });

    expect((await a.rpc('erase_lead', { p_lead: lead })).error).toBeNull();

    const { data: row } = await svc.from('leads').select('*').eq('id', lead).single();
    expect(row!.first_name).toBeNull();
    expect(row!.last_name).toBeNull();
    expect(row!.email).toBeNull();
    expect(row!.phone).toBeNull();
    const funnel = await svc.from('funnel_events').select('id').eq('campaign_slug', s);
    expect(funnel.data ?? []).toHaveLength(1); // anonymous counts retained
  });

  it('erase_lead: a non-owner is refused and the PII is untouched', async () => {
    const { s } = await seedCampaign();
    const lead = await seedLead(s);
    expect((await b.rpc('erase_lead', { p_lead: lead })).error).not.toBeNull(); // insufficient_privilege
    const { data: row } = await svc.from('leads').select('first_name').eq('id', lead).single();
    expect(row!.first_name).toBe('Marie');
  });

  it('erase_lead: anon is denied (no grant)', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const res = await anon.rpc('erase_lead', { p_lead: '00000000-0000-0000-0000-000000000000' });
    expect(res.error).not.toBeNull();
  });

  it('run_lead_anonymisation: past 36 months → PII nulled, row + funnel kept (AC-16)', async () => {
    const { s } = await seedCampaign();
    const old = await seedLead(s, { last_activity_at: monthsAgo(37) });
    await svc.from('funnel_events').insert({ campaign_slug: s, kind: 'form_submit', visitor_hash: 'h2' });

    const res = await svc.rpc('run_lead_anonymisation');
    expect(res.error).toBeNull();
    expect(res.data as number).toBeGreaterThanOrEqual(1);

    const { data: row } = await svc.from('leads').select('*').eq('id', old).single();
    expect(row).not.toBeNull(); // row retained
    expect(row!.email).toBeNull();
    expect((await svc.from('funnel_events').select('id').eq('campaign_slug', s)).data ?? []).toHaveLength(1);
  });

  it('run_lead_anonymisation: a refreshed last_activity_at defers anonymisation (AC-17)', async () => {
    const { s } = await seedCampaign();
    const fresh = await seedLead(s, { last_activity_at: monthsAgo(40) });
    await svc.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', fresh); // simulate 3A resubmit
    await svc.rpc('run_lead_anonymisation');
    const { data: row } = await svc.from('leads').select('first_name').eq('id', fresh).single();
    expect(row!.first_name).toBe('Marie'); // inside the window → retained
  });

  it('run_contact_purge: a purged contact loses its leads but keeps campaign + scan aggregates (AC-18)', async () => {
    const { s, contactId } = await seedCampaign();
    await seedLead(s);
    await svc.from('qr_scans').insert([
      { campaign_slug: s, is_bot: false, visitor_hash: 'sc1' },
      { campaign_slug: s, is_bot: false, visitor_hash: 'sc2' },
    ]);
    // back-date the contact so it is due for purge
    await svc.from('contacts').update({ archived_at: monthsAgo(2), purge_after: monthsAgo(1) }).eq('id', contactId);

    expect((await svc.rpc('run_contact_purge')).error).toBeNull();

    // leads gone; campaign detached but alive; scans retained.
    expect((await svc.from('leads').select('id').eq('campaign_slug', s)).data ?? []).toHaveLength(0);
    const { data: camp } = await svc.from('qr_campaigns').select('deal_id').eq('slug', s).single();
    expect(camp!.deal_id).toBeNull();
    expect((await svc.from('qr_scans').select('id').eq('campaign_slug', s)).data ?? []).toHaveLength(2);
  });

  it('cron-only functions are not callable by an authenticated member', async () => {
    expect((await a.rpc('run_lead_anonymisation')).error).not.toBeNull();
    expect((await a.rpc('run_contact_purge')).error).not.toBeNull();
  });
});
