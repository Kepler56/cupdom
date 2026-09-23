-- ============================================================
-- 0018: portal admin target — the 3 Cupdom members view ANY client's dashboard.
--       Spec: docs/superpowers/specs/2026-09-23-portail-admin-client-switch-design.md
--
-- NOT YET APPLIED. Review before running against prod. This is SECURITY-SENSITIVE:
-- it decides who can read which sponsor's data. Apply and test in a Supabase
-- branch / staging first, and run the VERIFICATION block at the bottom as a
-- member, as a real client, and as anon before trusting it in prod.
--
-- Depends on 0000 (is_cupdom_member), 0001 (contacts), 0002 (deals), 0009 (portal
-- chain), 0011 (client_funnel/client_campaigns bodies), 0012, 0013, 0017.
-- ADDITIVE + TIGHTENING. Adds new function overloads; DROP+CREATEs the 9 client
-- RPCs to append a trailing p_target (create-or-replace cannot change arity).
-- Leaves the zero/one-arg client_slugs/guard/owns intact so the RLS policies from
-- 0009 keep resolving, and alters NO policy.
--
-- SECURITY CORE: effective_contact() discards p_target for non-members, so a real
-- client can only ever resolve to their OWN contact — target isolation is true by
-- construction, not by a check that could be forgotten.
-- ============================================================

-- 0. Make is_cupdom_member callable as a PostgREST RPC (the dashboard calls it to
--    decide whether to show the client picker). It is plain SQL with default
--    PUBLIC execute today; grant it explicitly so the dependency is not implicit.
grant execute on function public.is_cupdom_member() to authenticated;

