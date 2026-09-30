'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Spinner } from '@/components/atoms/Spinner';
import { ConsentCheckbox } from '@/components/public/ConsentCheckbox';
import { FieldError } from '@/components/public/FieldError';
import { EndedCampaignCard } from '@/components/public/EndedCampaignCard';
import { CONSENT_VERSION } from '@/lib/public/consent';
import { PhoneField, type PhoneValue } from '@/components/public/PhoneField';
import { toE164, validateLead, type LeadErrors } from '@/lib/public/validation';
import { requestPosition } from '@/lib/public/geolocation';
import { httpOrNull } from '@/lib/public/safeUrl';
import { CampaignCard } from '@/components/public/CampaignCard';
import { CampaignHero } from '@/components/public/CampaignHero';
import { PublicCardShell } from '@/components/public/PublicCardShell';
import { PromoSentCard } from '@/components/public/PromoSentCard';
import { EMPTY_CAMPAIGN, postFormView, postSubmit, type PromoReply, type PublicCampaign } from '@/lib/public/leadClient';

// Product-first layout: photo hero + campaign name + value line, then the fields.
// Logic/validation/a11y are the contract; the look lives in CampaignCard / CampaignHero.
type Phase = 'loading' | 'inactive' | 'active' | 'done';

export function LeadForm({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [sponsor, setSponsor] = useState('');
  const [campaign, setCampaign] = useState<PublicCampaign>(EMPTY_CAMPAIGN);
  const [promo, setPromo] = useState<PromoReply | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState<PhoneValue>({ country: 'FR', national: '' });
  const [consent, setConsent] = useState(false); // un-ticked by default (AC-2/5)
  // Optional precise location (#5), off by default. A SEPARATE explicit consent from
  // the data-sharing one: precise GPS is sensitive, so it is opt-in and captured only
  // if the browser then grants it. Denied/unavailable → we continue without it.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'pending' | 'ok' | 'denied' | 'unavailable' | 'timeout' | 'unsupported'>('idle');
  const geoToken = useRef(0); // bumped on every toggle so a late result from a cancelled request is ignored
  const [website, setWebsite] = useState(''); // honeypot — real users leave it empty
  const [errors, setErrors] = useState<LeadErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const viewSent = useRef(false); // guard StrictMode double-invoke → log form_view once (AC-3)

  useEffect(() => {
    if (viewSent.current) return;
    viewSent.current = true;
    postFormView(slug).then((res) => {
      setSponsor(res.sponsor);
      setCampaign(res.campaign);
      setPhase(res.active ? 'active' : 'inactive');
    });
  }, [slug]);

  function onToggleLocation(checked: boolean) {
    const token = ++geoToken.current;
    if (!checked) {
      setCoords(null);
      setGeoStatus('idle');
      return;
    }
    setGeoStatus('pending');
    const geo = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
    void requestPosition(geo).then((res) => {
      if (token !== geoToken.current) return; // user unticked (or re-toggled) meanwhile
      if (res.ok) {
        setCoords({ lat: res.lat, lng: res.lng });
        setGeoStatus('ok');
      } else {
        setCoords(null);
        setGeoStatus(res.reason);
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // The country select owns the dial code, so the contract value is always E.164. When the
    // digits form no valid number toE164 returns null; pass the raw text through so the empty
    // case still reads as "required" rather than "invalid".
    const e164 = toE164(phone.national, phone.country) ?? phone.national.trim();
    const found = validateLead({ firstName, lastName, email, phone: e164, consent });
    setErrors(found);
    if (Object.keys(found).length > 0) return; // hard gate — nothing sent when invalid (AC-4/5)

    setSubmitting(true);
    const result = await postSubmit({
      slug,
      firstName,
      lastName,
      email,
      phone: e164,
      consent,
      website,
      consentVersion: CONSENT_VERSION,
      // Only sent when the visitor opted in and the browser granted it.
      ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
    });
    setSubmitting(false);

    if ('redirect' in result) {
      const target = httpOrNull(result.redirect); // never navigate to a non-http(s) scheme
      if (!target) {
        setErrors({ email: 'Une erreur est survenue. Réessayez.' });
        return;
      }
      setPhase('done');
      window.location.assign(target); // the reward (AC-6/7)
    } else if ('promo' in result) {
      setPromo(result.promo);
      setPhase('done');
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
    if (promo) return <PromoSentCard reply={promo} email={email.trim()} campaign={campaign} sponsor={sponsor} />;
    return (
      <PublicCardShell>
        <CampaignHero campaign={campaign} sponsor={sponsor} compact />
        <div className="px-5 py-7 text-center sm:px-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-text">Merci&nbsp;!</h1>
          <p className="mt-2 text-sm text-text-muted">Redirection vers votre offre…</p>
        </div>
      </PublicCardShell>
    );
  }

  return (
    <PublicCardShell>
      <CampaignCard campaign={campaign} sponsor={sponsor} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 px-5 pb-6 pt-6 sm:px-8 sm:pb-8">
        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 min-[360px]:gap-3">
          <div className="min-w-0">
            <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            <FieldError message={errors.firstName} />
          </div>
          <div className="min-w-0">
            <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            <FieldError message={errors.lastName} />
          </div>
        </div>
        <div>
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={campaign.rewardType === 'promo' ? 'promo-email-note' : undefined}
          />
          {campaign.rewardType === 'promo' && (
            <p id="promo-email-note" className="mt-1 text-xs text-text-muted">
              Nous utiliserons cet e-mail pour vous envoyer votre code promo.
            </p>
          )}
          <FieldError message={errors.email} />
        </div>
        <PhoneField {...phone} onChange={setPhone} error={errors.phone} />

        <ConsentCheckbox sponsor={sponsor} checked={consent} onChange={setConsent} error={errors.consent} />

        {/* Optional precise location (#5). Separate, explicit, off by default. */}
        <div className="rounded-input border border-border p-3">
          <label className="flex items-start gap-2.5 text-sm text-text">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-primary sm:h-4 sm:w-4"
              checked={geoStatus === 'ok' || geoStatus === 'pending'}
              onChange={(e) => onToggleLocation(e.target.checked)}
            />
            <span>
              Partager ma position précise <span className="text-text-muted">(facultatif)</span>
              <span className="mt-0.5 block text-xs text-text-muted">
                Aide {sponsor || 'la marque'} à savoir où ses QR sont scannés. Vous pouvez continuer sans.
              </span>
            </span>
          </label>
          {geoStatus === 'pending' && <p className="mt-2 text-xs text-text-muted">Localisation en cours…</p>}
          {geoStatus === 'ok' && <p className="mt-2 text-xs text-success-fg">Position ajoutée.</p>}
          {geoStatus === 'denied' && (
            <p className="mt-2 text-xs text-text-muted">
              Localisation bloquée. Pour l&apos;activer : Réglages › Confidentialité › Service de localisation › Sites Safari
              (ou les réglages du site dans votre navigateur). Vous pouvez continuer sans.
            </p>
          )}
          {(geoStatus === 'unavailable' || geoStatus === 'timeout') && (
            <p className="mt-2 text-xs text-text-muted">Position introuvable pour le moment — vous pouvez continuer sans.</p>
          )}
          {geoStatus === 'unsupported' && (
            <p className="mt-2 text-xs text-text-muted">Localisation indisponible sur cet appareil.</p>
          )}
        </div>

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

        <div className="mt-2">
          <Button type="submit" disabled={submitting} className="h-13 w-full rounded-card text-base font-bold sm:text-base">
            {submitting ? 'Envoi…' : campaign.rewardType === 'promo' ? 'Recevoir mon code promo' : "Recevoir l'offre"}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
            <Lock aria-hidden size={12} strokeWidth={2.25} className="shrink-0" />
            Gratuit, sans engagement, désinscription libre.
          </p>
        </div>
      </form>
    </PublicCardShell>
  );
}
