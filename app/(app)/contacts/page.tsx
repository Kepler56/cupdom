'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { ContactsTable } from '@/components/organisms/ContactsTable';
import { ArchivedContactsPanel } from '@/components/organisms/ArchivedContactsPanel';
import { ContactForm } from '@/components/molecules/ContactForm';
import { ExportButton } from '@/components/molecules/ExportButton';
import { cn } from '@/lib/cn';
import { useScope, useScopeFilter } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import {
  contactDisplayName,
  contactToInput,
  createContact,
  deleteContact,
  listArchivedContacts,
  listContactsWithStatus,
  updateContact,
  type ContactInput,
} from '@/lib/contacts';
import type { ArchivedContact, Contact, ContactStatus } from '@/types/domain';

type View = 'actifs' | 'archives';

export default function ContactsPage() {
  const { scope, myId } = useScope();
  const scopeFilter = useScopeFilter();
  const { profiles } = useProfiles();

  const [contacts, setContacts] = useState<ContactStatus[]>([]);
  const [archived, setArchived] = useState<ArchivedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('actifs');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [active, arch] = await Promise.all([listContactsWithStatus(), listArchivedContacts()]);
      setContacts(active);
      setArchived(arch);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canCreate = view === 'actifs' && scope.kind === 'me';

  const matchesSearch = useCallback(
    (c: Contact) => {
      const q = search.trim().toLowerCase();
      return !q || [c.firstName, c.lastName, c.company, c.email].some((v) => v?.toLowerCase().includes(q));
    },
    [search],
  );

  const visible = useMemo(
    () => contacts.filter((c) => scopeFilter(c.ownerId)).filter(matchesSearch),
    [contacts, scopeFilter, matchesSearch],
  );
  const visibleArchived = useMemo(
    () => archived.filter((c) => scopeFilter(c.ownerId)).filter(matchesSearch),
    [archived, scopeFilter, matchesSearch],
  );

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

  const tabClass = (active: boolean) =>
    cn('px-3 py-1.5 text-sm', active ? 'border-b-2 border-primary font-medium text-text' : 'text-text-muted hover:text-text');

  // Contacts export over the currently visible rows (ContactStatus and ArchivedContact both extend Contact).
  const exportRows: Contact[] = view === 'actifs' ? visible : visibleArchived;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex border-b border-border">
            <button type="button" className={tabClass(view === 'actifs')} onClick={() => setView('actifs')}>
              Actifs
            </button>
            <button type="button" className={tabClass(view === 'archives')} onClick={() => setView('archives')}>
              Archivés
            </button>
          </div>
          <div className="w-56">
            <Input
              aria-label="Rechercher un contact"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton datasetId="contacts" rows={exportRows} />
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
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : view === 'actifs' ? (
        <ContactsTable
          rows={visible}
          profiles={profiles}
          onEdit={(c) => {
            setEditing(c);
            setFormOpen(true);
          }}
          onDelete={handleDelete}
        />
      ) : (
        <ArchivedContactsPanel contacts={visibleArchived} onRestored={() => void reload()} />
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
