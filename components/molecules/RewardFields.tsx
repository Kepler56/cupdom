'use client';

import { Input } from '@/components/atoms/Input';
import { PROMO_CODE_MAX, type RewardError } from '@/lib/campaigns/campaigns';
import type { RewardType } from '@/types/domain';

export const REWARD_ERROR_FR: Record<RewardError, string> = {
  invalid_url: 'Lien invalide : http/https requis.',
  missing_code: 'Saisissez le code promo.',
  code_too_long: `Le code promo ne peut pas dépasser ${PROMO_CODE_MAX} caractères.`,
};

type Patch = Partial<{ rewardType: RewardType; promoCode: string; destination: string }>;

const OPTIONS: { value: RewardType; label: string }[] = [
  { value: 'site', label: 'Site web du client' },
  { value: 'promo', label: 'Code promo' },
];

/** Reward picker shared by the create form and the edit dialog (spec §4.1). */
export function RewardFields({
  rewardType,
  promoCode,
  destination,
  onChange,
}: {
  rewardType: RewardType;
  promoCode: string;
  destination: string;
  onChange: (patch: Patch) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs font-medium text-text-muted">Récompense du participant</legend>
      {/* Buttons with role="radio" (not <label>+<input>) so the "Code promo" option is not also
          picked up as a label of the promo-code text field. */}
      <div role="radiogroup" aria-label="Récompense du participant" className="grid grid-cols-2 gap-1 rounded-input border border-border bg-canvas p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={rewardType === o.value}
            onClick={() => onChange({ rewardType: o.value })}
            className={`rounded-input px-3 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              rewardType === o.value ? 'bg-surface font-medium text-text shadow-sm' : 'text-text-muted'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {rewardType === 'promo' && (
        <Input
          label="Code promo"
          value={promoCode}
          maxLength={PROMO_CODE_MAX}
          onChange={(e) => onChange({ promoCode: e.target.value })}
          placeholder="CUPDOM10"
        />
      )}
      <Input
        label={rewardType === 'promo' ? 'Lien pour utiliser le code (http/https)' : 'Destination (http/https)'}
        value={destination}
        onChange={(e) => onChange({ destination: e.target.value })}
        placeholder="https://…"
      />
    </fieldset>
  );
}
