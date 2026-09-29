import { describe, expect, it } from 'vitest';
import { PROMO_EMAIL_WINDOW_MS, publicCampaign, recentlyEmailed, rewardReply, safeHttpUrl } from '@/supabase/functions/lead-submit/reward';

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
  it('promo show (rate-limited, not honeypot) → code on screen, not emailed', () => {
    expect(rewardReply('promo', 'https://nike.fr', 'show', 'C10')).toEqual({
      promo: { link: 'https://nike.fr', emailed: false, code: 'C10' },
    });
  });
  it('promo show without a code → nothing to show, looks sent', () => {
    expect(rewardReply('promo', 'https://nike.fr', 'show', null)).toEqual({ promo: { link: 'https://nike.fr', emailed: true } });
  });
  it('site show → still a plain redirect', () => {
    expect(rewardReply('site', 'https://nike.fr', 'show', 'C10')).toEqual({ redirect: 'https://nike.fr' });
  });
});

describe('recentlyEmailed (per-recipient promo throttle)', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('the window is 24 h', () => {
    expect(PROMO_EMAIL_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
  it('no prior lead (or no usable timestamp) → not recent, the email goes out', () => {
    expect(recentlyEmailed(null, now)).toBe(false);
    expect(recentlyEmailed('', now)).toBe(false);
    expect(recentlyEmailed('not a date', now)).toBe(false);
  });
  it('activity inside the window → throttled', () => {
    expect(recentlyEmailed(ago(0), now)).toBe(true);
    expect(recentlyEmailed(ago(60_000), now)).toBe(true);
    expect(recentlyEmailed(ago(PROMO_EMAIL_WINDOW_MS - 1), now)).toBe(true);
  });
  it('activity 24 h ago or older → email again', () => {
    expect(recentlyEmailed(ago(PROMO_EMAIL_WINDOW_MS), now)).toBe(false);
    expect(recentlyEmailed(ago(3 * PROMO_EMAIL_WINDOW_MS), now)).toBe(false);
  });
  it('reads Postgres timestamptz strings', () => {
    expect(recentlyEmailed('2026-09-29T10:00:00.123+00:00', now)).toBe(true);
    expect(recentlyEmailed('2026-09-27T10:00:00+02:00', now)).toBe(false);
  });
});
