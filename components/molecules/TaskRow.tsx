'use client';

import { Trash2 } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { OverdueChip } from './OverdueChip';
import { formatFr, isOverdue } from '@/lib/dates';
import { cn } from '@/lib/cn';
import type { Task } from '@/types/domain';

interface TaskRowProps {
  task: Task;
  canEdit: boolean;
  onToggle: (done: boolean) => void;
  onDelete: () => void;
}

export function TaskRow({ task, canEdit, onToggle, onDelete }: TaskRowProps) {
  const done = task.doneAt != null;

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
        aria-label={`Terminer ${task.label}`}
        style={{ accentColor: 'var(--primary)' }}
        className="h-4 w-4"
      />
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm text-text', done && 'text-text-muted line-through')}>{task.label}</div>
        {task.dueDate && <div className="text-xs text-text-muted">Échéance : {formatFr(task.dueDate)}</div>}
      </div>
      {isOverdue(task.dueDate, task.doneAt) && <OverdueChip />}
      {canEdit && (
        <button
          type="button"
          aria-label={`Supprimer ${task.label}`}
          onClick={onDelete}
          className="text-text-muted hover:text-danger-fg"
        >
          <Icon icon={Trash2} size={15} />
        </button>
      )}
    </div>
  );
}
