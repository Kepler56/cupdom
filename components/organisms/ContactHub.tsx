'use client';

import { useCallback, useEffect, useState } from 'react';
import { ContactHubProfile } from './ContactHubProfile';
import { ContactForm } from '@/components/molecules/ContactForm';
import { TransferDialog } from '@/components/molecules/TransferDialog';
import { ComingSoon } from '@/components/molecules/ComingSoon';
import { cn } from '@/lib/cn';
import {
  contactDisplayName,
  contactToInput,
  getContactWithStatus,
  updateContact,
  type ContactInput,
} from '@/lib/contacts';
import { appendHistory } from '@/lib/history';
import type { ContactStatus } from '@/types/domain';

const TABS = ['Deals', 'Tâches', 'Rappels', 'Liens', 'Historique'] as const;
type Tab = (typeof TABS)[number];

export function ContactHub({ contactId }: { contactId: string }) {
  const [contact, setContact] = useState<ContactStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Deals');
  const [editing, setEditing] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setContact(await getContactWithStatus(contactId));
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;
  if (!contact) return <p className="text-sm text-text-muted">Contact introuvable.</p>;

  async function handleSave(input: ContactInput) {
    if (!contact) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await updateContact(contact.id, input);
      await appendHistory(contact.id, 'contact_edit', `${contactDisplayName(contact)} modifié`);
      setEditing(false);
      await reload();
    } catch {
      setFormError('Enregistrement impossible (lecture seule ou champ invalide).');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <ContactHubProfile
        contact={contact}
        onEdit={() => setEditing(true)}
        onTransfer={() => setTransferOpen(true)}
      />

      <div>
        <div className="mb-4 flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-2 text-sm',
                tab === t
                  ? 'border-b-2 border-primary font-medium text-text'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* The Deals tab content arrives in plan 1B-5; other tabs in 1C. */}
        <ComingSoon feature={tab} />
      </div>

      {editing && (
        <ContactForm
          title="Modifier le contact"
          initial={contactToInput(contact)}
          submitting={submitting}
          error={formError}
          onSubmit={handleSave}
          onClose={() => {
            setEditing(false);
            setFormError(null);
          }}
        />
      )}

      {transferOpen && (
        <TransferDialog
          contact={contact}
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}
