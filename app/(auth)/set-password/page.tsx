'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { createClient } from '@/lib/supabase/client';

const MIN_LENGTH = 12;

export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The invite / recovery link lands here with a session (detectSessionInUrl handles
  // the code exchange). Confirm we have a session before showing the form.
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Impossible de définir le mot de passe. Le lien a peut-être expiré.");
      return;
    }
    router.push('/apercu');
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card border border-border bg-surface p-6 shadow-sm"
    >
      <h1 className="mb-1 text-lg font-semibold text-text">Définir un mot de passe</h1>
      <p className="mb-5 text-sm text-text-muted">
        Choisissez un mot de passe d’au moins {MIN_LENGTH} caractères.
      </p>

      {!ready ? (
        <p className="text-sm text-text-muted">Vérification du lien…</p>
      ) : (
        <>
          <div className="space-y-4">
            <Input
              label="Nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label="Confirmer le mot de passe"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          {error && <p className="mt-4 text-sm text-danger-fg">{error}</p>}

          <Button type="submit" variant="primary" disabled={loading} className="mt-5 w-full">
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      )}
    </form>
  );
}
