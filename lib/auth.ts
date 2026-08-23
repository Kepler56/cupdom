// Pure auth allow-list helpers — safe to import from both client and server code
// (no next/headers, no Supabase client). The real security gate is Postgres RLS via
// public.is_cupdom_member(); this list is defence-in-depth and MUST stay in sync with
// the SQL allowlist in supabase/migrations/0000_legacy_baseline.sql — change both
// together. (It previously pointed at supabase_sql.md, which no longer exists; the
// predicate was recovered from production into 0000 on 2026-08-23.)

export const ALLOWED_EMAILS = [
  'eliah@cupdom.fr',
  'maxime@cupdom.fr',
  'contact@cupdom.fr',
] as const;

export type AllowedEmail = (typeof ALLOWED_EMAILS)[number];

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  return (ALLOWED_EMAILS as readonly string[]).includes(e);
}
