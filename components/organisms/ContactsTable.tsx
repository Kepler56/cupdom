'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { OwnerChip } from '@/components/molecules/OwnerChip';
import { StatutBadge } from '@/components/molecules/StatutBadge';
import { useCanEdit } from '@/lib/scope';
import { contactDisplayName } from '@/lib/contacts';
import type { Contact, ContactStatus, Profile } from '@/types/domain';

const fmtDate = (iso: string) => new Intl.DateTimeFormat('fr-FR').format(new Date(iso));

interface ContactsTableProps {
  rows: ContactStatus[];
  profiles: Record<string, Profile>;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

function ContactRow({
  contact,
  owner,
  onEdit,
  onDelete,
}: {
  contact: ContactStatus;
  owner?: Profile;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
}) {
  const canEdit = useCanEdit(contact.ownerId);

  return (
    <tr className="border-b border-border last:border-0 hover:bg-canvas">
      <td className="px-3 py-2.5">
        <div className="font-medium text-text">{contactDisplayName(contact)}</div>
        {contact.role && <div className="text-xs text-text-muted">{contact.role}</div>}
      </td>
      <td className="px-3 py-2.5 text-text-body">{contact.company ?? '—'}</td>
      <td className="px-3 py-2.5 text-text-body">{contact.sector ?? '—'}</td>
      <td className="px-3 py-2.5">
        <StatutBadge statut={contact.statut} />
      </td>
      <td className="px-3 py-2.5">
        {owner ? <OwnerChip name={owner.displayName} color={owner.color} /> : '—'}
      </td>
      <td className="px-3 py-2.5 text-text-muted">{fmtDate(contact.updatedAt)}</td>
      <td className="px-3 py-2.5 text-right">
        {canEdit && (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              aria-label={`Modifier ${contactDisplayName(contact)}`}
              onClick={() => onEdit(contact)}
              className="rounded-input p-1.5 text-text-muted hover:bg-canvas hover:text-text"
            >
              <Icon icon={Pencil} size={16} />
            </button>
            <button
              type="button"
              aria-label={`Supprimer ${contactDisplayName(contact)}`}
              onClick={() => onDelete(contact)}
              className="rounded-input p-1.5 text-text-muted hover:bg-danger-bg hover:text-danger-fg"
            >
              <Icon icon={Trash2} size={16} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function ContactsTable({ rows, profiles, onEdit, onDelete }: ContactsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-10 text-center text-sm text-text-muted">
        Aucun contact.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium">Nom</th>
            <th className="px-3 py-2.5 font-medium">Entreprise</th>
            <th className="px-3 py-2.5 font-medium">Secteur</th>
            <th className="px-3 py-2.5 font-medium">Statut</th>
            <th className="px-3 py-2.5 font-medium">Propriétaire</th>
            <th className="px-3 py-2.5 font-medium">Mis à jour</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              owner={profiles[c.ownerId]}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
