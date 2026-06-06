'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { TaskRow } from '@/components/molecules/TaskRow';
import { TaskForm } from '@/components/molecules/TaskForm';
import { useCanEdit } from '@/lib/scope';
import { createTask, deleteTask, listTasks, toggleDone } from '@/lib/tasks';
import type { ContactStatus, Task } from '@/types/domain';

export function TaskList({ contact }: { contact: ContactStatus }) {
  const canEdit = useCanEdit(contact.ownerId);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await listTasks(contact.id));
    } finally {
      setLoading(false);
    }
  }, [contact.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pending = tasks.filter((t) => t.doneAt == null);
  const done = tasks.filter((t) => t.doneAt != null);

  async function add(input: { label: string; dueDate: string | null }) {
    setSubmitting(true);
    try {
      await createTask({ contactId: contact.id, ...input });
      setFormOpen(false);
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(task: Task, value: boolean) {
    try {
      await toggleDone(task.id, value);
      await reload();
    } catch {
      /* read-only */
    }
  }

  async function remove(task: Task) {
    try {
      await deleteTask(task.id);
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
            + Nouvelle tâche
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <>
          {pending.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune tâche.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((t) => (
                <TaskRow key={t.id} task={t} canEdit={canEdit} onToggle={(v) => toggle(t, v)} onDelete={() => remove(t)} />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Terminées</div>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} canEdit={canEdit} onToggle={(v) => toggle(t, v)} onDelete={() => remove(t)} />
              ))}
            </div>
          )}
        </>
      )}

      {formOpen && <TaskForm submitting={submitting} onSubmit={add} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
