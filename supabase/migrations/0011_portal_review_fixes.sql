-- ============================================================
-- 0011: stage-1 client-portal final security review fixes
--
-- FOUND BY: the stage-1 final security review of the client portal
-- (.superpowers/sdd/2026-08-17-portail-client-stage1-schema-rls-plan),
-- against migrations 0009_client_portal.sql and 0010_crm_data_lockdown.sql.
-- This migration addresses the three findings from that review that require a
-- SQL change (funnel over-counting, a full-table-scan aggregate, and a missing
-- defence-in-depth guard on 0006's write policies), plus a documentation-only
-- fix for a fourth, non-actionable finding (visitor_hash's UTC/Paris skew).
--
-- ADDITIVE / TIGHTENING ONLY. Safe to re-run (create or replace function,
-- drop policy if exists + create policy). No table is dropped, no data is
-- deleted, no grant is loosened.
-- ============================================================

-- ------------------------------------------------------------
-- FIX 6 (review finding): client_funnel() can report over 100% conversion.
--
-- scannes counted `count(distinct visitor_hash)` (people) while
-- formulaire_vu / formulaire_soumis / offre_atteinte counted `count(*)` (raw
-- event rows). One visitor viewing the form twice produced 2 form_views
-- against 1 unique scanner, so a portal funnel could show a stage above 100%
-- of the previous one — which reads as broken to a sponsor.
--
-- FIX: every funnel-event stage now counts `count(distinct coalesce(
-- f.visitor_hash, f.id::text))` — people, not rows, consistent with scannes.
-- visitor_hash is best-effort on the public client (Spec 3A) and can be NULL;
-- coalescing to f.id::text means a null-hash event still counts once and can
-- never collapse with another null-hash event (each id is unique), so the
-- fallback cannot UNDER-count either.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- FIX 9 (review finding, DOCUMENTATION ONLY here — the code fix ships
-- alongside in netlify/edge-functions/lib/detect.mjs):
-- visitor_hash / uniques is an UPPER BOUND across Paris midnight, for scans
-- logged BEFORE the edge function carrying that fix was deployed.
--
-- THE BUG: visitor_hash was sha256(ip + ua + slug + secret + UTC date) — keyed
-- on the UTC calendar day. Every RPC in this file and in 0009 buckets time
-- `at time zone 'Europe/Paris'`. Those two clocks disagree for part of every
-- night: Paris is UTC+1 (winter) or UTC+2 (summer), so the UTC date rolls over
-- at 23:00 or 22:00 Paris — while it is still "the same Paris night" to a
-- human and to every bucketing function here. A person who scanned at 23:30
-- Paris and again at 01:00 Paris straddled the UTC boundary, got TWO different
-- hashes for one device, and was counted as two people by every
-- `count(distinct visitor_hash)` figure — "uniques" / "scannes" / "personnes
-- touchées" in client_campaigns, client_funnel, client_scans_daily,
-- client_scans_hourly, and client_overview.
--
-- WHY IT MATTERED HERE SPECIFICALLY: Cupdom's product is worn in
-- nightclubs/events. 00:00-02:00 Paris is the busiest scanning window and is
-- exactly the window that straddles the UTC boundary. The overcount landed
-- precisely where the data is densest.
--
-- THE FIX (approved by the user, 2026-08-18): detect.mjs now exports
-- visitorDate(), which formats the timestamp in Europe/Paris via
-- Intl.DateTimeFormat('en-CA'), and scan.js keys visitor_hash on that. The
-- dedupe window is still exactly one day and still carries no cross-day
-- identifier — the privacy property is unchanged, only the boundary moved.
--
-- DELIBERATE SEAM — NO SQL CHANGE IS POSSIBLE FOR HISTORY. visitor_hash is a
-- one-way digest; the pre-deployment rows cannot be re-keyed. So:
--   * scans written BEFORE the edge-function deploy remain UTC-keyed and stay
--     an UPPER BOUND (over-count only, never under-count) for sessions
--     crossing UTC midnight within one Paris night;
--   * scans written AFTER it are correct.
-- Spec §4.6's honest-numbers principle: a known, documented overcount is
-- acceptable; a silent one is not. This block is that documentation, and it
-- lives in the migration history so the discontinuity is discoverable from the
-- database alone.
-- ------------------------------------------------------------
create or replace function public.client_funnel(p_slug text default null)
returns table (
  distribues        bigint,
  scannes           bigint,
  formulaire_vu     bigint,
  formulaire_soumis bigint,
  offre_atteinte    bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.client_guard(p_slug);
  return query
  with scope as (
    select cs as slug from public.client_slugs() cs
    where p_slug is null or cs = p_slug
  )
  select
    coalesce((select sum(coalesce(c.distributed_count, 0))
              from public.qr_campaigns c join scope on scope.slug = c.slug), 0)::bigint,
    coalesce((select count(distinct q.visitor_hash)
              from public.qr_scans q join scope on scope.slug = q.campaign_slug
              where q.is_bot = false), 0)::bigint,
    coalesce((select count(distinct coalesce(f.visitor_hash, f.id::text))
              from public.funnel_events f join scope on scope.slug = f.campaign_slug
              where f.kind = 'form_view'), 0)::bigint,
    coalesce((select count(distinct coalesce(f.visitor_hash, f.id::text))
              from public.funnel_events f join scope on scope.slug = f.campaign_slug
              where f.kind = 'form_submit'), 0)::bigint,
    coalesce((select count(distinct coalesce(f.visitor_hash, f.id::text))
              from public.funnel_events f join scope on scope.slug = f.campaign_slug
              where f.kind = 'offer_reached'), 0)::bigint;
end;
$$;

revoke execute on function public.client_funnel(text) from public, anon;
grant  execute on function public.client_funnel(text) to authenticated;

-- ------------------------------------------------------------
-- FIX 7 (review finding): client_campaigns() full-scans qr_scans and leads.
--
-- Both rollup subqueries aggregated the ENTIRE qr_scans / leads table before
-- joining to the caller's slugs, instead of filtering by slug first. On a
-- database with real scan volume that is a full table scan on the portal's
-- landing page (client_campaigns is the first RPC the portal calls).
--
-- FIX: push `where … campaign_slug in (select public.client_slugs())` into
-- both subqueries so only the caller's own campaigns are ever aggregated.
-- client_slugs() is STABLE SECURITY DEFINER (0009 §2), so this is the same
-- ownership resolution already used by the join two lines above — no new
-- logic, just applied earlier so the planner can use it as a filter.
-- ------------------------------------------------------------
create or replace function public.client_campaigns()
returns table (
  slug                text,
  name                text,
  sponsor_name        text,
  product             text,
  destination_url     text,
  active              boolean,
  venue               text,
  distributed_count   int,
  invested_amount_eur numeric,
  created_at          timestamptz,
  scans               bigint,
  uniques             bigint,
  leads               bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.client_guard(null);
  return query
  select
    c.slug, c.name, c.sponsor_name, c.product, c.destination_url, c.active,
    c.venue, c.distributed_count, c.invested_amount_eur, c.created_at,
    coalesce(s.scans, 0), coalesce(s.uniques, 0), coalesce(l.leads, 0)
  from public.qr_campaigns c
  join public.client_slugs() cs on cs = c.slug
  left join (
    select q.campaign_slug,
           count(*)::bigint                        as scans,
           count(distinct q.visitor_hash)::bigint  as uniques
    from public.qr_scans q
    where q.is_bot = false
      and q.campaign_slug in (select public.client_slugs())
    group by q.campaign_slug
  ) s on s.campaign_slug = c.slug
  left join (
    select ld.campaign_slug, count(*)::bigint as leads
    from public.leads ld
    where ld.campaign_slug in (select public.client_slugs())
    group by ld.campaign_slug
  ) l on l.campaign_slug = c.slug
  order by c.created_at desc;
end;
$$;

revoke execute on function public.client_campaigns() from public, anon;
grant  execute on function public.client_campaigns() to authenticated;

-- ------------------------------------------------------------
-- FIX 8 (review finding): defence-in-depth on qr_campaigns UPDATE/DELETE.
--
-- 0006 defined the qr_campaigns UPDATE and DELETE policies as
-- `using (deal_id is null or public.owns_contact(...))` — with NO
-- is_cupdom_member() guard, unlike the sibling INSERT policy which has one.
--
-- THIS IS NOT CURRENTLY EXPLOITABLE. Postgres requires SELECT privilege on
-- any column referenced in an UPDATE/DELETE WHERE clause, so the (member-
-- gated) SELECT policy on qr_campaigns gates the filter: a portal client's
-- WHERE evaluates deal_id/owns_contact() against rows it cannot even see,
-- and matches nothing. Verified directly during the review (0009's isolation
-- suite: "a client has no write path anywhere"). Do not treat this as a live
-- vulnerability — it is being closed as defence in depth only.
--
-- FIX: recreate both policies with `public.is_cupdom_member() and (deal_id
-- is null or public.owns_contact(...))`, matching the INSERT policy's guard.
-- The UPDATE policy's WITH CHECK gets the same addition. Policy bodies are
-- otherwise byte-for-byte identical to 0006 — only the guard is added.
--
-- NOTE: this is a DELIBERATE, security-motivated change to a pre-existing
-- 0006 policy — the ONLY place in stage 1 where an existing policy is
-- altered rather than added to. Every other migration in stage 1 (0007-0010)
-- is additive-only over 0001-0006.
-- ------------------------------------------------------------
drop policy if exists "qr_campaigns update owner" on public.qr_campaigns;
create policy "qr_campaigns update owner" on public.qr_campaigns
  for update to authenticated
  using (
    public.is_cupdom_member()
    and (
      deal_id is null
      or public.owns_contact(
           (select d.contact_id from public.deals d where d.id = deal_id))
    )
  )
  with check (
    public.is_cupdom_member()
    and (
      deal_id is null
      or public.owns_contact(
           (select d.contact_id from public.deals d where d.id = deal_id))
    )
  );

drop policy if exists "qr_campaigns delete owner" on public.qr_campaigns;
create policy "qr_campaigns delete owner" on public.qr_campaigns
  for delete to authenticated
  using (
    public.is_cupdom_member()
    and (
      deal_id is null
      or public.owns_contact(
           (select d.contact_id from public.deals d where d.id = deal_id))
    )
  );

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================

-- Expected: client_funnel and client_campaigns both prosecdef = true
-- (SECURITY DEFINER preserved), proname unchanged.
select proname, prosecdef from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('client_funnel', 'client_campaigns')
order by proname;

-- Expected: anon holds EXECUTE on neither function.
select routine_name, grantee from information_schema.role_routine_grants
where specific_schema = 'public' and grantee = 'anon'
  and routine_name in ('client_funnel', 'client_campaigns');

-- Expected: the function source for client_funnel contains
-- "count(distinct coalesce" (three occurrences, one per funnel stage).
select proname, (length(prosrc) - length(replace(prosrc, 'count(distinct coalesce', ''))) / length('count(distinct coalesce') as occurrences
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'client_funnel';

-- Expected: the function source for client_campaigns references
-- client_slugs() inside both rollup subqueries (3 total: the join + 2 subqueries).
select proname, (length(prosrc) - length(replace(prosrc, 'client_slugs()', ''))) / length('client_slugs()') as occurrences
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'client_campaigns';

-- Expected: qr_campaigns still has exactly 4 policies (read/insert/update/delete);
-- update/delete policy bodies now start with "is_cupdom_member".
select policyname, cmd, qual from pg_policies
where schemaname = 'public' and tablename = 'qr_campaigns'
order by cmd, policyname;

-- Expected: for update/delete rows above, qual contains 'is_cupdom_member'.
select policyname, cmd,
       qual ilike '%is_cupdom_member%' as has_member_guard
from pg_policies
where schemaname = 'public' and tablename = 'qr_campaigns'
  and cmd in ('UPDATE', 'DELETE');
