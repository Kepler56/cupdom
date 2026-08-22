'use client';

import { useState } from 'react';
import { setVenue } from '@/lib/campaigns/campaigns';

interface VenueInputProps {
  slug: string;
  value: string | null;
  canEdit: boolean;
}

/**
 * Owner-only "Lieu / événement" input — unlocks the portal's venue ranking
 * (Spec 5 §4.8). Saves on blur. Read-only (disabled) when the caller is not
 * the campaign owner, matching DistributedInput.
 */
export function VenueInput({ slug, value, canEdit }: VenueInputProps) {
  const [v, setV] = useState<string>(value ?? '');
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!canEdit) return;
    try {
      await setVenue(slug, v);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch {
      // read-only / RLS — ignore
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-text-muted">Lieu / événement</span>
      <input
        type="text"
        placeholder="Rex Club"
        aria-label="Lieu / événement"
        value={v}
        disabled={!canEdit}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => void save()}
        className="w-40 rounded-input border border-border-strong bg-surface px-2 py-1 text-sm text-text disabled:opacity-50"
      />
      {saved && <span className="text-xs text-success-fg">enregistré ✓</span>}
    </label>
  );
}
