import { createClient } from '@/lib/supabase/client';
import { appendHistory } from '@/lib/history';
import type { OwnerReminder, Reminder } from '@/types/domain';

type ReminderRow = {
  id: string;
  contact_id: string;
  remind_on: string;
  note: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapReminder(r: ReminderRow): Reminder {
  return {
    id: r.id,
    contactId: r.contact_id,
    remindOn: r.remind_on,
    note: r.note,
    doneAt: r.done_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Reminders for one contact: pending first, then by date. */
export async function listReminders(contactId: string): Promise<Reminder[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('contact_id', contactId)
    .order('done_at', { ascending: true, nullsFirst: true })
    .order('remind_on', { ascending: true });
  if (error) throw error;
  return (data as ReminderRow[] | null ?? []).map(mapReminder);
}

/** All manual reminders joined to non-archived contacts (scope applied client-side). */
export async function listOwnerReminders(): Promise<OwnerReminder[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reminders')
    .select('*, contacts!inner(owner_id, company, archived_at)')
    .is('contacts.archived_at', null);
  if (error) throw error;
  type Joined = ReminderRow & { contacts: { owner_id: string; company: string | null } };
  return (data as Joined[] | null ?? []).map((r) => ({
    ...mapReminder(r),
    ownerId: r.contacts.owner_id,
    company: r.contacts.company,
  }));
}

export async function createReminder(input: {
  contactId: string;
  remindOn: string;
  note: string | null;
}): Promise<Reminder> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reminders')
    .insert({ contact_id: input.contactId, remind_on: input.remindOn, note: input.note?.trim() || null })
    .select('*')
    .single();
  if (error) throw error;
  await appendHistory(input.contactId, 'reminder', `Rappel ${input.remindOn}`).catch(() => {});
  return mapReminder(data as ReminderRow);
}

export async function toggleDone(id: string, done: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('reminders')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteReminder(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}
