'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  mapNotificationRow,
  markAllReadLocal,
  markReadLocal,
  unreadCountOf,
  type NotificationRow,
} from '@/lib/notifications.shared';
import type { Notification } from '@/types/domain';

/** How often the open CRM re-checks for notifications (scan-drop alerts are written by a 5-min cron). */
export const POLL_MS = 60_000;

export interface UseNotifications {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotifications {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    setItems((data as NotificationRow[] | null ?? []).map(mapNotificationRow));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      // Freshen the member's own notifications on load (best-effort), then fetch.
      await supabase.rpc('refresh_my_notifications').then(undefined, () => {});
      if (!active) return;
      await fetchList();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchList]);

  // LIVE UPDATES. The bell used to load once, when the CRM opened, so a scan-drop
  // alert written by the cron job mid-event stayed invisible until a full reload.
  // Poll the (cheap) list every POLL_MS while the tab is visible, and immediately
  // when the member comes back to the tab. A hidden tab does not poll — nobody is
  // looking, and the visibility catch-up covers the gap the moment they return.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void fetchList();
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchList]);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    await supabase.rpc('refresh_my_notifications').then(undefined, () => {});
    await fetchList();
  }, [fetchList]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => markReadLocal(prev, id, new Date().toISOString()));
    const supabase = createClient();
    await supabase.rpc('mark_notification_read', { p_id: id });
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => markAllReadLocal(prev, new Date().toISOString()));
    const supabase = createClient();
    await supabase.rpc('mark_all_notifications_read');
  }, []);

  return { items, unreadCount: unreadCountOf(items), loading, markRead, markAllRead, refresh };
}
