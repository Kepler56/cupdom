import { describe, expect, it } from 'vitest';
import {
  CONSENT_MSG,
  EMAIL_DISPOSABLE_MSG,
  EMAIL_MSG,
  PHONE_MSG,
  REQUIRED_MSG,
  normaliseEmail,
  toE164,
  validateLead,
  type LeadInput,
} from '@/lib/public/validation';

// `phone` is E.164 — the form assembles it from the country select + the typed digits (toE164).
const valid: LeadInput = { firstName: 'Marie', lastName: 'Curie', email: 'a.b@cupdom.fr', phone: '+33612345678', consent: true };

describe('validateLead', () => {
  it('all empty → required errors on all five fields', () => {
    const e = validateLead({ firstName: '', lastName: '', email: '', phone: '', consent: false });
    expect(e.firstName).toBe(REQUIRED_MSG);
    expect(e.lastName).toBe(REQUIRED_MSG);
    expect(e.email).toBe(REQUIRED_MSG);
    expect(e.phone).toBe(REQUIRED_MSG);
    expect(e.consent).toBe(CONSENT_MSG);
    expect(Object.keys(e)).toHaveLength(5);
  });

  it('consent false → consent error; true → none', () => {
    expect(validateLead({ ...valid, consent: false }).consent).toBe(CONSENT_MSG);
    expect(validateLead({ ...valid, consent: true }).consent).toBeUndefined();
  });

  it('a fully valid input returns {}', () => {
    expect(validateLead(valid)).toEqual({});
  });

  it('normaliseEmail lowercases and trims', () => {
    expect(normaliseEmail('  Foo@Bar.FR ')).toBe('foo@bar.fr');
  });
});

describe('email syntax', () => {
  it('rejects structurally broken addresses', () => {
    for (const email of ['a@b', 'foo', 'a@@b.com', 'a b@c.fr', 'a@b.c', 'a@x..com', 'a@.x.fr', 'a@x.fr.']) {
      expect(validateLead({ ...valid, email }).email, email).toBe(EMAIL_MSG);
    }
  });

  it('rejects single-character domain labels (t@g.com)', () => {
    for (const email of ['t@g.com', 'user@a.co.uk', 'x@mail.g.com']) {
      expect(validateLead({ ...valid, email }).email, email).toBe(EMAIL_MSG);
    }
  });

  it('rejects malformed local parts', () => {
    for (const email of ['.a@x.fr', 'a.@x.fr', 'a..b@x.fr']) {
      expect(validateLead({ ...valid, email }).email, email).toBe(EMAIL_MSG);
    }
  });

  it('rejects hyphen-edged domain labels', () => {
    for (const email of ['a@-x.fr', 'a@x-.fr']) {
      expect(validateLead({ ...valid, email }).email, email).toBe(EMAIL_MSG);
    }
  });

  it('accepts consumer providers and business domains alike', () => {
    for (const email of [
      'marie.curie@gmail.com',
      'marie@yahoo.fr',
      'm.curie@orange.fr',
      'jean.dupont@decathlon.fr',
      'contact@sub.domain.co.uk',
      "o'brien+tag@hotmail.com",
    ]) {
      expect(validateLead({ ...valid, email }).email, email).toBeUndefined();
    }
  });
});

describe('email disposable-domain blocklist', () => {
  it('rejects throwaway providers with a distinct message', () => {
    for (const email of ['x@yopmail.com', 'x@mailinator.com', 'x@10minutemail.com', 'x@guerrillamail.com']) {
      expect(validateLead({ ...valid, email }).email, email).toBe(EMAIL_DISPOSABLE_MSG);
    }
  });

  it('rejects subdomains of throwaway providers', () => {
    expect(validateLead({ ...valid, email: 'x@inbox.yopmail.com' }).email).toBe(EMAIL_DISPOSABLE_MSG);
  });

  it('is case-insensitive', () => {
    expect(validateLead({ ...valid, email: 'X@YopMail.COM' }).email).toBe(EMAIL_DISPOSABLE_MSG);
  });

  it('does not catch look-alike legitimate domains', () => {
    expect(validateLead({ ...valid, email: 'x@notyopmail.com' }).email).toBeUndefined();
  });
});

describe('phone', () => {
  it('rejects a number with no country code', () => {
    for (const phone of ['0612345678', '06 12 34 56 78', '01.23.45.67.89']) {
      expect(validateLead({ ...valid, phone }).phone, phone).toBe(PHONE_MSG);
    }
  });

  it('rejects impossible national numbers for the given country', () => {
    for (const phone of ['+33000000000', '+3312345678', '+33612', '+330000000000000']) {
      expect(validateLead({ ...valid, phone }).phone, phone).toBe(PHONE_MSG);
    }
  });

  it('rejects junk', () => {
    for (const phone of ['123', 'abc', '+', '00', '526722']) {
      expect(validateLead({ ...valid, phone }).phone, phone).toBe(PHONE_MSG);
    }
  });

  it('accepts valid E.164 numbers across countries', () => {
    for (const phone of ['+33612345678', '+14155550132', '+32470123456', '+41791234567', '+447911123456']) {
      expect(validateLead({ ...valid, phone }).phone, phone).toBeUndefined();
    }
  });
});

describe('toE164', () => {
  it('assembles a national number typed in any local format', () => {
    expect(toE164('06 12 34 56 78', 'FR')).toBe('+33612345678');
    expect(toE164('612345678', 'FR')).toBe('+33612345678');
    expect(toE164('06.12.34.56.78', 'FR')).toBe('+33612345678');
    expect(toE164('(415) 555-0132', 'US')).toBe('+14155550132');
  });

  it('returns null when the digits cannot form a valid number', () => {
    expect(toE164('', 'FR')).toBeNull();
    expect(toE164('526722', 'FR')).toBeNull();
    expect(toE164('abc', 'FR')).toBeNull();
    expect(toE164('000000000', 'FR')).toBeNull();
  });
});
