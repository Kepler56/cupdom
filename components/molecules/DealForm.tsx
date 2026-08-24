'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { StageSelect } from './StageSelect';
import type { DealInput } from '@/lib/deals';
import type { DealStage } from '@/types/domain';

interface DealFormProps {
  title: string;
  initial?: DealInput;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (input: DealInput) => void;
  onClose: () => void;
}

type FormState = { title: string; stage: DealStage; valueEur: string; expectedClose: string };

function toState(initial?: DealInput): FormState {
  return {
    title: initial?.title ?? '',
    stage: initial?.stage ?? 'QUALIFICATION',
    valueEur: initial?.valueEur != null ? String(initial.valueEur) : '',
    expectedClose: initial?.expectedClose ?? '',
  };
}

export function DealForm({ title, initial, submitting, error, onSubmit, onClose }: DealFormProps) {
  const [form, setForm] = useState<FormState>(toState(initial));

  function submit() {
    const valueEur = form.valueEur.trim() === '' ? null : Number(form.valueEur);
    onSubmit({
      title: form.title,
      stage: form.stage,
      valueEur: Number.isNaN(valueEur as number) ? null : valueEur,
      expectedClose: form.expectedClose === '' ? null : form.expectedClose,
    });
  }

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
          submit();
        }}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6"
      >
        <h2 className="mb-4 text-base font-semibold text-text">{title}</h2>

        <div className="space-y-4">
          <Input
            label="Titre"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Étape</span>
            <StageSelect value={form.stage} onChange={(stage) => setForm((f) => ({ ...f, stage }))} />
          </label>
          <Input
            label="Valeur (€)"
            type="number"
            min="0"
            value={form.valueEur}
            onChange={(e) => setForm((f) => ({ ...f, valueEur: e.target.value }))}
          />
          <Input
            label="Date de clôture prévue"
            type="date"
            value={form.expectedClose}
            onChange={(e) => setForm((f) => ({ ...f, expectedClose: e.target.value }))}
          />
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
