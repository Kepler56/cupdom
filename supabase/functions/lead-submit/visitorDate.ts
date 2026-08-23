// Pure mirror of netlify/edge-functions/lib/detect.mjs#visitorDate. Kept identical to it — the
// unit test asserts parity across a shared fixture set, exactly as validate.ts does against
// lib/public/validation.ts. No Deno/DOM imports, so it is importable by both the Deno function
// (index.ts, via './visitorDate.ts') and Vitest (via the @ alias).
//
// WHY A COPY RATHER THAN AN IMPORT: detect.mjs lives outside supabase/functions/, and Supabase's
// function bundler resolves relative to the function directory. Reaching up into netlify/ is not
// something to rely on. Same trade-off, and same mitigation, as validate.ts.

/**
 * The date component of visitor_hash, in EUROPE/PARIS.
 *
 * This MUST match scan.js. Both write a visitor_hash keyed on this date, and every aggregate RPC
 * in the database buckets `at time zone 'Europe/Paris'`. Keying the hash on the UTC date instead
 * silently inflates every `count(distinct visitor_hash)` figure — "uniques", "scannés",
 * "personnes touchées" — for anyone active across the UTC boundary, which in Paris falls at 23:00
 * (winter) or 22:00 (summer). Cupdom's product is used in nightclubs, so that is peak trading.
 *
 * The dedupe window is exactly one day and carries no cross-day identifier, whichever zone is
 * used; only the boundary moves. The privacy property is unchanged.
 */
export function visitorDate(d: Date): string {
  // 'en-CA' renders as YYYY-MM-DD, which is the format we want, in the named zone.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
