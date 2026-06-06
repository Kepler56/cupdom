import { describe, expect, it } from 'vitest';
import { SLUG_ALPHABET, isSlug, makeSlug } from '@/lib/campaigns/slug';

describe('campaign slug', () => {
  it('makeSlug returns 6–8 chars all within SLUG_ALPHABET (never 0/o/1/i/l)', () => {
    for (let i = 0; i < 1000; i++) {
      const s = makeSlug();
      expect(s.length).toBeGreaterThanOrEqual(6);
      expect(s.length).toBeLessThanOrEqual(8);
      for (const ch of s) expect(SLUG_ALPHABET).toContain(ch);
      expect(/[01oil]/.test(s)).toBe(false);
    }
  });

  it('clamps the requested length into 6–8', () => {
    expect(makeSlug(2).length).toBe(6);
    expect(makeSlug(7).length).toBe(7);
    expect(makeSlug(99).length).toBe(8);
  });

  it('generations are unique across a large sample and isSlug accepts them', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const s = makeSlug(8);
      expect(isSlug(s)).toBe(true);
      seen.add(s);
    }
    expect(seen.size).toBe(10_000); // no collision in the sample
  });

  it('isSlug rejects derived / uppercase / too-short values (proves opaque, AC-8)', () => {
    expect(isSlug('Nike2026')).toBe(false); // uppercase, not opaque
    expect(isSlug('ABCDEF')).toBe(false); // uppercase
    expect(isSlug('abc2')).toBe(false); // too short
    expect(isSlug('abcdefghi')).toBe(false); // too long (9)
    expect(isSlug('abc 23')).toBe(false); // space
    expect(isSlug('abcd23')).toBe(true);
  });
});
