'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { createClient } from '@/lib/supabase/client';

const MAX_BYTES = 2 * 1024 * 1024; // 2 Mo — matches the sponsor-media bucket limit.
// Raster only. SVG is excluded: it can carry script and would be served from the
// Supabase origin that both apps' CSP allow-list for images.
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/**
 * The sponsor's logo, managed from the CRM (#8 — « ajout du logo côté CRM »).
 *
 * Lives on the contact's profile card, the screen a member lands on right after
 * creating a client. The same `contacts.sponsor_logo_url` the portal reads
 * (client_profile(), migration 0020), so a logo set here shows in the client's
 * « Mon compte » too.
 *
 * Write path, both halves already enforced server-side:
 *   - the file goes to `sponsor-media/logos/{contactId}/…` — allowed for any Cupdom
 *     member by the storage policy « sponsor-media member write » (0021);
 *   - the URL is written to the contact row, which RLS lets ONLY the contact's
 *     owner update (« contacts update own »). The upload control is therefore shown
 *     only when `canEdit`, matching the card's other owner-only actions.
 *
 * Loads its own value rather than widening the Contact type, so no other screen or
 * fixture changes.
 */
export function ContactLogo({ contactId, canEdit }: { contactId: string; canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createClient()
      .from('contacts')
      .select('sponsor_logo_url')
      .eq('id', contactId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setUrl((data as { sponsor_logo_url: string | null } | null)?.sponsor_logo_url ?? null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [contactId]);

  async function save(next: string | null) {
    const { error: upErr } = await createClient()
      .from('contacts')
      .update({ sponsor_logo_url: next })
      .eq('id', contactId);
    if (upErr) {
      setError('Enregistrement impossible (seul le propriétaire du contact peut modifier le logo).');
      return false;
    }
    setUrl(next);
    return true;
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    const ext = EXT[file.type];
    if (!ext) {
      setError('Formats acceptés : PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Le logo doit peser moins de 2 Mo.');
      return;
    }

    setBusy(true);
    const supabase = createClient();
    // Random suffix: no stale CDN copy after a replace, and a non-enumerable path.
    const path = `logos/${contactId}/logo-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error: storageErr } = await supabase.storage
      .from('sponsor-media')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (storageErr) {
      setError('Envoi impossible. Réessayez.');
      setBusy(false);
      return;
    }
    const { data: pub } = supabase.storage.from('sponsor-media').getPublicUrl(path);
    await save(pub.publicUrl);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    await save(null);
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {url ? (
        <img
          src={url}
          alt="Logo du client"
          width={56}
          height={56}
          className="h-14 w-14 rounded-card border border-border bg-canvas object-contain"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-card border border-dashed border-border text-xs text-text-faint">
          {loaded ? 'Aucun' : '…'}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? 'Envoi…' : url ? 'Remplacer' : 'Ajouter un logo'}
            </Button>
            {url && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onRemove}>
                Retirer
              </Button>
            )}
          </div>
          <p className="text-xs text-text-muted">PNG, JPEG ou WebP, 2 Mo max. Visible dans le portail du client.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="w-full text-sm text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
