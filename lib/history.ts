import { createClient } from '@/lib/supabase/client';
import type { HistoryEntry, HistoryKind } from '@/types/domain';

type HistoryRow = {
  id: string;
  contact_id: string;
  actor_id: string | null;
  kind: HistoryKind;
  summary: string | null;
  created_at: string;
};

function mapHistory(r: HistoryRow): HistoryEntry {
  return {
    id: r.id,
    contactId: r.contact_id,
    actorId: r.actor_id,
    kind: r.kind,
    summary: r.summary,
    createdAt: r.created_at,
  };
}

/** Append a timeline entry (owner-gated by RLS). deal_stage/transfer are written by DB triggers/RPC. */
export async function appendHistory(
  contactId: string,
  kind: HistoryKind,
  summary: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('contact_history')
    .insert({ contact_id: contactId, kind, summary });
  if (error) throw error;
}

/** The Historique timeline for a contact, newest first (UI built in plan 1C). */
export async function listHistory(contactId: string): Promise<HistoryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contact_history')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as HistoryRow[] | null ?? []).map(mapHistory);
}
