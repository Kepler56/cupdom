'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { REWARD_ERROR_FR, RewardFields } from '@/components/molecules/RewardFields';
import { DuplicateDestinationDialog } from '@/components/molecules/DuplicateDestinationDialog';
import { useScope } from '@/lib/scope';
import { contactDisplayName, listContactsWithStatus } from '@/lib/contacts';
import { listDeals } from '@/lib/deals';
import { createCampaign, setCampaignState, type CampaignCreateInput } from '@/lib/campaigns/campaigns';
import { PRODUCT_PHOTO_ACCEPT, validateProductPhoto } from '@/lib/campaigns/productPhoto';
import { uploadProductPhoto } from '@/lib/campaigns/productPhotoUpload';
import { resizePhoto } from '@/lib/campaigns/resizePhoto';
import type { Campaign, ContactStatus, Deal, RewardType } from '@/types/domain';

const selectCls =
  'w-full rounded-input border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

interface CampaignCreateFormProps {
  onCreated: () => void;
  onClose: () => void;
}

/**
 * Create flow (AC-1…AC-8). Pick one of YOUR own, non-archived contacts → one of its deals
 * (required) → name + http/https destination + optional product. Duplicate destinations
 * branch to the reactivate/override dialog.
 *
 * Optional product photo: checked when picked, uploaded only AFTER the campaign exists (its
 * slug is the storage folder). A failed upload never undoes the creation — the form says so
 * and the photo can be added from the campaign page.
 */
export function CampaignCreateForm({ onCreated, onClose }: CampaignCreateFormProps) {
  const { myId } = useScope();
  const [contacts, setContacts] = useState<ContactStatus[]>([]);
  const [contactId, setContactId] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealId, setDealId] = useState('');
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [rewardType, setRewardType] = useState<RewardType>('site');
  const [promoCode, setPromoCode] = useState('');
  const [product, setProduct] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const pickToken = useRef(0); // bumped per pick/clear: a late resize of an older pick is dropped
  const [createdWithoutPhoto, setCreatedWithoutPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<{ kind: 'duplicate_active' | 'duplicate_terminee'; existing: Campaign } | null>(null);

  // Once the campaign exists, EVERY way out of the dialog must refresh the list.
  const dismiss = createdWithoutPhoto ? onCreated : onClose;
  // Esc reads the latest state through a ref, so it never uses a stale close.
  const escRef = useRef<() => void>(() => {});
  escRef.current = () => {
    if (!dup) dismiss(); // the duplicate dialog on top owns its own Cancel
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') escRef.current();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Only the caller's own, non-archived contacts are selectable (AC-1 / §9).
  useEffect(() => {
    if (!myId) return;
    listContactsWithStatus()
      .then((list) => setContacts(list.filter((c) => c.ownerId === myId && c.archivedAt === null)))
      .catch(() => {});
  }, [myId]);

  // Deals of the chosen contact.
  useEffect(() => {
    setDealId('');
    if (!contactId) {
      setDeals([]);
      return;
    }
    listDeals(contactId)
      .then(setDeals)
      .catch(() => setDeals([]));
  }, [contactId]);

  const selectedContact = contacts.find((c) => c.id === contactId);

  function buildInput(): CampaignCreateInput | null {
    if (!selectedContact) {
      setError('Choisissez un contact.');
      return null;
    }
    if (!dealId) {
      setError('Un deal est requis.');
      return null;
    }
    return {
      dealId,
      contactCompany: selectedContact.company ?? contactDisplayName(selectedContact),
      name,
      destinationUrl: destination,
      product,
      rewardType,
      promoCode,
    };
  }

  async function submit(force: boolean) {
    const input = buildInput();
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      const out = await createCampaign(input, { force });
      if (out.status === 'invalid_url' || out.status === 'missing_code' || out.status === 'code_too_long') {
        setError(REWARD_ERROR_FR[out.status]);
        return;
      }
      if (out.status === 'ok') {
        if (photo) {
          try {
            await uploadProductPhoto(out.campaign.slug, photo);
          } catch {
            // The campaign exists; keep the dialog open so the member reads why the photo is missing.
            setCreatedWithoutPhoto(true);
            return;
          }
        }
        onCreated();
        return;
      }
      setDup({ kind: out.status, existing: out.existing });
    } catch {
      setError('Création impossible (lecture seule ou champ invalide).');
    } finally {
      setBusy(false);
    }
  }

  async function reactivateExisting() {
    if (!dup) return;
    setBusy(true);
    try {
      await setCampaignState(dup.existing.slug, 'Active');
      onCreated();
    } catch {
      setError('Réactivation impossible (lecture seule).');
      setDup(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nouvelle campagne"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-text">Nouvelle campagne</h2>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Contact (vous)</span>
            <select aria-label="Contact" className={selectCls} value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {contactDisplayName(c)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Deal</span>
            <select
              aria-label="Deal"
              className={selectCls}
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              disabled={!contactId}
            >
              <option value="">—</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title ?? 'Deal sans titre'}
                </option>
              ))}
            </select>
          </label>

          <Input label="Nom de la campagne" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nike Été 2026" />
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
          <Input label="Produit (optionnel)" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="gourde, tote…" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Photo du produit (optionnel)</span>
            <input
              type="file"
              accept={PRODUCT_PHOTO_ACCEPT}
              aria-label="Photo du produit (optionnel)"
              className="text-sm text-text-body file:mr-3 file:rounded-input file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-text"
              onChange={(e) => {
                const target = e.target;
                const picked = target.files?.[0] ?? null;
                const token = ++pickToken.current;
                setPhotoError(null);
                if (!picked) {
                  setPhoto(null);
                  setPhotoBusy(false);
                  return;
                }
                // Downscale first; an undecodable file comes back as-is and fails validation clearly.
                setPhoto(null);
                setPhotoBusy(true);
                void resizePhoto(picked).then((f) => {
                  if (token !== pickToken.current) return; // a newer pick (or a clear) won
                  setPhotoBusy(false);
                  const check = validateProductPhoto(f);
                  if (!check.ok) {
                    setPhotoError(check.error);
                    setPhoto(null);
                    target.value = '';
                    return;
                  }
                  setPhoto(f);
                });
              }}
            />
            <span className="text-xs text-text-muted">PNG, JPEG ou WebP. Les grandes photos sont réduites automatiquement. Affichée sur le formulaire public.</span>
            {photoError && <span className="text-sm text-danger-fg">{photoError}</span>}
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-danger-fg">{error}</p>}
        {createdWithoutPhoto && (
          <p role="alert" className="mt-3 text-sm text-warning-fg">
            Campagne créée, mais la photo n&apos;a pas pu être envoyée. Ajoutez-la depuis la page de la campagne.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {createdWithoutPhoto ? (
            <Button variant="primary" onClick={dismiss}>
              Fermer
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={dismiss}>
                Annuler
              </Button>
              <Button variant="primary" disabled={busy || photoBusy} onClick={() => void submit(false)}>
                {busy ? 'Création…' : 'Créer'}
              </Button>
            </>
          )}
        </div>
      </div>

      {dup && (
        <DuplicateDestinationDialog
          kind={dup.kind}
          existing={dup.existing}
          onReactivate={dup.kind === 'duplicate_terminee' ? () => void reactivateExisting() : undefined}
          onCreateAnyway={() => {
            setDup(null);
            void submit(true);
          }}
          onCancel={() => setDup(null)}
        />
      )}
    </div>
  );
}
