'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { ContactsTable } from '@/components/organisms/ContactsTable';
import { ContactForm } from '@/components/molecules/ContactForm';
import { useScope, useScopeFilter } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import {
  contactDisplayName,
  contactToInput,
  createContact,
  deleteContact,
  listContactsWithStatus,
  updateContact,
  type ContactInput,
} from '@/lib/contacts';
import type { Contact, ContactStatus } from '@/types/domain';

export default function ContactsPage() {
  const { scope, myId } = useScope();
  const scopeFilter = useScopeFilter();
  const { profiles } = useProfiles();

  const [contacts, setContacts] = useState<ContactStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(await listContactsWithStatus());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canCreate = scope.kind === 'me';

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => scopeFilter(c.ownerId))
      .filter(
        (c) =>
          !q ||
          [c.firstName, c.lastName, c.company, c.email].some((v) =>
            v?.toLowerCase().includes(q),
          ),
      );
  }, [contacts, scopeFilter, search]);

  async function handleSubmit(input: ContactInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) await updateContact(editing.id, input);
      else if (myId) await createContact(input, myId);
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch {
      setFormError('Enregistrement impossible (lecture seule ou champ invalide).');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(contact: Contact) {
    if (!window.confirm(`Supprimer ${contactDisplayName(contact)} ?`)) return;
    try {
      await deleteContact(contact.id);
      await reload();
    } catch {
      window.alert('Suppression impossible (lecture seule).');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="w-full max-w-xs">
          <Input
            aria-label="Rechercher un contact"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + Nouveau contact
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : (
        <ContactsTable
          rows={visible}
          profiles={profiles}
          onEdit={(c) => {
            setEditing(c);
            setFormOpen(true);
          }}
          onDelete={handleDelete}
        />
      )}

      {formOpen && (
        <ContactForm
          title={editing ? 'Modifier le contact' : 'Nouveau contact'}
          initial={editing ? contactToInput(editing) : undefined}
          submitting={submitting}
          error={formError}
          onSubmit={handleSubmit}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            setFormError(null);
          }}
        />
      )}
    </div>
  );
}
