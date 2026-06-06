import { describe, expect, it } from 'vitest';
import {
  mapNotificationRow,
  markAllReadLocal,
  markReadLocal,
  unreadCountOf,
  type NotificationRow,
} from '@/lib/notifications.shared';

const goneQuietRow: NotificationRow = {
  id: 'n1', recipient_id: 'u1', type: 'gone_quiet', contact_id: 'c1',
  payload: { kind: 'gone_quiet', level: 'urgent', silentDays: 31, lastActivity: '2026-01-01', company: 'Acme' },
  created_at: '2026-06-01', read_at: null,
};

describe('notification helpers', () => {
  it('maps snake_case rows to camelCase and keeps the payload', () => {
    const n = mapNotificationRow(goneQuietRow);
    expect(n.recipientId).toBe('u1');
    expect(n.contactId).toBe('c1');
    expect(n.readAt).toBeNull();
    expect(n.payload).toMatchObject({ kind: 'gone_quiet', level: 'urgent', silentDays: 31 });
  });

  it('preserves each payload kind', () => {
    const reminder = mapNotificationRow({
      ...goneQuietRow, type: 'reminder_due',
      payload: { kind: 'reminder_due', reminderId: 'r1', note: 'x', remindOn: '2026-06-01', company: 'Acme' },
    });
    const task = mapNotificationRow({
      ...goneQuietRow, type: 'task_overdue',
      payload: { kind: 'task_overdue', taskId: 't1', label: 'Appeler', dueDate: '2026-05-01', company: 'Acme' },
    });
    expect(reminder.payload.kind).toBe('reminder_due');
    expect(task.payload.kind).toBe('task_overdue');
  });

  it('counts only unread (readAt == null)', () => {
    const items = [
      mapNotificationRow(goneQuietRow),
      mapNotificationRow({ ...goneQuietRow, id: 'n2', read_at: '2026-06-02' }),
    ];
    expect(unreadCountOf(items)).toBe(1);
  });

  it('markReadLocal flips one; markAllReadLocal flips all unread', () => {
    const items = [mapNotificationRow(goneQuietRow), mapNotificationRow({ ...goneQuietRow, id: 'n2' })];
    const one = markReadLocal(items, 'n1', '2026-06-03T00:00:00Z');
    expect(one.find((n) => n.id === 'n1')?.readAt).toBe('2026-06-03T00:00:00Z');
    expect(one.find((n) => n.id === 'n2')?.readAt).toBeNull();

    const all = markAllReadLocal(items, '2026-06-03T00:00:00Z');
    expect(all.every((n) => n.readAt !== null)).toBe(true);
  });
});
