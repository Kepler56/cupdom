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

const MESSAGES: Record<string, string> = {
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

const failure = (reason: Exclude<PortalAccessResult, { ok: true }>['reason']): PortalAccessResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason] ?? MESSAGES.unknown,
});

async function call(fn: 'client-provision' | 'client-reset-password', contactId: string): Promise<PortalAccessResult> {
  const { data, error } = await createClient().functions.invoke(fn, { body: { contactId } });

  // A transport-level error means the function is not deployed or not reachable.
  // The raw message is English and names our infrastructure; it never reaches a
  // user. Naming this case separately matters because « Action impossible »
  // would send someone hunting for a bug in the CRM.
  if (error) return failure('unavailable');

  if (data?.ok === true) {
    return { ok: true, email: String(data.email), password: String(data.password) };
  }

  // The password already changed; only the forced-change flag did not. Reporting
  // failure would send the team chasing a password that works, while the sponsor
  // holds one nobody in the CRM believes in. This is deliberately ok: true.
  if (data?.error === 'flag_not_set' && data?.password) {
    return {
      ok: true,
      email: String(data.email),
      password: String(data.password),
      warning:
        'Mot de passe changé, mais le changement obligatoire à la première connexion n’a pas pu être activé.',
    };
  }

  const reason = String(data?.error ?? 'unknown');
  return failure((reason in MESSAGES ? reason : 'unknown') as never);
}

/** Create the sponsor's portal account. The password is returned exactly once. */
export function grantPortalAccess(contactId: string): Promise<PortalAccessResult> {
  return call('client-provision', contactId);
}

/** Issue a fresh password for a sponsor who already has an account. */
export function resetPortalPassword(contactId: string): Promise<PortalAccessResult> {
  return call('client-reset-password', contactId);
}
