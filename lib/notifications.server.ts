import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { mapNotificationRow, type NotificationRow } from '@/lib/notifications.shared';
import type { Notification } from '@/types/domain';

/** SSR fetch of the signed-in member's notifications (RLS scopes to them). */
export async function fetchMyNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  return (data as NotificationRow[] | null ?? []).map(mapNotificationRow);
}

/** Re-evaluate the member's own notifications (best-effort; never blocks the page). */
export async function refreshMyNotifications(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('refresh_my_notifications').then(undefined, () => {});
}
