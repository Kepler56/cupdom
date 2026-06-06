import { describe, expect, it } from 'vitest';
import { formatFr, isDue, isOverdue, todayLocal } from '@/lib/dates';
import { isSafeUrl } from '@/lib/links';

const NOW = new Date(2026, 5, 6, 12, 0, 0); // 2026-06-06 local
const TODAY = '2026-06-06';
const YESTERDAY = '2026-06-05';
const TOMORROW = '2026-06-07';
const SOME_TS = '2026-06-01T10:00:00.000Z';

describe('isOverdue', () => {
  it('not done + due today or earlier → overdue', () => {
    expect(isOverdue(YESTERDAY, null, NOW)).toBe(true);
    expect(isOverdue(TODAY, null, NOW)).toBe(true);
  });
  it('future / no due / done → not overdue', () => {
    expect(isOverdue(TOMORROW, null, NOW)).toBe(false);
    expect(isOverdue(null, null, NOW)).toBe(false);
    expect(isOverdue(YESTERDAY, SOME_TS, NOW)).toBe(false);
  });
});

describe('isDue', () => {
  it('not done + remind-on today or earlier → due', () => {
    expect(isDue(YESTERDAY, null, NOW)).toBe(true);
    expect(isDue(TODAY, null, NOW)).toBe(true);
  });
  it('future / done → not due', () => {
    expect(isDue(TOMORROW, null, NOW)).toBe(false);
    expect(isDue(YESTERDAY, SOME_TS, NOW)).toBe(false);
  });
});

describe('formatFr / todayLocal', () => {
  it('formats fr-FR and em-dashes null', () => {
    expect(formatFr(null)).toBe('—');
    expect(formatFr('2026-06-06')).toBe('06/06/2026');
  });
  it('todayLocal is local calendar date', () => {
    expect(todayLocal(NOW)).toBe(TODAY);
  });
});

describe('isSafeUrl', () => {
  it('accepts http/https/mailto/tel and bare domains', () => {
    expect(isSafeUrl('https://cupdom.fr')).toBe(true);
    expect(isSafeUrl('http://x')).toBe(true);
    expect(isSafeUrl('mailto:a@b.fr')).toBe(true);
    expect(isSafeUrl('tel:+33123456789')).toBe(true);
    expect(isSafeUrl('cupdom.fr')).toBe(true); // normalised to https
  });
  it('rejects dangerous schemes and junk', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });
});
