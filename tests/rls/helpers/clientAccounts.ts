/**
 * Shared seeding for the client-portal RLS suites (Spec 5, migration 0009).
 * Creates a real Supabase auth user + its client_accounts row via the service role,
 * and signs it in so the test gets an RLS-bound client. Always paired with
 * destroyTestClient in afterAll — a crashed run otherwise leaves auth users behind.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface TestClientAccount {
  /** Anon-key client signed in AS the portal client — subject to client RLS. */
  client: SupabaseClient;
  authUserId: string;
  accountId: string;
  contactId: string;
  email: string;
  password: string;
}

export interface CreateTestClientOpts {
  contactId: string;
  /** Unique marker so parallel/crashed runs never collide. */
  marker: string;
  active?: boolean;
  mustChangePassword?: boolean;
}

export async function createTestClient(
  svc: SupabaseClient,
  url: string,
  anon: string,
  opts: CreateTestClientOpts,
): Promise<TestClientAccount> {
  const email = `portal-test+${opts.marker}@cupdom-test.invalid`;
  const password = `Test-${opts.marker}-Aa1!`;

  const created = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`createUser failed for ${email}: ${created.error?.message}`);
  }
  const authUserId = created.data.user.id;

  try {
    const row = await svc
      .from('client_accounts')
      .insert({
        auth_user_id: authUserId,
        contact_id: opts.contactId,
        email,
        display_name: `Test ${opts.marker}`,
        active: opts.active ?? true,
        must_change_password: opts.mustChangePassword ?? false,
      })
      .select('id')
      .single();
    if (row.error) throw new Error(`client_accounts insert failed: ${row.error.message}`);

    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(`client sign-in failed: ${signedIn.error.message}`);

    return { client, authUserId, accountId: row.data!.id, contactId: opts.contactId, email, password };
  } catch (err) {
    // Unwind the auth user we just created so a failed insert/sign-in (the normal
    // TDD red step, or any real failure) never leaks a user into auth.users.
    await svc.auth.admin.deleteUser(authUserId);
    throw err;
  }
}

export async function destroyTestClient(
  svc: SupabaseClient,
  account: TestClientAccount | undefined,
): Promise<void> {
  if (!account) return;
  // client_accounts cascades from auth.users, but delete explicitly so a failed
  // user-delete still leaves no orphan row.
  await svc.from('client_accounts').delete().eq('auth_user_id', account.authUserId);
  await svc.auth.admin.deleteUser(account.authUserId);
}
