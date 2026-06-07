'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TaskRow } from '@/components/molecules/TaskRow';
import { useCanEdit, useScopeFilter } from '@/lib/scope';
import { deleteTask, listOwnerTasks, toggleDone } from '@/lib/tasks';
import { isOverdue } from '@/lib/dates';
import type { OwnerTask } from '@/types/domain';

function OwnerTaskRow({ task, onChanged }: { task: OwnerTask; onChanged: () => void }) {
  const canEdit = useCanEdit(task.ownerId);
  return (
    <div className="space-y-1">
      <Link href={`/contacts/${task.contactId}`} className="text-xs text-text-muted hover:underline">
        {task.company ?? 'Contact'}
      </Link>
      <TaskRow
        task={task}
        canEdit={canEdit}
        onToggle={async (v) => {
          try {
            await toggleDone(task.id, v);
            onChanged();
          } catch {
            /* read-only */
          }
        }}
        onDelete={async () => {
          try {
            await deleteTask(task.id);
            onChanged();
          } catch {
            /* read-only */
          }
        }}
      />
    </div>
  );
}

function Group({ title, count, tasks, onChanged }: { title: string; count?: number; tasks: OwnerTask[]; onChanged: () => void }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {title}
        {count !== undefined && <span className="ml-2 text-text-faint">{count}</span>}
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-text-faint">—</p>
      ) : (
        tasks.map((t) => <OwnerTaskRow key={t.id} task={t} onChanged={onChanged} />)
      )}
    </section>
  );
}

export default function TachesPage() {
  const scopeFilter = useScopeFilter();
  const [tasks, setTasks] = useState<OwnerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listOwnerTasks()
      .then((t) => {
        if (active) {
          setTasks(t);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const groups = useMemo(() => {
    const visible = tasks.filter((t) => scopeFilter(t.ownerId));
    return {
      overdue: visible.filter((t) => isOverdue(t.dueDate, t.doneAt)),
      upcoming: visible.filter((t) => t.doneAt == null && !isOverdue(t.dueDate, t.doneAt)),
      done: visible.filter((t) => t.doneAt != null),
    };
  }, [tasks, scopeFilter]);

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;

  const total = groups.overdue.length + groups.upcoming.length + groups.done.length;
  if (total === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-strong bg-surface p-10 text-center">
        <p className="text-sm text-text-muted">Aucune tâche.</p>
        <p className="mt-1 text-sm text-text-faint">
          Les tâches se créent depuis une fiche contact. Ouvrez un{' '}
          <Link href="/contacts" className="text-primary underline">
            contact
          </Link>{' '}
          puis l&apos;onglet <strong>Tâches</strong> pour en ajouter — elles seront regroupées ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Group title="En retard" count={groups.overdue.length} tasks={groups.overdue} onChanged={reload} />
      <Group title="À venir" tasks={groups.upcoming} onChanged={reload} />
      <Group title="Terminées" tasks={groups.done} onChanged={reload} />
    </div>
  );
}
