import { describe, expect, it } from 'vitest';
import { purgeCountdown } from '@/lib/contacts/purgeCountdown';

const NOW = new Date('2026-06-06T12:00:00Z');
const plusDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe('purgeCountdown', () => {
  it('30 days out → warning tone', () => {
    const c = purgeCountdown(plusDays(30), NOW);
    expect(c.daysLeft).toBe(30);
    expect(c.tone).toBe('warning');
    expect(c.label).toBe('Supprimé dans 30 jours');
  });

  it('within the 3-day window → danger tone', () => {
    expect(purgeCountdown(plusDays(3), NOW).tone).toBe('danger');
    expect(purgeCountdown(plusDays(1), NOW).label).toBe('Supprimé dans 1 jour'); // singular
    expect(purgeCountdown(plusDays(2), NOW).label).toBe('Supprimé dans 2 jours'); // plural
  });

  it('now or past → 0 days, imminent, danger', () => {
    const c = purgeCountdown(plusDays(-1), NOW);
    expect(c.daysLeft).toBe(0);
    expect(c.label).toBe('Suppression imminente');
    expect(c.tone).toBe('danger');
  });
});
