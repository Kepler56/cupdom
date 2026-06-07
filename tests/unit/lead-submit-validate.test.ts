import { describe, expect, it } from 'vitest';
import * as client from '@/lib/public/validation';
import * as edge from '@/supabase/functions/lead-submit/validate';
import type { LeadInput } from '@/lib/public/validation';

// The Edge validators MUST stay identical to the client lib (Spec 3A AC-4/5). Assert parity on a
// shared fixture set so the two never drift, plus the Edge-only anti-abuse (isSpam) logic.
const fixtures: LeadInput[] = [
  { firstName: '', lastName: '', email: '', phone: '', consent: false },
  { firstName: 'Marie', lastName: 'Curie', email: 'a.b@cupdom.fr', phone: '06 12 34 56 78', consent: true },
  { firstName: 'X', lastName: 'Y', email: 'bad@@e.com', phone: '123', consent: true },
  { firstName: 'A', lastName: 'B', email: 'ok@e.fr', phone: '+1 415 555 0132', consent: false },
];

describe('lead-submit validate parity', () => {
  it('validateLead returns identical errors to the client lib for every fixture', () => {
    for (const f of fixtures) {
      expect(edge.validateLead(f)).toEqual(client.validateLead(f));
    }
  });

  it('normaliseEmail matches the client lib (the dedup key)', () => {
    for (const e of ['  Foo@Bar.FR ', 'already@low.fr']) {
      expect(edge.normaliseEmail(e)).toBe(client.normaliseEmail(e));
    }
  });
});

describe('isSpam (Edge anti-abuse)', () => {
  it('honeypot non-empty ⇒ spam', () => {
    expect(edge.isSpam({ honeypot: 'http://x', recentSubmits: 0 })).toBe(true);
  });
  it('empty honeypot + under the rate limit ⇒ not spam', () => {
    expect(edge.isSpam({ honeypot: '', recentSubmits: 3 })).toBe(false);
    expect(edge.isSpam({ honeypot: '   ', recentSubmits: 0 })).toBe(false);
  });
  it('over the rate window ⇒ spam', () => {
    expect(edge.isSpam({ honeypot: '', recentSubmits: 6 })).toBe(true);
    expect(edge.isSpam({ honeypot: '', recentSubmits: 2, limit: 1 })).toBe(true);
  });
});
