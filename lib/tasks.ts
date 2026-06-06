import { createClient } from '@/lib/supabase/client';
import { appendHistory } from '@/lib/history';
import type { OwnerTask, Task } from '@/types/domain';

type TaskRow = {
  id: string;
  contact_id: string;
  label: string;
  due_date: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    contactId: r.contact_id,
    label: r.label,
    dueDate: r.due_date,
    doneAt: r.done_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Tasks for one contact: not-done first, then by due date. */
export async function listTasks(contactId: string): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('contact_id', contactId)
    .order('done_at', { ascending: true, nullsFirst: true })
    .order('due_date', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return (data as TaskRow[] | null ?? []).map(mapTask);
}

/** All tasks joined to non-archived contacts (scope applied client-side). */
export async function listOwnerTasks(): Promise<OwnerTask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('*, contacts!inner(owner_id, company, archived_at)')
    .is('contacts.archived_at', null);
  if (error) throw error;
  type Joined = TaskRow & { contacts: { owner_id: string; company: string | null } };
  return (data as Joined[] | null ?? []).map((r) => ({
    ...mapTask(r),
    ownerId: r.contacts.owner_id,
    company: r.contacts.company,
  }));
}

export async function createTask(input: {
  contactId: string;
  label: string;
  dueDate: string | null;
}): Promise<Task> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({ contact_id: input.contactId, label: input.label.trim(), due_date: input.dueDate })
    .select('*')
    .single();
  if (error) throw error;
  await appendHistory(input.contactId, 'task', `${input.label.trim()}`).catch(() => {});
  return mapTask(data as TaskRow);
}

/** Mark done (now) or reopen (null → resets the 90-day cleanup clock). */
export async function toggleDone(id: string, done: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('tasks')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
