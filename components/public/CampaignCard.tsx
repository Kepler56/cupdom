'use client';

import { useState } from 'react';
import type { PublicCampaign } from '@/lib/public/leadClient';

/**
 * « What am I taking part in? » (spec §4.4). Fixed-size image box with explicit
 * dimensions so the form never jumps when the photo arrives. Plain <img>, not
 * next/image: the photo lives on the Supabase origin, already CSP-allowed, and the
 * public page must not depend on the image optimizer. A photo that fails to load
 * (deleted, bad URL) drops the whole box rather than showing a broken-image icon.
 */
export function CampaignCard({ campaign, sponsor }: { campaign: PublicCampaign; sponsor: string }) {
  const title = campaign.name || `Pour accéder à l'offre de ${sponsor}`;
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="mb-6 flex items-center gap-4">
      {campaign.imageUrl && !imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={campaign.imageUrl}
          alt={campaign.product || campaign.name || sponsor}
          width={88}
          height={88}
          decoding="async"
          onError={() => setImageFailed(true)}
          className="h-22 w-22 shrink-0 rounded-input border border-border object-cover"
        />
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-text">{title}</h1>
        {campaign.product && <p className="text-sm text-text-body">{campaign.product}</p>}
        {sponsor && <p className="mt-0.5 text-xs text-text-muted">proposé par {sponsor}</p>}
      </div>
    </div>
  );
}
