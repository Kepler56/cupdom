// Pure lead-form validation (Spec 3A §3/§4, AC-4/5). Shared CONTRACT with the Edge
// Function: supabase/functions/lead-submit/validate.ts MUST keep identical rules — the
// unit test asserts parity. No DOM / Deno / network here so both sides can import it.

export interface LeadInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
}

export type LeadField = 'firstName' | 'lastName' | 'email' | 'phone' | 'consent';
export type LeadErrors = Partial<Record<LeadField, string>>;

export const REQUIRED_MSG = 'Champ requis';
export const EMAIL_MSG = 'Adresse e-mail invalide';
export const PHONE_MSG = 'Numéro de téléphone invalide';
export const CONSENT_MSG = "Vous devez accepter pour recevoir l'offre";

// Well-formed email, length-capped (defensive against pathological inputs).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercased + trimmed email — the dedup key (the Edge Function lowercases again server-side). */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** FR + international phone: strip separators, allow one leading '+', require 8–15 digits. */
export function isValidPhone(raw: string): boolean {
  const s = raw.trim();
  if (!/^\+?[\d\s.()-]+$/.test(s)) return false; // only digits + allowed separators / one leading +
  const digits = s.replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

/** Returns field→FR-message for every invalid field; {} when the whole input is valid. */
export function validateLead(input: LeadInput): LeadErrors {
  const errors: LeadErrors = {};

  if (input.firstName.trim() === '') errors.firstName = REQUIRED_MSG;
  if (input.lastName.trim() === '') errors.lastName = REQUIRED_MSG;

  const email = input.email.trim();
  if (email === '') errors.email = REQUIRED_MSG;
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = EMAIL_MSG;

  const phone = input.phone.trim();
  if (phone === '') errors.phone = REQUIRED_MSG;
  else if (!isValidPhone(phone)) errors.phone = PHONE_MSG;

  if (input.consent !== true) errors.consent = CONSENT_MSG;

  return errors;
}
