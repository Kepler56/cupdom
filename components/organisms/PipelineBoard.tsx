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
    /*
      A board, not a list. Stacking the five stages into `grid-cols-1` on a phone
      turned the pipeline into one long column where the stage you were looking
      for was three screens down and the shape of the funnel — the whole point of
      a board — was invisible. Below `xl` it scrolls sideways with snap points
      instead, so a stage is always a swipe away and always full-width-legible.
    */
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0 xl:pb-0">
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
