import { describe, expect, it } from 'vitest';
import { buildPromoEmail } from '@/supabase/functions/lead-submit/promoEmail';

const base = {
  firstName: 'Marie',
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
      expect(part).toContain('Marie');
    }
    expect(e.html).toContain('Utiliser mon code');
  });

  it('escapes every interpolated value in the HTML', () => {
    const e = buildPromoEmail({ ...base, firstName: '<script>x</script>', sponsor: 'A&B', code: '"><img>' });
    expect(e.html).not.toContain('<script>x');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).toContain('A&amp;B');
    expect(e.html).not.toContain('"><img>');
  });

  it('omits the link button when the link is not http(s)', () => {
    const e = buildPromoEmail({ ...base, link: 'javascript:alert(1)' });
    expect(e.html).not.toContain('javascript:');
    expect(e.text).not.toContain('javascript:');
    expect(e.html).not.toContain('Utiliser mon code');
  });
});
