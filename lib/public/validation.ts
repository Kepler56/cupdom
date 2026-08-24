// Pure lead-form validation (Spec 3A §3/§4, AC-4/5). Shared CONTRACT with the Edge
// Function: supabase/functions/lead-submit/validate.ts MUST keep identical rules — the
// unit test asserts parity. No DOM / Deno / network here so both sides can import it.
import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

export interface LeadInput {
  firstName: string;
  lastName: string;
  /** E.164, e.g. '+33612345678' — the form assembles it with toE164(). */
  email: string;
  phone: string;
  consent: boolean;
}

export type LeadField = 'firstName' | 'lastName' | 'email' | 'phone' | 'consent';
export type LeadErrors = Partial<Record<LeadField, string>>;

export const REQUIRED_MSG = 'Champ requis';
export const EMAIL_MSG = 'Adresse e-mail invalide';
export const EMAIL_DISPOSABLE_MSG = 'Merci d’utiliser une adresse e-mail permanente';
export const PHONE_MSG = 'Numéro de téléphone invalide';
export const CONSENT_MSG = "Vous devez accepter pour recevoir l'offre";

// Local part: dot-separated atoms, so a leading, trailing or doubled dot cannot match.
// Domain: labels of AT LEAST TWO characters, no leading/trailing hyphen, then an alphabetic TLD.
// The two-character minimum is what rejects t@g.com — syntactically perfect, but never a real
// consumer address. It also excludes x.com and q.com; acceptable for a French consumer form.
const LOCAL = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*";
const LABEL = '[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9]';
const EMAIL_RE = new RegExp(`^${LOCAL}@(?:${LABEL}\.)+[A-Za-z]{2,24}$`);

// Throwaway mailbox providers. A lead we cannot reach later is worth nothing to a sponsor, and
// these domains exist specifically to be unreachable. Curated, not exhaustive — a blocklist only
// has to cover the ones people actually reach for.
const DISPOSABLE_DOMAINS = [
  '10minutemail.com', '20minutemail.com', 'anonbox.net', 'burnermail.io', 'dispostable.com',
  'discard.email', 'emailondeck.com', 'fakeinbox.com', 'getairmail.com', 'getnada.com',
  'guerrillamail.com', 'guerrillamail.info', 'inboxbear.com', 'jetable.org', 'mail-temporaire.fr',
  'mailcatch.com', 'maildrop.cc', 'mailinator.com', 'mailnesia.com', 'mintemail.com',
  'mohmal.com', 'moakt.com', 'mytemp.email', 'sharklasers.com', 'spam4.me',
  'temp-mail.org', 'tempmail.com', 'tempmailo.com', 'throwawaymail.com', 'trashmail.com',
  'trashmail.fr', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
];

/** Lowercased + trimmed email — the dedup key (the Edge Function lowercases again server-side). */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when the address belongs to a throwaway provider, or any subdomain of one. */
export function isDisposableEmail(email: string): boolean {
  const domain = normaliseEmail(email).split('@')[1] ?? '';
  return DISPOSABLE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/**
 * E.164 only. The country select owns the dial code, so anything reaching here without a leading
 * '+' was not assembled by the form. libphonenumber's /min metadata checks each country's real
 * lengths and leading digits — enough to reject 526722, +3312345678 and +33000000000. The /max
 * metadata additionally checks operator allocation, which is 20 kB more AND rejects live numbers
 * in ranges its table has not caught up with (+33691234567 today). On a lead form a false
 * rejection costs a lead, so /min is the right side to err on.
 */
export function isValidPhone(raw: string): boolean {
  const s = raw.trim();
  if (!s.startsWith('+')) return false;
  return isValidPhoneNumber(s);
}

/** National digits in any local format + ISO country → E.164, or null when they form no valid number. */
export function toE164(national: string, country: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(national, country);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** Returns field→FR-message for every invalid field; {} when the whole input is valid. */
export function validateLead(input: LeadInput): LeadErrors {
  const errors: LeadErrors = {};

  if (input.firstName.trim() === '') errors.firstName = REQUIRED_MSG;
  if (input.lastName.trim() === '') errors.lastName = REQUIRED_MSG;

  const email = input.email.trim();
  if (email === '') errors.email = REQUIRED_MSG;
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = EMAIL_MSG;
  else if (isDisposableEmail(email)) errors.email = EMAIL_DISPOSABLE_MSG;

  const phone = input.phone.trim();
  if (phone === '') errors.phone = REQUIRED_MSG;
  else if (!isValidPhone(phone)) errors.phone = PHONE_MSG;

  if (input.consent !== true) errors.consent = CONSENT_MSG;

  return errors;
}
