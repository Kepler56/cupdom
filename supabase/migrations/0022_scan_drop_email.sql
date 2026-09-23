-- ============================================================
-- 0022: real-time EMAIL on a scan-drop incident (#6), in addition to the in-app
--       notification. Re-creates detect_scan_drops() (0019) to POST to the
--       `scan-alert` Edge Function via pg_net at the moment a NEW incident fires.
--
-- NOT YET APPLIED. Review before running. Depends on 0019 (detect_scan_drops,
-- scan_alerts, scan_alert_config) and 0004 (app_config, pg_net pattern).
-- ADDITIVE: only the function body changes; the schedule from 0019 keeps calling it.
--
-- MANUAL STEPS to make the email fire (the SQL is inert until these are done, and
-- degrades safely — no email, in-app alert unaffected — if they are not):
--   1. Deploy the Edge Function:  supabase functions deploy scan-alert
--   2. Set its secrets:  RESEND_API_KEY, DIGEST_FROM (reused from the digest),
--      and SCAN_ALERT_CRON_SECRET (a new random string).
--   3. Seed app_config (service/SQL only):
--        insert into public.app_config(key,value) values
--          ('scan_alert_fn_url','https://<ref>.functions.supabase.co/scan-alert'),
--          ('scan_alert_cron_secret','<same random as SCAN_ALERT_CRON_SECRET>')
--        on conflict (key) do update set value = excluded.value;
--   4. Ensure pg_net is enabled (it already is for the daily digest).
-- ============================================================

create or replace function public.detect_scan_drops()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  cfg public.scan_alert_config; c record; v_burst int; v_drop int; v_floor int;
  v_now timestamptz := now(); v_local time; v_open uuid; v_last timestamptz; p record; fired int := 0;
  v_email_enabled boolean;
begin
  select * into cfg from public.scan_alert_config where id = true;
  if cfg is null or cfg.enabled = false then return 0; end if;

  -- Email hook is live only when pg_net is present AND the config is seeded.
  v_email_enabled := exists (select 1 from pg_extension where extname = 'pg_net')
                 and exists (select 1 from public.app_config where key = 'scan_alert_fn_url');

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

      -- #6: real-time email, one per new incident. Guarded so a missing extension
      -- or unseeded config simply skips the email (the in-app alert is unaffected).
      if v_email_enabled then
        perform net.http_post(
          url     := (select value from public.app_config where key = 'scan_alert_fn_url'),
          headers := jsonb_build_object(
                       'Content-Type','application/json',
                       'x-cron-secret', (select value from public.app_config where key = 'scan_alert_cron_secret')),
          body    := jsonb_build_object(
                       'campaignSlug', c.slug,
                       'sponsorName',  coalesce(c.name, c.sponsor_name),
                       'burstCount',   v_burst,
                       'dropCount',    v_drop,
                       'windowMinutes', cfg.window_minutes)
        );
      end if;

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

-- VERIFICATION: the function still exists and is SECURITY DEFINER.
select proname, prosecdef from pg_proc where pronamespace='public'::regnamespace and proname='detect_scan_drops';
