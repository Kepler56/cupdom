'use client';

import { HistoryItem } from '@/components/molecules/HistoryItem';
import type { HistoryEntry } from '@/types/domain';

/** Read-only, newest-first activity timeline over contact_history. */
export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-text-muted">Aucune activité.</p>;
  }
  return (
    <div className="space-y-4 border-l border-border pl-4">
      {entries.map((e) => (
        <HistoryItem key={e.id} entry={e} />
      ))}
    </div>
  );
}
