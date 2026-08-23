/**
 * Derived `statut` — three-way parity.
 *
 * The same first-match-wins rule is implemented in THREE places, each for a
 * defensible reason:
 *
 *   1. public.contacts_with_status  (0002)  — the canonical read path
 *   2. public.contact_statut_d()    (0004)  — because a security_invoker view is
 *                                             awkward inside the SECURITY DEFINER
 *                                             batch jobs, and eval_gone_quiet()
 *                                             needs it
 *   3. lib/status.ts#deriveStatut           — optimistic UI before a refetch
 *
 * 0004 calls its copy an "in-sync mirror"; lib/status.ts says "MUST stay in sync
 * with 0002_deals.sql". Nothing enforced either claim until this file.
 *
 * WHY IT MATTERS MORE THAN A COSMETIC BADGE: eval_gone_quiet() only considers
 * contacts whose contact_statut_d() is 'Prospect' or 'En cours'. If the SQL
 * function drifted from the view, whole contacts would silently stop generating
 * gone-quiet notifications while the UI kept showing the old badge — a silent
 * loss of follow-up, not a visible bug.
 *
 * Requires migrations 0001+0002+0004 and the member env:
 *   SUPABASE_URL / SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)
 *   TEST_MEMBER_A_EMAIL / TEST_MEMBER_A_PASSWORD
 * Skipped entirely when that env is absent, same as the rest of this suite.
 * Run: pnpm test:rls
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deriveStatut } from '@/lib/status';
import type { DealStage, Statut } from '@/types/domain';

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const A_EMAIL = process.env.TEST_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.TEST_MEMBER_A_PASSWORD;

const configured = Boolean(URL && ANON && A_EMAIL && A_PASSWORD);
const MARKER = `statut-${Date.now()}`;

/**
 * Every combination that can change the answer, including the ones where order
 * of evaluation is the whole question — a contact holding both GAGNÉ and PERDU
 * must be 'Client', and one holding an open stage alongside PERDU must be
 * 'En cours'.
 */
const CASES: { name: string; stages: DealStage[]; expected: Statut }[] = [
  { name: 'no deals', stages: [], expected: 'Prospect' },
  { name: 'one GAGNÉ', stages: ['GAGNÉ'], expected: 'Client' },
  { name: 'one PERDU', stages: ['PERDU'], expected: 'Perdu' },
  { name: 'all PERDU', stages: ['PERDU', 'PERDU'], expected: 'Perdu' },
  { name: 'one QUALIFICATION', stages: ['QUALIFICATION'], expected: 'En cours' },
  { name: 'one PROPOSITION', stages: ['PROPOSITION'], expected: 'En cours' },
  { name: 'one NÉGOCIATION', stages: ['NÉGOCIATION'], expected: 'En cours' },
  { name: 'GAGNÉ beats an open stage', stages: ['QUALIFICATION', 'GAGNÉ'], expected: 'Client' },
  { name: 'GAGNÉ beats PERDU', stages: ['PERDU', 'GAGNÉ'], expected: 'Client' },
  { name: 'an open stage beats PERDU', stages: ['PERDU', 'PROPOSITION'], expected: 'En cours' },
  { name: 'GAGNÉ beats everything', stages: ['PERDU', 'NÉGOCIATION', 'GAGNÉ'], expected: 'Client' },
];

describe.skipIf(!configured)('derived statut — view / function / TS parity', () => {
  let member: SupabaseClient;
  const created: { id: string; expected: Statut; stages: DealStage[]; name: string }[] = [];

  beforeAll(async () => {
    member = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await member.auth.signInWithPassword({ email: A_EMAIL!, password: A_PASSWORD! });
    if (signedIn.error || !signedIn.data.user) {
      throw new Error(`member sign-in failed: ${signedIn.error?.message}`);
    }
    const ownerId = signedIn.data.user.id;

    for (const c of CASES) {
      const contact = await member
        .from('contacts')
        .insert({ owner_id: ownerId, company: `${MARKER} ${c.name}` })
        .select('id')
        .single();
      if (contact.error) throw new Error(`contact insert failed (${c.name}): ${contact.error.message}`);
      const id = contact.data!.id;

      for (const stage of c.stages) {
        const deal = await member.from('deals').insert({ contact_id: id, stage, title: `${MARKER} ${stage}` });
        if (deal.error) throw new Error(`deal insert failed (${c.name}/${stage}): ${deal.error.message}`);
      }
      created.push({ id, expected: c.expected, stages: c.stages, name: c.name });
    }
  });

  afterAll(async () => {
    // Deals, and the deal_stage history rows the 0002 trigger wrote, cascade
    // from the contact (0002 FKs). Deleting the contacts is the whole cleanup.
    if (created.length) {
      await member.from('contacts').delete().in('id', created.map((c) => c.id));
    }
  });

  it.each(CASES.map((c) => c.name))('contacts_with_status agrees for: %s', async (name) => {
    const row = created.find((c) => c.name === name)!;
    const { data, error } = await member
      .from('contacts_with_status')
      .select('statut')
      .eq('id', row.id)
      .single();
    expect(error).toBeNull();
    expect(data!.statut).toBe(row.expected);
  });

  it.each(CASES.map((c) => c.name))('contact_statut_d() agrees for: %s', async (name) => {
    const row = created.find((c) => c.name === name)!;
    const { data, error } = await member.rpc('contact_statut_d', { p_contact: row.id });
    expect(error).toBeNull();
    expect(data).toBe(row.expected);
  });

  it.each(CASES.map((c) => c.name))('lib/status.ts#deriveStatut agrees for: %s', (name) => {
    const row = created.find((c) => c.name === name)!;
    expect(deriveStatut(row.stages.map((stage) => ({ stage })))).toBe(row.expected);
  });

  it('the view and the function never disagree with each other', async () => {
    // The pairing that actually matters at runtime: eval_gone_quiet() gates on
    // contact_statut_d(), while every screen reads the view. A divergence here
    // silently stops follow-up notifications for the affected contacts.
    for (const row of created) {
      const view = await member.from('contacts_with_status').select('statut').eq('id', row.id).single();
      const fn = await member.rpc('contact_statut_d', { p_contact: row.id });
      expect(view.error).toBeNull();
      expect(fn.error).toBeNull();
      expect(
        fn.data,
        `contact_statut_d() and contacts_with_status disagree for "${row.name}"`,
      ).toBe(view.data!.statut);
    }
  });
});
