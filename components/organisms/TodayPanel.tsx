'use client';

import { NotificationItem } from '@/components/molecules/NotificationItem';
import { useNotifications } from '@/lib/notifications';
import type { NotificationType } from '@/types/domain';

const GROUPS: { type: NotificationType; title: string }[] = [
  { type: 'reminder_due', title: 'Rappels du jour' },
  { type: 'task_overdue', title: 'Tâches en retard' },
  { type: 'gone_quiet', title: 'À relancer' },
  { type: 'purge_warning', title: 'Archives à purger' },
];

/** Aperçu "À traiter aujourd'hui": the member's pending (unread) notifications, grouped. */
export function TodayPanel() {
  const { items, markRead, loading } = useNotifications();
  const pending = items.filter((n) => n.readAt == null);

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;

  if (pending.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 text-sm text-text-muted">
        Rien à traiter aujourd&apos;hui.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {GROUPS.map((g) => {
        const rows = pending.filter((n) => n.type === g.type);
        if (rows.length === 0) return null;
        return (
          <section key={g.type}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{g.title}</h3>
            <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
              {rows.map((n) => (
                <NotificationItem key={n.id} notification={n} onMarkRead={(id) => void markRead(id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
