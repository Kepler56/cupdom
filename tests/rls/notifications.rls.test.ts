/**
 * Notifications RLS integration test (Spec 1D, migration 0004).
 *
 * Proves AC-42: a member reads/updates ONLY their own notifications, never a colleague's;
 * rows are created only by SECURITY DEFINER evaluators / the service role (no direct insert).
 *
 * Requires 0001–0004 applied + the foundation env, plus SUPABASE_SERVICE_ROLE_KEY
 * (to seed notification rows, which authenticated members cannot insert).
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

const configured = Boolean(URL && ANON && SERVICE && A_EMAIL && A_PASSWORD && B_EMAIL && B_PASSWORD);
const MARKER = `1D-RLS ${Date.now()}`;

async function signIn(email: string, password: string) {
  const client = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!configured)('1D notifications RLS', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let admin: SupabaseClient;
  let aId = '';
  let bId = '';
  let ka = '';

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    ({ client: b, userId: bId } = await signIn(B_EMAIL!, B_PASSWORD!));
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const { data } = await a
      .from('contacts')
      .insert({ owner_id: aId, company: `${MARKER}` })
      .select('id')
      .single();
    ka = data!.id as string;
  });

  afterAll(async () => {
    await admin.from('notifications').delete().in('recipient_id', [aId, bId]).eq('contact_id', ka);
    await a.from('contacts').delete().like('company', `${MARKER}%`);
  });

  async function seedNotif(recipientId: string): Promise<string> {
    // notifications_open_unique forbids two OPEN (unread) rows for the same
    // (recipient_id, type, contact_id). Three tests below each seed the same
    // triple, and the first leaves its row unread — so without clearing the
    // prior open row first, seeds 2 and 3 violate the constraint. The
    // constraint is correct; the seed has to respect it.
    await admin
      .from('notifications')
      .delete()
      .eq('recipient_id', recipientId)
      .eq('type', 'task_overdue')
      .eq('contact_id', ka)
      .is('read_at', null);

    const { data, error } = await admin
      .from('notifications')
      .insert({ recipient_id: recipientId, type: 'task_overdue', contact_id: ka, payload: { kind: 'task_overdue' } })
      .select('id')
      .single();
    if (error) throw new Error(`seed notif failed: ${error.message}`);
    return data.id as string;
  }

  it('a member reads only their own notifications (AC-42)', async () => {
    const id = await seedNotif(aId);
    expect((await a.from('notifications').select('id').eq('id', id).maybeSingle()).data?.id).toBe(id);
    expect((await b.from('notifications').select('id').eq('id', id).maybeSingle()).data).toBeNull();
  });

  it('a member updates only their own (mark read)', async () => {
    const id = await seedNotif(aId);
    expect((await b.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).select('id')).data ?? []).toHaveLength(0);
    const own = await a.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).select('read_at').single();
    expect(own.data!.read_at).not.toBeNull();
  });

  it('authenticated members cannot directly insert notifications', async () => {
    const res = await a.from('notifications').insert({ recipient_id: aId, type: 'task_overdue', contact_id: ka, payload: {} });
    expect(res.error).not.toBeNull();
  });

  it('mark_notification_read is self-scoped', async () => {
    const id = await seedNotif(aId);
    await b.rpc('mark_notification_read', { p_id: id }); // no-op for B
    expect((await admin.from('notifications').select('read_at').eq('id', id).single()).data!.read_at).toBeNull();
    await a.rpc('mark_notification_read', { p_id: id });
    expect((await admin.from('notifications').select('read_at').eq('id', id).single()).data!.read_at).not.toBeNull();
  });

  it('refresh_my_notifications evaluates only the caller and returns a count', async () => {
    // Seed a reminder due today on A's contact, then refresh.
    await a.from('reminders').insert({ contact_id: ka, remind_on: new Date().toISOString().slice(0, 10) });
    const res = await a.rpc('refresh_my_notifications');
    expect(res.error).toBeNull();
    expect(typeof res.data).toBe('number');
    // Any rows created belong to A only.
    const { data } = await admin.from('notifications').select('recipient_id').eq('contact_id', ka);
    for (const row of data ?? []) expect(row.recipient_id).toBe(aId);
  });
});
