// Pure, isomorphic helpers — run on both the Deno edge runtime and Node's test runner.
// No Deno/Node-specific APIs; uses only Web standards (RegExp, TextEncoder, crypto.subtle).

// Conservative on purpose: better to count a borderline real scan than to silently
// drop it from headline numbers. Tokens are specific bot/preview/crawler markers.
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|slack|twitter|bingpreview|curl|wget|python-requests|headless|lighthouse|pingdom|uptimerobot/i;

export function detectBot(ua) {
  if (!ua) return false;
  return BOT_RE.test(ua);
}

export function parseUserAgent(ua) {
  ua = ua || '';

  let device_type = 'desktop';
  if (/Tablet|iPad/i.test(ua)) device_type = 'tablet';
  else if (/Mobi|Android|iPhone|iPod/i.test(ua)) device_type = 'mobile';

  let os = 'unknown';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  return { device_type, os, browser };
}

/**
 * The date component of visitor_hash, in EUROPE/PARIS.
 *
 * This was the UTC date until 2026-08-18, and that silently inflated the client
 * portal's « Personnes touchées » KPI. Every aggregate RPC buckets
 * `at time zone 'Europe/Paris'`, so someone scanning at 00:30 and again at
 * 03:00 on the SAME Paris night straddled a UTC date boundary, received two
 * different hashes, and was counted as two people. Cupdom's product is used in
 * nightclubs, so 00:00–02:00 Paris is peak trading — the overcount landed
 * exactly where the data is densest.
 *
 * DELIBERATE SEAM: scans logged before this change are keyed on the UTC date and
 * remain slightly over-counted for sessions crossing midnight Paris. Scans after
 * it are correct. The dedupe window is still ONE DAY and still carries no
 * cross-day identifier — the privacy property is unchanged, only the boundary
 * moved.
 */
export function visitorDate(d) {
  // 'en-CA' renders as YYYY-MM-DD, which is the format we want, in the named zone.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export async function buildVisitorHash({ ip, ua, slug, secret, date }) {
  const input = [ip || '', ua || '', slug || '', secret || '', date || ''].join('|');
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
