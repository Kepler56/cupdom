import { describe, expect, it } from 'vitest';
import { publicCampaign, rewardReply, safeHttpUrl } from '@/supabase/functions/lead-submit/reward';

describe('safeHttpUrl', () => {
  it('keeps http(s) and refuses everything else', () => {
    expect(safeHttpUrl('https://nike.fr/x')).toBe('https://nike.fr/x');
    expect(safeHttpUrl('http://a.fr')).toBe('http://a.fr/');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,x')).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe('publicCampaign', () => {
  it('maps the row and never carries promo_code', () => {
    const c = publicCampaign({ name: 'Été', product: 'gourde', product_image_url: 'https://x.supabase.co/a.jpg', reward_type: 'promo', promo_code: 'SECRET' } as never);
    expect(c).toEqual({ name: 'Été', product: 'gourde', imageUrl: 'https://x.supabase.co/a.jpg', rewardType: 'promo' });
    expect(JSON.stringify(c)).not.toContain('SECRET');
  });

  it('defaults safely', () => {
    expect(publicCampaign({ name: null, product: null, product_image_url: 'javascript:1', reward_type: 'weird' })).toEqual({
      name: '',
      product: '',
      imageUrl: null,
      rewardType: 'site',
    });
  });
});

describe('rewardReply', () => {
  it('site → redirect, whatever the outcome', () => {
    expect(rewardReply('site', 'https://nike.fr', 'skipped', null)).toEqual({ redirect: 'https://nike.fr' });
  });
  it('promo sent → emailed, no code on the wire', () => {
    expect(rewardReply('promo', 'https://nike.fr', 'sent', 'C10')).toEqual({ promo: { link: 'https://nike.fr', emailed: true } });
  });
  it('promo skipped (honeypot / rate-limited resubmit) → looks sent, no code, no email', () => {
    expect(rewardReply('promo', 'https://nike.fr', 'skipped', 'C10')).toEqual({ promo: { link: 'https://nike.fr', emailed: true } });
  });
  it('promo failed → the code travels so the page can show it', () => {
    expect(rewardReply('promo', 'https://nike.fr', 'failed', 'C10')).toEqual({
      promo: { link: 'https://nike.fr', emailed: false, code: 'C10' },
    });
  });
});
