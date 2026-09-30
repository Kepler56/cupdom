'use client';

import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { setProductImageUrl } from '@/lib/campaigns/campaigns';
import { PRODUCT_PHOTO_ACCEPT } from '@/lib/campaigns/productPhoto';
import { uploadProductPhoto } from '@/lib/campaigns/productPhotoUpload';
import { resizePhoto } from '@/lib/campaigns/resizePhoto';
import { httpOrNull } from '@/lib/public/safeUrl';

interface ProductPhotoUploadProps {
  slug: string;
  url: string | null;
  /** Called after a successful add/replace/remove so the page reloads the campaign. */
  onChanged: () => void;
}

/**
 * The product photo shown at the top of the public lead form. Same write path as
 * ContactLogo: file → `sponsor-media/products/{slug}/{timestamp}.{ext}`, then the
 * public URL goes on the campaign via setProductImageUrl. Big photos are downscaled in the
 * browser first (resizePhoto) so they fit the bucket's 2 Mo cap. Render it only for a
 * viewer who can edit the campaign — RLS would refuse the row update anyway.
 */
export function ProductPhotoUpload({ slug, url: rawUrl, onChanged }: ProductPhotoUploadProps) {
  const url = httpOrNull(rawUrl); // never put a non-http(s) value in <img src>
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      // Downscale first (phone photos exceed the 2 Mo bucket cap); undecodable → original, validated below.
      await uploadProductPhoto(slug, await resizePhoto(file));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi de la photo impossible. Réessayez.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    try {
      await setProductImageUrl(slug, null);
      onChanged();
    } catch {
      setError('Suppression impossible. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  const open = () => inputRef.current?.click();

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted">Photo du produit</span>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Photo du produit"
          width={192}
          height={144}
          className="aspect-[4/3] w-48 rounded-input border border-border bg-canvas object-cover"
        />
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={busy}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void onPick(e.dataTransfer.files?.[0]);
          }}
          className={`flex aspect-[4/3] w-48 flex-col items-center justify-center gap-1 rounded-input border border-dashed text-xs text-text-muted transition-colors hover:border-primary hover:text-primary ${
            dragOver ? 'border-primary bg-canvas' : 'border-border-strong'
          }`}
        >
          <Icon icon={ImagePlus} size={20} />
          Glissez une photo ici
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={PRODUCT_PHOTO_ACCEPT}
        aria-label="Fichier photo du produit"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={open}>
          {busy ? 'Envoi…' : url ? 'Remplacer' : 'Ajouter'}
        </Button>
        {url && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void onRemove()}>
            Retirer
          </Button>
        )}
      </div>
      <p className="max-w-48 text-xs text-text-muted">PNG, JPEG ou WebP. Les grandes photos sont réduites automatiquement. Affichée sur le formulaire public.</p>
      {error && (
        <p role="alert" className="max-w-60 text-sm text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
