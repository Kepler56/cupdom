// Pure notification helpers — safe to import from both client and server modules.
import type { Notification, NotificationPayload, NotificationType } from '@/types/domain';

export type NotificationRow = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  contact_id: string | null;
  campaign_slug: string | null;
  payload: NotificationPayload;
  created_at: string;
  read_at: string | null;
};

/** Map a DB row to the domain type. The jsonb payload already carries camelCase keys. */
export function mapNotificationRow(r: NotificationRow): Notification {
  return {
    id: r.id,
    recipientId: r.recipient_id,
    type: r.type,
    contactId: r.contact_id,
    campaignSlug: r.campaign_slug,
    payload: r.payload,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

export function unreadCountOf(items: Notification[]): number {
  return items.filter((n) => n.readAt == null).length;
}

/** Pure optimistic update: stamp one item read. */
export function markReadLocal(items: Notification[], id: string, nowIso: string): Notification[] {
  return items.map((n) => (n.id === id && n.readAt == null ? { ...n, readAt: nowIso } : n));
}

/** Pure optimistic update: stamp all unread items read. */
export function markAllReadLocal(items: Notification[], nowIso: string): Notification[] {
  return items.map((n) => (n.readAt == null ? { ...n, readAt: nowIso } : n));
}

/**
 * Unread scan-drop alerts (#6), newest first — the ones the CRM surfaces as a
 * persistent in-app alert until someone acknowledges them. This is the channel
 * that works with no email configured at all.
 */
export function pendingScanDrops(items: Notification[]): Notification[] {
  return items
    .filter((n) => n.type === 'scan_drop' && n.readAt == null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const TITLE_PREFIX = /^\(\d+\) ⚠️ /;

/**
 * The browser-tab title while scan-drop alerts are pending: `(2) ⚠️ <page title>`,
 * so an alert is visible even from another tab. Idempotent — an existing prefix is
 * replaced, never stacked — and returns the bare title when nothing is pending.
 */
export function alertTitle(current: string, pending: number): string {
  const bare = current.replace(TITLE_PREFIX, '');
  return pending > 0 ? `(${pending}) ⚠️ ${bare}` : bare;
}
