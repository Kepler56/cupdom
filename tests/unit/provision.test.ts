import { describe, expect, it } from 'vitest';
import {
  AUTH_USER_EXISTS_CODES,
  generatePassword,
  isAuthUserExistsError,
  PASSWORD_ALPHABET,
  PASSWORD_LENGTH,
  RANDOM_BYTES_NEEDED,
} from '@/supabase/functions/_shared/provision';

/** Deterministic bytes, so a password test is not a coin flip. */
const bytes = (fill: number | number[]): Uint8Array =>
  typeof fill === 'number'
    ? new Uint8Array(RANDOM_BYTES_NEEDED).fill(fill)
    : Uint8Array.from(fill);

describe('generatePassword', () => {
  it('produces exactly the documented length', () => {
    expect(generatePassword(bytes(7))).toHaveLength(PASSWORD_LENGTH);
  });

  it('uses only the unambiguous alphabet', () => {
    // The team reads this password aloud or pastes it into a chat. A character
    // that could be two things costs a support round-trip.
    const password = generatePassword(bytes([...Array(RANDOM_BYTES_NEEDED).keys()].map((i) => i % 251)));
    for (const character of password) expect(PASSWORD_ALPHABET).toContain(character);
  });

  it('excludes the characters a human would misread', () => {
    for (const ambiguous of ['l', '1', 'I', 'O', '0']) {
      expect(PASSWORD_ALPHABET).not.toContain(ambiguous);
    }
  });

  it('is deterministic for the same bytes, so this suite is not flaky', () => {
    expect(generatePassword(bytes(3))).toBe(generatePassword(bytes(3)));
  });

  it('produces different passwords for different bytes', () => {
    expect(generatePassword(bytes(3))).not.toBe(generatePassword(bytes(200)));
  });

  it('skips biased bytes instead of folding them into the alphabet', () => {
    // Bytes >= UNBIASED_CEILING (228 for a 57-character alphabet) must be
    // discarded. Feeding a run of them followed by usable bytes proves the
    // `continue` runs: without it, those high bytes would be modulo-folded and
    // the password would start with the alphabet's first characters.
    const high = new Uint8Array(RANDOM_BYTES_NEEDED).fill(255);
    expect(() => generatePassword(high)).toThrow();

    const mixed = Uint8Array.from([
      ...Array(20).fill(255),
      ...Array(RANDOM_BYTES_NEEDED).fill(5),
    ]);
    expect(generatePassword(mixed)).toBe(generatePassword(new Uint8Array(RANDOM_BYTES_NEEDED).fill(5)));
  });

  it('throws rather than returning a short password when it runs out of entropy', () => {
    // Silently returning 9 characters where 16 were promised would be a security
    // defect that no caller could see.
    expect(() => generatePassword(new Uint8Array(2))).toThrow();
  });
});

describe('isAuthUserExistsError', () => {
  it('recognises both codes GoTrue uses for a taken address', () => {
    for (const code of AUTH_USER_EXISTS_CODES) {
      expect(isAuthUserExistsError({ code })).toBe(true);
    }
  });

  it('does not treat an unrelated auth error as a collision', () => {
    expect(isAuthUserExistsError({ code: 'weak_password' })).toBe(false);
  });

  it('handles a null or code-less error without throwing', () => {
    expect(isAuthUserExistsError(null)).toBe(false);
    expect(isAuthUserExistsError({})).toBe(false);
  });

  it('no longer depends on the message wording', () => {
    // The old implementation matched /already|exist|registered/i on the message.
    // This error would have passed that regex and must NOT pass now — that is
    // what proves the wording dependency is gone rather than merely unused.
    expect(isAuthUserExistsError({ message: 'user already registered' } as never)).toBe(false);
  });
});
