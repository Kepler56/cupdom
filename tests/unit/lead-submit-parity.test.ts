/**
 * Parity between the Next-side modules and their Edge Function mirrors.
 *
 * Three pairs of files say the same thing twice, deliberately: the Deno function cannot import
 * across the `@` alias, and reaching outside supabase/functions/ is not something the Supabase
 * bundler guarantees. Duplication is the accepted cost; THIS FILE is what makes it safe.
 *
 * tests/unit/lead-submit-validate.test.ts already covers validate.ts. This adds the two that were
 * unguarded:
 *
 *   consent      — what the consumer READS vs what gets STORED as the accountability evidence.
 *                  Drift here means someone agrees to one sentence and a different one is filed as
 *                  proof of what they agreed to. Both files individually would look correct.
 *
 *   visitorDate  — scan.js and lead-submit both key visitor_hash on this date, and every aggregate
 *                  RPC buckets `at time zone 'Europe/Paris'`. Drift means the funnel measures its
 *                  stages on a different clock from its own baseline.
 */
import { describe, expect, it } from 'vitest';

import { CONSENT_TEXT_FR, CONSENT_VERSION } from '@/lib/public/consent';
import {
  CONSENT_TEXT_FR as EDGE_CONSENT_TEXT_FR,
  CONSENT_VERSION as EDGE_CONSENT_VERSION,
} from '@/supabase/functions/lead-submit/consent';

import { visitorDate as edgeVisitorDate } from '@/supabase/functions/lead-submit/visitorDate';
// The Netlify edge helper is plain ESM using only Web standards, so Vitest can import it directly.
import { visitorDate as scanVisitorDate } from '@/netlify/edge-functions/lib/detect.mjs';

describe('consent wording parity — lib/public/consent.ts vs lead-submit/consent.ts', () => {
  it('the version string is identical', () => {
    expect(EDGE_CONSENT_VERSION).toBe(CONSENT_VERSION);
  });

  it('the wording is identical for a plain sponsor name', () => {
    expect(EDGE_CONSENT_TEXT_FR('Nike')).toBe(CONSENT_TEXT_FR('Nike'));
  });

  it.each([
    ['Nike'],
    ['Démo Nightlife'], // accents
    ['Ben & Jerry’s'], // ampersand + typographic apostrophe
    [''], // sponsor_name is NOT NULL in the DB, but the function coalesces a missing row to ''
    ['A'.repeat(200)], // long
  ])('the wording is identical for sponsor %j', (sponsor) => {
    expect(EDGE_CONSENT_TEXT_FR(sponsor)).toBe(CONSENT_TEXT_FR(sponsor));
  });

  it('the sponsor name is actually interpolated, so parity is not vacuous', () => {
    // Guards against both copies being changed to ignore their argument, which would make every
    // assertion above pass while recording the wrong text.
    expect(EDGE_CONSENT_TEXT_FR('Nike')).toContain('Nike');
    expect(EDGE_CONSENT_TEXT_FR('Nike')).not.toBe(EDGE_CONSENT_TEXT_FR('Adidas'));
  });
});

describe('visitorDate parity — detect.mjs vs lead-submit/visitorDate.ts', () => {
  const cases: [string, string][] = [
    // [ISO instant (UTC), expected Paris calendar day]
    ['2026-08-22T21:30:00Z', '2026-08-22'], // 23:30 Paris, summer (UTC+2) — same day
    ['2026-08-22T22:30:00Z', '2026-08-23'], // 00:30 Paris — the boundary the UTC key got wrong
    ['2026-08-23T01:00:00Z', '2026-08-23'], // 03:00 Paris — same Paris night as the row above
    ['2026-01-15T23:30:00Z', '2026-01-16'], // 00:30 Paris, winter (UTC+1)
    ['2026-01-15T22:30:00Z', '2026-01-15'], // 23:30 Paris, winter — still the same day
    ['2026-06-01T00:00:00Z', '2026-06-01'], // 02:00 Paris
    ['2026-12-31T23:30:00Z', '2027-01-01'], // year boundary
  ];

  it.each(cases)('both agree that %s is the Paris day %s', (iso, expected) => {
    const d = new Date(iso);
    expect(edgeVisitorDate(d)).toBe(expected);
    expect(scanVisitorDate(d)).toBe(expected);
  });

  it('the two implementations agree across a full year of hourly samples', () => {
    // Covers both DST transitions without hard-coding their dates.
    const start = Date.UTC(2026, 0, 1);
    const HOUR = 3_600_000;
    for (let i = 0; i < 365 * 24; i += 7) {
      const d = new Date(start + i * HOUR);
      expect(edgeVisitorDate(d)).toBe(scanVisitorDate(d));
    }
  });

  it('returns YYYY-MM-DD, which is what the hash input assumes', () => {
    expect(edgeVisitorDate(new Date('2026-08-22T22:30:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is NOT the UTC date across the Paris boundary — the bug this replaced', () => {
    // 22:30 UTC on 2026-08-22 is 00:30 Paris on the 23rd. Keying on the UTC date would return
    // the 22nd and split one Paris night into two visitors.
    const d = new Date('2026-08-22T22:30:00Z');
    expect(edgeVisitorDate(d)).not.toBe(d.toISOString().slice(0, 10));
    expect(edgeVisitorDate(d)).toBe('2026-08-23');
  });
});
