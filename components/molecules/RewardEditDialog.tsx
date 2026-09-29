'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { REWARD_ERROR_FR, RewardFields } from '@/components/molecules/RewardFields';
import { setReward } from '@/lib/campaigns/campaigns';
import type { Campaign, RewardType } from '@/types/domain';

interface RewardEditDialogProps {
  campaign: Pick<Campaign, 'slug' | 'destinationUrl' | 'rewardType' | 'promoCode'>;
  onDone: () => void;
  onClose: () => void;
}

/** Edit how a campaign rewards participants (spec §4.1). Slug and QR are unchanged. */
export function RewardEditDialog({ campaign, onDone, onClose }: RewardEditDialogProps) {
  const [rewardType, setRewardType] = useState<RewardType>(campaign.rewardType);
  const [promoCode, setPromoCode] = useState(campaign.promoCode ?? '');
  const [destination, setDestination] = useState(campaign.destinationUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await setReward(campaign.slug, { rewardType, promoCode, destinationUrl: destination });
      if (!res.ok) {
        setError(REWARD_ERROR_FR[res.error]);
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
      aria-label="Modifier la récompense"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
        <h2 className="mb-1 text-base font-semibold text-text">Modifier la récompense</h2>
        <p className="mb-4 text-xs text-text-muted">Le QR et le lien /s/ restent identiques.</p>
        <RewardFields
          rewardType={rewardType}
          promoCode={promoCode}
          destination={destination}
          onChange={(p) => {
            if (p.rewardType !== undefined) setRewardType(p.rewardType);
            if (p.promoCode !== undefined) setPromoCode(p.promoCode);
            if (p.destination !== undefined) setDestination(p.destination);
          }}
        />
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
