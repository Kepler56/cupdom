import { describe, expect, it } from 'vitest';
import { buildPromoEmail } from '@/supabase/functions/lead-submit/promoEmail';

const base = {
  sponsor: 'Nike',
  campaignName: 'Été 2026',
  product: 'gourde',
  code: 'CUPDOM10',
  link: 'https://nike.fr/panier',
};

describe('buildPromoEmail', () => {
  it('carries the code, the link and the sponsor', () => {
    const e = buildPromoEmail(base);
    expect(e.subject).toBe('Votre code promo Nike');
    for (const part of [e.html, e.text]) {
      expect(part).toContain('CUPDOM10');
      expect(part).toContain('https://nike.fr/panier');
      expect(part).toContain('Bonjour,');
    }
    expect(e.html).toContain('Utiliser mon code');
  });

  it('escapes every interpolated value in the HTML', () => {
    const e = buildPromoEmail({ ...base, campaignName: '<script>x</script>', sponsor: 'A&B', code: '"><img>' });
    expect(e.html).not.toContain('<script>x');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).toContain('A&amp;B');
    expect(e.html).not.toContain('"><img>');
  });

  it('carries no participant-supplied text: the input has no such field, and extras are ignored', () => {
    // The recipient address is whatever the visitor typed, so anything they typed that reached
    // the body would let them mail arbitrary content from our domain. Smuggle form fields in
    // and check none of them surface.
    const participant = { firstName: 'VISIT-EVIL-SITE', lastName: 'FREE-MONEY-NOW', email: 'victim@x.fr', phone: '+33600000000' };
    const e = buildPromoEmail({ ...base, ...participant } as never);
    for (const part of [e.subject, e.html, e.text]) {
      for (const v of Object.values(participant)) expect(part).not.toContain(v);
    }
    expect(e.text.startsWith('Bonjour,\n')).toBe(true);
    expect(e.html).toContain('<p>Bonjour,</p>');
  });

  it('omits the link button when the link is not http(s)', () => {
    const e = buildPromoEmail({ ...base, link: 'javascript:alert(1)' });
    expect(e.html).not.toContain('javascript:');
    expect(e.text).not.toContain('javascript:');
    expect(e.html).not.toContain('Utiliser mon code');
  });
});
