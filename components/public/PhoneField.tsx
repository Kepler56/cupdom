'use client';

// Phone entry for the public lead form: a country/dial-code select fused to the number input.
// The select owns the country so validation can apply that country's real numbering rules — a
// bare national string is ambiguous, and "8 to 15 digits" accepts 00 00 00 00.
import { useId } from 'react';
import { AsYouType, getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';
import { cn } from '@/lib/cn';
import { FieldError } from '@/components/public/FieldError';

export interface PhoneCountry {
  code: CountryCode;
  dial: string;
  name: string;
}

// Cupdom's own market first, then the countries its consumers most plausibly come from, then
// everything else alphabetically — so the common case is one tap, not a scroll through 245 rows.
const PINNED: CountryCode[] = ['FR', 'BE', 'CH', 'LU', 'DE', 'ES', 'IT', 'GB', 'PT', 'NL', 'MA', 'DZ', 'TN', 'US', 'CA'];

const NAMES = new Intl.DisplayNames(['fr'], { type: 'region' });
const countryName = (code: CountryCode): string => NAMES.of(code) ?? code;

function build(): PhoneCountry[] {
  const all = getCountries();
  const rest = all
    .filter((c) => !PINNED.includes(c))
    .map((code) => ({ code, dial: getCountryCallingCode(code), name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const pinned = PINNED.filter((c) => all.includes(c)).map((code) => ({
    code,
    dial: getCountryCallingCode(code),
    name: countryName(code),
  }));
  return [...pinned, ...rest];
}

export const PHONE_COUNTRIES: PhoneCountry[] = build();

export interface PhoneValue {
  country: CountryCode;
  national: string;
}

interface PhoneFieldProps extends PhoneValue {
  onChange: (value: PhoneValue) => void;
  error?: string;
}

export function PhoneField({ country, national, onChange, error }: PhoneFieldProps) {
  const inputId = useId();
  const dial = getCountryCallingCode(country);

  return (
    <div>
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-xs font-medium text-text-muted">
          Téléphone
        </label>
        {/* One bordered box around both controls so they read as a single field. */}
        <div
          className={cn(
            'flex w-full items-stretch rounded-input border bg-surface',
            'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary',
            error ? 'border-danger-fg' : 'border-border-strong',
          )}
        >
          <div className="relative flex shrink-0 items-center gap-1 pl-3 pr-2 text-base text-text sm:text-sm">
            <span aria-hidden>+{dial}</span>
            <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 text-text-muted" fill="none" stroke="currentColor">
              <path d="M3 4.5 6 7.5 9 4.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* The real control, transparent over the display above: keeps the native mobile
                picker (a searchable wheel) instead of reimplementing a combobox. */}
            <select
              aria-label="Indicatif pays"
              value={country}
              onChange={(e) => onChange({ country: e.target.value as CountryCode, national })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} +{c.dial}
                </option>
              ))}
            </select>
          </div>
          <span aria-hidden className={cn('my-2 w-px', error ? 'bg-danger-fg' : 'bg-border')} />
          <input
            id={inputId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-invalid={error ? true : undefined}
            value={national}
            onChange={(e) => onChange({ country, national: new AsYouType(country).input(e.target.value) })}
            className={cn(
              'w-full min-w-0 rounded-r-input bg-transparent px-3 py-2.5 text-base text-text sm:py-2 sm:text-sm',
              'placeholder:text-text-faint focus:outline-none',
            )}
          />
        </div>
      </div>
      <FieldError message={error} />
    </div>
  );
}
