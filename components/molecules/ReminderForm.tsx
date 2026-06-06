'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';

interface ReminderFormProps {
  submitting?: boolean;
  onSubmit: (input: { remindOn: string; note: string | null }) => void;
  onClose: () => void;
}

export function ReminderForm({ submitting, onSubmit, onClose }: ReminderFormProps) {
  const [remindOn, setRemindOn] = useState('');
  const [note, setNote] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nouveau rappel"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ remindOn, note: note || null });
        }}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-lg"
      >
        <h2 className="mb-4 text-base font-semibold text-text">Nouveau rappel</h2>
        <div className="space-y-4">
          <Input label="Date" type="date" value={remindOn} onChange={(e) => setRemindOn(e.target.value)} required />
          <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || remindOn === ''}>
            Ajouter
          </Button>
        </div>
      </form>
    </div>
  );
}
