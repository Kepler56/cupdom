'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { LinkRow } from '@/components/molecules/LinkRow';
import { LinkForm } from '@/components/molecules/LinkForm';
import { useCanEdit } from '@/lib/scope';
import { createLink, deleteLink, listLinks } from '@/lib/links';
import type { ContactLink, ContactStatus } from '@/types/domain';

export function LinkList({ contact }: { contact: ContactStatus }) {
  const canEdit = useCanEdit(contact.ownerId);
  const [links, setLinks] = useState<ContactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await listLinks(contact.id));
    } finally {
      setLoading(false);
    }
  }, [contact.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function add(input: { label: string; url: string }) {
    setSubmitting(true);
    try {
      await createLink({ contactId: contact.id, ...input });
      setFormOpen(false);
      await reload();
    } catch {
      /* createLink already validated the scheme; an error here is read-only / RLS */
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(link: ContactLink) {
    try {
      await deleteLink(link.id);
      await reload();
    } catch {
      /* read-only */
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setFormOpen(true)}>
            + Nouveau lien
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun lien.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <LinkRow key={l.id} link={l} canEdit={canEdit} onDelete={() => remove(l)} />
          ))}
        </div>
      )}

      {formOpen && <LinkForm submitting={submitting} onSubmit={add} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
