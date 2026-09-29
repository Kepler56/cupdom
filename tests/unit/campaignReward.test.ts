import { describe, expect, it } from 'vitest';
import { PROMO_CODE_MAX, rewardFieldsOrError } from '@/lib/campaigns/campaigns';

describe('rewardFieldsOrError', () => {
  it('site mode: validates the url and leaves promo_code untouched (reversible switch)', () => {
    const r = rewardFieldsOrError({ rewardType: 'site', promoCode: 'OLD10', destinationUrl: 'nike.fr/ete' });
    expect(r).toEqual({ ok: true, fields: { reward_type: 'site', destination_url: 'https://nike.fr/ete' } });
  });

  it('promo mode: trims the code and validates the link', () => {
    const r = rewardFieldsOrError({ rewardType: 'promo', promoCode: '  CUPDOM10 ', destinationUrl: 'https://nike.fr/panier' });
    expect(r).toEqual({
      ok: true,
      fields: { reward_type: 'promo', promo_code: 'CUPDOM10', destination_url: 'https://nike.fr/panier' },
    });
  });

  it('promo with blank code → missing_code', () => {
    expect(rewardFieldsOrError({ rewardType: 'promo', promoCode: '   ', destinationUrl: 'https://a.fr' })).toEqual({
      ok: false,
      error: 'missing_code',
    });
  });

  it('promo with an over-long code → code_too_long', () => {
    const code = 'X'.repeat(PROMO_CODE_MAX + 1);
    expect(rewardFieldsOrError({ rewardType: 'promo', promoCode: code, destinationUrl: 'https://a.fr' })).toEqual({
      ok: false,
      error: 'code_too_long',
    });
  });

  it('rejects a non-http link in either mode', () => {
    for (const rewardType of ['site', 'promo'] as const) {
      expect(rewardFieldsOrError({ rewardType, promoCode: 'A', destinationUrl: 'javascript:alert(1)' })).toEqual({
        ok: false,
        error: 'invalid_url',
      });
    }
  });
});
