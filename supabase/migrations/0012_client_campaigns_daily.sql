-- ============================================================
-- Spec 5 (Portail Client) — stage 3B.
-- ONE function: the daily scan curve for EVERY campaign the caller owns, in a
-- single round-trip.
--
-- Why it exists: client_scans_daily takes one p_slug, so a table of sparklines
-- would be one RPC per row. A client with fifteen campaigns would pay fifteen
-- round-trips to draw fifteen ornaments. This returns the same aggregate keyed
-- by slug.
--
-- ADDITIVE ONLY. Creates nothing but this function; drops nothing; alters no
-- table and no existing policy. Safe to re-run.
-- ============================================================

-- No `leads` and no `uniques` column, deliberately. The only consumer is a
-- sparkline, which draws one series; returning three would triple the payload
-- for a chart that cannot show them. If a future screen needs them, widen the
-- return type then — narrowing it later would be a breaking change.
create or replace function public.client_campaigns_daily(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (slug text, day date, scans bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Same guard as every other client RPC. No p_slug argument at all: this
  -- function is "all of my campaigns" by definition, so there is no slug to
  -- validate and no way to ask it about someone else's.
  perform public.client_guard(null);
  return query
  select q.campaign_slug,
         -- at time zone 'Europe/Paris' before ::date, exactly as
         -- client_scans_daily does. A scan at 00:30 Paris in summer is 22:30
         -- UTC the previous day; bucketed in UTC the curve would be shifted by
         -- one day relative to the area chart on the same screen.
         (q.scanned_at at time zone 'Europe/Paris')::date,
         count(*)::bigint
  from public.qr_scans q
  where q.is_bot = false
    and q.campaign_slug in (select public.client_slugs())
    -- The range filter stays on the raw timestamptz so it remains
    -- index-friendly; only the GROUP BY key is converted.
    and q.scanned_at >= p_from
    and q.scanned_at <  p_to
  group by 1, 2
  order by 1, 2;
end;
$$;

revoke execute on function public.client_campaigns_daily(timestamptz, timestamptz) from public, anon;
grant  execute on function public.client_campaigns_daily(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- Verify (run as a portal client, not as postgres):
--   select * from public.client_campaigns_daily(now() - interval '30 days', now());
-- Expect: one row per (campaign, day-with-scans). Zero rows is a valid answer.
-- As a CRM member or anon it must raise: accès refusé (SQLSTATE 42501).
-- ------------------------------------------------------------
