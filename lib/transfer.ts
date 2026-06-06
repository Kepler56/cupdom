import { createClient } from '@/lib/supabase/client';

export type TransferResult = { ok: true } | { ok: false; message: string };

/**
 * Re-assign a contact to another member via the transfer_contact RPC.
 * Returns a discriminated result with a French message on the expected failures
 * (not owner / invalid recipient) rather than throwing.
 */
export async function transferContact(
  contactId: string,
  newOwnerId: string,
): Promise<TransferResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('transfer_contact', {
    p_contact: contactId,
    p_new_owner: newOwnerId,
  });
  if (!error) return { ok: true };

  const code = (error as { code?: string }).code;
  if (code === '42501') return { ok: false, message: "Lecture seule : vous n'êtes pas le propriétaire." };
  if (code === '23503') return { ok: false, message: 'Destinataire invalide.' };
  return { ok: false, message: 'Transfert impossible.' };
}
