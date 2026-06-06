/**
 * Opaque, immutable campaign slugs (Spec 2A, AC-8). The slug is the QR's permanent
 * identity, so it is generated from CSPRNG randomness — NEVER derived from the
 * company/name — and uses a base32-ish charset without ambiguous glyphs (no 0/o/1/i/l).
 */

/** base32-ish alphabet, lowercase, no ambiguous chars (0/o/1/i/l excluded). */
export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const SLUG_RE = /^[a-z2-9]{6,8}$/;

/** Validate the slug shape (length 6–8, lowercase a–z / 2–9). */
export function isSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

/** A fresh opaque slug. `len` is clamped to 6–8. Uses crypto for unguessability. */
export function makeSlug(len = 6): string {
  const n = Math.min(8, Math.max(6, Math.trunc(len)));
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < n; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}
