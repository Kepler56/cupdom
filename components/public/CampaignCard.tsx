'use client';

import { Gift, Mail } from 'lucide-react';
import type { PublicCampaign } from '@/lib/public/leadClient';
import { CampaignHero } from '@/components/public/CampaignHero';

/** What the visitor gets, in one line — the reason to fill the form. */
export function valueLine(rewardType: PublicCampaign['rewardType'], sponsor: string): string {
  if (rewardType === 'promo') return sponsor ? `Recevez votre code promo ${sponsor} par e-mail` : 'Recevez votre code promo par e-mail';
  return sponsor ? `Accédez à l'offre ${sponsor}` : "Accédez à l'offre";
}

/**
 * « What am I taking part in? » (spec §4.4), product first: the photo (or a tinted
 * fallback) across the top of the card, then the campaign name and the value line on a
 * dashed voucher-like stub. The product type (« chaussure ») is only the image's alt text — it is
 * a CRM label, not a headline.
 */
export function CampaignCard({ campaign, sponsor }: { campaign: PublicCampaign; sponsor: string }) {
  const title = campaign.name || (sponsor ? `L'offre de ${sponsor}` : 'Votre offre');
  const promo = campaign.rewardType === 'promo';
  return (
    <header>
      <CampaignHero campaign={campaign} sponsor={sponsor} />
      <div className="px-5 pt-5 sm:px-8 sm:pt-7">
        <h1 className="text-balance text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-text sm:text-3xl">
          {title}
        </h1>
        <div className="mt-4 flex items-center gap-3 rounded-input border border-dashed border-border-strong bg-canvas py-3 pl-3 pr-4">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-contrast">
            {promo ? <Mail size={17} strokeWidth={2.25} /> : <Gift size={17} strokeWidth={2.25} />}
          </span>
          <p className="text-[0.95rem] font-semibold leading-snug text-text">{valueLine(campaign.rewardType, sponsor)}</p>
        </div>
      </div>
    </header>
  );
}
