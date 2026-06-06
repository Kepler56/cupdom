-- ============================================================
-- Spec 1E: archive / restore / 30-day purge
-- Depends on:
--   1A (0001): public.contacts(archived_at, purge_after), public.profiles, is_cupdom_member()
--   1B (0002): public.owns_contact(uuid), public.contact_history, public.deals
--   1C (0003): public.tasks, public.reminders, public.contact_links
--   1D (0004): public.notify_purge_warning(uuid,int)  <-- the actual 1D helper
-- Additive only: no DROP/ALTER of crm_data, qr_campaigns, qr_scans.
-- pg_cron schedules at the end are GUARDED (apply even if pg_cron is not enabled).
-- ============================================================

-- ------------------------------------------------------------
-- archive_contact(p_contact): owner-gated soft archive (AC-33).
--   * refuses if caller is not the owner
--   * (Spec 2) refuses if the contact has an ACTIVE campaign — see NOTE below
--   * sets archived_at = now(), purge_after = now() + 30 days
--   * appends an 'archive' history entry (1B contact_history)
-- SECURITY DEFINER so the function (not the caller) performs the write; the explicit
-- owner check below replaces RLS for this path.
-- ------------------------------------------------------------
create or replace function public.archive_contact(p_contact uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid;
  v_company text;
begin
  select owner_id, company
    into v_owner, v_company
    from public.contacts
   where id = p_contact
   for update;

  if v_owner is null then
    raise exception 'contact introuvable' using errcode = 'no_data_found';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'lecture seule : seul le propriétaire peut archiver ce contact'
      using errcode = 'insufficient_privilege';
  end if;

  -- ----------------------------------------------------------------
  -- ACTIVE-CAMPAIGN GUARD (AC-34). SPEC 2 WIRING POINT.
  -- Final intended predicate (Spec 2A migration 0006 will replace this comment
  -- with the real check, since qr_campaigns gains a deal_id link there):
  --
  --   if exists (select 1 from public.qr_campaigns c
  --                join public.deals d on d.id = c.deal_id
  --               where d.contact_id = p_contact and c.active = true) then
  --     raise exception 'Désactivez la campagne active avant de supprimer ce contact'
  --       using errcode = 'check_violation';
  --   end if;
  --
  -- TODAY this is a NO-OP: qr_campaigns has no deal_id link yet, so no contact can
  -- have an "active campaign". Archiving never blocks until Spec 2A wires it.
  -- ----------------------------------------------------------------

  update public.contacts
     set archived_at = now(),
         purge_after = now() + interval '30 days'
   where id = p_contact;

  insert into public.contact_history (contact_id, actor_id, kind, summary)
  values (p_contact, auth.uid(), 'archive',
          coalesce(v_company, 'Ce contact') || ' archivé (suppression dans 30 jours)');
end;
$$;

-- ------------------------------------------------------------
-- restore_contact(p_contact): owner-gated restore (AC-35).
-- ------------------------------------------------------------
create or replace function public.restore_contact(p_contact uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner    uuid;
  v_company  text;
  v_archived timestamptz;
begin
  select owner_id, company, archived_at
    into v_owner, v_company, v_archived
    from public.contacts
   where id = p_contact
   for update;

  if v_owner is null then
    raise exception 'contact introuvable' using errcode = 'no_data_found';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'lecture seule : seul le propriétaire peut restaurer ce contact'
      using errcode = 'insufficient_privilege';
  end if;

  if v_archived is null then
    raise exception 'ce contact n''est pas archivé'
      using errcode = 'check_violation';
  end if;

  update public.contacts
     set archived_at = null,
         purge_after = null
   where id = p_contact;

  insert into public.contact_history (contact_id, actor_id, kind, summary)
  values (p_contact, auth.uid(), 'restore',
          coalesce(v_company, 'Ce contact') || ' restauré');
end;
$$;

-- RPC exposure: members only. anon never calls these.
revoke all on function public.archive_contact(uuid) from public, anon;
revoke all on function public.restore_contact(uuid) from public, anon;
grant execute on function public.archive_contact(uuid) to authenticated;
grant execute on function public.restore_contact(uuid) to authenticated;

-- ------------------------------------------------------------
-- run_purge_warnings(): daily. For contacts whose purge_after is within the next
-- 3 days (and still future), raise a 'purge_warning' notification to the OWNER via
-- the 1D helper public.notify_purge_warning(contact, days_left) — which looks up the
-- owner, builds the payload, and UPSERTs (the 1D open-unique index dedupes, so a
-- repeated run just refreshes the same open warning with the new day count). AC-36.
-- ------------------------------------------------------------
create or replace function public.run_purge_warnings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r           record;
  v_days_left int;
begin
  for r in
    select c.id, c.purge_after
      from public.contacts c
     where c.archived_at is not null
       and c.purge_after is not null
       and c.purge_after > now()
       and c.purge_after <= now() + interval '3 days'
  loop
    v_days_left := greatest(0, ceil(extract(epoch from (r.purge_after - now())) / 86400)::int);
    perform public.notify_purge_warning(r.id, v_days_left);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- run_contact_purge(): daily. Permanently delete contacts past purge_after.
-- Sub-records (deals, tasks, reminders, contact_links, contact_history) are removed
-- via ON DELETE CASCADE FKs (1B/1C). We delete the contact row; cascade does the rest.
--
-- SPEC 3 WIRING POINT (lead PII): Spec 3B (migration 0008) will redefine this function
-- to also delete personal lead data (leads via campaign->deal->contact) BEFORE the
-- contact delete. TODAY there is no leads table — NO-OP, flagged.
--
-- SPEC 2 WIRING POINT (anonymous scans): qr_scans must be RETAINED on purge. Spec 2A
-- links campaigns to deals with ON DELETE SET NULL so purge severs the link but keeps
-- the anonymous scan rows. TODAY there is no contact<->scan link, so scans already
-- survive. Flagged.
-- ------------------------------------------------------------
create or replace function public.run_contact_purge()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.contacts
   where archived_at is not null
     and purge_after is not null
     and purge_after <= now();
end;
$$;

-- These run only from cron (server-side). Lock them down from API roles.
revoke all on function public.run_purge_warnings() from public, anon, authenticated;
revoke all on function public.run_contact_purge()  from public, anon, authenticated;

-- ------------------------------------------------------------
-- Schedules (pg_cron, UTC). GUARDED: applies even if pg_cron is not yet enabled.
--   * 08:00 UTC — pre-purge warnings (before the purge so the owner is warned first)
--   * 03:00 UTC — purge run
-- ------------------------------------------------------------
do $cron$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron not enabled — skipping archive/purge schedules. Enable pg_cron and re-run.';
    return;
  end if;

  begin perform cron.unschedule('purge_warnings_daily'); exception when others then null; end;
  begin perform cron.unschedule('contact_purge_daily');  exception when others then null; end;

  perform cron.schedule('purge_warnings_daily', '0 8 * * *',
    $job$ select public.run_purge_warnings(); $job$);
  perform cron.schedule('contact_purge_daily', '0 3 * * *',
    $job$ select public.run_contact_purge(); $job$);
end
$cron$;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Expected: the four functions exist.
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('archive_contact','restore_contact','run_purge_warnings','run_contact_purge')
order by proname;
-- After pg_cron is enabled, verify the jobs (run separately; errors if cron schema absent):
--   select jobname, schedule, active from cron.job
--   where jobname in ('purge_warnings_daily','contact_purge_daily');
