/**
 * Deals / history / transfer / derived-status RLS integration test (Spec 1B, migration 0002).
 *
 * Proves contact-level ownership for SUB-RECORDS (effective owner = the parent
 * contact's owner via owns_contact), the append-only history timeline, the
 * deal_stage auto-log trigger, the transfer_contact RPC, and the
 * contacts_with_status derived statut. Run in CI on every change to 0002_deals.sql.
 *
 * Requires migrations 0001 + 0002 applied and the same env as foundation.rls.test.ts:
 *   SUPABASE_URL / SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)
 *   TEST_MEMBER_A_EMAIL / TEST_MEMBER_A_PASSWORD
 *   TEST_MEMBER_B_EMAIL / TEST_MEMBER_B_PASSWORD
 * Skipped when absent. Run: pnpm test:rls
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
const MARKER = `1B-RLS ${Date.now()}`;

async function signIn(email: string, password: string) {
  const client = createClient(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

describe.skipIf(!configured)('1B deals/history/transfer RLS', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = '';
  let bId = '';

  beforeAll(async () => {
    ({ client: a, userId: aId } = await signIn(A_EMAIL!, A_PASSWORD!));
    ({ client: b, userId: bId } = await signIn(B_EMAIL!, B_PASSWORD!));
  });

  afterAll(async () => {
    // Each member deletes its own marker contacts (sub-records cascade). Run both
    // because transfers may have moved a contact between owners.
    for (const client of [a, b]) {
      if (client) await client.from('contacts').delete().like('company', `${MARKER}%`);
    }
  });

  it('deals insert is gated by owns_contact', async () => {
    const ka = await makeContact(a, aId);
    const ok = await a.from('deals').insert({ contact_id: ka, title: 'D1' }).select('id').single();
    expect(ok.error).toBeNull();

    const forged = await a.from('deals').insert({ contact_id: await makeContact(b, bId), title: 'X' });
    expect(forged.error).not.toBeNull(); // KB owned by B → with-check fails
  });

  it('deals are readable by any member but writable only by the owner', async () => {
    const ka = await makeContact(a, aId);
    const { data: deal } = await a.from('deals').insert({ contact_id: ka, title: 'Read' }).select('id').single();

    const read = await b.from('deals').select('id').eq('id', deal!.id).single();
    expect(read.error).toBeNull(); // view-everyone

    const upd = await b.from('deals').update({ stage: 'PERDU' }).eq('id', deal!.id).select('id');
    expect(upd.data ?? []).toHaveLength(0); // not owner

    const del = await b.from('deals').delete().eq('id', deal!.id).select('id');
    expect(del.data ?? []).toHaveLength(0);

    const own = await a.from('deals').update({ stage: 'PROPOSITION' }).eq('id', deal!.id).select('id').single();
    expect(own.error).toBeNull();
  });

  it('contact_history is append-only and owner-gated, and deal stage changes auto-log', async () => {
    const ka = await makeContact(a, aId);
    const { data: deal } = await a.from('deals').insert({ contact_id: ka, title: 'Log' }).select('id').single();
    await a.from('deals').update({ stage: 'NÉGOCIATION' }).eq('id', deal!.id);

    const { data: rows } = await a
      .from('contact_history')
      .select('id, kind, summary')
      .eq('contact_id', ka)
      .eq('kind', 'deal_stage');
    expect((rows ?? []).length).toBeGreaterThanOrEqual(2); // create + stage change

    // append-only: no update/delete
    const hid = rows![0].id;
    const upd = await a.from('contact_history').update({ summary: 'tamper' }).eq('id', hid).select('id');
    expect(upd.data ?? []).toHaveLength(0);

    // owner-gated insert: A cannot log on B's contact
    const kb = await makeContact(b, bId);
    const forged = await a.from('contact_history').insert({ contact_id: kb, kind: 'contact_edit', summary: 'x' });
    expect(forged.error).not.toBeNull();
  });

  it('transfer_contact re-points ownership, logs it, and rejects non-owners / bad recipients', async () => {
    const ka = await makeContact(a, aId);
    const { data: deal } = await a.from('deals').insert({ contact_id: ka, title: 'T' }).select('id').single();

    const ok = await a.rpc('transfer_contact', { p_contact: ka, p_new_owner: bId });
    expect(ok.error).toBeNull();

    const { data: c } = await a.from('contacts').select('owner_id').eq('id', ka).single();
    expect(c!.owner_id).toBe(bId);

    const { data: hist } = await a
      .from('contact_history')
      .select('id')
      .eq('contact_id', ka)
      .eq('kind', 'transfer');
    expect((hist ?? []).length).toBeGreaterThanOrEqual(1);

    // B now owns it: B can edit the deal, A cannot.
    const bEdit = await b.from('deals').update({ stage: 'GAGNÉ' }).eq('id', deal!.id).select('id').single();
    expect(bEdit.error).toBeNull();
    const aEdit = await a.from('deals').update({ stage: 'PERDU' }).eq('id', deal!.id).select('id');
    expect(aEdit.data ?? []).toHaveLength(0);

    // not owner → raises
    const kb = await makeContact(b, bId);
    const notOwner = await a.rpc('transfer_contact', { p_contact: kb, p_new_owner: aId });
    expect(notOwner.error).not.toBeNull();

    // invalid recipient → raises
    const ka2 = await makeContact(a, aId);
    const badRecipient = await a.rpc('transfer_contact', {
      p_contact: ka2,
      p_new_owner: '00000000-0000-0000-0000-000000000000',
    });
    expect(badRecipient.error).not.toBeNull();
  });

  it('contacts_with_status derives statut from deals', async () => {
    const statutOf = async (id: string) => {
      const { data } = await a.from('contacts_with_status').select('statut').eq('id', id).single();
      return data?.statut as string;
    };

    const prospect = await makeContact(a, aId);
    expect(await statutOf(prospect)).toBe('Prospect');

    const enCours = await makeContact(a, aId);
    await a.from('deals').insert({ contact_id: enCours, stage: 'NÉGOCIATION' });
    expect(await statutOf(enCours)).toBe('En cours');

    const client = await makeContact(a, aId);
    await a.from('deals').insert([
      { contact_id: client, stage: 'GAGNÉ' },
      { contact_id: client, stage: 'NÉGOCIATION' },
    ]);
    expect(await statutOf(client)).toBe('Client'); // GAGNÉ wins

    const perdu = await makeContact(a, aId);
    await a.from('deals').insert({ contact_id: perdu, stage: 'PERDU' });
    expect(await statutOf(perdu)).toBe('Perdu');
  });

  it('anon cannot read deals/history or call transfer', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false } });
    expect((await anon.from('deals').select('id')).data ?? []).toHaveLength(0);
    expect((await anon.from('contact_history').select('id')).data ?? []).toHaveLength(0);
    const rpc = await anon.rpc('transfer_contact', {
      p_contact: '00000000-0000-0000-0000-000000000000',
      p_new_owner: '00000000-0000-0000-0000-000000000000',
    });
    expect(rpc.error).not.toBeNull();
  });
});
