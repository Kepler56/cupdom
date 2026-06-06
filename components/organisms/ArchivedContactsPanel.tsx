'use client';

import { ArchivedContactRow } from '@/components/molecules/ArchivedContactRow';
import type { ArchivedContact } from '@/types/domain';

interface ArchivedContactsPanelProps {
  contacts: ArchivedContact[];
  onRestored: () => void;
}

export function ArchivedContactsPanel({ contacts, onRestored }: ArchivedContactsPanelProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-10 text-center text-sm text-text-muted">
        Aucun contact archivé.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {contacts.map((c) => (
        <ArchivedContactRow key={c.id} contact={c} onRestored={onRestored} />
      ))}
    </div>
  );
}
