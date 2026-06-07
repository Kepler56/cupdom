import { describe, expect, it } from 'vitest';
import {
  CONSENT_MSG,
  EMAIL_MSG,
  PHONE_MSG,
  REQUIRED_MSG,
  normaliseEmail,
  validateLead,
  type LeadInput,
} from '@/lib/public/validation';

const valid: LeadInput = { firstName: 'Marie', lastName: 'Curie', email: 'a.b@cupdom.fr', phone: '06 12 34 56 78', consent: true };

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

  it('bad emails → email error; good email → none', () => {
    for (const email of ['a@b', 'foo', 'a@@b.com', 'a b@c.fr']) {
      expect(validateLead({ ...valid, email }).email).toBe(EMAIL_MSG);
    }
    expect(validateLead({ ...valid, email: 'a.b@cupdom.fr' }).email).toBeUndefined();
  });

  it('bad phones → phone error; good FR + international → none', () => {
    for (const phone of ['123', 'abc', '+', '00']) {
      expect(validateLead({ ...valid, phone }).phone).toBe(PHONE_MSG);
    }
    for (const phone of ['06 12 34 56 78', '+33612345678', '+1 415 555 0132', '01.23.45.67.89']) {
      expect(validateLead({ ...valid, phone }).phone).toBeUndefined();
    }
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
