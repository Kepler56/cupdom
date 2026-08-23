// Pure server-side mirror of lib/public/consent.ts. Kept byte-identical to it — the unit test
// asserts parity, exactly as validate.ts does against lib/public/validation.ts. No Deno/DOM
// imports, so it is importable by both the Deno function (index.ts, via './consent.ts') and
// Vitest (via the @ alias).
//
// WHY THIS MATTERS MORE THAN THE OTHER MIRRORS: lib/public/consent.ts is what the consumer READS
// on the form; this copy is what gets STORED verbatim in lead_consents as the accountability
// evidence. If the two ever drift, a person agrees to one sentence and a different one is recorded
// as proof of what they agreed to — which defeats the entire purpose of the table, and would be
// invisible because each file looks correct on its own.
//
// The Edge Function re-derives the text server-side rather than trusting the request payload, so a
// tampered client cannot change what is recorded (AC-9).

// PLACEHOLDER — pending Cupdom DPO/counsel sign-off (Spec §12). {sponsor} is injected at render.
export const CONSENT_VERSION = 'v1-2026-06';

export const CONSENT_TEXT_FR = (sponsor: string): string =>
  `J'accepte que mes données soient traitées par Cupdom et partagées avec ${sponsor} ` +
  `afin de recevoir cette offre et des communications marketing.`;
