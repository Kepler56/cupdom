'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { DuplicateDestinationDialog } from '@/components/molecules/DuplicateDestinationDialog';
import { useScope } from '@/lib/scope';
import { contactDisplayName, listContactsWithStatus } from '@/lib/contacts';
import { listDeals } from '@/lib/deals';
import { createCampaign, setCampaignState, type CampaignCreateInput } from '@/lib/campaigns/campaigns';
import type { Campaign, ContactStatus, Deal } from '@/types/domain';

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
 */
export function CampaignCreateForm({ onCreated, onClose }: CampaignCreateFormProps) {
  const { myId } = useScope();
  const [contacts, setContacts] = useState<ContactStatus[]>([]);
  const [contactId, setContactId] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealId, setDealId] = useState('');
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [product, setProduct] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<{ kind: 'duplicate_active' | 'duplicate_terminee'; existing: Campaign } | null>(null);

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
    };
  }

  async function submit(force: boolean) {
    const input = buildInput();
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      const out = await createCampaign(input, { force });
      if (out.status === 'invalid_url') {
        setError('Lien invalide : http/https requis.');
        return;
      }
      if (out.status === 'ok') {
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
          <Input
            label="Destination (http/https)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="https://…"
          />
          <Input label="Produit (optionnel)" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="gourde, tote…" />
        </div>

        {error && <p className="mt-3 text-sm text-danger-fg">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void submit(false)}>
            {busy ? 'Création…' : 'Créer'}
          </Button>
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
