import { describe, expect, it } from 'vitest';
import {
  generatePassword,
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

  it('rejects biased bytes rather than folding them into the alphabet', () => {
    // 256 is not a multiple of the alphabet length, so the top of the byte range
    // would over-represent the first characters. Those bytes are skipped, which
    // is why the caller must supply more bytes than the password is long.
    expect(RANDOM_BYTES_NEEDED).toBeGreaterThan(PASSWORD_LENGTH);
  });

  it('throws rather than returning a short password when it runs out of entropy', () => {
    // Silently returning 9 characters where 16 were promised would be a security
    // defect that no caller could see.
    expect(() => generatePassword(new Uint8Array(2))).toThrow();
  });
});
