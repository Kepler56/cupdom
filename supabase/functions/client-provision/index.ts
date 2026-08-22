// Supabase Edge Function (Deno): grants a sponsor portal access (Spec 5 §5.9).
// Holds the service-role key (Edge secret, never the browser) and is the ONLY
// path that creates a portal auth user.
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
import { generatePassword, isAuthUserExistsError, RANDOM_BYTES_NEEDED } from '../_shared/provision.ts';

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
  const { data: isMember, error: isMemberError } = await caller.rpc('is_cupdom_member');
  if (isMemberError) {
    // A refusal and a fault are different answers and must not look alike: an
    // ungranted RPC, a schema-cache miss, or a dropped round-trip must not be
    // told to a legitimate member as "Réservé à l’équipe Cupdom" with nothing
    // logged anywhere — these are the first Edge Functions this codebase has
    // deployed, with no other instrumentation.
    console.error('[client-provision] is_cupdom_member failed:', isMemberError.code, isMemberError.message);
    return json({ ok: false, error: 'unknown' }, 500);
  }
  if (isMember !== true) return json({ ok: false, error: 'not_member' }, 403);

  // The member performing this action — recorded on client_accounts.created_by
  // for audit (Spec §5.2). Read once guard 1 has confirmed a real caller
  // exists; `?? null` at the insert site handles a missing actor without
  // failing a provision that has already created an auth user.
  const {
    data: { user: actor },
  } = await caller.auth.getUser();

  // Guard 2 — and this member owns this contact.
  const { data: owns, error: ownsError } = await caller.rpc('owns_contact', { p_contact: contactId });
  if (ownsError) {
    console.error('[client-provision] owns_contact failed:', ownsError.code, ownsError.message);
    return json({ ok: false, error: 'unknown' }, 500);
  }
  if (owns !== true) return json({ ok: false, error: 'not_owner' }, 403);

  const { data: contact } = await service
    .from('contacts')
    .select('id, email, company')
    .eq('id', contactId)
    .maybeSingle();

  const email = String(contact?.email ?? '').trim().toLowerCase();
  if (!email) return json({ ok: false, error: 'contact_has_no_email' }, 400);

  const { data: existingRow } = await service
    .from('client_accounts')
    .select('id')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (existingRow) return json({ ok: false, error: 'already_provisioned' }, 409);

  const password = generatePassword(crypto.getRandomValues(new Uint8Array(RANDOM_BYTES_NEEDED)));

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    // An existing auth user is the one collision worth naming: the CRM offers a
    // password reset instead of failing opaquely (Spec §5.9). Matched on the
    // structured `code` field, never the message — see provision.ts.
    const already = isAuthUserExistsError(createError);
    return json({ ok: false, error: already ? 'auth_user_exists' : 'unknown' }, already ? 409 : 500);
  }

  const { error: insertError } = await service.from('client_accounts').insert({
    auth_user_id: created.user!.id,
    contact_id: contactId,
    email,
    display_name: contact?.company ?? null,
    must_change_password: true,
    created_by: actor?.id ?? null,
  });

  if (insertError) {
    // Do not leave an orphan auth user behind: it would block every later
    // attempt with 'auth_user_exists' and nobody could tell why.
    const { error: cleanupError } = await service.auth.admin.deleteUser(created.user!.id);
    if (cleanupError) {
      // An orphan auth user now exists and will make every later attempt for
      // this sponsor look like a collision. Log it so the cause is findable.
      console.error('[client-provision] orphan cleanup failed:', cleanupError.code, cleanupError.message);
    }
    console.error('[client-provision] insert failed:', insertError.code, insertError.message);
    return json({ ok: false, error: 'unknown' }, 500);
  }

  // The one and only time this password exists outside the sponsor's hands.
  return json({ ok: true, email, password });
});
