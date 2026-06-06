'use client';

import { DEAL_STAGES, type DealStage } from '@/types/domain';

interface StageSelectProps {
  value: DealStage;
  onChange: (stage: DealStage) => void;
  disabled?: boolean;
}

/** The 5-stage pipeline select. Single source = DEAL_STAGES. */
export function StageSelect({ value, onChange, disabled }: StageSelectProps) {
  return (
    <select
      aria-label="Étape"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as DealStage)}
      className="rounded-input border border-border-strong bg-surface px-2 py-1 text-xs font-medium text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
    >
      {DEAL_STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
