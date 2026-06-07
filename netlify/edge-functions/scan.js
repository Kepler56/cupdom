import { parseUserAgent, detectBot, buildVisitorHash, utcDate } from './lib/detect.mjs';

// Public scan behaviour (Spec 2 §7):
//   slug exists & active=true  -> 302 to the lead form /c/<slug> (Spec 3A); log ONE scan tagged 'Active'
//   slug exists & active=false -> 302 to the branded ended page;          log ONE scan tagged 'Terminée'
//   slug not found             -> 302 to the same ended page;             log NOTHING
// Logging is fire-and-forget (context.waitUntil): a write failure never blocks the scanner.
// Writes use the SERVICE-ROLE key (bypasses RLS); it lives only in Netlify server env.

export default async (request, context) => {
  const slug = (context.params && context.params.slug) || '';

  const SUPABASE_URL = Netlify.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const DAILY_SECRET = Netlify.env.get('QR_DAILY_SECRET') || '';
  const FALLBACK     = Netlify.env.get('QR_FALLBACK_URL') || 'https://cupdom.fr';
  // Absolute base for building the public app URLs (lead form + ended page).
  const BASE_URL     = (Netlify.env.get('PUBLIC_BASE_URL') || FALLBACK).replace(/\/+$/, '');

  const ENDED_URL = `${BASE_URL}/campagne-terminee`;
  const formUrl   = (s) => `${BASE_URL}/c/${encodeURIComponent(s)}`;

  // ---- 1. Look up the campaign (service-role key bypasses RLS). ----
  // We only need to know IF it exists and whether it is active. Destination is selected
  // for completeness but is NOT where we send the scanner (Active -> form; Terminée -> ended page).
  let found = false;
  let isActive = false;
  try {
    const lookup = await fetch(
      `${SUPABASE_URL}/rest/v1/qr_campaigns?slug=eq.${encodeURIComponent(slug)}` +
        `&select=active,destination_url`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const rows = await lookup.json();
    if (Array.isArray(rows) && rows[0]) {
      found = true;
      isActive = rows[0].active === true;
    }
  } catch (e) {
    console.error('qr_campaigns lookup failed', e);
    // On lookup failure we treat the slug as not-found: ended page, no log. Never the old destination.
  }

  // ---- 2. Not found (typo or purged): branded ended page, log NOTHING. ----
  if (!found) {
    return Response.redirect(ENDED_URL, 302);
  }

  // ---- 3. Derive anonymous metrics (same as before). ----
  const ua   = request.headers.get('user-agent') || '';
  const lang = (request.headers.get('accept-language') || '').split(',')[0].trim() || null;
  const { device_type, os, browser } = parseUserAgent(ua);
  const is_bot = detectBot(ua);
  const geo = context.geo || {};
  const visitor_hash = await buildVisitorHash({
    ip: context.ip, ua, slug, secret: DAILY_SECRET, date: utcDate(new Date()),
  });

  const campaign_state_at_scan = isActive ? 'Active' : 'Terminée';

  const row = {
    campaign_slug: slug,
    campaign_state_at_scan,                 // NEW (Spec 2A column): state captured at scan time
    country: (geo.country && geo.country.name) || null,
    region:  (geo.subdivision && geo.subdivision.name) || null,
    city:    geo.city || null,
    device_type, os, browser,
    language: lang,
    visitor_hash,
    is_bot,
  };

  // ---- 4. Log WITHOUT blocking the response. A failed insert still lets the scanner through. ----
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

  // ---- 5. Hand off. Active -> lead form (Spec 3A); Terminée -> branded ended page. ----
  return Response.redirect(isActive ? formUrl(slug) : ENDED_URL, 302);
};

// Route: every /s/<slug> request runs this function (no netlify.toml entry needed).
export const config = { path: '/s/:slug' };
