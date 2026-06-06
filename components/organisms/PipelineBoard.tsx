'use client';

import { DealColumn } from './DealColumn';
import { useProfiles } from '@/lib/profiles';
import { DEAL_STAGES } from '@/types/domain';
import type { ScopeDeal } from '@/lib/deals';

interface PipelineBoardProps {
  deals: ScopeDeal[];
  onChanged: () => void;
}

/** A board of the 5 pipeline stages, each column holding its deals (current scope). */
export function PipelineBoard({ deals, onChanged }: PipelineBoardProps) {
  const { profiles } = useProfiles();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {DEAL_STAGES.map((stage) => (
        <DealColumn
          key={stage}
          stage={stage}
          deals={deals.filter((d) => d.stage === stage)}
          profiles={profiles}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
