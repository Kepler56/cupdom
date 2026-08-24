'use client';

import Link from 'next/link';
import { OwnerChip } from '@/components/molecules/OwnerChip';
import { StageSelect } from '@/components/molecules/StageSelect';
import { useCanEdit } from '@/lib/scope';
import { setStage, type ScopeDeal } from '@/lib/deals';
import type { DealStage, Profile } from '@/types/domain';

const money = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function PipelineCard({
  deal,
  owner,
  onChanged,
}: {
  deal: ScopeDeal;
  owner?: Profile;
  onChanged: () => void;
}) {
  const canEdit = useCanEdit(deal.ownerId);

  async function move(stage: DealStage) {
    try {
      await setStage(deal.id, stage);
      onChanged();
    } catch {
      // read-only / RLS — ignore
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <Link href={`/contacts/${deal.contactId}`} className="font-medium text-text hover:underline">
        {deal.title ?? 'Deal'}
      </Link>
      {deal.company && <div className="text-xs text-text-muted">{deal.company}</div>}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm text-text-body">
          {deal.valueEur != null ? money.format(deal.valueEur) : '—'}
        </span>
        {owner && <OwnerChip name={owner.displayName} color={owner.color} />}
      </div>

      {canEdit && (
        <div className="mt-2">
          <StageSelect value={deal.stage} onChange={move} />
        </div>
      )}
    </div>
  );
}

interface DealColumnProps {
  stage: DealStage;
  deals: ScopeDeal[];
  profiles: Record<string, Profile>;
  onChanged: () => void;
}

export function DealColumn({ stage, deals, profiles, onChanged }: DealColumnProps) {
  const total = deals.reduce((sum, d) => sum + (d.valueEur ?? 0), 0);

  return (
    <div className="flex w-[82vw] shrink-0 snap-start flex-col gap-2 sm:w-[300px] xl:w-auto xl:shrink">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{stage}</span>
        <span className="text-xs text-text-faint">{deals.length}</span>
      </div>
      {total > 0 && <div className="px-1 text-xs text-text-faint">{money.format(total)}</div>}

      {deals.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-4 text-center text-xs text-text-faint">
          —
        </div>
      ) : (
        deals.map((d) => (
          <PipelineCard key={d.id} deal={d} owner={profiles[d.ownerId]} onChanged={onChanged} />
        ))
      )}
    </div>
  );
}
