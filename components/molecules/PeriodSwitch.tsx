'use client';

import type { PeriodPreset } from '@/lib/analytics/period';

const LABELS: Record<PeriodPreset, string> = { '7j': '7 jours', '30j': '30 jours', '90j': '90 jours', tout: 'Tout' };

export function PeriodSwitch({ value, onChange }: { value: PeriodPreset; onChange: (p: PeriodPreset) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-border bg-surface p-1" role="group" aria-label="Période">
      {(Object.keys(LABELS) as PeriodPreset[]).map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => onChange(p)}
          className={`rounded-full px-3 py-1 text-sm ${value === p ? 'bg-primary font-medium text-primary-contrast' : 'text-text-muted hover:text-text'}`}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}
