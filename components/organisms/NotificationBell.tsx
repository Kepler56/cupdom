'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { NotificationItem } from '@/components/molecules/NotificationItem';
import { useNotifications } from '@/lib/notifications';

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative text-text-muted transition-colors hover:text-text"
      >
        <Icon icon={Bell} size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-fg px-1 text-[10px] font-semibold text-primary-contrast">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-card border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-text">Notifications</span>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs text-text-muted hover:text-text"
            >
              Tout marquer comme lu
            </button>
          </div>
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-text-muted">Aucune notification.</p>
            ) : (
              items.map((n) => (
                <NotificationItem key={n.id} notification={n} onMarkRead={(id) => void markRead(id)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
