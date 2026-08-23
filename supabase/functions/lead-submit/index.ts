// Supabase Edge Function (Deno): the ONLY public write path for lead capture (Spec 3A §4/§12).
// Holds the service-role key (Edge secret, never the browser); bypasses RLS. Handles two POST
// shapes: a `form_view` ping (logs the funnel event + returns campaign status) and a full
// submission (validate → anti-abuse drop → dedup upsert → consent row → funnel events → redirect).
// Not part of the Next typecheck (Deno globals + URL imports) — excluded in tsconfig.
import { createClient } from '@supabase/supabase-js';
import { isSpam, normaliseEmail, validateLead } from './validate.ts';
import { CONSENT_TEXT_FR, CONSENT_VERSION } from './consent.ts';
import { visitorDate } from './visitorDate.ts';

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
  const { data: campaign } = await supabase
    .from('qr_campaigns')
    .select('active, sponsor_name, destination_url')
    .eq('slug', slug)
    .maybeSingle();
  const isActive = campaign?.active === true;
  const sponsor = (campaign?.sponsor_name as string | undefined) ?? '';

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
    return json({ active: true, sponsor });
  }

  // ---- full submission ----
  // 1. Re-validate Active (defense in depth, §10): unknown/Terminée stores nothing.
  if (!isActive) return json({ errors: { _campaign: 'Campagne inactive' } }, 422);
  const destination = (campaign?.destination_url as string | undefined) ?? Deno.env.get('QR_FALLBACK_URL') ?? 'https://cupdom.fr';

  // 2. Anti-abuse (AC-8): honeypot or rate-limit ⇒ store nothing, but still forward the consumer.
  const { count: recentSubmits } = await supabase
    .from('funnel_events')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_slug', slug)
    .eq('kind', 'form_submit')
    .eq('visitor_hash', visitorHash)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if (isSpam({ honeypot: String(payload.website ?? ''), recentSubmits: recentSubmits ?? 0 })) {
    return json({ redirect: destination });
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

  // From here on, a DB hiccup must NOT block the reward — log and still redirect (mirrors scan.js).
  try {
    const email = normaliseEmail(input.email);

    // 4. UPSERT the lead deduped on (campaign_slug, email) — refresh last_activity_at (AC-10).
    const { data: lead } = await supabase
      .from('leads')
      .upsert(
        {
          campaign_slug: slug,
          first_name: input.firstName.trim(),
          last_name: input.lastName.trim(),
          email,
          phone: input.phone.trim(),
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: 'campaign_slug,email' },
      )
      .select('id')
      .single();

    // 5. Immutable consent record — server-derived text, NO IP (AC-9).
    await supabase.from('lead_consents').insert({
      lead_id: lead?.id ?? null,
      campaign_slug: slug,
      sponsor_name: sponsor,
      consent_text: CONSENT_TEXT_FR(sponsor),
      consent_version: CONSENT_VERSION,
    });

    // 6. Funnel events: form_submit (AC-6) then offer_reached just before redirect (AC-7).
    await supabase.from('funnel_events').insert([
      { campaign_slug: slug, kind: 'form_submit', visitor_hash: visitorHash },
      { campaign_slug: slug, kind: 'offer_reached', visitor_hash: visitorHash },
    ]);
  } catch (e) {
    console.error('lead-submit storage failed (forwarding anyway)', e);
  }

  // 7. Forward the consumer to the reward (AC-6/7).
  return json({ redirect: destination });
});
