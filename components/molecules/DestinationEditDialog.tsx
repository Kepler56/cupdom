'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { editDestination } from '@/lib/campaigns/campaigns';
import type { Campaign } from '@/types/domain';

interface DestinationEditDialogProps {
  campaign: Pick<Campaign, 'slug' | 'destinationUrl'>;
  onDone: () => void;
  onClose: () => void;
}

/**
 * Edit a campaign's destination URL (AC-13). The slug and QR are unchanged — only the
 * redirect target moves. Rendered only when the caller owns the campaign (useCanEdit).
 */
export function DestinationEditDialog({ campaign, onDone, onClose }: DestinationEditDialogProps) {
  const [url, setUrl] = useState(campaign.destinationUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await editDestination(campaign.slug, url);
      if (!res.ok) {
        setError('Lien invalide (http/https requis).');
        return;
      }
      onDone();
    } catch {
      setError('Enregistrement impossible (lecture seule).');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modifier la destination"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
        <h2 className="mb-1 text-base font-semibold text-text">Modifier la destination</h2>
        <p className="mb-4 text-xs text-text-muted">Le QR et le lien /s/ restent identiques.</p>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-muted">Destination (http/https)</span>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>

        {error && <p className="mt-3 text-sm text-danger-fg">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
