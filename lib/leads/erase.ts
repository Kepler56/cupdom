import { createClient } from '@/lib/supabase/client';
import type { EraseLeadResult } from '@/types/domain';

/**
 * Erase a lead's PII on request / consent withdrawal (Spec 3B AC-15) via the owner-gated
 * `erase_lead` RPC. Never throws on the expected blocked cases — returns a discriminated result
 * the UI toasts in French. SQLSTATEs from 0008's raises: 42501 = insufficient_privilege (not owner),
 * P0002 = no_data_found (lead unknown / detached).
 */
export async function eraseLead(id: string): Promise<EraseLeadResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('erase_lead', { p_lead: id });
  if (!error) return { ok: true };

  if (error.code === '42501' || /insufficient_privilege|lecture seule/i.test(error.message)) {
    return { ok: false, reason: 'not_owner', message: 'Lecture seule : seul le propriétaire peut effacer ce lead.' };
  }
  if (error.code === 'P0002' || /introuvable|no_data_found/i.test(error.message)) {
    return { ok: false, reason: 'not_found', message: 'Lead introuvable.' };
  }
  return { ok: false, reason: 'unknown', message: 'Effacement impossible.' };
}
