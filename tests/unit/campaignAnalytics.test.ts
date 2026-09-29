import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }));

import { loadCampaignAnalytics } from '@/lib/campaigns/analytics';

describe('loadCampaignAnalytics', () => {
  beforeEach(() => rpc.mockReset());

  it('calls the five crm_campaign_* RPCs once each, in parallel, with the slug', async () => {
    rpc.mockImplementation((name: string) => {
      const data: Record<string, unknown> = {
        crm_campaign_overview: [
          { bucket: 'current', scans: 10, uniques: 8, leads: 2 },
          { bucket: 'previous', scans: 5, uniques: 5, leads: 1 },
        ],
        crm_campaign_daily: [{ day: '2026-09-28', scans: 10, uniques: 8, leads: 2 }],
        crm_campaign_hourly: [{ dow: 1, hour: 21, scans: 10 }],
        crm_campaign_geo: [{ label: 'Paris', scans: 10, uniques: 8 }],
        crm_campaign_tech: [
          { dimension: 'device_type', label: 'mobile', scans: 9 },
          { dimension: 'os', label: 'iOS', scans: 6 },
        ],
      };
      return Promise.resolve({ data: data[name], error: null });
    });
    const a = await loadCampaignAnalytics('abcd23', '30j', '2026-01-01T00:00:00Z', new Date('2026-09-29T12:00:00Z'));
    expect(rpc.mock.calls.map((c) => c[0]).sort()).toEqual([
      'crm_campaign_daily', 'crm_campaign_geo', 'crm_campaign_hourly', 'crm_campaign_overview', 'crm_campaign_tech',
    ]);
    expect(rpc.mock.calls.every((c) => c[1].p_slug === 'abcd23')).toBe(true);
    expect(a.overview.current).toEqual({ scans: 10, uniques: 8, leads: 2 });
    expect(a.overview.previous).toEqual({ scans: 5, uniques: 5, leads: 1 });
    expect(a.cities.rows[0].label).toBe('Paris');
    expect(a.devices.rows[0].label).toBe('mobile');
    expect(a.os.rows[0].label).toBe('iOS');
  });

  it('« Tout » starts at the campaign creation and has no previous window', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const a = await loadCampaignAnalytics('abcd23', 'tout', '2026-06-01T00:00:00Z', new Date('2026-09-29T12:00:00Z'));
    const daily = rpc.mock.calls.find((c) => c[0] === 'crm_campaign_daily')!;
    expect(daily[1].p_from).toBe('2026-06-01T00:00:00.000Z');
    expect(a.overview.previous).toBeNull();
  });
});
