'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Spinner } from '@/components/atoms/Spinner';
import { ConsentCheckbox } from '@/components/public/ConsentCheckbox';
import { FieldError } from '@/components/public/FieldError';
import { EndedCampaignCard } from '@/components/public/EndedCampaignCard';
import { CONSENT_VERSION } from '@/lib/public/consent';
import { validateLead, type LeadErrors } from '@/lib/public/validation';
import { postFormView, postSubmit } from '@/lib/public/leadClient';

// Visuals are intentionally minimal — Spec 4 owns the form polish. Logic/validation/a11y are the contract.
type Phase = 'loading' | 'inactive' | 'active' | 'done';

export function LeadForm({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sponsor, setSponsor] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false); // un-ticked by default (AC-2/5)
  const [website, setWebsite] = useState(''); // honeypot — real users leave it empty
  const [errors, setErrors] = useState<LeadErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const viewSent = useRef(false); // guard StrictMode double-invoke → log form_view once (AC-3)

  useEffect(() => {
    if (viewSent.current) return;
    viewSent.current = true;
    postFormView(slug).then((res) => {
      setSponsor(res.sponsor);
      setPhase(res.active ? 'active' : 'inactive');
    });
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateLead({ firstName, lastName, email, phone, consent });
    setErrors(found);
    if (Object.keys(found).length > 0) return; // hard gate — nothing sent when invalid (AC-4/5)

    setSubmitting(true);
    const result = await postSubmit({
      slug,
      firstName,
      lastName,
      email,
      phone,
      consent,
      website,
      consentVersion: CONSENT_VERSION,
    });
    setSubmitting(false);

    if ('redirect' in result) {
      setPhase('done');
      window.location.assign(result.redirect); // the reward (AC-6/7)
    } else {
      setErrors(result.errors);
    }
  }

  if (phase === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (phase === 'inactive') return <EndedCampaignCard />;

  if (phase === 'done') {
    return (
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-text">Merci&nbsp;!</h1>
        <p className="mt-2 text-sm text-text-muted">Redirection vers votre offre…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
      <span
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-input bg-primary text-lg font-bold uppercase text-primary-contrast"
        aria-hidden
      >
        {sponsor.trim().charAt(0) || 'C'}
      </span>
      <h1 className="mb-1 text-xl font-semibold text-text">Pour accéder à l&apos;offre de {sponsor}</h1>
      <p className="mb-6 text-sm text-text-muted">
        Renseignez vos coordonnées pour recevoir votre offre. C&apos;est rapide et sans engagement.
      </p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          <FieldError message={errors.firstName} />
        </div>
        <div>
          <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          <FieldError message={errors.lastName} />
        </div>
        <div>
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError message={errors.email} />
        </div>
        <div>
          <Input
            label="Téléphone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <FieldError message={errors.phone} />
        </div>

        <ConsentCheckbox sponsor={sponsor} checked={consent} onChange={setConsent} error={errors.consent} />

        {/* Honeypot: hidden from real users; bots fill it; the server drops spam (AC-8). */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        <Button type="submit" disabled={submitting} className="mt-2 w-full">
          {submitting ? 'Envoi…' : "Recevoir l'offre"}
        </Button>
      </form>
    </div>
  );
}
