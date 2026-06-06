'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { useProfiles } from '@/lib/profiles';
import { transferContact } from '@/lib/transfer';
import type { ContactStatus } from '@/types/domain';

interface TransferDialogProps {
  contact: ContactStatus;
  onClose: () => void;
  onDone: () => void;
}

export function TransferDialog({ contact, onClose, onDone }: TransferDialogProps) {
  const { profiles } = useProfiles();
  const others = Object.values(profiles)
    .filter((p) => p.id !== contact.ownerId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));

  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const res = await transferContact(contact.id, target);
    setBusy(false);
    if (res.ok) onDone();
    else setError(res.message);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transférer le contact"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-lg">
        <h2 className="mb-4 text-base font-semibold text-text">Transférer le contact</h2>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-muted">Nouveau propriétaire</span>
          <select
            aria-label="Nouveau propriétaire"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-input border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">—</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="mt-3 text-sm text-danger-fg">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!target || busy} onClick={confirm}>
            {busy ? 'Transfert…' : 'Transférer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
