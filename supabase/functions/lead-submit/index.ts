// Supabase Edge Function (Deno): the ONLY public write path for lead capture (Spec 3A §4/§12).
// Holds the service-role key (Edge secret, never the browser); bypasses RLS. Handles two POST
// shapes: a `form_view` ping (logs the funnel event + returns campaign status) and a full
// submission (validate → anti-abuse drop → dedup upsert → consent row → funnel events → redirect).
// Not part of the Next typecheck (Deno globals + URL imports) — excluded in tsconfig.
import { createClient } from '@supabase/supabase-js';
import { abuseKind, normaliseEmail, validateLead } from './validate.ts';
import { CONSENT_TEXT_FR, CONSENT_VERSION } from './consent.ts';
import { visitorDate } from './visitorDate.ts';
import { withRetry } from '../_shared/retry.ts';
import { publicCampaign, recentlyEmailed, rewardReply, type RewardOutcome, type RewardType } from './reward.ts';
import { buildPromoEmail } from './promoEmail.ts';
import { DEFAULT_FROM, sendEmail } from '../_shared/resend.ts';

// deno-lint-ignore no-explicit-any
type Json = any;

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('LEAD_FORM_ORIGIN') ?? '*', // restrict to prod origin pre-launch (Task 6)
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const secret = Deno.env.get('QR_DAILY_SECRET') ?? '';

  let payload: Json;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  const slug = String(payload.slug ?? '');
  if (!slug) return json({ error: 'missing slug' }, 400);

  // Campaign lookup (service-role bypasses RLS): existence + active + sponsor + destination.
  const { data: campaign, error: campaignError } = await supabase
    .from('qr_campaigns')
    .select('active, sponsor_name, destination_url, name, product, product_image_url, reward_type, promo_code')
    .eq('slug', slug)
    .maybeSingle();
  if (campaignError) {
    console.error(JSON.stringify({ evt: 'campaign_lookup_failed', slug, message: campaignError.message }));
  }
  const isActive = campaign?.active === true;
  const sponsor = (campaign?.sponsor_name as string | undefined) ?? '';
  const rewardType: RewardType = campaign?.reward_type === 'promo' ? 'promo' : 'site';
  const promoCode = (campaign?.promo_code as string | null | undefined) ?? null;

  // Anonymous best-effort visitor hash (no IP stored), consistent with scan.js dedup.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const ua = req.headers.get('user-agent') ?? '';
  // Europe/Paris, NOT UTC — this must match scan.js, which keys its visitor_hash the same way.
  // A UTC date rolls over at 23:00/22:00 Paris, mid-evening, so one person scanning either side of
  // it would produce two hashes and count as two people in every count(distinct visitor_hash).
  const visitorHash = await sha256Hex([ip, ua, slug, secret, visitorDate(new Date())].join('|'));

  // ---- form_view ping (AC-3): log the view if Active, and tell the page whether to render. ----
  if (payload.kind === 'form_view') {
    if (!isActive) return json({ active: false });
    await supabase.from('funnel_events').insert({ campaign_slug: slug, kind: 'form_view', visitor_hash: visitorHash });
    return json({ active: true, sponsor, campaign: publicCampaign(campaign ?? {}) });
  }

  // ---- full submission ----
  // 1. Re-validate Active (defense in depth, §10): unknown/Terminée stores nothing.
  if (!isActive) return json({ errors: { _campaign: 'Campagne inactive' } }, 422);
  const destination = (campaign?.destination_url as string | undefined) ?? Deno.env.get('QR_FALLBACK_URL') ?? 'https://cupdom.fr';

  // 2. Anti-abuse (AC-8): honeypot or rate-limit ⇒ store nothing, but still forward the consumer.
  //    Promo mode splits the two: a honeypot hit looks sent (no code, no email), while a
  //    rate-limited participant — the limit is per IP+UA, so shared Wi-Fi trips it — gets
  //    the code on screen once their input validates. Site mode: unchanged, redirect.
  const { count: recentSubmits } = await supabase
    .from('funnel_events')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_slug', slug)
    .eq('kind', 'form_submit')
    .eq('visitor_hash', visitorHash)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  const abuse = abuseKind({ honeypot: String(payload.website ?? ''), recentSubmits: recentSubmits ?? 0 });
  if (abuse === 'honeypot' || (abuse === 'rate_limited' && rewardType === 'site')) {
    return json(rewardReply(rewardType, destination, 'skipped', promoCode));
  }

  // 3. Server-side validation (source of truth, AC-4/5). The hard gate means storage implies consent.
  const input = {
    firstName: String(payload.firstName ?? ''),
    lastName: String(payload.lastName ?? ''),
    email: String(payload.email ?? ''),
    phone: String(payload.phone ?? ''),
    consent: payload.consent === true,
  };
  const errors = validateLead(input);
  if (Object.keys(errors).length > 0) return json({ errors }, 422);
  // Rate-limited promo participant: code on screen, nothing stored, no email.
  if (abuse === 'rate_limited') return json(rewardReply(rewardType, destination, 'show', promoCode));

  // From here on, a DB hiccup must NOT block the reward — retry, then log and still
  // redirect (mirrors scan.js). The writes run BEFORE the response, so retrying makes
  // them MORE durable (the redirect waits for them) without delaying the common,
  // successful path. Each write is safe to retry — see _shared/retry.ts. A write that
  // still fails after the retries is logged as a structured, greppable line so a lost
  // lead stops being invisible.
  // Optional precise location (#5), only when the visitor opted in AND the browser
  // granted geolocation. Validated to real ranges; anything off is simply dropped
  // (never stored), so a spoofed or malformed value can't poison the row. Absent is
  // the normal case. When present it is written with geo_source='gps'; when absent
  // the columns are left untouched, so a returning visitor keeps a location they
  // shared before rather than having it wiped by a later no-location submit.
  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);
  const hasGeo =
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const geoFields = hasGeo ? { latitude: lat, longitude: lng, geo_source: 'gps' } : {};

  let outcome: RewardOutcome = 'skipped';
  try {
    const email = normaliseEmail(input.email);

    // Per-recipient throttle (promo only): read BEFORE the upsert refreshes
    // last_activity_at. An address already active on this campaign in the last 24 h
    // gets no new email, so the form cannot be used to hammer an arbitrary inbox.
    // A failed read fails open (email sent) — the visitor-level limit still applies.
    let throttled = false;
    if (rewardType === 'promo' && promoCode) {
      const prior = await supabase
        .from('leads')
        .select('last_activity_at')
        .eq('campaign_slug', slug)
        .eq('email', email)
        .maybeSingle();
      if (prior.error) console.error(JSON.stringify({ evt: 'lead_lookup_failed', slug, message: prior.error.message }));
      throttled = recentlyEmailed((prior.data?.last_activity_at as string | null | undefined) ?? null, new Date());
    }

    // 4. UPSERT the lead deduped on (campaign_slug, email) — refresh last_activity_at (AC-10).
    const leadRes = await withRetry(async () =>
      supabase
        .from('leads')
        .upsert(
          {
            campaign_slug: slug,
            first_name: input.firstName.trim(),
            last_name: input.lastName.trim(),
            email,
            ...geoFields,
            // `|| null`, never ''. Phone is optional (2026-09) and an empty string
            // is NOT an absent value here: migration 0008's anonymisation job
            // selects rows where `phone is not null`, and the portal derives a
            // lead's "anonymised" state from PII presence. Storing '' would make
            // every phone-less lead look like it still holds a number, forever.
            phone: input.phone.trim() || null,
            last_activity_at: new Date().toISOString(),
          },
          { onConflict: 'campaign_slug,email' },
        )
        .select('id')
        .single(),
    );
    if (leadRes.error) console.error(JSON.stringify({ evt: 'lead_write_failed', step: 'lead', slug }));
    const lead = leadRes.data;

    // 5. Immutable consent record — server-derived text, NO IP (AC-9).
    const consentRes = await withRetry(async () =>
      supabase.from('lead_consents').insert({
        lead_id: lead?.id ?? null,
        campaign_slug: slug,
        sponsor_name: sponsor,
        consent_text: CONSENT_TEXT_FR(sponsor),
        consent_version: CONSENT_VERSION,
      }),
    );
    if (consentRes.error) console.error(JSON.stringify({ evt: 'lead_write_failed', step: 'consent', slug }));

    // 6. Funnel events: form_submit (AC-6) then offer_reached just before redirect (AC-7).
    const funnelRes = await withRetry(async () =>
      supabase.from('funnel_events').insert([
        { campaign_slug: slug, kind: 'form_submit', visitor_hash: visitorHash },
        { campaign_slug: slug, kind: 'offer_reached', visitor_hash: visitorHash },
      ]),
    );
    if (funnelRes.error) console.error(JSON.stringify({ evt: 'lead_write_failed', step: 'funnel', slug }));

    // 7. Promo reward (spec §4.3): email the shared code. Retried like the writes; a
    //    final failure is logged and the reply carries the code so the page shows it.
    //    Throttled recipient: no email, outcome stays 'skipped' (reply looks sent).
    if (rewardType === 'promo' && promoCode && !throttled) {
      const mail = buildPromoEmail({
        sponsor,
        campaignName: (campaign?.name as string | null) ?? null,
        product: (campaign?.product as string | null) ?? null,
        code: promoCode,
        link: destination,
      });
      const cfg = { apiKey: Deno.env.get('RESEND_API_KEY') ?? '', from: Deno.env.get('DIGEST_FROM') ?? DEFAULT_FROM };
      const sent = await withRetry(async () => {
        const r = await sendEmail({ to: email, ...mail }, cfg);
        return { error: r.ok ? null : r };
      });
      outcome = sent.error ? 'failed' : 'sent';
      if (sent.error) console.error(JSON.stringify({ evt: 'promo_email_failed', slug }));
      const promoEvt = await supabase.from('funnel_events').insert({
        campaign_slug: slug,
        kind: outcome === 'sent' ? 'promo_email_sent' : 'promo_email_failed',
        visitor_hash: visitorHash,
      });
      if (promoEvt.error) {
        console.error(JSON.stringify({ evt: 'lead_write_failed', step: 'promo_funnel', slug, message: promoEvt.error.message }));
      }
    }
  } catch (e) {
    console.error('lead-submit storage failed (forwarding anyway)', e);
    if (rewardType === 'promo') outcome = 'failed';
  }

  // 8. Hand the consumer their reward (AC-6/7): a redirect (site) or the promo payload.
  return json(rewardReply(rewardType, destination, outcome, promoCode));
});
