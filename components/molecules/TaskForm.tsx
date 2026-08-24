'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';

interface TaskFormProps {
  submitting?: boolean;
  onSubmit: (input: { label: string; dueDate: string | null }) => void;
  onClose: () => void;
}

export function TaskForm({ submitting, onSubmit, onClose }: TaskFormProps) {
  const [label, setLabel] = useState('');
  const [due, setDue] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nouvelle tâche"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ label, dueDate: due || null });
        }}
        className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6"
      >
        <h2 className="mb-4 text-base font-semibold text-text">Nouvelle tâche</h2>
        <div className="space-y-4">
          <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} required />
          <Input label="Échéance" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || label.trim() === ''}>
            Ajouter
          </Button>
        </div>
      </form>
    </div>
  );
}
