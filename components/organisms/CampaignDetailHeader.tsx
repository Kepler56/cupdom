'use client';

import { useState } from 'react';
import { Power, QrCode } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { OwnerChip } from '@/components/molecules/OwnerChip';
import { CampaignStateBadge } from '@/components/molecules/CampaignStateBadge';
import { DistributedInput } from '@/components/molecules/DistributedInput';
import { InvestedAmountInput } from '@/components/molecules/InvestedAmountInput';
import { VenueInput } from '@/components/molecules/VenueInput';
import { scanUrl } from '@/lib/campaigns/redirectUrl';
import type { CampaignWithOwner } from '@/lib/campaigns/campaigns';

interface CampaignDetailHeaderProps {
  campaign: CampaignWithOwner;
  canEdit: boolean;
  ownerName: string | null;
  ownerColor: string | null;
  onToggle: () => void | Promise<void>;
  onShowQr: () => void;
}

/**
 * Campaign detail header (Spec 4 AC-9): name · état badge · slug (+ public /s/ hint) · Télécharger QR
 * (read-only-safe) · Désactiver/Réactiver + Distribués, Montant investi, Lieu / événement (owner only).
 * Off-scope shows an OwnerChip and hides the lifecycle controls (AC-4).
 *
 * Montant investi and Lieu / événement are the portal's only inputs for the cost-per-contact
 * tile and venue ranking (Spec 5 §4.7/§4.8) — see InvestedAmountInput's doc comment for the
 * "every campaign must carry an amount" rule that makes the cost tile all-or-nothing.
 */
export function CampaignDetailHeader({ campaign, canEdit, ownerName, ownerColor, onToggle, onShowQr }: CampaignDetailHeaderProps) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await onToggle();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-text">{campaign.name ?? campaign.sponsorName}</h1>
          <CampaignStateBadge state={campaign.state} />
        </div>
        <p className="text-xs text-text-muted">
          Sponsor : {campaign.contactCompany ?? campaign.sponsorName}
        </p>
        <p className="font-mono text-xs text-text-faint">{scanUrl(campaign.slug)}</p>
        {canEdit && <DistributedInput slug={campaign.slug} value={campaign.distributedCount} canEdit={canEdit} />}
        {canEdit && <InvestedAmountInput slug={campaign.slug} value={campaign.investedAmountEur} canEdit={canEdit} />}
        {canEdit && <VenueInput slug={campaign.slug} value={campaign.venue} canEdit={canEdit} />}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onShowQr}>
          <Icon icon={QrCode} size={15} /> Télécharger QR
        </Button>
        {canEdit ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void toggle()}>
            <Icon icon={Power} size={15} /> {campaign.state === 'Active' ? 'Désactiver' : 'Réactiver'}
          </Button>
        ) : (
          ownerName && <OwnerChip name={ownerName} color={ownerColor ?? '#999'} />
        )}
      </div>
    </div>
  );
}
