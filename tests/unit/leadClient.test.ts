import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CAMPAIGN, postFormView, postSubmit } from '@/lib/public/leadClient';

const reply = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe('postFormView', () => {
  it('parses the campaign card data', async () => {
    reply({ active: true, sponsor: 'Nike', campaign: { name: 'Été', product: 'gourde', imageUrl: 'https://x/a.jpg', rewardType: 'promo' } });
    expect(await postFormView('s')).toEqual({
      active: true,
      sponsor: 'Nike',
      campaign: { name: 'Été', product: 'gourde', imageUrl: 'https://x/a.jpg', rewardType: 'promo' },
    });
  });

  it('an old server without `campaign` still renders (site mode, empty card)', async () => {
    reply({ active: true, sponsor: 'Nike' });
    expect(await postFormView('s')).toEqual({ active: true, sponsor: 'Nike', campaign: EMPTY_CAMPAIGN });
  });

  it('rejects a non-http image url', async () => {
    reply({ active: true, sponsor: 'N', campaign: { name: '', product: '', imageUrl: 'javascript:1', rewardType: 'site' } });
    expect((await postFormView('s')).campaign.imageUrl).toBeNull();
  });
});

describe('postSubmit', () => {
  it('returns the promo reply', async () => {
    reply({ promo: { link: 'https://nike.fr', emailed: false, code: 'C10' } });
    expect(await postSubmit({} as never)).toEqual({ promo: { link: 'https://nike.fr', emailed: false, code: 'C10' } });
  });

  it('still returns a redirect', async () => {
    reply({ redirect: 'https://nike.fr' });
    expect(await postSubmit({} as never)).toEqual({ redirect: 'https://nike.fr' });
  });
});
