'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import type { PromoReply, PublicCampaign } from '@/lib/public/leadClient';
import { CampaignHero } from '@/components/public/CampaignHero';
import { PublicCardShell } from '@/components/public/PublicCardShell';
import { httpOrNull } from '@/lib/public/safeUrl';

/**
 * Promo confirmation (spec §4.4). Shows the code only when the email could not be sent.
 * Carries the same product photo band as the form (when the campaign is passed) so the
 * form and its confirmation read as one experience.
 */
export function PromoSentCard({
  reply,
  email,
  campaign,
  sponsor = '',
}: {
  reply: PromoReply;
  email: string;
  campaign?: PublicCampaign;
  sponsor?: string;
}) {
  const link = httpOrNull(reply.link);
  const [copied, setCopied] = useState(false);
  const showCode = !reply.emailed && reply.code;
  const neitherSentNorShown = !reply.emailed && !reply.code;

  return (
    <PublicCardShell>
      {campaign && <CampaignHero campaign={campaign} sponsor={sponsor} compact />}
      <div className="px-5 py-7 text-center sm:px-8 sm:py-8">
        {showCode ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-text">Voici votre code promo</h1>
            <p className="mt-2 text-sm text-text-muted">Notez-le : nous n&apos;avons pas pu vous l&apos;envoyer par e-mail.</p>
            <p className="mt-4 rounded-input border border-dashed border-border-strong bg-canvas p-4 font-mono text-2xl font-bold tracking-widest text-text">
              {reply.code}
            </p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => {
                void navigator.clipboard?.writeText(reply.code ?? '').then(() => setCopied(true)).catch(() => {});
              }}
            >
              {copied ? 'Copié !' : 'Copier le code'}
            </Button>
          </>
        ) : neitherSentNorShown ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-text">Merci&nbsp;!</h1>
            <p className="mt-2 text-sm text-text-body">
              Votre participation est enregistrée. Si vous ne recevez pas votre code, contactez la marque.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-text">Félicitations&nbsp;!</h1>
            <p className="mt-2 text-sm text-text-body">
              Nous vous avons envoyé un e-mail avec votre code promo à <strong>{email}</strong>. Vérifiez votre boîte de
              réception (et vos spams).
            </p>
          </>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-13 w-full items-center justify-center rounded-card bg-primary px-4 text-base font-bold text-primary-contrast transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Utiliser mon code
          </a>
        )}
      </div>
    </PublicCardShell>
  );
}
