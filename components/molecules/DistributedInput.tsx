'use client';

import { useState } from 'react';
import { setDistributedCount } from '@/lib/campaigns/campaigns';

interface DistributedInputProps {
  slug: string;
  value: number | null;
  canEdit: boolean;
}

/**
 * Owner-only "Unités distribuées" input — the single MANUAL funnel stage (Spec 3A §6).
 * Saves on blur. Read-only (disabled) when the caller is not the campaign owner (AC-13).
 */
export function DistributedInput({ slug, value, canEdit }: DistributedInputProps) {
  const [n, setN] = useState<string>(value == null ? '' : String(value));
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!canEdit) return;
    const parsed = n.trim() === '' ? null : Math.max(0, Math.trunc(Number(n)));
    if (n.trim() !== '' && Number.isNaN(parsed)) return;
    try {
      await setDistributedCount(slug, parsed);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch {
      // read-only / RLS — ignore
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-text-muted">Unités distribuées</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        aria-label="Unités distribuées"
        value={n}
        disabled={!canEdit}
        onChange={(e) => setN(e.target.value)}
        onBlur={() => void save()}
        className="w-28 rounded-input border border-border-strong bg-surface px-2 py-1 text-sm text-text disabled:opacity-50"
      />
      {saved && <span className="text-xs text-success-fg">enregistré ✓</span>}
    </label>
  );
}
