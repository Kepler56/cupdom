import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  path.resolve(__dirname, '../../supabase/migrations/0024_campaign_reward_and_crm_analytics.sql'),
  'utf8',
).toLowerCase();

const RPCS = ['crm_campaign_overview', 'crm_campaign_daily', 'crm_campaign_hourly', 'crm_campaign_geo', 'crm_campaign_tech'];

describe('migration 0024', () => {
  it('adds reward columns idempotently with a safe default', () => {
    expect(sql).toContain("add column if not exists reward_type text not null default 'site'");
    expect(sql).toContain('add column if not exists promo_code  text');
    expect(sql).toContain('drop constraint if exists qr_campaigns_reward_chk');
  });

  it('extends the funnel kinds without dropping the existing ones', () => {
    expect(sql).toContain('drop constraint if exists funnel_events_kind_check');
    for (const k of ['form_view', 'form_submit', 'offer_reached', 'promo_email_sent', 'promo_email_failed']) {
      expect(sql).toContain(`'${k}'`);
    }
  });

  it.each(RPCS)('%s is member-gated and closed to anon', (fn) => {
    expect(sql).toContain(`create or replace function public.${fn}(`);
    expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon`));
    expect(sql).toMatch(new RegExp(`grant\\s+execute on function public\\.${fn}\\([^)]*\\) to authenticated`));
  });

  it('every crm_ RPC calls the member guard', () => {
    expect(sql.match(/perform public\.crm_member_guard\(\)/g)?.length).toBe(RPCS.length);
  });

  it('never exposes promo_code through an RPC', () => {
    const rpcBodies = sql.split('create or replace function').slice(1).join('');
    expect(rpcBodies).not.toContain('promo_code');
  });
});
