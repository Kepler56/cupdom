import { parseUserAgent, detectBot, buildVisitorHash, utcDate } from './lib/detect.mjs';

export default async (request, context) => {
  const slug = (context.params && context.params.slug) || '';
  const SUPABASE_URL = Netlify.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const DAILY_SECRET = Netlify.env.get('QR_DAILY_SECRET') || '';
  const FALLBACK     = Netlify.env.get('QR_FALLBACK_URL') || 'https://cupdom.fr';

  // 1. Look up the campaign (service-role key bypasses RLS).
  let destination = null;
  try {
    const lookup = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_campaigns?slug=eq.${encodeURIComponent(slug)}&select=destination_url,active`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const rows = await lookup.json();
    if (Array.isArray(rows) && rows[0] && rows[0].active) destination = rows[0].destination_url;
  } catch (e) {
    console.error('qr_campaigns lookup failed', e);
  }

  // Unknown or inactive slug: redirect to fallback, do not log.
  if (!destination) return Response.redirect(FALLBACK, 302);

  // 2. Derive metrics from the edge context + request headers.
  const ua   = request.headers.get('user-agent') || '';
  const lang = (request.headers.get('accept-language') || '').split(',')[0].trim() || null;
  const { device_type, os, browser } = parseUserAgent(ua);
  const is_bot = detectBot(ua);
  const geo = context.geo || {};
  const visitor_hash = await buildVisitorHash({
    ip: context.ip, ua, slug, secret: DAILY_SECRET, date: utcDate(new Date()),
  });

  const row = {
    campaign_slug: slug,
    country: (geo.country && geo.country.name) || null,
    region:  (geo.subdivision && geo.subdivision.name) || null,
    city:    geo.city || null,
    device_type, os, browser,
    language: lang,
    visitor_hash,
    is_bot,
  };

  // 3. Log WITHOUT blocking the redirect. If the insert fails, the user still goes through.
  const logPromise = fetch(`${SUPABASE_URL}/rest/v1/qr_scans`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  }).catch((e) => console.error('qr_scans insert failed', e));
  context.waitUntil(logPromise);

  // 4. Redirect the scanner to the sponsor.
  return Response.redirect(destination, 302);
};

// Route: every /s/<slug> request runs this function (no netlify.toml entry needed).
export const config = { path: '/s/:slug' };
