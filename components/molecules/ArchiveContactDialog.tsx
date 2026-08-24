'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { archiveContact } from '@/lib/contacts/lifecycle';

interface ArchiveContactDialogProps {
  contactId: string;
  contactName: string;
  onClose: () => void;
  onArchived: () => void;
}

export function ArchiveContactDialog({ contactId, contactName, onClose, onArchived }: ArchiveContactDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await archiveContact(contactId);
    setBusy(false);
    if (res.ok) onArchived();
    else setError(res.message);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Archiver le contact"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
        <h2 className="mb-2 text-base font-semibold text-text">Archiver {contactName} ?</h2>
        <p className="mb-4 text-sm text-text-muted">
          Il sera masqué et définitivement supprimé dans 30 jours. Vous pourrez le restaurer d&apos;ici là.
        </p>
        {error && <p className="mb-3 text-sm text-danger-fg">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger-outline" disabled={busy} onClick={confirm}>
            {busy ? 'Archivage…' : 'Archiver'}
          </Button>
        </div>
      </div>
    </div>
  );
}
