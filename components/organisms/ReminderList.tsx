'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { ReminderRow } from '@/components/molecules/ReminderRow';
import { ReminderForm } from '@/components/molecules/ReminderForm';
import { useCanEdit } from '@/lib/scope';
import { createReminder, deleteReminder, listReminders, toggleDone } from '@/lib/reminders';
import type { ContactStatus, Reminder } from '@/types/domain';

export function ReminderList({ contact }: { contact: ContactStatus }) {
  const canEdit = useCanEdit(contact.ownerId);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setReminders(await listReminders(contact.id));
    } finally {
      setLoading(false);
    }
  }, [contact.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pending = reminders.filter((r) => r.doneAt == null);
  const done = reminders.filter((r) => r.doneAt != null);

  async function add(input: { remindOn: string; note: string | null }) {
    setSubmitting(true);
    try {
      await createReminder({ contactId: contact.id, ...input });
      setFormOpen(false);
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(reminder: Reminder, value: boolean) {
    try {
      await toggleDone(reminder.id, value);
      await reload();
    } catch {
      /* read-only */
    }
  }

  async function remove(reminder: Reminder) {
    try {
      await deleteReminder(reminder.id);
      await reload();
    } catch {
      /* read-only */
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setFormOpen(true)}>
            + Nouveau rappel
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <>
          {pending.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun rappel.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((r) => (
                <ReminderRow key={r.id} reminder={r} canEdit={canEdit} onToggle={(v) => toggle(r, v)} onDelete={() => remove(r)} />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Traités</div>
              {done.map((r) => (
                <ReminderRow key={r.id} reminder={r} canEdit={canEdit} onToggle={(v) => toggle(r, v)} onDelete={() => remove(r)} />
              ))}
            </div>
          )}
        </>
      )}

      {formOpen && <ReminderForm submitting={submitting} onSubmit={add} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
