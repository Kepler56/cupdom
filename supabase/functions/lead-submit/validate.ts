// Pure server-side mirror of lib/public/validation.ts (Spec 3A, AC-4/5). Kept identical to the
// client lib — the unit test asserts parity on a shared fixture set. No Deno/DOM imports so it is
// importable by both the Deno function (index.ts, via ./validate.ts) and Vitest (via the @ alias).
// Deno needs the relative './validate.ts' specifier; tsc/Vitest resolve it without the extension.

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidPhone(raw: string): boolean {
  const s = raw.trim();
  if (!/^\+?[\d\s.()-]+$/.test(s)) return false;
  const digits = s.replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

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

/** Anti-abuse (AC-8): a filled honeypot, or too many submits in the rate window, is spam. */
export function isSpam(args: { honeypot: string; recentSubmits: number; limit?: number }): boolean {
  if (args.honeypot.trim() !== '') return true;
  return args.recentSubmits > (args.limit ?? 5);
}
