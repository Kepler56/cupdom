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
