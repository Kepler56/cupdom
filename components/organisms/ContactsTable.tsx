'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
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
  const router = useRouter();
  const href = `/contacts/${contact.id}`;

  // The whole row opens the contact hub (where deals / tâches / rappels are created).
  // The Nom stays a real <Link> for keyboard access; inner buttons stop propagation.
  return (
    <tr
      className="group cursor-pointer border-b border-border last:border-0 hover:bg-canvas"
      onClick={() => router.push(href)}
    >
      <td className="sticky left-0 z-10 bg-surface px-3 py-2.5 group-hover:bg-canvas">
        <Link href={href} className="font-medium text-text hover:underline" onClick={(e) => e.stopPropagation()}>
          {contactDisplayName(contact)}
        </Link>
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
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <>
              <button
                type="button"
                aria-label={`Modifier ${contactDisplayName(contact)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(contact);
                }}
                className="rounded-input p-1.5 text-text-muted hover:bg-canvas hover:text-text"
              >
                <Icon icon={Pencil} size={16} />
              </button>
              <button
                type="button"
                aria-label={`Supprimer ${contactDisplayName(contact)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(contact);
                }}
                className="rounded-input p-1.5 text-text-muted hover:bg-danger-bg hover:text-danger-fg"
              >
                <Icon icon={Trash2} size={16} />
              </button>
            </>
          )}
          <Icon icon={ChevronRight} size={16} className="text-text-faint" />
        </div>
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
    // `overflow-x-auto`, not `overflow-hidden`: seven columns do not fit a phone, and
    // hidden CLIPS them — the owner, the date and the row actions simply vanished with
    // nothing on screen saying so. The name column stays pinned while the rest scrolls,
    // so a reader always knows whose row they are looking at.
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-3 py-2.5 font-medium">Nom</th>
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
