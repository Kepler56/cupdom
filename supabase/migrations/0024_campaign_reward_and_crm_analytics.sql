-- ============================================================
-- 0024 — campaign reward mode (site | promo) + member-only CRM campaign analytics
-- Spec: docs/superpowers/specs/2026-09-29-campaign-reward-dashboard-perf-design.md §3
-- Idempotent, additive. Existing campaigns become reward_type='site' (no behaviour change).
-- ============================================================
--
-- ── Verification (run after applying) ───────────────────────────────────────
-- select column_name, column_default from information_schema.columns
--   where table_name='qr_campaigns' and column_name in ('reward_type','promo_code');
--   Expected: reward_type → 'site'::text, promo_code → null.
-- select count(*) from qr_campaigns where reward_type <> 'site';   -- Expected: 0
-- As a member in the SQL editor with a real slug:
--   select * from crm_campaign_overview('<slug>', now()-interval '30 days', now(), now()-interval '60 days', now()-interval '30 days');
--
-- 1. Reward mode. destination_url keeps its meaning: redirect target (site) or
--    « lien pour utiliser le code » (promo). promo_code survives a switch back to
--    'site' so the switch is reversible; it is only read in promo mode.
alter table public.qr_campaigns
  add column if not exists reward_type text not null default 'site',
  add column if not exists promo_code  text;

alter table public.qr_campaigns drop constraint if exists qr_campaigns_reward_chk;
alter table public.qr_campaigns add constraint qr_campaigns_reward_chk check (
  reward_type in ('site','promo')
  and (reward_type = 'site' or (promo_code is not null and length(trim(promo_code)) between 1 and 64))
);

-- 2. Funnel kinds: 0007 declared an inline check (auto-named funnel_events_kind_check).
alter table public.funnel_events drop constraint if exists funnel_events_kind_check;
alter table public.funnel_events add constraint funnel_events_kind_check check (
  kind in ('form_view','form_submit','offer_reached','promo_email_sent','promo_email_failed')
);

-- 3. Member guard for the CRM analytics twins. The portal's client_* RPCs scope via
--    campaign → deal → contact and would refuse a campaign with no deal; the CRM
--    team may read any campaign, so these are slug-scoped and member-only.
create or replace function public.crm_member_guard()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_cupdom_member() then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
end; $$;
revoke execute on function public.crm_member_guard() from public, anon;
grant  execute on function public.crm_member_guard() to authenticated;

-- 4. Overview — current + previous window (mirrors client_overview, 0018 §10).
create or replace function public.crm_campaign_overview(p_slug text, p_from timestamptz, p_to timestamptz,
  p_prev_from timestamptz, p_prev_to timestamptz)
