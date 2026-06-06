/**
 * Archive / restore / purge RPC integration test (Spec 1E, migration 0005).
 *
 * Proves the owner-gated archive/restore RPCs, the not-archived guard, the
 * cascade-on-purge, anon denial, and that the cron-only functions are not callable
 * by members.
 *
 * Requires 0001–0005 applied + the foundation env; the cascade/cron cases additionally
 * need SUPABASE_SERVICE_ROLE_KEY. Skipped when env is absent. Run: pnpm test:rls
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
const cleanupConfigured = configured && Boolean(SERVICE);
const MARKER = `1E-RLS ${Date.now()}`;

async function signIn(email: string, password: string) {
  const client = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
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

describe.skipIf(!configured)('1E archive/restore RPC', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = '';
  let bId = '';

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    ({ client: b, userId: bId } = await signIn(B_EMAIL!, B_PASSWORD!));
  });
  afterAll(async () => {
    for (const client of [a, b]) {
      if (client) await client.from('contacts').delete().like('company', `${MARKER}%`);
    }
  });

  it('owner archives → archived_at + purge_after + history; non-owner rejected', async () => {
    const ka = await makeContact(a, aId);
    expect((await a.rpc('archive_contact', { p_contact: ka })).error).toBeNull();
    const { data } = await a.from('contacts').select('archived_at, purge_after').eq('id', ka).single();
    expect(data!.archived_at).not.toBeNull();
    expect(data!.purge_after).not.toBeNull();
    const { data: hist } = await a.from('contact_history').select('id').eq('contact_id', ka).eq('kind', 'archive');
    expect((hist ?? []).length).toBeGreaterThanOrEqual(1);

    // B cannot archive/restore A's contact
    expect((await b.rpc('archive_contact', { p_contact: ka })).error).not.toBeNull();
    expect((await b.rpc('restore_contact', { p_contact: ka })).error).not.toBeNull();
  });

  it('owner restores; restoring a non-archived contact is rejected', async () => {
    const ka = await makeContact(a, aId);
    await a.rpc('archive_contact', { p_contact: ka });
    expect((await a.rpc('restore_contact', { p_contact: ka })).error).toBeNull();
    const { data } = await a.from('contacts').select('archived_at').eq('id', ka).single();
    expect(data!.archived_at).toBeNull();
    // already restored → not archived → raises
    expect((await a.rpc('restore_contact', { p_contact: ka })).error).not.toBeNull();
  });

  it('anon cannot call the lifecycle RPCs', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    expect((await anon.rpc('archive_contact', { p_contact: bId })).error).not.toBeNull();
    expect((await anon.rpc('restore_contact', { p_contact: bId })).error).not.toBeNull();
  });
});

describe.skipIf(!cleanupConfigured)('1E purge (service role)', () => {
  let a: SupabaseClient;
  let admin: SupabaseClient;
  let aId = '';

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
  });
  afterAll(async () => {
    await admin.from('contacts').delete().like('company', `${MARKER}%`);
  });

  it('purge deletes a past-due archived contact and cascades its sub-records', async () => {
    const ka = await makeContact(a, aId);
    await a.from('deals').insert({ contact_id: ka, title: 'D' });
    await a.from('tasks').insert({ contact_id: ka, label: 'T' });
    await a.from('reminders').insert({ contact_id: ka, remind_on: '2026-01-01' });
    await a.from('contact_links').insert({ contact_id: ka, label: 'L', url: 'https://x.fr' });

    // archive in the past so it is due for purge
    await admin
      .from('contacts')
      .update({ archived_at: '2026-01-01T00:00:00Z', purge_after: '2026-01-02T00:00:00Z' })
      .eq('id', ka);

    expect((await admin.rpc('run_contact_purge')).error).toBeNull();

    expect((await admin.from('contacts').select('id').eq('id', ka)).data ?? []).toHaveLength(0);
    expect((await admin.from('deals').select('id').eq('contact_id', ka)).data ?? []).toHaveLength(0);
    expect((await admin.from('tasks').select('id').eq('contact_id', ka)).data ?? []).toHaveLength(0);
    expect((await admin.from('reminders').select('id').eq('contact_id', ka)).data ?? []).toHaveLength(0);
    expect((await admin.from('contact_links').select('id').eq('contact_id', ka)).data ?? []).toHaveLength(0);
  });

  it('cron-only functions are not callable by an authenticated member', async () => {
    expect((await a.rpc('run_contact_purge')).error).not.toBeNull();
    expect((await a.rpc('run_purge_warnings')).error).not.toBeNull();
  });
});
