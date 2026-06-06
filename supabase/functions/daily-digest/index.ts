// Supabase Edge Function (Deno): daily French digest email per member, via Resend.
// Invoked by pg_cron (pg_net) at 06:00 UTC. Reads each member's UNREAD notifications
// (already owner-scoped + archived-excluded by the 0004 evaluators) and emails a recap.
// Not part of the Next typecheck (Deno globals + URL imports) — excluded in tsconfig.
import { createClient } from '@supabase/supabase-js';
import { buildDigestEmail, type DigestItems } from './email.ts';

// deno-lint-ignore no-explicit-any
type Json = any;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('DIGEST_CRON_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const resendKey = Deno.env.get('RESEND_API_KEY')!;
  const from = Deno.env.get('DIGEST_FROM') ?? 'Cupdom <crm@cupdom.fr>';

  const { data: profiles } = await supabase.from('profiles').select('id, email, display_name');

  let sent = 0;
  let skipped = 0;

  for (const p of (profiles ?? []) as Json[]) {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('type, payload')
      .eq('recipient_id', p.id)
      .is('read_at', null);

    const items: DigestItems = { reminders: [], tasks: [], followUps: [] };
    for (const n of (notifs ?? []) as Json[]) {
      const pl = n.payload ?? {};
      if (n.type === 'reminder_due') {
        items.reminders.push({ company: pl.company ?? null, note: pl.note ?? null, remindOn: pl.remindOn });
      } else if (n.type === 'task_overdue') {
        items.tasks.push({ company: pl.company ?? null, label: pl.label, dueDate: pl.dueDate });
      } else if (n.type === 'gone_quiet') {
        items.followUps.push({ company: pl.company ?? null, level: pl.level, silentDays: pl.silentDays });
      }
      // purge_warning stays in-app only — not emailed.
    }

    const email = buildDigestEmail({ displayName: p.display_name, email: p.email }, items);
    if (!email) {
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
