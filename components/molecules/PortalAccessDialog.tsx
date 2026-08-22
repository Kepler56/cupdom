'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { grantPortalAccess, resetPortalPassword } from '@/lib/clientAccess';
import type { PortalAccessResult } from '@/types/domain';

interface PortalAccessDialogProps {
  contactId: string;
  contactName: string;
  onClose: () => void;
  /**
   * Reports an access event so the caller can write it to contact_history —
   * fires on an initial grant AND on a later reset/reissue, each with its own
   * password-free summary. It never receives the password.
   */
  onGranted: (summary: string) => void;
}

function copyToClipboard(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  navigator.clipboard.writeText(text).catch(() => {
    // Clipboard access can be refused (insecure origin, missing permission,
    // no clipboard in this environment). There is nothing actionable to do
    // about it here — the password is still on screen — so the rejection is
    // deliberately swallowed rather than left to surface as noise.
  });
}

export function PortalAccessDialog({ contactId, contactName, onClose, onGranted }: PortalAccessDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortalAccessResult | null>(null);
  const [canReset, setCanReset] = useState(false);

  async function grant() {
    setBusy(true);
    setError(null);
    setCanReset(false);
    const res = await grantPortalAccess(contactId);
    setBusy(false);
    if (res.ok) {
      setResult(res);
      onGranted(`Accès au portail accordé — ${res.email}`);
    } else {
      setError(res.message);
      // `already_provisioned` is the only refusal client-reset-password can
      // actually resolve: a client_accounts row already exists, so the reset
      // RPC will find it. `auth_user_exists` means the opposite — an auth
      // user with NO client_accounts row — and client-reset-password looks
      // that row up by contact_id, so offering the button there could only
      // produce a second, contradictory refusal.
      setCanReset(res.reason === 'already_provisioned');
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    const res = await resetPortalPassword(contactId);
    setBusy(false);
    if (res.ok) {
      setResult(res);
      setCanReset(false);
      onGranted(`Mot de passe du portail réinitialisé — ${res.email}`);
    } else {
      setError(res.message);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Accès au portail"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-lg">
        <h2 className="mb-2 text-base font-semibold text-text">Accès au portail — {contactName}</h2>

        {!result && (
          <p className="mb-4 text-sm text-text-muted">
            Un compte sera créé pour l’adresse e-mail du contact, et un mot de passe sera affiché une seule fois.
          </p>
        )}

        {error && (
          <p role="alert" className="mb-3 text-sm text-danger-fg">
            {error}
          </p>
        )}

        {result?.ok && (
          <div className="mb-4 space-y-2 text-sm">
            <p className="text-text-muted">{result.email}</p>
            <code className="block break-all rounded-input border border-border bg-bg px-3 py-2 text-text">
              {result.password}
            </code>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => copyToClipboard(result.password)}>
                Copier
              </Button>
            </div>
            <p className="text-danger-fg">
              Ce mot de passe ne pourra plus être affiché. Transmettez-le maintenant.
            </p>
            {result.warning && (
              <p role="status" className="text-text-muted">
                {result.warning}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {result?.ok ? 'Fermer' : 'Annuler'}
          </Button>
          {!result?.ok && canReset && (
            <Button variant="primary" disabled={busy} onClick={reset}>
              {busy ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
            </Button>
          )}
          {!result?.ok && (
            <Button variant="primary" disabled={busy} onClick={grant}>
              {busy ? 'Envoi…' : 'Donner l’accès au portail'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
