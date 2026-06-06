import { describe, expect, it } from 'vitest';
import { ALLOWED_EMAILS, isAllowedEmail, normalizeEmail } from '@/lib/auth';

describe('auth allow-list', () => {
  it('accepts each allow-listed email', () => {
    for (const email of ALLOWED_EMAILS) {
      expect(isAllowedEmail(email)).toBe(true);
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isAllowedEmail('  Eliah@Cupdom.FR ')).toBe(true);
    expect(normalizeEmail('  Eliah@Cupdom.FR ')).toBe('eliah@cupdom.fr');
  });

  it('rejects non-allow-listed emails', () => {
    expect(isAllowedEmail('intruder@cupdom.fr')).toBe(false);
    expect(isAllowedEmail('eliah@gmail.com')).toBe(false);
  });

  it('rejects empty / nullish input', () => {
    expect(isAllowedEmail('')).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
  });

  it('keeps exactly the three Cupdom members', () => {
    expect([...ALLOWED_EMAILS]).toEqual([
      'eliah@cupdom.fr',
      'maxime@cupdom.fr',
      'contact@cupdom.fr',
    ]);
  });
});
