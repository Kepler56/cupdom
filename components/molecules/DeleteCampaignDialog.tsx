'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { deleteCampaign } from '@/lib/campaigns/campaigns';
import type { Campaign } from '@/types/domain';

interface DeleteCampaignDialogProps {
  campaign: Pick<Campaign, 'slug' | 'name' | 'sponsorName'>;
  /** True when the campaign has ≥1 scan → deletion is unavailable (AC-15). */
  hasScans: boolean;
  onDone: () => void;
  onClose: () => void;
}

/**
 * Delete a campaign — only when it has zero scans (AC-14/15). With scans, the confirm
 * button is disabled with an explanatory message; the DB guard is the hard gate, so a
 * `has_scans` race is handled gracefully. Rendered only when the caller owns the campaign.
 */
export function DeleteCampaignDialog({ campaign, hasScans, onDone, onClose }: DeleteCampaignDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = campaign.name ?? campaign.sponsorName;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await deleteCampaign(campaign.slug);
      if (!res.ok) {
        setError('Supprimable uniquement sans scan — désactivez la campagne.');
        return;
      }
      onDone();
    } catch {
      setError('Suppression impossible (lecture seule).');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Supprimer la campagne"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-lg">
        <h2 className="mb-3 text-base font-semibold text-text">Supprimer la campagne</h2>
        {hasScans ? (
          <p className="mb-6 text-sm text-text-muted">
            « {label} » a déjà des scans : suppression impossible. Désactivez-la pour la terminer (ses statistiques
            sont conservées).
          </p>
        ) : (
          <p className="mb-6 text-sm text-text-muted">
            Supprimer définitivement « {label} » ? Cette action est irréversible.
          </p>
        )}

        {error && <p className="mb-3 text-sm text-danger-fg">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger-outline" disabled={hasScans || busy} onClick={() => void confirm()}>
            {busy ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
