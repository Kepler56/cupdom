/**
 * contact_history.kind constraint RLS test (Spec 5, migration 0014).
 *
 * 0002_deals.sql created contact_history.kind's CHECK constraint with six values.
 * 0005_archive_purge.sql then started writing 'archive' and 'restore' from two
 * SECURITY DEFINER functions with no migration ever widening the constraint to
 * permit them — the live constraint was hand-patched, and no file recorded it.
 * 0014_portal_history_kind.sql reconciles that drift: it drops whatever check
 * constraint is currently on the column (by discovery, not by a guessed name)
 * and recreates it from the full nine-value list, adding 'portal_access' for
 * stage 5 alongside every value already in use.
 *
 * This test proves the reconciliation did what it claims:
 *   1. 'portal_access' is now accepted — the value stage 5 needs.
 *   2. 'archive' and 'restore' are STILL accepted — the regression that would
 *      silently break the CRM's archive feature if 0014 had narrowed anything.
 *   3. An unrecognised kind is still REJECTED — without this, a migration that
 *      dropped the constraint and never recreated it would pass (1) and (2)
 *      just as well as a correct one.
 *
 * Requires migrations 0001+0002 applied (contacts, contact_history, owns_contact)
 * plus the member env below:
 *   SUPABASE_URL / SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)
 *   TEST_MEMBER_A_EMAIL / TEST_MEMBER_A_PASSWORD
 * Skipped entirely when that env is absent, same as the rest of this suite.
 *
 * Additionally, migration 0014 itself is — as of this writing — deliberately
 * unapplied; the product owner runs it by hand (see the stage 5 provisioning
 * plan's task-8 brief). A beforeAll probe detects whether 'portal_access' is
 * accepted yet and every test below skips cleanly via ctx.skip() when it is
 * not, rather than failing the suite for a reason that is not the product
 * owner's fault. Run: pnpm test:rls
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const A_EMAIL = process.env.TEST_MEMBER_A_EMAIL;
const A_PASSWORD = process.env.TEST_MEMBER_A_PASSWORD;

const configured = Boolean(URL && ANON && A_EMAIL && A_PASSWORD);
const MARKER = `0014-${Date.now()}`;
const CHECK_VIOLATION = '23514'; // Postgres SQLSTATE for check_violation

describe.skipIf(!configured)('contact_history.kind reconciliation (migration 0014)', () => {
  let member: SupabaseClient;
  let contactId = '';
  let migrationApplied = false;

  async function insertKind(kind: string) {
    return member
      .from('contact_history')
      .insert({ contact_id: contactId, kind, summary: `${MARKER} ${kind}` })
      .select('id')
      .single();
  }

  beforeAll(async () => {
    member = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const signedIn = await member.auth.signInWithPassword({ email: A_EMAIL!, password: A_PASSWORD! });
    if (signedIn.error || !signedIn.data.user) {
      throw new Error(`member sign-in failed: ${signedIn.error?.message}`);
    }
    const contact = await member
      .from('contacts')
      .insert({ owner_id: signedIn.data.user.id, company: `${MARKER} Sponsor` })
      .select('id')
      .single();
    if (contact.error) throw new Error(`contact insert failed: ${contact.error.message}`);
    contactId = contact.data!.id;

    // Detection only — not one of the four assertions above. Whether
    // 'portal_access' is accepted yet is exactly what tells us if 0014 has been
    // applied. A genuinely unexpected error (anything but a check violation)
    // must still fail the suite loudly rather than be swallowed into a skip.
    const probe = await insertKind('portal_access');
    if (probe.error && probe.error.code !== CHECK_VIOLATION) {
      throw new Error(`unexpected error probing 'portal_access': ${probe.error.message}`);
    }
    migrationApplied = !probe.error;
  });

  afterAll(async () => {
    // contact_history is append-only: 0002 grants members SELECT/INSERT only, no
    // DELETE policy. The only cleanup path is deleting the parent contact this
    // suite created — ON DELETE CASCADE (0002) removes every contact_history row
    // inserted above (probe included) along with it.
    if (contactId) await member.from('contacts').delete().eq('id', contactId);
  });

  it("kind = 'portal_access' inserts — the value stage 5 needs", async (ctx) => {
    ctx.skip(!migrationApplied, 'migration 0014 not applied yet — see task-8 brief');
    const { error } = await insertKind('portal_access');
    expect(error).toBeNull();
  });

  it("kind = 'archive' still inserts — the CRM archive feature must not regress", async (ctx) => {
    ctx.skip(!migrationApplied, 'migration 0014 not applied yet — see task-8 brief');
    const { error } = await insertKind('archive');
    expect(error).toBeNull();
  });

  it("kind = 'restore' still inserts — the CRM archive feature must not regress", async (ctx) => {
    ctx.skip(!migrationApplied, 'migration 0014 not applied yet — see task-8 brief');
    const { error } = await insertKind('restore');
    expect(error).toBeNull();
  });

  it("kind = 'definitely_not_a_kind' is REJECTED — proves the constraint still constrains", async (ctx) => {
    ctx.skip(!migrationApplied, 'migration 0014 not applied yet — see task-8 brief');
    const { data, error } = await insertKind('definitely_not_a_kind');
    expect(error).not.toBeNull();
    expect(error!.code).toBe(CHECK_VIOLATION);
    expect(data).toBeNull();
  });
});
