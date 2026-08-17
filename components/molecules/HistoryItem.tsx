'use client';

import type { LucideIcon } from 'lucide-react';
import { Archive, ArchiveRestore, ArrowRightLeft, Bell, CheckSquare, Link2, Pencil, TrendingUp } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { useProfiles } from '@/lib/profiles';
import { timeAgoFr } from '@/lib/dates';
import type { HistoryEntry, HistoryKind } from '@/types/domain';

const KIND_ICON: Record<HistoryKind, LucideIcon> = {
  deal_stage: TrendingUp,
  transfer: ArrowRightLeft,
  contact_edit: Pencil,
  task: CheckSquare,
  reminder: Bell,
  link: Link2,
  archive: Archive,
  restore: ArchiveRestore,
};

const KIND_LABEL: Record<HistoryKind, string> = {
  deal_stage: 'Deal',
  transfer: 'Transfert',
  contact_edit: 'Modification',
  task: 'Tâche',
  reminder: 'Rappel',
  link: 'Lien',
  archive: 'Archivage',
  restore: 'Restauration',
};

export function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const { profiles } = useProfiles();
  const actor = entry.actorId ? profiles[entry.actorId]?.displayName : null;

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-text-muted" aria-label={KIND_LABEL[entry.kind]}>
        <Icon icon={KIND_ICON[entry.kind]} size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-sm text-text">{entry.summary ?? KIND_LABEL[entry.kind]}</div>
        <div className="text-xs text-text-muted">
          {actor ? `${actor} · ` : ''}
          {timeAgoFr(entry.createdAt)}
        </div>
      </div>
    </div>
  );
}
