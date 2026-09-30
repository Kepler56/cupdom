'use client';

import { useState } from 'react';
import type { PublicCampaign } from '@/lib/public/leadClient';
import { httpOrNull } from '@/lib/public/safeUrl';

/**
 * Stable soft hue per sponsor, so the no-photo banner is tinted rather than grey and a
 * given brand always gets the same colour. Pure string hash — no user data leaves here.
 */
export function sponsorHue(sponsor: string): number {
  let h = 0;
  for (let i = 0; i < sponsor.length; i++) h = (h * 31 + sponsor.charCodeAt(i)) % 360;
  return h;
}

/**
 * Top of the public card: the product photo, full-bleed (4:3 box sized before the image
 * arrives, so nothing jumps), with the sponsor as a pill over it. Plain <img>, not
 * next/image: the photo lives on the Supabase origin, already CSP-allowed, and the public
 * page must not depend on the image optimizer.
 *
 * No photo — or a photo that fails to load (deleted, bad URL) — renders a tinted banner
 * with the sponsor's initial instead, so the card never looks empty or broken.
 */
export function CampaignHero({
  campaign,
  sponsor,
  compact = false,
}: {
  campaign: PublicCampaign;
  sponsor: string;
  /** Shorter band for the confirmation screens, where the message matters more. */
  compact?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const src = httpOrNull(campaign.imageUrl);
  const showPhoto = src !== null && !imageFailed;
  const pill = sponsor ? `Proposé par ${sponsor}` : null;
  // Without a photo the band has nothing to show off, so it stays short and the form comes up.
  const ratio = compact || !showPhoto ? 'aspect-[2/1]' : 'aspect-[4/3]';

  return (
    <div className={`relative w-full overflow-hidden ${ratio}`}>
      {showPhoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            // The campaign name is the heading right below; repeating it as alt reads it twice.
            alt={campaign.product || ''}
            width={800}
            height={600}
            decoding="async"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full bg-canvas object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-[image:var(--hero-scrim)]" />
        </>
      ) : (
        <HeroFallback sponsor={sponsor} />
      )}
      {pill && (
        <span className="absolute left-3 top-3 inline-flex max-w-[calc(100%-1.5rem)] items-center truncate rounded-full bg-surface/95 px-3 py-1 text-xs font-semibold text-text shadow-sm backdrop-blur-sm">
          {pill}
        </span>
      )}
    </div>
  );
}

function HeroFallback({ sponsor }: { sponsor: string }) {
  const hue = sponsorHue(sponsor);
  const initial = (Array.from(sponsor.trim())[0] ?? 'C').toUpperCase(); // code points: no half-emoji
  return (
    <div
      aria-hidden
      data-testid="hero-fallback"
      className="absolute inset-0 flex items-end justify-end overflow-hidden"
      style={{ backgroundColor: `hsl(${hue} 38% 91%)` }}
    >
      <span
        className="-mb-[0.22em] mr-3 select-none text-[11rem] font-extrabold leading-none tracking-tighter sm:text-[13rem]"
        style={{ color: `hsl(${hue} 32% 80%)` }}
      >
        {initial}
      </span>
    </div>
  );
}
