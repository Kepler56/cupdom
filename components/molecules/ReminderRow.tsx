'use client';

import { Trash2 } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { DueChip } from './OverdueChip';
import { formatFr, isDue } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { Reminder } from '@/types/domain';

interface ReminderRowProps {
  reminder: Reminder;
  canEdit: boolean;
  onToggle: (done: boolean) => void;
  onDelete: () => void;
}

export function ReminderRow({ reminder, canEdit, onToggle, onDelete }: ReminderRowProps) {
  const done = reminder.doneAt != null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-input border border-border bg-surface px-3 py-2',
        done && 'opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={done}
        disabled={!canEdit}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`Marquer le rappel du ${formatFr(reminder.remindOn)} comme traité`}
        style={{ accentColor: 'var(--primary)' }}
        className="h-4 w-4"
      />
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm text-text', done && 'text-text-muted line-through')}>
          {formatFr(reminder.remindOn)}
        </div>
        {reminder.note && <div className="text-xs text-text-muted">{reminder.note}</div>}
      </div>
      {isDue(reminder.remindOn, reminder.doneAt) && <DueChip />}
      {canEdit && (
        <button
          type="button"
          aria-label={`Supprimer le rappel du ${formatFr(reminder.remindOn)}`}
          onClick={onDelete}
          className="text-text-muted hover:text-danger-fg"
        >
          <Icon icon={Trash2} size={15} />
        </button>
      )}
    </div>
  );
}