-- 1. THE boundary. Non-member: p_target ignored, own contact only.
create or replace function public.effective_contact(p_target uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case
    when public.is_cupdom_member() then p_target
    else public.current_client_contact()
  end;
$$;

-- 2. target-aware overloads (the 0009 originals are untouched — RLS still uses them)
create or replace function public.client_slugs(p_target uuid)
returns setof text language sql stable security definer set search_path = public as $$
  select c.slug from public.qr_campaigns c
  join public.deals d on d.id = c.deal_id
  where d.contact_id = public.effective_contact(p_target);
$$;

create or replace function public.client_owns_campaign(p_slug text, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.client_slugs(p_target) s where s = p_slug);
$$;

create or replace function public.client_guard(p_slug text, p_target uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if (select public.effective_contact(p_target)) is null then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
  if p_slug is not null and not public.client_owns_campaign(p_slug, p_target) then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
end; $$;

revoke execute on function public.effective_contact(uuid)          from public, anon;
revoke execute on function public.client_slugs(uuid)               from public, anon;
revoke execute on function public.client_owns_campaign(text, uuid) from public, anon;
revoke execute on function public.client_guard(text, uuid)         from public, anon;
grant  execute on function public.effective_contact(uuid)          to authenticated;
grant  execute on function public.client_slugs(uuid)               to authenticated;
grant  execute on function public.client_owns_campaign(text, uuid) to authenticated;
grant  execute on function public.client_guard(text, uuid)         to authenticated;

-- 3. member-only client picker source
create or replace function public.admin_portal_clients()
returns table (contact_id uuid, company text, contact_name text, campaigns bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_cupdom_member() then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
  return query
  select ct.id, ct.company,
         nullif(trim(concat_ws(' ', ct.first_name, ct.last_name)), ''),
         count(c.slug)::bigint
  from public.contacts ct
  join public.deals d on d.contact_id = ct.id
  join public.qr_campaigns c on c.deal_id = d.id
  group by ct.id, ct.company, ct.first_name, ct.last_name
  order by ct.company nulls last, 3;
end; $$;
revoke execute on function public.admin_portal_clients() from public, anon;
grant  execute on function public.admin_portal_clients() to authenticated;

-- 4. client_campaigns() — DROP+CREATE, body verbatim from 0017 + p_target.
drop function if exists public.client_campaigns();
create function public.client_campaigns(p_target uuid default null)
returns table (
  slug text, name text, sponsor_name text, product text, destination_url text,
  active boolean, venue text, distributed_count int, invested_amount_eur numeric,
  created_at timestamptz, scans bigint, uniques bigint, leads bigint,
  product_image_url text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(null, p_target);
  return query
  select c.slug, c.name, c.sponsor_name, c.product, c.destination_url, c.active,
         c.venue, c.distributed_count, c.invested_amount_eur, c.created_at,
         coalesce(s.scans,0), coalesce(s.uniques,0), coalesce(l.leads,0),
         c.product_image_url
  from public.qr_campaigns c
  join public.client_slugs(p_target) cs on cs = c.slug
  left join (
    select q.campaign_slug, count(*)::bigint as scans,
           count(distinct q.visitor_hash)::bigint as uniques
    from public.qr_scans q
    where q.is_bot = false and q.campaign_slug in (select public.client_slugs(p_target))
    group by q.campaign_slug
  ) s on s.campaign_slug = c.slug
  left join (
    select ld.campaign_slug, count(*)::bigint as leads
    from public.leads ld
    where ld.campaign_slug in (select public.client_slugs(p_target))
    group by ld.campaign_slug
  ) l on l.campaign_slug = c.slug
  order by c.created_at desc;
end; $$;
revoke execute on function public.client_campaigns(uuid) from public, anon;
grant  execute on function public.client_campaigns(uuid) to authenticated;

-- 5. client_funnel() — body verbatim from 0011 FIX 6 + p_target.
drop function if exists public.client_funnel(text);
create function public.client_funnel(p_slug text default null, p_target uuid default null)
returns table (distribues bigint, scannes bigint, formulaire_vu bigint,
               formulaire_soumis bigint, offre_atteinte bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(p_slug, p_target);
  return query
  with scope as (
    select cs as slug from public.client_slugs(p_target) cs where p_slug is null or cs = p_slug
  )
  select
    coalesce((select sum(coalesce(c.distributed_count,0))
              from public.qr_campaigns c join scope on scope.slug = c.slug),0)::bigint,
    coalesce((select count(distinct q.visitor_hash)
              from public.qr_scans q join scope on scope.slug = q.campaign_slug
              where q.is_bot = false),0)::bigint,
    coalesce((select count(distinct coalesce(f.visitor_hash, f.id::text))
              from public.funnel_events f join scope on scope.slug = f.campaign_slug
              where f.kind = 'form_view'),0)::bigint,
    coalesce((select count(distinct coalesce(f.visitor_hash, f.id::text))
              from public.funnel_events f join scope on scope.slug = f.campaign_slug
              where f.kind = 'form_submit'),0)::bigint,
    coalesce((select count(distinct coalesce(f.visitor_hash, f.id::text))
              from public.funnel_events f join scope on scope.slug = f.campaign_slug
              where f.kind = 'offer_reached'),0)::bigint;
end; $$;
revoke execute on function public.client_funnel(text, uuid) from public, anon;
grant  execute on function public.client_funnel(text, uuid) to authenticated;

-- 6. client_scans_daily() — verbatim from 0009 + p_target.
drop function if exists public.client_scans_daily(timestamptz, timestamptz, text);
create function public.client_scans_daily(p_from timestamptz, p_to timestamptz,
  p_slug text default null, p_target uuid default null)
returns table (day date, scans bigint, uniques bigint, leads bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(p_slug, p_target);
  return query
  with scope as (
    select cs as slug from public.client_slugs(p_target) cs where p_slug is null or cs = p_slug
  ),
  sc as (
    select (q.scanned_at at time zone 'Europe/Paris')::date as d,
           count(*)::bigint as scans, count(distinct q.visitor_hash)::bigint as uniques
    from public.qr_scans q join scope on scope.slug = q.campaign_slug
    where q.is_bot = false and q.scanned_at >= p_from and q.scanned_at < p_to
    group by 1
  ),
  ld as (
    select (l.first_seen_at at time zone 'Europe/Paris')::date as d, count(*)::bigint as leads
    from public.leads l join scope on scope.slug = l.campaign_slug
    where l.first_seen_at >= p_from and l.first_seen_at < p_to
    group by 1
  )
  select coalesce(sc.d, ld.d), coalesce(sc.scans,0), coalesce(sc.uniques,0), coalesce(ld.leads,0)
  from sc full outer join ld on ld.d = sc.d
  order by 1;
end; $$;
revoke execute on function public.client_scans_daily(timestamptz, timestamptz, text, uuid) from public, anon;
grant  execute on function public.client_scans_daily(timestamptz, timestamptz, text, uuid) to authenticated;

-- 7. client_scans_hourly() — verbatim from 0009 + p_target.
drop function if exists public.client_scans_hourly(timestamptz, timestamptz, text);
create function public.client_scans_hourly(p_from timestamptz, p_to timestamptz,
  p_slug text default null, p_target uuid default null)
returns table (dow int, hour int, scans bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(p_slug, p_target);
  return query
  with scope as (
    select cs as slug from public.client_slugs(p_target) cs where p_slug is null or cs = p_slug
  )
  select extract(isodow from (q.scanned_at at time zone 'Europe/Paris'))::int,
         extract(hour   from (q.scanned_at at time zone 'Europe/Paris'))::int,
         count(*)::bigint
  from public.qr_scans q join scope on scope.slug = q.campaign_slug
  where q.is_bot = false and q.scanned_at >= p_from and q.scanned_at < p_to
  group by 1,2 order by 1,2;
end; $$;
revoke execute on function public.client_scans_hourly(timestamptz, timestamptz, text, uuid) from public, anon;
grant  execute on function public.client_scans_hourly(timestamptz, timestamptz, text, uuid) to authenticated;

-- 8. client_scans_geo() — verbatim from 0009 + p_target.
drop function if exists public.client_scans_geo(timestamptz, timestamptz, text, text);
create function public.client_scans_geo(p_from timestamptz, p_to timestamptz,
  p_slug text default null, p_level text default 'country', p_target uuid default null)
returns table (label text, scans bigint, uniques bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(p_slug, p_target);
  if p_level not in ('country','region','city','venue') then
    raise exception 'niveau invalide' using errcode = 'invalid_parameter_value';
  end if;
  return query
  with scope as (
    select cs as slug from public.client_slugs(p_target) cs where p_slug is null or cs = p_slug
  )
  select coalesce(case p_level
           when 'country' then q.country when 'region' then q.region
           when 'city' then q.city when 'venue' then c.venue end, 'Inconnu')::text,
         count(*)::bigint, count(distinct q.visitor_hash)::bigint
  from public.qr_scans q
  join scope on scope.slug = q.campaign_slug
  join public.qr_campaigns c on c.slug = q.campaign_slug
  where q.is_bot = false and q.scanned_at >= p_from and q.scanned_at < p_to
  group by 1 order by 2 desc, 1;
end; $$;
revoke execute on function public.client_scans_geo(timestamptz, timestamptz, text, text, uuid) from public, anon;
grant  execute on function public.client_scans_geo(timestamptz, timestamptz, text, text, uuid) to authenticated;

-- 9. client_scans_tech() — verbatim from 0009 + p_target.
drop function if exists public.client_scans_tech(timestamptz, timestamptz, text);
create function public.client_scans_tech(p_from timestamptz, p_to timestamptz,
  p_slug text default null, p_target uuid default null)
returns table (dimension text, label text, scans bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(p_slug, p_target);
  return query
  with scope as (
    select cs as slug from public.client_slugs(p_target) cs where p_slug is null or cs = p_slug
  ),
  rows_in_range as (
    select q.device_type, q.os, q.browser, q.language
    from public.qr_scans q join scope on scope.slug = q.campaign_slug
    where q.is_bot = false and q.scanned_at >= p_from and q.scanned_at < p_to
  )
  select 'device_type'::text, coalesce(r.device_type,'Inconnu')::text, count(*)::bigint from rows_in_range r group by 2
  union all
  select 'os'::text,          coalesce(r.os,'Inconnu')::text,          count(*)::bigint from rows_in_range r group by 2
  union all
  select 'browser'::text,     coalesce(r.browser,'Inconnu')::text,     count(*)::bigint from rows_in_range r group by 2
  union all
  select 'language'::text,    coalesce(r.language,'Inconnu')::text,    count(*)::bigint from rows_in_range r group by 2
  order by 1, 3 desc, 2;
end; $$;
revoke execute on function public.client_scans_tech(timestamptz, timestamptz, text, uuid) from public, anon;
grant  execute on function public.client_scans_tech(timestamptz, timestamptz, text, uuid) to authenticated;

-- 10. client_overview() — verbatim from 0009 + p_target.
drop function if exists public.client_overview(timestamptz, timestamptz, timestamptz, timestamptz, text);
create function public.client_overview(p_from timestamptz, p_to timestamptz,
  p_prev_from timestamptz, p_prev_to timestamptz,
  p_slug text default null, p_target uuid default null)
returns table (bucket text, scans bigint, uniques bigint, leads bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(p_slug, p_target);
  return query
  with scope as (
    select cs as slug from public.client_slugs(p_target) cs where p_slug is null or cs = p_slug
  ),
  windows as (
    select 'current'::text as bucket, p_from as w_from, p_to as w_to
    union all select 'previous'::text, p_prev_from, p_prev_to
  )
  select w.bucket,
         coalesce((select count(*) from public.qr_scans q join scope on scope.slug = q.campaign_slug
                   where q.is_bot = false and q.scanned_at >= w.w_from and q.scanned_at < w.w_to),0)::bigint,
         coalesce((select count(distinct q.visitor_hash) from public.qr_scans q join scope on scope.slug = q.campaign_slug
                   where q.is_bot = false and q.scanned_at >= w.w_from and q.scanned_at < w.w_to),0)::bigint,
         coalesce((select count(*) from public.leads l join scope on scope.slug = l.campaign_slug
                   where l.first_seen_at >= w.w_from and l.first_seen_at < w.w_to),0)::bigint
  from windows w;
end; $$;
revoke execute on function public.client_overview(timestamptz, timestamptz, timestamptz, timestamptz, text, uuid) from public, anon;
grant  execute on function public.client_overview(timestamptz, timestamptz, timestamptz, timestamptz, text, uuid) to authenticated;

-- 11. client_campaigns_daily() — verbatim from 0012 + p_target.
drop function if exists public.client_campaigns_daily(timestamptz, timestamptz);
create function public.client_campaigns_daily(p_from timestamptz, p_to timestamptz,
  p_target uuid default null)
returns table (slug text, day date, scans bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(null, p_target);
  return query
  select q.campaign_slug, (q.scanned_at at time zone 'Europe/Paris')::date, count(*)::bigint
  from public.qr_scans q
  where q.is_bot = false and q.campaign_slug in (select public.client_slugs(p_target))
    and q.scanned_at >= p_from and q.scanned_at < p_to
  group by 1,2 order by 1,2;
end; $$;
revoke execute on function public.client_campaigns_daily(timestamptz, timestamptz, uuid) from public, anon;
grant  execute on function public.client_campaigns_daily(timestamptz, timestamptz, uuid) to authenticated;

-- 12. client_lead_consents() — verbatim from 0013 + p_target.
drop function if exists public.client_lead_consents();
create function public.client_lead_consents(p_target uuid default null)
returns table (consent_text text, consent_version text, leads bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.client_guard(null, p_target);
  return query
  select lc.consent_text, lc.consent_version, count(distinct lc.lead_id)::bigint
  from public.lead_consents lc
  where lc.campaign_slug in (select public.client_slugs(p_target))
  group by lc.consent_text, lc.consent_version
  order by count(distinct lc.lead_id) desc;
end; $$;
revoke execute on function public.client_lead_consents(uuid) from public, anon;
grant  execute on function public.client_lead_consents(uuid) to authenticated;

-- ============================================================
-- VERIFICATION — run as a MEMBER, a real CLIENT, and ANON.
--  * as a client, every RPC with p_target => <another contact> returns OWN/EMPTY data, never theirs.
--  * as a member, p_target => <contact> returns that contact's aggregates; p_target => null raises 42501.
--  * as anon, every RPC raises.
--  * admin_portal_clients(): rows for a member, raise for client/anon.
-- ============================================================
-- All new/updated functions are SECURITY DEFINER:
select proname, prosecdef from pg_proc where pronamespace='public'::regnamespace
 and proname in ('effective_contact','client_slugs','client_owns_campaign','client_guard',
   'admin_portal_clients','client_campaigns','client_funnel','client_scans_daily',
   'client_scans_hourly','client_scans_geo','client_scans_tech','client_overview',
   'client_campaigns_daily','client_lead_consents') order by proname;
-- ZERO rows — anon holds EXECUTE on no client_/admin_ function:
select routine_name, grantee from information_schema.role_routine_grants
 where specific_schema='public' and grantee='anon'
   and (routine_name like 'client%' or routine_name like 'admin_portal%' or routine_name='effective_contact');
-- Policies unchanged (qr_campaigns still 5, leads still 2):
select tablename, count(*) from pg_policies where schemaname='public'
 and tablename in ('qr_campaigns','leads') group by tablename;
