'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { createClient } from '@/lib/supabase/client';
import { isAllowedEmail, normalizeEmail } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const clean = normalizeEmail(email);
    // Defence-in-depth: reject non-allow-listed emails before hitting Supabase. RLS is the real gate.
    if (!isAllowedEmail(clean)) {
      setError("Cet e-mail n'est pas autorisé à accéder à Cupdom.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: clean,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError('E-mail ou mot de passe incorrect.');
      return;
    }

    const redirect = new URLSearchParams(window.location.search).get('redirect');
    router.push(redirect && redirect.startsWith('/') ? redirect : '/apercu');
    router.refresh();
  }

  async function onForgotPassword() {
    setError(null);
    setNotice(null);
    const clean = normalizeEmail(email);
    if (!isAllowedEmail(clean)) {
      setError("Saisissez d'abord votre e-mail Cupdom.");
      return;
    }
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo: `${window.location.origin}/set-password`,
    });
    if (resetError) {
      setError("Impossible d'envoyer l'e-mail de réinitialisation.");
      return;
    }
    setNotice('Si un compte existe, un e-mail de réinitialisation vient d’être envoyé.');
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card border border-border bg-surface p-6 shadow-sm"
    >
      <h1 className="mb-1 text-lg font-semibold text-text">Connexion</h1>
      <p className="mb-5 text-sm text-text-muted">Accédez à votre CRM Cupdom.</p>

      <div className="space-y-4">
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="mt-4 text-sm text-danger-fg">{error}</p>}
      {notice && <p className="mt-4 text-sm text-success-fg">{notice}</p>}

      <Button type="submit" variant="primary" disabled={loading} className="mt-5 w-full">
        {loading ? 'Connexion…' : 'Se connecter'}
      </Button>

      <button
        type="button"
        onClick={onForgotPassword}
        className="mt-4 block w-full text-center text-sm text-text-muted underline-offset-2 hover:underline"
      >
        Mot de passe oublié ?
      </button>
    </form>
  );
}
