'use client';

import { CONSENT_TEXT_FR, PRIVACY_POLICY_HREF } from '@/lib/public/consent';
import { FieldError } from '@/components/public/FieldError';

interface ConsentCheckboxProps {
  sponsor: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

/**
 * One UN-ticked consent checkbox (AC-2/5) naming Cupdom + the sponsor, with a visible privacy link.
 * Renders the exact CONSENT_TEXT_FR(sponsor) the Edge Function re-derives and stores (AC-9).
 */
export function ConsentCheckbox({ sponsor, checked, onChange, error }: ConsentCheckboxProps) {
  return (
    <div>
      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          aria-invalid={Boolean(error)}
        />
        <span>
          {CONSENT_TEXT_FR(sponsor)}{' '}
          <a
            href={PRIVACY_POLICY_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Politique de confidentialité
          </a>
        </span>
      </label>
      <FieldError message={error} />
    </div>
  );
}
