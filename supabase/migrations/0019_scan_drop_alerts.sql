-- ============================================================
-- 0019: scan-drop alerts — warn the CRM when a live campaign's scans
--       collapse right after a peak (probable breakage mid-event). Spec:
--       docs/superpowers/specs/2026-09-23-scan-drop-alerts-design.md
--
-- NOT YET APPLIED. Review before running against prod. Depends on 0004
-- (notifications, upsert_notification, profiles), 0006 (qr_campaigns.deal_id).
-- pg_cron/pg_net are optional at apply time — the schedule block is GUARDED
-- exactly like 0004, so the migration applies even if the `cron` schema is
-- absent (you then schedule detect_scan_drops() by hand later).
-- ADDITIVE ONLY. The pure detection math is mirrored + unit-tested in
-- lib/scan-drop/detect.ts — keep the two in lockstep.
-- ============================================================

-- 1. Widen notifications for a per-campaign, contactless alert type.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('reminder_due','task_overdue','gone_quiet','purge_warning','scan_drop'));

alter table public.notifications
  add column if not exists campaign_slug text
    references public.qr_campaigns(slug) on delete cascade;

-- Rebuild the open-dedup index to key on campaign too. Existing types keep
-- campaign_slug = null -> coalesce('') -> identical behaviour to before; two
-- different campaigns can now each hold an open scan_drop for the same member.
drop index if exists public.notifications_open_unique;
create unique index if not exists notifications_open_unique
  on public.notifications(
    recipient_id, type,
    coalesce(contact_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(campaign_slug,'')
  )
  where read_at is null;

-- 2. upsert_notification overload carrying campaign_slug (the 4-arg 0004 version
--    stays intact so existing callers are untouched).
create or replace function public.upsert_notification(
  p_recipient uuid, p_type text, p_contact uuid, p_payload jsonb, p_campaign text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.notifications (recipient_id, type, contact_id, payload, campaign_slug)
  values (p_recipient, p_type, p_contact, coalesce(p_payload,'{}'::jsonb), p_campaign)
  on conflict (recipient_id, type,
               coalesce(contact_id,'00000000-0000-0000-0000-000000000000'::uuid),
               coalesce(campaign_slug,''))
    where read_at is null
  do update set payload = excluded.payload, created_at = now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.upsert_notification(uuid,text,uuid,jsonb,text)
  from public, anon, authenticated;

-- 3. Per-campaign mute.
alter table public.qr_campaigns
  add column if not exists scan_alerts_muted boolean not null default false;

-- 4. Singleton config (start == end => quiet hours OFF; events are nocturnal so
--    quiet hours default OFF — see the spec's §5).
create table if not exists public.scan_alert_config (
  id                        boolean primary key default true check (id),
  enabled                   boolean not null default true,
  window_minutes            int     not null default 10,
  peak_threshold            int     not null default 5,
  drop_ratio                numeric not null default 0.20,
  min_campaign_age_minutes  int     not null default 30,
  cooldown_minutes          int     not null default 60,
  quiet_start               time    not null default '00:00',
  quiet_end                 time    not null default '00:00',
  quiet_tz                  text    not null default 'Europe/Paris'
);
insert into public.scan_alert_config (id) values (true) on conflict (id) do nothing;
alter table public.scan_alert_config enable row level security; -- no policy => SQL/service only
revoke all on public.scan_alert_config from anon, authenticated;

-- 5. Incident log + open-incident dedup (the real source of truth for debounce,
--    cooldown and resolution).
create table if not exists public.scan_alerts (
  id             uuid primary key default gen_random_uuid(),
  campaign_slug  text not null references public.qr_campaigns(slug) on delete cascade,
  fired_at       timestamptz not null default now(),
  burst_count    int not null,
  drop_count     int not null,
  window_minutes int not null,
  resolved_at    timestamptz
);
create unique index if not exists scan_alerts_open_unique
  on public.scan_alerts(campaign_slug) where resolved_at is null;
create index if not exists scan_alerts_slug_idx
  on public.scan_alerts(campaign_slug, fired_at desc);
alter table public.scan_alerts enable row level security;
drop policy if exists "scan_alerts read members" on public.scan_alerts;
create policy "scan_alerts read members" on public.scan_alerts
  for select to authenticated using (public.is_cupdom_member());
revoke all on public.scan_alerts from anon;
grant select on public.scan_alerts to authenticated;

-- 6. detect_scan_drops(): the timer-driven detector. A trigger CANNOT do this —
--    the signal is the ABSENCE of scans, which no row-insert observes. This
--    mirrors lib/scan-drop/detect.ts (burst/drop windows + floor) with the
--    stateful guards (active, muted, min age, cooldown, open incident) around it.
create or replace function public.detect_scan_drops()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  cfg public.scan_alert_config; c record; v_burst int; v_drop int; v_floor int;
  v_now timestamptz := now(); v_local time; v_open uuid; v_last timestamptz; p record; fired int := 0;
begin
  select * into cfg from public.scan_alert_config where id = true;
  if cfg is null or cfg.enabled = false then return 0; end if;

  if cfg.quiet_start <> cfg.quiet_end then
    v_local := (v_now at time zone cfg.quiet_tz)::time;
    if (cfg.quiet_start < cfg.quiet_end and v_local >= cfg.quiet_start and v_local < cfg.quiet_end)
       or (cfg.quiet_start > cfg.quiet_end and (v_local >= cfg.quiet_start or v_local < cfg.quiet_end)) then
      return 0;
    end if;
  end if;

  for c in
    select slug, sponsor_name, name from public.qr_campaigns
    where active = true and coalesce(scan_alerts_muted, false) = false
      and created_at <= v_now - make_interval(mins => cfg.min_campaign_age_minutes)
  loop
    select count(*) into v_burst from public.qr_scans s
     where s.campaign_slug = c.slug and s.is_bot = false
       and s.scanned_at >= v_now - make_interval(mins => 2 * cfg.window_minutes)
       and s.scanned_at <  v_now - make_interval(mins => cfg.window_minutes);
    select count(*) into v_drop from public.qr_scans s
     where s.campaign_slug = c.slug and s.is_bot = false
       and s.scanned_at >= v_now - make_interval(mins => cfg.window_minutes)
       and s.scanned_at <= v_now;
    v_floor := floor(cfg.drop_ratio * v_burst)::int;
    select id into v_open from public.scan_alerts where campaign_slug = c.slug and resolved_at is null limit 1;

    if v_burst >= cfg.peak_threshold and v_drop <= v_floor then
      if v_open is not null then continue; end if;                       -- already open: fire once
      select max(fired_at) into v_last from public.scan_alerts where campaign_slug = c.slug;
      if v_last is not null and v_last > v_now - make_interval(mins => cfg.cooldown_minutes) then
        continue;                                                        -- inside cooldown
      end if;
      insert into public.scan_alerts (campaign_slug, burst_count, drop_count, window_minutes)
      values (c.slug, v_burst, v_drop, cfg.window_minutes);
      for p in select id from public.profiles loop
        perform public.upsert_notification(p.id, 'scan_drop', null,
          jsonb_build_object('kind','scan_drop','campaignSlug',c.slug,
            'sponsorName',coalesce(c.name,c.sponsor_name),'burstCount',v_burst,
            'dropCount',v_drop,'windowMinutes',cfg.window_minutes,'detectedAt',v_now),
          c.slug);
      end loop;
      fired := fired + 1;
    else
      if v_open is not null and v_drop > v_floor then                    -- recovered: re-arm
        update public.scan_alerts set resolved_at = v_now where id = v_open;
      end if;
    end if;
  end loop;
  return fired;
end; $$;
revoke all on function public.detect_scan_drops() from public, anon, authenticated;

-- 7. GUARDED schedule (mirrors 0004). Runs every 5 minutes. Optional real-time
--    email hook (a scan-alert Edge Function via pg_net) is intentionally NOT wired
--    here — add it once the delivery-channel decision is made (spec §4/§9).
do $cron$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron not enabled — skipping scan-drop schedule; run cron.schedule() by hand later.';
    return;
  end if;
  begin perform cron.unschedule('detect-scan-drops-5min'); exception when others then null; end;
  perform cron.schedule('detect-scan-drops-5min', '*/5 * * * *', $job$ select public.detect_scan_drops(); $job$);
end $cron$;

-- VERIFICATION: new tables exist, RLS on, function is SECURITY DEFINER, schedule present.
select tablename, rowsecurity from pg_tables where schemaname='public'
  and tablename in ('scan_alerts','scan_alert_config');
select proname, prosecdef from pg_proc where pronamespace='public'::regnamespace and proname='detect_scan_drops';
