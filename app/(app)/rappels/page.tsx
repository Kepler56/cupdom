'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ReminderRow } from '@/components/molecules/ReminderRow';
import { useCanEdit, useScopeFilter } from '@/lib/scope';
import { deleteReminder, listOwnerReminders, toggleDone } from '@/lib/reminders';
import { isDue } from '@/lib/dates';
import type { OwnerReminder } from '@/types/domain';

// This page lists ONLY manual reminders (public.reminders). The automatic
// "gone-quiet" nudges (2/7/15/30-day prospect silence) are Plan 1D — not here.

function OwnerReminderRow({ reminder, onChanged }: { reminder: OwnerReminder; onChanged: () => void }) {
  const canEdit = useCanEdit(reminder.ownerId);
  return (
    <div className="space-y-1">
      <Link href={`/contacts/${reminder.contactId}`} className="text-xs text-text-muted hover:underline">
        {reminder.company ?? 'Contact'}
      </Link>
      <ReminderRow
        reminder={reminder}
        canEdit={canEdit}
        onToggle={async (v) => {
          try {
            await toggleDone(reminder.id, v);
            onChanged();
          } catch {
            /* read-only */
          }
        }}
        onDelete={async () => {
          try {
            await deleteReminder(reminder.id);
            onChanged();
          } catch {
            /* read-only */
          }
        }}
      />
    </div>
  );
}

function Group({ title, count, reminders, onChanged }: { title: string; count?: number; reminders: OwnerReminder[]; onChanged: () => void }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {title}
        {count !== undefined && <span className="ml-2 text-text-faint">{count}</span>}
      </h2>
      {reminders.length === 0 ? (
        <p className="text-sm text-text-faint">—</p>
      ) : (
        reminders.map((r) => <OwnerReminderRow key={r.id} reminder={r} onChanged={onChanged} />)
      )}
    </section>
  );
}

export default function RappelsPage() {
  const scopeFilter = useScopeFilter();
  const [reminders, setReminders] = useState<OwnerReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listOwnerReminders()
      .then((r) => {
        if (active) {
          setReminders(r);
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
    const visible = reminders.filter((r) => scopeFilter(r.ownerId));
    return {
      due: visible.filter((r) => isDue(r.remindOn, r.doneAt)),
      upcoming: visible.filter((r) => r.doneAt == null && !isDue(r.remindOn, r.doneAt)),
      done: visible.filter((r) => r.doneAt != null),
    };
  }, [reminders, scopeFilter]);

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;

  const total = groups.due.length + groups.upcoming.length + groups.done.length;
  if (total === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-strong bg-surface p-10 text-center">
        <p className="text-sm text-text-muted">Aucun rappel.</p>
        <p className="mt-1 text-sm text-text-faint">
          Les rappels se créent depuis une fiche contact. Ouvrez un{' '}
          <Link href="/contacts" className="text-primary underline">
            contact
          </Link>{' '}
          puis l&apos;onglet <strong>Rappels</strong> pour en ajouter — ils seront regroupés ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Group title="Échus" count={groups.due.length} reminders={groups.due} onChanged={reload} />
      <Group title="À venir" reminders={groups.upcoming} onChanged={reload} />
      <Group title="Traités" reminders={groups.done} onChanged={reload} />
    </div>
  );
}
