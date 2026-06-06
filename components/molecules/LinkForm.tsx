'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { isSafeUrl } from '@/lib/links';

interface LinkFormProps {
  submitting?: boolean;
  onSubmit: (input: { label: string; url: string }) => void;
  onClose: () => void;
}

export function LinkForm({ submitting, onSubmit, onClose }: LinkFormProps) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!isSafeUrl(url)) {
      setError('URL non autorisée');
      return;
    }
    onSubmit({ label, url });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nouveau lien"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-lg"
      >
        <h2 className="mb-4 text-base font-semibold text-text">Nouveau lien</h2>
        <div className="space-y-4">
          <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} required />
          <Input
            label="URL"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            required
          />
        </div>
        {error && <p className="mt-3 text-sm text-danger-fg">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || label.trim() === '' || url.trim() === ''}
          >
            Ajouter
          </Button>
        </div>
      </form>
    </div>
  );
}
