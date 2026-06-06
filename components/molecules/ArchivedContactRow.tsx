'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Tag } from '@/components/atoms/Tag';
import { useCanEdit } from '@/lib/scope';
import { purgeCountdown } from '@/lib/contacts/purgeCountdown';
import { restoreContact } from '@/lib/contacts/lifecycle';
import { contactDisplayName } from '@/lib/contacts';
import { formatFr } from '@/lib/dates';
import type { ArchivedContact } from '@/types/domain';

interface ArchivedContactRowProps {
  contact: ArchivedContact;
  onRestored: () => void;
}

export function ArchivedContactRow({ contact, onRestored }: ArchivedContactRowProps) {
  const canEdit = useCanEdit(contact.ownerId);
  const [busy, setBusy] = useState(false);
  const countdown = purgeCountdown(contact.purgeAfter);

  async function restore() {
    setBusy(true);
    const res = await restoreContact(contact.id);
    setBusy(false);
    if (res.ok) onRestored();
    else window.alert(res.message);
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="font-medium text-text">{contactDisplayName(contact)}</div>
        <div className="text-xs text-text-muted">Archivé le {formatFr(contact.archivedAt.slice(0, 10))}</div>
      </div>
      <div className="flex items-center gap-3">
        <Tag tone={countdown.tone}>{countdown.label}</Tag>
        {canEdit && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={restore}>
            {busy ? 'Restauration…' : 'Restaurer'}
          </Button>
        )}
      </div>
    </div>
  );
}
