/**
 * Foundation RLS integration test (Spec 1A, migration 0001).
 *
 * Proves the contact-level ownership truth table directly against Postgres RLS:
 *   - any member can READ all contacts ("view everyone")
 *   - a member can INSERT only rows owned by themselves
 *   - only the OWNER can UPDATE/DELETE a contact
 *   - anon sees nothing
 *
 * This is the most important safety net in the foundation. Run it in CI on every
 * change to 0001_foundation.sql or its policies.
 *
 * ── How to run ────────────────────────────────────────────────────────────────
 * 1. Apply supabase/migrations/0001_foundation.sql to a (test) Supabase project.
 * 2. Ensure TWO member accounts exist in auth.users with known passwords and that
 *    the profiles seed picked them up (use two of the allow-listed emails, or add
 *    the test emails to public.is_cupdom_member()'s allowlist in the test project).
 * 3. Provide these env vars (e.g. in .env.test, never committed):
 *      SUPABASE_URL                     (or NEXT_PUBLIC_SUPABASE_URL)
 *      SUPABASE_ANON_KEY                (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *      TEST_MEMBER_A_EMAIL / TEST_MEMBER_A_PASSWORD
 *      TEST_MEMBER_B_EMAIL / TEST_MEMBER_B_PASSWORD
 * 4. pnpm test:rls
 *
 * If the env vars are absent the suite is SKIPPED (so unit CI stays green without
 * a live database).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const A_EMAIL = process.env.TEST_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.TEST_MEMBER_A_PASSWORD;
const B_EMAIL = process.env.TEST_MEMBER_B_EMAIL;
const B_PASSWORD = process.env.TEST_MEMBER_B_PASSWORD;

const configured = Boolean(URL && ANON && A_EMAIL && A_PASSWORD && B_EMAIL && B_PASSWORD);

async function signIn(email: string, password: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!configured)('foundation RLS — contact-level ownership', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = '';
  let bId = '';
  const createdIds: string[] = [];

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    ({ client: b, userId: bId } = await signIn(B_EMAIL!, B_PASSWORD!));
  });

  afterAll(async () => {
    // Each owner deletes their own seed rows (delete is owner-gated by RLS).
    for (const client of [a, b]) {
      if (client) await client.from('contacts').delete().in('id', createdIds);
    }
  });

  it('A can insert a contact owned by A', async () => {
    const { data, error } = await a
      .from('contacts')
      .insert({ owner_id: aId, company: 'RLS Test A', first_name: 'A' })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data?.id) createdIds.push(data.id);
  });

  it('A cannot insert a contact owned by B (with check)', async () => {
    const { data, error } = await a
      .from('contacts')
      .insert({ owner_id: bId, company: 'Forged owner' })
      .select('id');
    expect(error).not.toBeNull(); // RLS with-check violation
    expect(data).toBeNull();
  });

  it('B can read A’s contact (view-everyone)', async () => {
    const id = createdIds[0];
    const { data, error } = await b.from('contacts').select('id, company').eq('id', id).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(id);
  });

  it('B cannot update A’s contact (0 rows, not owner)', async () => {
    const id = createdIds[0];
    const { data } = await b
      .from('contacts')
      .update({ company: 'hijacked' })
      .eq('id', id)
      .select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('B cannot delete A’s contact (0 rows, not owner)', async () => {
    const id = createdIds[0];
    const { data } = await b.from('contacts').delete().eq('id', id).select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('A can update its own contact', async () => {
    const id = createdIds[0];
    const { data, error } = await a
      .from('contacts')
      .update({ company: 'RLS Test A (edited)' })
      .eq('id', id)
      .select('id, company')
      .single();
    expect(error).toBeNull();
    expect(data?.company).toBe('RLS Test A (edited)');
  });

  it('anon sees no contacts', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { data } = await anon.from('contacts').select('id');
    expect(data ?? []).toHaveLength(0);
  });
});
