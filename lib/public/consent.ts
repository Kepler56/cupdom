// PLACEHOLDER — pending Cupdom DPO/counsel sign-off (Spec §12). {sponsor} is injected at render.
// This is the SINGLE source of the consent wording; the Edge Function re-derives the same text
// server-side and stores it verbatim in lead_consents (prevents client tampering, AC-9).
export const CONSENT_VERSION = 'v1-2026-06';

export const CONSENT_TEXT_FR = (sponsor: string): string =>
  `J'accepte que mes données soient traitées par Cupdom et partagées avec ${sponsor} ` +
  `afin de recevoir cette offre et des communications marketing.`;

// Privacy policy page CONTENT is owned by Spec 3B; the link is present now (AC-2).
export const PRIVACY_POLICY_HREF = '/confidentialite';