returns table (bucket text, scans bigint, uniques bigint, leads bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.crm_member_guard();
  return query
  with windows as (
    select 'current'::text as bucket, p_from as w_from, p_to as w_to
    union all select 'previous'::text, p_prev_from, p_prev_to
  )
  select w.bucket,
         coalesce((select count(*) from public.qr_scans q
                   where q.campaign_slug = p_slug and q.is_bot = false
                     and q.scanned_at >= w.w_from and q.scanned_at < w.w_to),0)::bigint,
         coalesce((select count(distinct q.visitor_hash) from public.qr_scans q
                   where q.campaign_slug = p_slug and q.is_bot = false
                     and q.scanned_at >= w.w_from and q.scanned_at < w.w_to),0)::bigint,
         coalesce((select count(*) from public.leads l
                   where l.campaign_slug = p_slug
                     and l.first_seen_at >= w.w_from and l.first_seen_at < w.w_to),0)::bigint
  from windows w;
end; $$;
revoke execute on function public.crm_campaign_overview(text, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant  execute on function public.crm_campaign_overview(text, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;

-- 5. Daily series, Europe/Paris days (mirrors client_scans_daily, 0018 §6).
create or replace function public.crm_campaign_daily(p_slug text, p_from timestamptz, p_to timestamptz)
returns table (day date, scans bigint, uniques bigint, leads bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.crm_member_guard();
  return query
  with sc as (
    select (q.scanned_at at time zone 'Europe/Paris')::date as d,
           count(*)::bigint as scans, count(distinct q.visitor_hash)::bigint as uniques
    from public.qr_scans q
    where q.campaign_slug = p_slug and q.is_bot = false and q.scanned_at >= p_from and q.scanned_at < p_to
    group by 1
  ),
  ld as (
    select (l.first_seen_at at time zone 'Europe/Paris')::date as d, count(*)::bigint as leads
    from public.leads l
    where l.campaign_slug = p_slug and l.first_seen_at >= p_from and l.first_seen_at < p_to
    group by 1
  )
  select coalesce(sc.d, ld.d), coalesce(sc.scans,0), coalesce(sc.uniques,0), coalesce(ld.leads,0)
  from sc full outer join ld on ld.d = sc.d
  order by 1;
end; $$;
revoke execute on function public.crm_campaign_daily(text, timestamptz, timestamptz) from public, anon;
grant  execute on function public.crm_campaign_daily(text, timestamptz, timestamptz) to authenticated;

-- 6. Weekday × hour, ISO dow 1=lundi (mirrors client_scans_hourly, 0018 §7).
create or replace function public.crm_campaign_hourly(p_slug text, p_from timestamptz, p_to timestamptz)
returns table (dow int, hour int, scans bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.crm_member_guard();
  return query
  select extract(isodow from (q.scanned_at at time zone 'Europe/Paris'))::int,
         extract(hour   from (q.scanned_at at time zone 'Europe/Paris'))::int,
         count(*)::bigint
  from public.qr_scans q
  where q.campaign_slug = p_slug and q.is_bot = false and q.scanned_at >= p_from and q.scanned_at < p_to
  group by 1,2 order by 1,2;
end; $$;
revoke execute on function public.crm_campaign_hourly(text, timestamptz, timestamptz) from public, anon;
grant  execute on function public.crm_campaign_hourly(text, timestamptz, timestamptz) to authenticated;

-- 7. Geo (mirrors client_scans_geo, 0018 §8).
create or replace function public.crm_campaign_geo(p_slug text, p_from timestamptz, p_to timestamptz,
  p_level text default 'city')
returns table (label text, scans bigint, uniques bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.crm_member_guard();
  if p_level not in ('country','region','city') then
    raise exception 'niveau invalide' using errcode = 'invalid_parameter_value';
  end if;
  return query
  select coalesce(case p_level when 'country' then q.country when 'region' then q.region
                               when 'city' then q.city end, 'Inconnu')::text,
         count(*)::bigint, count(distinct q.visitor_hash)::bigint
  from public.qr_scans q
  where q.campaign_slug = p_slug and q.is_bot = false and q.scanned_at >= p_from and q.scanned_at < p_to
  group by 1 order by 2 desc, 1;
end; $$;
revoke execute on function public.crm_campaign_geo(text, timestamptz, timestamptz, text) from public, anon;
grant  execute on function public.crm_campaign_geo(text, timestamptz, timestamptz, text) to authenticated;

-- 8. Tech (mirrors client_scans_tech, 0018 §9).
create or replace function public.crm_campaign_tech(p_slug text, p_from timestamptz, p_to timestamptz)
returns table (dimension text, label text, scans bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.crm_member_guard();
  return query
  with r as (
    select q.device_type, q.os from public.qr_scans q
    where q.campaign_slug = p_slug and q.is_bot = false and q.scanned_at >= p_from and q.scanned_at < p_to
  )
  select 'device_type'::text, coalesce(r.device_type,'Inconnu')::text, count(*)::bigint from r group by 2
  union all
  select 'os'::text, coalesce(r.os,'Inconnu')::text, count(*)::bigint from r group by 2
  order by 1, 3 desc, 2;
end; $$;
revoke execute on function public.crm_campaign_tech(text, timestamptz, timestamptz) from public, anon;
grant  execute on function public.crm_campaign_tech(text, timestamptz, timestamptz) to authenticated;
