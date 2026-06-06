-- ============================================================
-- Spec 1C: tasks + reminders + contact_links + 90-day cleanup (pg_cron)
-- Depends on:
--   0001_foundation.sql  -> public.contacts, public.is_cupdom_member(), public.set_updated_at()
--   0002_deals.sql       -> public.owns_contact(uuid), public.contact_history (+ its RLS)
-- ADDITIVE ONLY. Never drops/alters crm_data, qr_campaigns, qr_scans, contacts, profiles,
--   deals, contact_history. Safe to re-run (idempotent-friendly).
-- ============================================================

-- ------------------------------------------------------------
-- 1. tasks: à-faire items under a contact (Spec §5.6 / AC-22/23/24/25).
--    Effective owner = parent contact's owner (public.owns_contact).
--    done_at: null = à faire; timestamp = fait; reopening sets it back to null
--    (which resets the 90-day deletion clock, §6).
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  label       text not null,
  due_date    date,                       -- échéance (optional)
  done_at     timestamptz,                -- null = à faire; set = fait (reopen -> null)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_contact_idx on public.tasks(contact_id);
create index if not exists tasks_due_idx      on public.tasks(due_date);
create index if not exists tasks_done_idx     on public.tasks(done_at);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "tasks read members" on public.tasks;
create policy "tasks read members" on public.tasks
  for select to authenticated using (public.is_cupdom_member());

drop policy if exists "tasks insert owner" on public.tasks;
create policy "tasks insert owner" on public.tasks
  for insert to authenticated
  with check (public.owns_contact(contact_id));

drop policy if exists "tasks update owner" on public.tasks;
create policy "tasks update owner" on public.tasks
  for update to authenticated
  using (public.owns_contact(contact_id))
  with check (public.owns_contact(contact_id));

drop policy if exists "tasks delete owner" on public.tasks;
create policy "tasks delete owner" on public.tasks
  for delete to authenticated using (public.owns_contact(contact_id));

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

-- ------------------------------------------------------------
-- 2. reminders: dated nudges under a contact (Spec §5.7 / AC-26/27/28).
--    A contact may have MANY reminders. Effective owner = parent contact's owner.
--    done_at semantics identical to tasks.
-- ------------------------------------------------------------
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  remind_on   date not null,              -- the date the reminder is due
  note        text,
  done_at     timestamptz,                -- null = en attente; set = traité (reopen -> null)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists reminders_contact_idx on public.reminders(contact_id);
create index if not exists reminders_remind_idx   on public.reminders(remind_on);
create index if not exists reminders_done_idx      on public.reminders(done_at);

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;

drop policy if exists "reminders read members" on public.reminders;
create policy "reminders read members" on public.reminders
  for select to authenticated using (public.is_cupdom_member());

drop policy if exists "reminders insert owner" on public.reminders;
create policy "reminders insert owner" on public.reminders
  for insert to authenticated
  with check (public.owns_contact(contact_id));

drop policy if exists "reminders update owner" on public.reminders;
create policy "reminders update owner" on public.reminders
  for update to authenticated
  using (public.owns_contact(contact_id))
  with check (public.owns_contact(contact_id));

drop policy if exists "reminders delete owner" on public.reminders;
create policy "reminders delete owner" on public.reminders
  for delete to authenticated using (public.owns_contact(contact_id));

revoke all on public.reminders from anon;
grant select, insert, update, delete on public.reminders to authenticated;

-- ------------------------------------------------------------
-- 3. contact_links: label + URL under a contact (Spec §5.8 / AC-29).
--    Safe URL schemes only; validated in the app (no DB-side scheme parsing).
--    No file upload in v1. No updated_at (links are create/delete only).
-- ------------------------------------------------------------
create table if not exists public.contact_links (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  label       text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);
create index if not exists contact_links_contact_idx on public.contact_links(contact_id);

alter table public.contact_links enable row level security;

drop policy if exists "links read members" on public.contact_links;
create policy "links read members" on public.contact_links
  for select to authenticated using (public.is_cupdom_member());

drop policy if exists "links insert owner" on public.contact_links;
create policy "links insert owner" on public.contact_links
  for insert to authenticated
  with check (public.owns_contact(contact_id));

drop policy if exists "links update owner" on public.contact_links;
create policy "links update owner" on public.contact_links
  for update to authenticated
  using (public.owns_contact(contact_id))
  with check (public.owns_contact(contact_id));

drop policy if exists "links delete owner" on public.contact_links;
create policy "links delete owner" on public.contact_links
  for delete to authenticated using (public.owns_contact(contact_id));

revoke all on public.contact_links from anon;
grant select, insert, update, delete on public.contact_links to authenticated;

-- ------------------------------------------------------------
-- 4. 90-day cleanup (Spec §5.6 AC-24, §5.7 AC-28, §6 reopen resets the clock).
--    A daily pg_cron job hard-deletes COMPLETED tasks/reminders whose most recent
--    completion is older than 90 days. Because reopening sets done_at back to null,
--    a reopened-then-recompleted row's clock restarts from the new done_at (the
--    WHERE only ever sees the current done_at). The functions are SECURITY DEFINER
--    so the scheduled job (no auth.uid()) bypasses RLS to purge across all owners.
--
--    SETUP STEP (run once, superuser): enable pg_cron before scheduling. In Supabase
--    this is done in Dashboard -> Database -> Extensions (toggle "pg_cron"), or:
--        create extension if not exists pg_cron;
--    pg_cron schedules run in the database's cron schema; on Supabase the job runs
--    in the `postgres` database. If `create extension` errors for lack of privilege,
--    enable it via the Dashboard Extensions UI first, then run the schedule call.
-- ------------------------------------------------------------
create or replace function public.cleanup_completed_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.tasks
  where done_at is not null
    and done_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.cleanup_completed_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.reminders
  where done_at is not null
    and done_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Keep these callable by the cron owner only (not by app users / anon).
revoke all on function public.cleanup_completed_tasks()     from public, anon, authenticated;
revoke all on function public.cleanup_completed_reminders() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Schedule the daily cleanup (pg_cron). Requires the pg_cron extension (above).
--    cron.schedule is idempotent on job name in recent pg_cron; to be safe we
--    unschedule any existing job of the same name first, ignoring "not found".
--    Runs daily at 03:10 UTC (off-peak; after any digest job that 1D may add).
-- ------------------------------------------------------------
do $$
begin
  perform cron.unschedule('cupdom_cleanup_completed_tasks');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('cupdom_cleanup_completed_reminders');
exception when others then null;
end $$;

select cron.schedule(
  'cupdom_cleanup_completed_tasks',
  '10 3 * * *',
  $$select public.cleanup_completed_tasks();$$
);

select cron.schedule(
  'cupdom_cleanup_completed_reminders',
  '15 3 * * *',
  $$select public.cleanup_completed_reminders();$$
);

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: rowsecurity = true for all three tables.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('tasks','reminders','contact_links');

-- Expected: tasks -> 4 policies; reminders -> 4 policies; contact_links -> 4 policies.
select tablename, policyname, cmd from pg_policies
where tablename in ('tasks','reminders','contact_links') order by tablename, cmd;

-- Expected: the two cron jobs are registered and active.
select jobname, schedule, active from cron.job
where jobname in ('cupdom_cleanup_completed_tasks','cupdom_cleanup_completed_reminders');
