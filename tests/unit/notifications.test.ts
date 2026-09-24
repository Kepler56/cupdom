import { describe, expect, it } from 'vitest';
import {
  alertTitle,
  mapNotificationRow,
  markAllReadLocal,
  pendingScanDrops,
  markReadLocal,
  unreadCountOf,
  type NotificationRow,
} from '@/lib/notifications.shared';

const goneQuietRow: NotificationRow = {
  id: 'n1', recipient_id: 'u1', type: 'gone_quiet', contact_id: 'c1', campaign_slug: null,
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

  it('maps a campaign-keyed scan_drop row (campaign_slug, no contact)', () => {
    const n = mapNotificationRow({
      ...goneQuietRow,
      type: 'scan_drop',
      contact_id: null,
      campaign_slug: 'rex-club-2026',
      payload: {
        kind: 'scan_drop',
        campaignSlug: 'rex-club-2026',
        sponsorName: 'Nike',
        burstCount: 8,
        dropCount: 0,
        windowMinutes: 10,
        detectedAt: '2026-09-23T01:00:00Z',
      },
    });
    expect(n.contactId).toBeNull();
    expect(n.campaignSlug).toBe('rex-club-2026');
    expect(n.payload).toMatchObject({ kind: 'scan_drop', sponsorName: 'Nike', burstCount: 8, dropCount: 0 });
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

  it('pendingScanDrops keeps only UNREAD scan_drop alerts, newest first', () => {
    const drop = (id: string, createdAt: string, read: string | null) =>
      mapNotificationRow({
        ...goneQuietRow, id, type: 'scan_drop', contact_id: null, campaign_slug: 'x', created_at: createdAt, read_at: read,
        payload: { kind: 'scan_drop', campaignSlug: 'x', sponsorName: 'Nike', burstCount: 8, dropCount: 0, windowMinutes: 10, detectedAt: createdAt },
      });
    const items = [
      mapNotificationRow(goneQuietRow),
      drop('old', '2026-09-23T01:00:00Z', null),
      drop('new', '2026-09-23T02:00:00Z', null),
      drop('seen', '2026-09-23T03:00:00Z', '2026-09-23T03:05:00Z'),
    ];
    expect(pendingScanDrops(items).map((n) => n.id)).toEqual(['new', 'old']);
  });

  it('alertTitle prefixes the pending count, replaces rather than stacks, and clears at 0', () => {
    expect(alertTitle('Aperçu — Cupdom', 2)).toBe('(2) ⚠️ Aperçu — Cupdom');
    expect(alertTitle('(2) ⚠️ Aperçu — Cupdom', 3)).toBe('(3) ⚠️ Aperçu — Cupdom');
    expect(alertTitle('(3) ⚠️ Aperçu — Cupdom', 0)).toBe('Aperçu — Cupdom');
    expect(alertTitle('Aperçu — Cupdom', 0)).toBe('Aperçu — Cupdom');
  });
});
