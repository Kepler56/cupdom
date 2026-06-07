import { describe, expect, it } from 'vitest';
import { deriveKpis, formatKpiValue, trendPct, type KpiInput } from '@/lib/kpis';

const input = (over: Partial<KpiInput> = {}): KpiInput => ({
  contactsActifs: 12,
  scans30: 120,
  scansPrev30: 100,
  leads30: 8,
  leadsPrev30: 10,
  pipelineEur: 25000,
  ...over,
});

describe('trendPct', () => {
  it('signed change vs prior window', () => {
    expect(trendPct(120, 100)).toBe(20);
    expect(trendPct(80, 100)).toBe(-20);
    expect(trendPct(100, 100)).toBe(0);
  });
  it('zero-safe: both 0 → null; prev 0 & cur>0 → +100', () => {
    expect(trendPct(0, 0)).toBeNull();
    expect(trendPct(5, 0)).toBe(100);
  });
});

describe('formatKpiValue', () => {
  it('formats numbers and EUR in fr-FR', () => {
    expect(formatKpiValue(25000, 'eur')).toMatch(/25\s?000\s?€/);
    expect(formatKpiValue(1200, 'number')).toMatch(/1\s?200/);
  });
});

describe('deriveKpis', () => {
  it('returns the four cards in fixed order with the right trends', () => {
    const cards = deriveKpis(input());
    expect(cards.map((c) => c.key)).toEqual(['contacts_actifs', 'scans_30j', 'leads_30j', 'pipeline_eur']);
    expect(cards[0].trendPct).toBeNull(); // contacts: snapshot
    expect(cards[1].trendPct).toBe(20); // scans +20%
    expect(cards[2].trendPct).toBe(-20); // leads -20%
    expect(cards[3].trendPct).toBeNull(); // pipeline: snapshot
    expect(cards[3].value).toMatch(/25\s?000\s?€/);
  });
});
