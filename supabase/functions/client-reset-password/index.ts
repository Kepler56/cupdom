// Supabase Edge Function (Deno): resets a sponsor's portal password (Spec 5 §5.8).
// Holds the service-role key (Edge secret, never the browser) and is the ONLY
// path that resets a portal auth user's password without hand-written SQL.
//
// TWO CLIENTS, DELIBERATELY. The CALLER's client carries the member's own JWT
// and is used for both guards, so Postgres evaluates is_cupdom_member() and
// owns_contact() as that member — exactly as it would anywhere else in the CRM.
// The SERVICE client then does the privileged work. Using the service client for
// the guards would check nothing at all.
//
// The generated password is returned once and never stored, logged or emailed.
// Not part of the Next typecheck (Deno globals + URL imports) — excluded in tsconfig.
import { createClient } from '@supabase/supabase-js';
import { generatePassword, RANDOM_BYTES_NEEDED } from '../_shared/provision.ts';

// deno-lint-ignore no-explicit-any
type Json = any;

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('CRM_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'bad_request' }, 405);

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization) return json({ ok: false, error: 'not_member' }, 403);

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let payload: Json;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const contactId = String(payload.contactId ?? '');
  if (!contactId) return json({ ok: false, error: 'bad_request' }, 400);

  // Guard 1 — a Cupdom member, evaluated as the caller.
  const { data: isMember } = await caller.rpc('is_cupdom_member');
  if (isMember !== true) return json({ ok: false, error: 'not_member' }, 403);

  // Guard 2 — and this member owns this contact.
  const { data: owns } = await caller.rpc('owns_contact', { p_contact: contactId });
  if (owns !== true) return json({ ok: false, error: 'not_owner' }, 403);

  const { data: account } = await service
    .from('client_accounts')
    .select('auth_user_id, email')
    .eq('contact_id', contactId)
    .maybeSingle();

  if (!account) return json({ ok: false, error: 'not_provisioned' }, 404);

  const password = generatePassword(crypto.getRandomValues(new Uint8Array(RANDOM_BYTES_NEEDED)));

  const { error: updateError } = await service.auth.admin.updateUserById(account.auth_user_id, { password });
  if (updateError) {
    console.error('[client-reset-password] update failed:', updateError.message);
    return json({ ok: false, error: 'unknown' }, 500);
  }

  // Back to a temporary password, so the portal forces a change on next sign-in
  // exactly as it does for a freshly provisioned account (Spec §5.8).
  const { error: flagError } = await service
    .from('client_accounts')
    .update({ must_change_password: true })
    .eq('contact_id', contactId);

  if (flagError) {
    // The password HAS ALREADY CHANGED at this point — updateUserById above
    // succeeded. Reporting a clean failure here would send the team chasing a
    // password that no longer works, so this branch still returns it: a 500
    // that carries the password rather than hiding it. Task 4's CRM wrapper
    // treats this as a success carrying a warning, not as a failure.
    console.error('[client-reset-password] flag failed:', flagError.code, flagError.message);
    return json({ ok: false, error: 'flag_not_set', password, email: account.email }, 500);
  }

  return json({ ok: true, email: account.email, password });
});
