'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import type { PromoReply } from '@/lib/public/leadClient';

function httpOrNull(v: string): string | null {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}

/** Promo confirmation (spec §4.4). Shows the code only when the email could not be sent. */
export function PromoSentCard({ reply, email }: { reply: PromoReply; email: string }) {
  const link = httpOrNull(reply.link);
  const [copied, setCopied] = useState(false);
  const showCode = !reply.emailed && reply.code;

  return (
    <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center shadow-sm">
      {showCode ? (
        <>
          <h1 className="text-xl font-semibold text-text">Voici votre code promo</h1>
          <p className="mt-2 text-sm text-text-muted">Notez-le : nous n&apos;avons pas pu vous l&apos;envoyer par e-mail.</p>
          <p className="mt-4 rounded-input border border-dashed border-border-strong bg-canvas p-4 font-mono text-2xl font-bold tracking-widest text-text">
            {reply.code}
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard?.writeText(reply.code ?? '').then(() => setCopied(true));
            }}
          >
            {copied ? 'Copié !' : 'Copier le code'}
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-text">Félicitations&nbsp;!</h1>
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
          className="mt-6 inline-flex w-full items-center justify-center rounded-input bg-primary px-4 py-2.5 text-sm font-semibold text-primary-contrast"
        >
          Utiliser mon code
        </a>
      )}
    </div>
  );
}
