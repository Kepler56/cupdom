'use client';

import { useState, type ChangeEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { COMPANY_SIZES, SECTORS } from '@/types/domain';
import { EMPTY_CONTACT_INPUT, type ContactInput } from '@/lib/contacts';

interface ContactFormProps {
  title: string;
  initial?: ContactInput;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (input: ContactInput) => void;
  onClose: () => void;
}

const selectClass =
  'w-full rounded-input border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

export function ContactForm({ title, initial, submitting, error, onSubmit, onClose }: ContactFormProps) {
  const [input, setInput] = useState<ContactInput>(initial ?? EMPTY_CONTACT_INPUT);

  const set =
    (key: keyof ContactInput) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setInput((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(input);
        }}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6"
      >
        <h2 className="mb-4 text-base font-semibold text-text">{title}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Prénom" value={input.firstName} onChange={set('firstName')} />
          <Input label="Nom" value={input.lastName} onChange={set('lastName')} />
          <Input label="Poste" value={input.role} onChange={set('role')} />
          <Input label="Entreprise" value={input.company} onChange={set('company')} />
          <Input label="E-mail" type="email" value={input.email} onChange={set('email')} />
          <Input label="Téléphone" value={input.phone} onChange={set('phone')} />

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Secteur</span>
            <select value={input.sector} onChange={set('sector')} className={selectClass}>
              <option value="">—</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Taille</span>
            <select value={input.companySize} onChange={set('companySize')} className={selectClass}>
              <option value="">—</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-danger-fg">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  );
}
