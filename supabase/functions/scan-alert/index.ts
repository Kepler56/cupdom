// Supabase Edge Function (Deno): emails the Cupdom team when a live campaign's scans
// collapse after a peak (#6). Invoked by pg_net from detect_scan_drops() at the moment
// a NEW scan_alerts incident is inserted (migration 0022). Reuses the daily-digest Resend
// setup (RESEND_API_KEY, DIGEST_FROM). Not part of the Next typecheck (Deno globals + URL
// imports) — excluded in tsconfig.
import { createClient } from '@supabase/supabase-js';
import { buildScanAlertEmail, type ScanDropIncident } from './email.ts';

// deno-lint-ignore no-explicit-any
type Json = any;

Deno.serve(async (req: Request): Promise<Response> => {
  // Same guard shape as daily-digest: a shared secret in a header, so only the
  // scheduled detector (which reads it from app_config) can trigger a send.
  if (req.headers.get('x-cron-secret') !== Deno.env.get('SCAN_ALERT_CRON_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const incident: ScanDropIncident = {
    campaignSlug: String(body.campaignSlug ?? ''),
    sponsorName: body.sponsorName ?? null,
    burstCount: Number(body.burstCount ?? 0),
    dropCount: Number(body.dropCount ?? 0),
    windowMinutes: Number(body.windowMinutes ?? 0),
  };
  if (!incident.campaignSlug) return new Response('missing campaignSlug', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const resendKey = Deno.env.get('RESEND_API_KEY')!;
  const from = Deno.env.get('DIGEST_FROM') ?? 'Cupdom <crm@cupdom.fr>';

  const { data: profiles } = await supabase.from('profiles').select('email');
  const email = buildScanAlertEmail(incident);

  let sent = 0;
  let skipped = 0;
  for (const p of (profiles ?? []) as Json[]) {
    if (!p.email) {
      skipped++;
      continue;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: p.email, subject: email.subject, html: email.html, text: email.text }),
      });
      if (res.ok) sent++;
      else {
        skipped++;
        console.error('resend failed', await res.text());
      }
    } catch (e) {
      skipped++;
      console.error('send error', e);
    }
  }

  return Response.json({ sent, skipped });
});
