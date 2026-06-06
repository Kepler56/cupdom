-- ============================================================
-- Spec 1D: notifications + gone-quiet detector + daily digest
-- Depends on: 0001 (profiles, contacts, is_cupdom_member, set_updated_at),
--             0002 (deals, contact_history, owns_contact),
--             0003 (tasks, reminders).
-- Extensions: pg_cron (scheduler) + pg_net (http from cron, for the digest).
-- Enable once in Supabase Dashboard -> Database -> Extensions. The cron schedules
-- at the end are GUARDED so this migration applies even if pg_cron is not yet on.
-- ADDITIVE ONLY. Never drops/alters crm_data, qr_campaigns, qr_scans or 1A/1B/1C tables.
-- ============================================================

-- ----- 1. NOTIFICATIONS TABLE -----
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in
                  ('reminder_due','task_overdue','gone_quiet','purge_warning')),
  contact_id    uuid references public.contacts(id) on delete cascade,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  read_at       timestamptz                              -- null = unread
);

create index if not exists notifications_recipient_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(recipient_id) where read_at is null;
create index if not exists notifications_contact_idx
  on public.notifications(contact_id);

-- De-dup key: at most ONE open (unread) notification per recipient+type+contact.
create unique index if not exists notifications_open_unique
  on public.notifications(recipient_id, type, coalesce(contact_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where read_at is null;

-- ----- 2. RLS: owner reads/updates own; NO direct user insert -----
alter table public.notifications enable row level security;

drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke all on public.notifications from anon;
grant select, update on public.notifications to authenticated;

-- ----- 3. INTERNAL UPSERT HELPER (SECURITY DEFINER) -----
create or replace function public.upsert_notification(
  p_recipient uuid, p_type text, p_contact uuid, p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.notifications (recipient_id, type, contact_id, payload)
  values (p_recipient, p_type, p_contact, coalesce(p_payload,'{}'::jsonb))
  on conflict (recipient_id, type, coalesce(contact_id,'00000000-0000-0000-0000-000000000000'::uuid))
    where read_at is null
  do update set payload = excluded.payload, created_at = now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.upsert_notification(uuid,text,uuid,jsonb) from public, anon, authenticated;

-- ----- 4. LAST-ACTIVITY HELPER (gone-quiet basis, AC-39) -----
create or replace function public.contact_last_activity(p_contact uuid)
returns timestamptz
language sql stable
set search_path = public
as $$
  select greatest(
    c.created_at,
    coalesce((select max(h.created_at) from public.contact_history h
              where h.contact_id = c.id), c.created_at)
  )
  from public.contacts c where c.id = p_contact;
$$;

-- ----- 5. DERIVED STATUT HELPER (in-sync mirror of §3.4 / 1B) -----
-- Mirrors public.contacts_with_status (1B); kept as a STABLE function because the
-- security_invoker view is awkward inside the SECURITY DEFINER batch jobs below.
create or replace function public.contact_statut_d(p_contact uuid)
returns text
language sql stable
set search_path = public
as $$
  select case
    when exists (select 1 from public.deals d
                 where d.contact_id = p_contact and d.stage = 'GAGNÉ') then 'Client'
    when exists (select 1 from public.deals d
                 where d.contact_id = p_contact
                   and d.stage in ('QUALIFICATION','PROPOSITION','NÉGOCIATION')) then 'En cours'
    when exists (select 1 from public.deals d
                 where d.contact_id = p_contact)                       then 'Perdu'
    else 'Prospect'
  end;
$$;

-- ----- 6. EVALUATOR: REMINDERS DUE (AC-27, AC-38) -----
create or replace function public.eval_reminders_due(p_owner uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select rm.id as reminder_id, rm.contact_id, rm.note, rm.remind_on, c.company
    from public.reminders rm
    join public.contacts c on c.id = rm.contact_id
    where c.owner_id = p_owner
      and c.archived_at is null
      and rm.done_at is null
      and rm.remind_on <= current_date
  loop
    perform public.upsert_notification(
      p_owner, 'reminder_due', r.contact_id,
      jsonb_build_object('kind','reminder_due','reminderId',r.reminder_id,
                         'note',r.note,'remindOn',r.remind_on,'company',r.company));
    n := n + 1;
  end loop;
  return n;
end; $$;

-- ----- 7. EVALUATOR: TASKS OVERDUE (AC-25, AC-38) -----
create or replace function public.eval_tasks_overdue(p_owner uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select t.id as task_id, t.contact_id, t.label, t.due_date, c.company
    from public.tasks t
    join public.contacts c on c.id = t.contact_id
    where c.owner_id = p_owner
      and c.archived_at is null
      and t.done_at is null
      and t.due_date <= current_date
  loop
    perform public.upsert_notification(
      p_owner, 'task_overdue', r.contact_id,
      jsonb_build_object('kind','task_overdue','taskId',r.task_id,
                         'label',r.label,'dueDate',r.due_date,'company',r.company));
    n := n + 1;
  end loop;
  return n;
end; $$;

-- ----- 8. EVALUATOR: GONE-QUIET (AC-39) -----
create or replace function public.eval_gone_quiet(p_owner uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare r record; n int := 0; v_days int; v_level text; v_last timestamptz;
begin
  for r in
    select c.id as contact_id, c.company, c.created_at
    from public.contacts c
    where c.owner_id = p_owner
      and c.archived_at is null
      and public.contact_statut_d(c.id) in ('Prospect','En cours')
  loop
    v_last := public.contact_last_activity(r.contact_id);
    v_days := floor(extract(epoch from (now() - v_last)) / 86400)::int;

    v_level := case
      when v_days >= 30 then 'urgent'
      when v_days >= 15 then 'important'
      when v_days >= 7  then 'a_surveiller'
      when v_days >= 2  then 'souple'
      else null end;

    if v_level is null then
      delete from public.notifications
       where recipient_id = p_owner and type = 'gone_quiet'
         and contact_id = r.contact_id and read_at is null;
      continue;
    end if;

    perform public.upsert_notification(
      p_owner, 'gone_quiet', r.contact_id,
      jsonb_build_object('kind','gone_quiet','level',v_level,'silentDays',v_days,
                         'lastActivity',v_last,'company',r.company));
    n := n + 1;
  end loop;
  return n;
end; $$;

-- ----- 9. PURGE-WARNING NOTIFY (AC-36) — DEFINED here, CALLED by 1E -----
create or replace function public.notify_purge_warning(
  p_contact uuid, p_days_left int
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_company text; v_purge timestamptz;
begin
  select owner_id, company, purge_after into v_owner, v_company, v_purge
  from public.contacts where id = p_contact and archived_at is not null;
  if v_owner is null then return null; end if;
  return public.upsert_notification(
    v_owner, 'purge_warning', p_contact,
    jsonb_build_object('kind','purge_warning','daysLeft',p_days_left,
                       'purgeAfter',v_purge,'company',v_company));
end; $$;
revoke all on function public.notify_purge_warning(uuid,int) from public, anon, authenticated;

-- ----- 10. PER-MEMBER ORCHESTRATOR (on-demand from the app) -----
create or replace function public.refresh_my_notifications()
returns integer
language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); total int := 0;
begin
  if me is null or not public.is_cupdom_member() then
    raise exception 'not a member';
  end if;
  total := total + public.eval_reminders_due(me);
  total := total + public.eval_tasks_overdue(me);
  total := total + public.eval_gone_quiet(me);
  return total;
end; $$;
grant execute on function public.refresh_my_notifications() to authenticated;

-- ----- 11. ALL-MEMBERS SWEEP (scheduled, server-side) -----
create or replace function public.refresh_all_notifications()
returns integer
language plpgsql security definer set search_path = public
as $$
declare p record; total int := 0;
begin
  for p in select id from public.profiles loop
    total := total + public.eval_reminders_due(p.id);
    total := total + public.eval_tasks_overdue(p.id);
    total := total + public.eval_gone_quiet(p.id);
  end loop;
  return total;
end; $$;
revoke all on function public.refresh_all_notifications() from public, anon, authenticated;

-- ----- 12. MARK-READ HELPERS (RLS-safe) -----
create or replace function public.mark_notification_read(p_id uuid)
returns void language sql security invoker set search_path = public as $$
  update public.notifications set read_at = now()
  where id = p_id and recipient_id = auth.uid() and read_at is null;
$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  update public.notifications set read_at = now()
  where recipient_id = auth.uid() and read_at is null;
  get diagnostics n = row_count; return n;
end; $$;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============================================================
-- 13. CONFIG + SCHEDULES (pg_cron + pg_net). GUARDED so the migration applies
--     even when pg_cron is not yet enabled (the `cron` schema is absent until then).
-- ============================================================

-- Cron->function secret + URL live here (SQL/service only). Seed MANUALLY, do NOT commit values:
--   insert into public.app_config(key,value) values
--     ('digest_fn_url','https://<ref>.functions.supabase.co/daily-digest'),
--     ('digest_cron_secret','<random>')
--   on conflict (key) do update set value = excluded.value;
create table if not exists public.app_config (
  key text primary key, value text not null
);
revoke all on public.app_config from anon, authenticated;  -- service/SQL only
-- Enable RLS with NO policy: locks the table to service-role / SQL / cron only
-- (all of which bypass RLS). Defense-in-depth so it is never exposed via the API.
alter table public.app_config enable row level security;

do $cron$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron not enabled — skipping notification schedules. Enable pg_cron (and pg_net for the digest), seed app_config, and re-run this migration.';
    return;
  end if;

  begin perform cron.unschedule('refresh-notifications-hourly'); exception when others then null; end;
  begin perform cron.unschedule('daily-digest-0600-utc');        exception when others then null; end;

  -- 13a. Hourly: re-evaluate everyone's in-app notifications (idempotent upsert).
  perform cron.schedule('refresh-notifications-hourly', '0 * * * *',
    $job$ select public.refresh_all_notifications(); $job$);

  -- 13b. Daily digest at 06:00 UTC (~08:00 Europe/Paris). pg_net POSTs to the Edge
  --      Function; requires pg_net enabled + app_config seeded at run time.
  perform cron.schedule('daily-digest-0600-utc', '0 6 * * *',
    $job$
      select net.http_post(
        url     := (select value from public.app_config where key = 'digest_fn_url'),
        headers := jsonb_build_object(
                     'Content-Type','application/json',
                     'x-cron-secret', (select value from public.app_config where key = 'digest_cron_secret')),
        body    := '{}'::jsonb
      );
    $job$);
end
$cron$;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Expected: rowsecurity = true; 2 policies (read/update); no insert/delete policy.
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename='notifications';
select policyname, cmd from pg_policies where tablename='notifications' order by cmd;
-- After pg_cron is enabled, verify the jobs (errors if cron schema absent — run separately):
--   select jobname, schedule, active from cron.job
--   where jobname in ('refresh-notifications-hourly','daily-digest-0600-utc');
