'use client';

import { useState } from 'react';
import { setInvestedAmount } from '@/lib/campaigns/campaigns';

interface InvestedAmountInputProps {
  slug: string;
  value: number | null;
  canEdit: boolean;
}

/**
 * Owner-only "Montant investi (€)" input — the sole input behind the portal's
 * « Coût par contact » tile (Spec 5 §4.7). Saves on blur. Read-only (disabled)
 * when the caller is not the campaign owner, matching DistributedInput.
 *
 * Spec 5 §4.7 consequence worth knowing: the tile appears only when EVERY
 * campaign in the client's selection carries an amount. Leaving even one
 * campaign blank hides the tile entirely for that client — partial data is
 * not a partial feature, it is no feature.
 */
export function InvestedAmountInput({ slug, value, canEdit }: InvestedAmountInputProps) {
  const [n, setN] = useState<string>(value == null ? '' : String(value));
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!canEdit) return;
    const parsed = n.trim() === '' ? null : Number(n);
    if (n.trim() !== '' && (parsed === null || Number.isNaN(parsed))) return;
    try {
      await setInvestedAmount(slug, parsed);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch {
      // read-only / RLS — ignore
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-text-muted">Montant investi (€)</span>
      <input
        type="number"
        min={0}
        step="0.01"
        aria-label="Montant investi (€)"
        title="Le portail n’affiche le coût par contact que si toutes les campagnes du sponsor ont un montant."
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
