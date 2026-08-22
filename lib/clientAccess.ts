import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { PortalAccessResult } from '@/types/domain';

/**
 * Portal provisioning, called from the CRM (Spec 5 §5.9).
 *
 * The FIRST Edge Function invocations in this codebase, so a note for whoever
 * copies this next: `functions.invoke` forwards the caller's session JWT
 * automatically, which is the whole reason the functions can evaluate
 * is_cupdom_member() and owns_contact() as the caller rather than as themselves.
 *
 * The password these return is never persisted here — not in state that
 * outlives the dialog, not in history, not in a log. It is handed straight to
 * the caller and forgotten.
 */

/** The reasons a refusal can carry — derived from the result type, not restated. */
type PortalAccessReason = Exclude<PortalAccessResult, { ok: true }>['reason'];

const MESSAGES: Record<PortalAccessReason, string> = {
  not_member: 'Réservé à l’équipe Cupdom.',
  not_owner: 'Seul le propriétaire de ce contact peut donner l’accès au portail.',
  auth_user_exists:
    'Un compte existe déjà pour cette adresse. Réinitialisez plutôt son mot de passe.',
  already_provisioned: 'Ce contact a déjà un accès au portail.',
  not_provisioned: 'Ce contact n’a pas encore d’accès au portail.',
  contact_has_no_email: 'Ajoutez une adresse e-mail à ce contact avant de lui donner l’accès.',
  unavailable: 'La fonction n’est pas encore disponible. Réessayez une fois le déploiement terminé.',
  unknown: 'Action impossible pour le moment.',
};

/**
 * A real type predicate, because `value in MESSAGES` does NOT narrow a string
 * against a Record's key space — TypeScript's `in`-narrowing works on the object
 * side of a union of shapes, not this. Verified empirically rather than assumed.
 */
function isKnownReason(value: string): value is PortalAccessReason {
  return value in MESSAGES;
}

const failure = (reason: PortalAccessReason): PortalAccessResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason] ?? MESSAGES.unknown,
});

async function call(fn: 'client-provision' | 'client-reset-password', contactId: string): Promise<PortalAccessResult> {
  const { data, error } = await createClient().functions.invoke(fn, { body: { contactId } });

  if (error) {
    // Every refusal these functions issue is a non-2xx response, and
    // @supabase/functions-js turns ANY non-2xx into `error` rather than `data`
    // (FunctionsClient: `if (!response.ok) throw new FunctionsHttpError(response)`).
    // The structured body therefore has to be recovered from the error's Response.
    // Without this, every typed refusal collapsed into « indisponible » and the
    // reset-offering path Spec §5.9 requires was unreachable.
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);

      // The password already changed; only the forced-change flag did not.
      // Reporting failure would send the team chasing a password that works,
      // while the sponsor holds one nobody in the CRM believes in. This is
      // deliberately ok: true.
      if (body?.error === 'flag_not_set' && body?.password) {
        return {
          ok: true,
          email: String(body.email),
          password: String(body.password),
          warning:
            'Mot de passe changé, mais le changement obligatoire à la première connexion n’a pas pu être activé.',
        };
      }

      const reason = String(body?.error ?? 'unknown');
      // `bad_request` is deliberately folded into `unknown`: it signals a
      // malformed call rather than anything a CRM user can act on.
      return failure(isKnownReason(reason) ? reason : 'unknown');
    }

    // FunctionsFetchError or FunctionsRelayError — a genuine transport problem:
    // the function is not deployed yet or otherwise unreachable. The raw
    // message is English and names our infrastructure; it never reaches a
    // user. Naming this case separately matters because « Action impossible »
    // would send someone hunting for a bug in the CRM.
    return failure('unavailable');
  }

  if (data?.ok === true) {
    return { ok: true, email: String(data.email), password: String(data.password) };
  }

  return failure('unknown');
}

/** Create the sponsor's portal account. The password is returned exactly once. */
export function grantPortalAccess(contactId: string): Promise<PortalAccessResult> {
  return call('client-provision', contactId);
}

/** Issue a fresh password for a sponsor who already has an account. */
export function resetPortalPassword(contactId: string): Promise<PortalAccessResult> {
  return call('client-reset-password', contactId);
}
