'use client';

import { Pencil } from 'lucide-react';
import { Tag } from '@/components/atoms/Tag';
import { Icon } from '@/components/atoms/Icon';
import { StageSelect } from './StageSelect';
import { STAGE_TONE } from '@/lib/status';
import type { Deal, DealStage } from '@/types/domain';

const money = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('fr-FR').format(new Date(iso)) : '—';

interface DealCardProps {
  deal: Deal;
  canEdit: boolean;
  onStage: (stage: DealStage) => void;
  onEdit: () => void;
}

export function DealCard({ deal, canEdit, onStage, onEdit }: DealCardProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-text">{deal.title ?? 'Deal'}</div>
        {canEdit && (
          <button
            type="button"
            aria-label="Modifier le deal"
            onClick={onEdit}
            className="rounded-input p-1 text-text-muted hover:bg-canvas hover:text-text"
          >
            <Icon icon={Pencil} size={15} />
          </button>
        )}
      </div>

      <div className="mt-2">
        {canEdit ? (
          <StageSelect value={deal.stage} onChange={onStage} />
        ) : (
          <Tag tone={STAGE_TONE[deal.stage]}>{deal.stage}</Tag>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
        <span>{deal.valueEur != null ? money.format(deal.valueEur) : '—'}</span>
        <span>Clôture : {fmtDate(deal.expectedClose)}</span>
      </div>
    </div>
  );
}
