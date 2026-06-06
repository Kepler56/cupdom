import { createClient } from '@/lib/supabase/client';
import type { LifecycleResult } from '@/types/domain';

// Postgres SQLSTATEs raised by the 0005 RPCs (PostgREST surfaces them as error.code):
//   42501 = insufficient_privilege (owner gate)
//   23514 = check_violation (archive: active campaign; restore: not archived)
function mapError(error: { code?: string } | null, ctx: 'archive' | 'restore'): LifecycleResult {
  const code = error?.code;
  if (code === '42501') {
    return { ok: false, reason: 'not_owner', message: 'Lecture seule : seul le propriétaire peut effectuer cette action.' };
  }
  if (code === '23514') {
    return ctx === 'archive'
      ? { ok: false, reason: 'active_campaign', message: 'Désactivez la campagne active avant de supprimer ce contact.' }
      : { ok: false, reason: 'not_archived', message: "Ce contact n'est pas archivé." };
  }
  return { ok: false, reason: 'unknown', message: 'Action impossible.' };
}

/** Soft-archive a contact (owner-gated server-side). Returns a discriminated result. */
export async function archiveContact(id: string): Promise<LifecycleResult> {
  const { error } = await createClient().rpc('archive_contact', { p_contact: id });
  return error ? mapError(error, 'archive') : { ok: true };
}

/** Restore an archived contact (owner-gated server-side). */
export async function restoreContact(id: string): Promise<LifecycleResult> {
  const { error } = await createClient().rpc('restore_contact', { p_contact: id });
  return error ? mapError(error, 'restore') : { ok: true };
}
