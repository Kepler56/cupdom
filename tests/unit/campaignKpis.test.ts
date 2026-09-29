import { describe, expect, it } from 'vitest';
import { deriveCampaignKpis } from '@/lib/campaigns/campaignKpis';

const cur = { scans: 200, uniques: 150, leads: 30 };
const prev = { scans: 100, uniques: 100, leads: 30 };

describe('deriveCampaignKpis', () => {
  it('six tiles in fixed order with trends', () => {
    const k = deriveCampaignKpis({ current: cur, previous: prev }, { investedAmountEur: 600, distributedCount: 1000 });
    expect(k.map((x) => x.key)).toEqual(['c_scans', 'c_uniques', 'c_leads', 'c_rate', 'c_cpl', 'c_per_cup']);
    expect(k[0].trendPct).toBe(100);
    expect(k[2].trendPct).toBe(0);
    expect(k[3].value).toBe('20 %'); // 30 / 150
    expect(k[4].value).toMatch(/^20\s€$/); // 600 / 30 — shared CRM money format has no decimals
    expect(k[5].value).toBe('3 %'); // 30 / 1000 → 3 %
  });

  it('missing inputs render « — », never 0 € or NaN', () => {
    const k = deriveCampaignKpis({ current: { scans: 0, uniques: 0, leads: 0 }, previous: null }, { investedAmountEur: null, distributedCount: null });
    expect(k[3].value).toBe('—');
    expect(k[4].value).toBe('—');
    expect(k[5].value).toBe('—');
    expect(k.every((x) => x.trendPct === null)).toBe(true);
  });

  it('cost per lead is « — » with zero leads even when an amount is set', () => {
    const k = deriveCampaignKpis({ current: { scans: 5, uniques: 5, leads: 0 }, previous: null }, { investedAmountEur: 500, distributedCount: 100 });
    expect(k[4].value).toBe('—');
  });
});
