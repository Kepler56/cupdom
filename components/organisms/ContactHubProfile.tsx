'use client';

import type { LucideIcon } from 'lucide-react';
import { Building2, Mail, Phone } from 'lucide-react';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { StatutBadge } from '@/components/molecules/StatutBadge';
import { OwnerChip } from '@/components/molecules/OwnerChip';
import { useCanEdit } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import { contactDisplayName } from '@/lib/contacts';
import type { ContactStatus } from '@/types/domain';

interface ContactHubProfileProps {
  contact: ContactStatus;
  onEdit: () => void;
  onTransfer: () => void;
  onArchive: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">{title}</div>
      {children}
    </div>
  );
}

function Line({ icon, value }: { icon: LucideIcon; value: string | null }) {
  return (
    <div className="flex items-center gap-2 text-text-body">
      <span className="text-text-faint">
        <Icon icon={icon} size={15} />
      </span>
      <span>{value ?? '—'}</span>
    </div>
  );
}

export function ContactHubProfile({ contact, onEdit, onTransfer, onArchive }: ContactHubProfileProps) {
  const canEdit = useCanEdit(contact.ownerId);
  const { profiles } = useProfiles();
  const owner = profiles[contact.ownerId];
  const name = contactDisplayName(contact);

  return (
    <div className="space-y-5 rounded-card border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <Avatar name={name} size="lg" />
        <div className="min-w-0">
          <div className="truncate font-semibold text-text">{name}</div>
          {contact.role && <div className="truncate text-sm text-text-muted">{contact.role}</div>}
        </div>
      </div>

      <Section title="Statut">
        <StatutBadge statut={contact.statut} />
      </Section>

      <Section title="Propriétaire">
        {owner ? <OwnerChip name={owner.displayName} color={owner.color} /> : <span className="text-sm text-text-muted">—</span>}
      </Section>

      <Section title="Coordonnées">
        <div className="space-y-1 text-sm">
          <Line icon={Mail} value={contact.email} />
          <Line icon={Phone} value={contact.phone} />
        </div>
      </Section>

      <Section title="Business">
        <div className="space-y-1 text-sm">
          <Line icon={Building2} value={contact.company} />
          <div className="text-text-muted">Secteur : {contact.sector ?? '—'}</div>
          <div className="text-text-muted">Taille : {contact.companySize ?? '—'}</div>
        </div>
      </Section>

      {canEdit && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Modifier
          </Button>
          <Button size="sm" variant="secondary" onClick={onTransfer}>
            Transférer
          </Button>
          <Button size="sm" variant="danger-outline" onClick={onArchive}>
            Archiver
          </Button>
        </div>
      )}
    </div>
  );
}
