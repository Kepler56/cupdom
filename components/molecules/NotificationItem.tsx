'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Bell, Clock, Trash2 } from 'lucide-react';
import { Tag } from '@/components/atoms/Tag';
import { Icon } from '@/components/atoms/Icon';
import { timeAgoFr } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { GONE_QUIET_LABEL_FR, GONE_QUIET_TONE, type Notification, type NotificationType } from '@/types/domain';

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

const ICON: Record<NotificationType, LucideIcon> = {
  reminder_due: Bell,
  task_overdue: AlertTriangle,
  gone_quiet: Clock,
  purge_warning: Trash2,
};

/** French primary line + status Tag, derived from the typed payload. */
function describe(n: Notification): { primary: string; tone: Tone; tagLabel: string } {
  const p = n.payload;
  switch (p.kind) {
    case 'reminder_due':
      return { primary: `Rappel : ${p.note?.trim() || 'à traiter'}`, tone: 'warning', tagLabel: 'À traiter' };
    case 'task_overdue':
      return { primary: `Tâche en retard : ${p.label}`, tone: 'danger', tagLabel: 'En retard' };
    case 'gone_quiet':
      return {
        primary: `Prospect silencieux (${p.silentDays} j)`,
        tone: GONE_QUIET_TONE[p.level],
        tagLabel: GONE_QUIET_LABEL_FR[p.level],
      };
    case 'purge_warning':
      return { primary: 'Suppression imminente', tone: 'danger', tagLabel: `J-${p.daysLeft}` };
  }
}

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const { primary, tone, tagLabel } = describe(notification);
  const company = notification.payload.company;
  const unread = notification.readAt == null;
  const href = notification.contactId ? `/contacts/${notification.contactId}` : '#';

  return (
    <Link
      href={href}
      onClick={() => onMarkRead(notification.id)}
      className={cn('flex items-start gap-3 px-3 py-2.5 hover:bg-canvas', unread && 'border-l-2 border-primary')}
    >
      <span className="mt-0.5 text-text-muted">
        <Icon icon={ICON[notification.type]} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm text-text', unread && 'font-medium')}>{primary}</div>
        <div className="text-xs text-text-muted">
          {company ? `${company} · ` : ''}
          {timeAgoFr(notification.createdAt)}
        </div>
      </div>
      <Tag tone={tone}>{tagLabel}</Tag>
    </Link>
  );
}
