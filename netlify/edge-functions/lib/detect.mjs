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

export function utcDate(d) {
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD' in UTC
}

export async function buildVisitorHash({ ip, ua, slug, secret, date }) {
  const input = [ip || '', ua || '', slug || '', secret || '', date || ''].join('|');
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
