/**
 * PURE half of client-provision. No Deno globals, no network, no crypto call —
 * the caller supplies the random bytes, which is what makes this testable and
 * why the handler stays a thin shell (same split as lead-submit's validate.ts).
 */

/**
 * Unambiguous by construction: no lowercase L, no digit one, no capital i, no
 * capital O, no zero. This password is read aloud or pasted into a chat by a
 * human under mild time pressure; a character that could be two things costs a
 * support round-trip and, worse, makes a correct password look wrong.
 */
export const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Spec §5.9: a generated 16-character password. */
export const PASSWORD_LENGTH = 16;

/**
 * The largest multiple of the alphabet length that fits in a byte. Bytes at or
 * above this are DISCARDED rather than folded in with a modulo, because 256 is
 * not a multiple of the alphabet size and folding would make the first
 * characters measurably more likely than the rest.
 */
const UNBIASED_CEILING = Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length;

/**
 * Enough bytes that rejection sampling almost never runs dry. The rejection rate
 * is (256 - UNBIASED_CEILING) / 256, so four times the password length leaves an
 * enormous margin — and `generatePassword` throws rather than truncating if it
 * ever does run out.
 */
export const RANDOM_BYTES_NEEDED = PASSWORD_LENGTH * 4;

export function generatePassword(random: Uint8Array): string {
  let password = '';
  for (const byte of random) {
    if (byte >= UNBIASED_CEILING) continue; // biased; skip it
    password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
    if (password.length === PASSWORD_LENGTH) return password;
  }
  // Never return a short password. A caller cannot tell a 9-character password
  // from a 16-character one without counting, and the failure would be silent.
  throw new Error('not enough entropy supplied');
}
