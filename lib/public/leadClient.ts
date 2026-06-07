// Browser client for the public lead form (Spec 3A §4). Holds NO keys — it talks only to
// the public Edge Function URL (NEXT_PUBLIC_LEAD_SUBMIT_URL). The service-role key lives only
// inside that function. Every write/decision is server-side; this just relays.
import type { LeadErrors, LeadInput } from '@/lib/public/validation';

const ENDPOINT = process.env.NEXT_PUBLIC_LEAD_SUBMIT_URL ?? '';

export interface FormViewResult {
  active: boolean;
  sponsor: string;
}

export interface SubmitPayload extends LeadInput {
  slug: string;
  website: string; // honeypot (must stay empty for real users)
  consentVersion: string;
}

export type SubmitResult = { redirect: string } | { errors: LeadErrors };

async function post(body: unknown): Promise<Response> {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Log the form_view funnel event AND learn the campaign status in one round-trip (AC-3).
 * Best-effort: a network/endpoint error resolves to inactive so the page shows the ended state
 * rather than hanging — a broken beacon never blocks rendering.
 */
export async function postFormView(slug: string): Promise<FormViewResult> {
  try {
    const res = await post({ slug, kind: 'form_view' });
    if (!res.ok) return { active: false, sponsor: '' };
    const data = (await res.json()) as Partial<FormViewResult>;
    return { active: data.active === true, sponsor: typeof data.sponsor === 'string' ? data.sponsor : '' };
  } catch {
    return { active: false, sponsor: '' };
  }
}

/**
 * Submit the lead. 200 → { redirect } (the reward); 422 → { errors } (server validation mirror).
 * A spam/inactive submission may still return a redirect (the consumer is forwarded; AC-8).
 */
export async function postSubmit(payload: SubmitPayload): Promise<SubmitResult> {
  const res = await post(payload);
  const data = (await res.json().catch(() => ({}))) as SubmitResult;
  if (res.ok && 'redirect' in data) return { redirect: data.redirect };
  if ('errors' in data) return { errors: data.errors };
  return { errors: { email: 'Une erreur est survenue. Réessayez.' } };
}
