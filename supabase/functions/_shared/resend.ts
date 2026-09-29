// Shared Resend sender for the Edge Functions (scan-alert, daily-digest, lead-submit).
// Pure: no Deno globals, so Vitest imports it directly. Callers read the env and pass
// cfg in. NEVER throws: an email is always a side effect that must not take the caller
// down with it, so every failure comes back as { ok:false, status, error }.

export const DEFAULT_FROM = 'Cupdom <crm@cupdom.fr>';

/** Resend call budget. A hung request must not hold lead-submit's reply (or a cron run). */
export const RESEND_TIMEOUT_MS = 5000;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  error?: string;
}

export async function sendEmail(
  msg: EmailMessage,
  cfg: { apiKey: string; from: string; fetchImpl?: typeof fetch },
): Promise<SendResult> {
  if (!cfg.apiKey) return { ok: false, status: 0, error: 'missing RESEND_API_KEY' };
  const f = cfg.fetchImpl ?? fetch;
  try {
    const res = await f('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
      // Aborts after RESEND_TIMEOUT_MS; the rejection (TimeoutError/AbortError) lands in the
      // catch below and comes back as { ok:false, status:0 } like any network error.
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: await res.text().catch(() => '') };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
