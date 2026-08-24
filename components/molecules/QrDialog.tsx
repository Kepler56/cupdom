'use client';

import { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { downloadBlob, toPng, toSvg } from '@/lib/campaigns/qr';
import { scanUrl } from '@/lib/campaigns/redirectUrl';
import type { Campaign } from '@/types/domain';

interface QrDialogProps {
  campaign: Pick<Campaign, 'slug' | 'name'>;
  onClose: () => void;
}

/**
 * View + download the QR for a campaign's scan URL (Spec 2A, AC-9). Available in ANY
 * scope — viewing/downloading is not an edit, so it is NOT gated by useCanEdit. The QR
 * is deterministic from the immutable slug, so it never changes (AC-10).
 */
export function QrDialog({ campaign, onClose }: QrDialogProps) {
  const url = scanUrl(campaign.slug);
  const svg = useMemo(() => toSvg(url), [url]);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  function downloadSvg() {
    downloadBlob(`qr_${campaign.slug}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  }

  async function downloadPng() {
    downloadBlob(`qr_${campaign.slug}.png`, await toPng(url));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`QR — ${campaign.name ?? campaign.slug}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">QR de la campagne</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-text-muted hover:text-text">
            <Icon icon={X} size={18} />
          </button>
        </div>

        {/* Our own deterministic SVG (no user-supplied HTML) — safe to inject. */}
        <div
          className="mx-auto mb-4 h-48 w-48 rounded-card border border-border bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <button
          type="button"
          onClick={copy}
          className="mb-4 block w-full truncate rounded-input border border-border-strong bg-canvas px-3 py-2 text-center text-xs text-text-muted hover:border-primary"
          title="Copier le lien"
        >
          {copied ? 'Lien copié ✓' : url}
        </button>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => void downloadPng()}>
            <Icon icon={Download} size={15} /> PNG
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={downloadSvg}>
            <Icon icon={Download} size={15} /> SVG
          </Button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-text-faint">
          Conseil d&apos;impression : forte correction d&apos;erreur, taille ≥ 2 cm, bon contraste et une zone de
          silence (marge blanche) autour du code.
        </p>
      </div>
    </div>
  );
}
