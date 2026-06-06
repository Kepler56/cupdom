/**
 * Tasks / reminders / links RLS + 90-day cleanup integration test (Spec 1C, migration 0003).
 *
 * Proves sub-record ownership (effective owner = parent contact's owner via owns_contact),
 * the create+contact_history-append owner gate, done_at toggle/reopen, and the
 * cleanup_completed_* logic (deletes >90-day-completed only; reopen resets the clock).
 *
 * Requires 0001+0002+0003 applied + the foundation env. The cleanup cases additionally
 * need SUPABASE_SERVICE_ROLE_KEY (the cleanup_* functions are revoked from authenticated).
 * Skipped when env is absent. Run: pnpm test:rls
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
const MARKER = `1C-RLS ${Date.now()}`;

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

describe.skipIf(!configured)('1C tasks/reminders/links RLS', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = '';
  let bId = '';
  let ka = '';
  let kb = '';

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    ({ client: b, userId: bId } = await signIn(B_EMAIL!, B_PASSWORD!));
    ka = await makeContact(a, aId);
    kb = await makeContact(b, bId);
  });

  afterAll(async () => {
    for (const client of [a, b]) {
      if (client) await client.from('contacts').delete().like('company', `${MARKER}%`);
    }
  });

  it('tasks: insert owner-gated, read-all, update/delete owner-only, done_at toggle', async () => {
    const ok = await a.from('tasks').insert({ contact_id: ka, label: 'T1' }).select('id').single();
    expect(ok.error).toBeNull();
    const taskId = ok.data!.id as string;

    const forged = await a.from('tasks').insert({ contact_id: kb, label: 'X' });
    expect(forged.error).not.toBeNull();

    expect((await b.from('tasks').select('id').eq('id', taskId).single()).error).toBeNull();

    expect((await b.from('tasks').update({ label: 'hijack' }).eq('id', taskId).select('id')).data ?? []).toHaveLength(0);
    expect((await b.from('tasks').delete().eq('id', taskId).select('id')).data ?? []).toHaveLength(0);

    // done_at toggle + reopen
    const done = await a.from('tasks').update({ done_at: new Date().toISOString() }).eq('id', taskId).select('done_at').single();
    expect(done.data!.done_at).not.toBeNull();
    const reopened = await a.from('tasks').update({ done_at: null }).eq('id', taskId).select('done_at').single();
    expect(reopened.data!.done_at).toBeNull();
  });

  it('reminders: insert owner-gated, read-all, update owner-only (many per contact)', async () => {
    const r1 = await a.from('reminders').insert({ contact_id: ka, remind_on: '2026-01-01' }).select('id').single();
    const r2 = await a.from('reminders').insert({ contact_id: ka, remind_on: '2026-02-01' }).select('id').single();
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull(); // many reminders per contact

    expect((await a.from('reminders').insert({ contact_id: kb, remind_on: '2026-01-01' })).error).not.toBeNull();
    expect((await b.from('reminders').update({ note: 'x' }).eq('id', r1.data!.id).select('id')).data ?? []).toHaveLength(0);
  });

  it('contact_links: insert owner-gated, delete owner-only', async () => {
    const l = await a.from('contact_links').insert({ contact_id: ka, label: 'Site', url: 'https://cupdom.fr' }).select('id').single();
    expect(l.error).toBeNull();
    expect((await a.from('contact_links').insert({ contact_id: kb, label: 'X', url: 'https://x.fr' })).error).not.toBeNull();
    expect((await b.from('contact_links').delete().eq('id', l.data!.id).select('id')).data ?? []).toHaveLength(0);
    expect((await a.from('contact_links').delete().eq('id', l.data!.id).select('id')).data ?? []).toHaveLength(1);
  });

  it('history-append is owner-gated for task/reminder/link kinds', async () => {
    for (const kind of ['task', 'reminder', 'link'] as const) {
      const ok = await a.from('contact_history').insert({ contact_id: ka, kind, summary: `${kind} ajouté` });
      expect(ok.error).toBeNull();
      const forged = await a.from('contact_history').insert({ contact_id: kb, kind, summary: 'x' });
      expect(forged.error).not.toBeNull();
    }
  });

  it('anon cannot read the tables', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    expect((await anon.from('tasks').select('id')).data ?? []).toHaveLength(0);
    expect((await anon.from('reminders').select('id')).data ?? []).toHaveLength(0);
    expect((await anon.from('contact_links').select('id')).data ?? []).toHaveLength(0);
  });
});

describe.skipIf(!cleanupConfigured)('1C 90-day cleanup (service role)', () => {
  let a: SupabaseClient;
  let admin: SupabaseClient;
  let aId = '';
  let ka = '';

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    ka = await makeContact(a, aId);
  });

  afterAll(async () => {
    await a.from('contacts').delete().like('company', `${MARKER}%`);
  });

  const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

  it('deletes only completed tasks older than 90 days', async () => {
    await admin.from('tasks').insert([
      { contact_id: ka, label: 'old-done', done_at: daysAgo(100) },
      { contact_id: ka, label: 'recent-done', done_at: daysAgo(10) },
      { contact_id: ka, label: 'not-done', done_at: null },
    ]);
    await admin.rpc('cleanup_completed_tasks');
    const { data } = await admin.from('tasks').select('label').eq('contact_id', ka);
    const labels = (data ?? []).map((r) => r.label);
    expect(labels).not.toContain('old-done');
    expect(labels).toContain('recent-done');
    expect(labels).toContain('not-done');
  });

  it('reopening a >90-day task resets the clock (retained)', async () => {
    const { data } = await admin
      .from('tasks')
      .insert({ contact_id: ka, label: 'reopened', done_at: daysAgo(100) })
      .select('id')
      .single();
    await admin.from('tasks').update({ done_at: null }).eq('id', data!.id); // reopen
    await admin.rpc('cleanup_completed_tasks');
    const after = await admin.from('tasks').select('id').eq('id', data!.id);
    expect((after.data ?? []).length).toBe(1); // retained
  });

  it('authenticated members cannot call cleanup_completed_tasks (revoked)', async () => {
    const res = await a.rpc('cleanup_completed_tasks');
    expect(res.error).not.toBeNull();
  });
});
