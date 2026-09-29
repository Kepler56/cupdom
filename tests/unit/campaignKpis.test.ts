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
    expect(k[4].value).toMatch(/^20,00\s€$/); // 600 / 30 — cost per lead keeps cents
    expect(k[5].value).toBe('3,0 %'); // 30 / 1000 → under 10 %, one decimal
  });

  it('cost per lead never rounds a cheap lead down to « 0 € »', () => {
    const k = deriveCampaignKpis({ current: { scans: 500, uniques: 400, leads: 100 }, previous: null }, { investedAmountEur: 30, distributedCount: 100 });
    expect(k[4].value).toMatch(/^0,30\s€$/);
  });

  it('ratios under 10 % keep one decimal, 10 % and above are whole', () => {
    const small = deriveCampaignKpis({ current: { scans: 1000, uniques: 1000, leads: 3 }, previous: null }, { investedAmountEur: null, distributedCount: 1000 });
    expect(small[3].value).toBe('0,3 %'); // 3 / 1000 uniques
    expect(small[5].value).toBe('0,3 %'); // 3 / 1000 cups
    const big = deriveCampaignKpis({ current: { scans: 10, uniques: 8, leads: 1 }, previous: null }, { investedAmountEur: null, distributedCount: 3 });
    expect(big[3].value).toBe('13 %'); // 12.5 → whole
    expect(big[5].value).toBe('33 %');
    // 9.96 % rounds to 10.0 at one decimal, so it reads as a whole « 10 % », not « 10,0 % ».
    const edge = deriveCampaignKpis({ current: { scans: 10000, uniques: 10000, leads: 996 }, previous: null }, { investedAmountEur: null, distributedCount: null });
    expect(edge[3].value).toBe('10 %');
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
