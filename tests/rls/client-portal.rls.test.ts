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

describe.skipIf(!configured)('Spec 5 client portal RLS — positive space', () => {
  let svc: SupabaseClient;
  let member: SupabaseClient;
  let memberId = '';
  let contactId = '';
  let portal: TestClientAccount | undefined;

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
  });

  afterAll(async () => {
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
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { data } = await anon.from('client_accounts').select('id');
    expect(data ?? []).toHaveLength(0);
  });
});
