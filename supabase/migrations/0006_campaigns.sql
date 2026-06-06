-- ============================================================
-- Spec 2A: campaign model + event log + legacy-safe owner-gated RLS
-- Depends on:
--   1A (0001): public.profiles, public.contacts, public.is_cupdom_member(), public.set_updated_at()
--   1B (0002): public.owns_contact(uuid), public.deals
--   1E (0005): public.archive_contact(uuid)  (re-created here to switch its guard on)
--   PROD:      public.qr_campaigns, public.qr_scans  (created by supabase_qr_sql.md)
-- ADDITIVE ONLY. Never drops/alters crm_data. qr_campaigns/qr_scans changes are additive + legacy-safe.
-- Safe to re-run (idempotent-friendly).
-- ============================================================

-- ------------------------------------------------------------
-- 1. EXTEND qr_campaigns (additive, all nullable — old index.html keeps working).
--    * deal_id      -> link to a deal (ON DELETE SET NULL so a contact purge DETACHES the
--                      campaign and RETAINS its anonymous scans — 1E AC-37 requirement).
--    * name         -> friendly CRM name.
--    * distributed_count -> owner-entered "Distribués" funnel input (Spec 3 reads it).
--    sponsor_name stays NOT NULL (do not weaken it); the create flow writes the linked
--    contact's company into it on insert.
-- ------------------------------------------------------------
alter table public.qr_campaigns
  add column if not exists deal_id uuid references public.deals(id) on delete set null;
alter table public.qr_campaigns
  add column if not exists name text;
alter table public.qr_campaigns
  add column if not exists distributed_count int;

create index if not exists qr_campaigns_deal_idx on public.qr_campaigns(deal_id);

-- ------------------------------------------------------------
-- 2. EXTEND qr_scans (additive, nullable): the state of the campaign at scan time.
--    The redirector (Spec 2B) sets this at scan time; 2A only adds the column and uses
--    it in the Active/Terminée headline split. Legacy rows / pre-2B scans stay NULL.
-- ------------------------------------------------------------
alter table public.qr_scans
  add column if not exists campaign_state_at_scan text
    check (campaign_state_at_scan in ('Active','Terminée'));

-- ------------------------------------------------------------
-- 3. campaign_events: append-only lifecycle log (one row per create/deactivate/
--    reactivate/destination_change). Read = all members; INSERT is written by the
--    SECURITY DEFINER trigger below (the trigger proves ownership via the campaign
--    write that fired it), with an owner-gated direct-insert policy as defence-in-depth.
-- ------------------------------------------------------------
create table if not exists public.campaign_events (
  id            uuid primary key default gen_random_uuid(),
  campaign_slug text not null references public.qr_campaigns(slug) on delete cascade,
  actor_id      uuid references public.profiles(id),
  kind          text not null check (kind in
                  ('create','deactivate','reactivate','destination_change')),
  detail        text,
  created_at    timestamptz not null default now()
);
create index if not exists campaign_events_slug_idx
  on public.campaign_events(campaign_slug, created_at desc);

alter table public.campaign_events enable row level security;

-- READ: any member sees all campaign events (view-everyone rule).
drop policy if exists "campaign_events read members" on public.campaign_events;
create policy "campaign_events read members" on public.campaign_events
  for select to authenticated using (public.is_cupdom_member());

-- INSERT (defence-in-depth): only the linked contact's owner, OR a legacy/unlinked
-- campaign (deal_id is null). The trigger is SECURITY DEFINER so it is not re-gated,
-- but this policy keeps any direct client insert honest.
drop policy if exists "campaign_events insert owner" on public.campaign_events;
create policy "campaign_events insert owner" on public.campaign_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.qr_campaigns c
      where c.slug = campaign_events.campaign_slug
        and (
          c.deal_id is null
          or public.owns_contact(
               (select d.contact_id from public.deals d where d.id = c.deal_id))
        )
    )
  );

-- Append-only: no UPDATE/DELETE policies -> the log cannot be edited or erased.
-- (ON DELETE CASCADE from qr_campaigns purges events if a campaign is hard-deleted.)

revoke all on public.campaign_events from anon;
grant select, insert on public.campaign_events to authenticated;

-- ------------------------------------------------------------
-- 4. log_campaign_event(): SECURITY DEFINER trigger that appends a campaign_events
--    row on create / deactivate / reactivate / destination_change. Mirrors 1B's
--    log_deal_stage pattern (the campaign write already proved ownership). Actor = auth.uid().
-- ------------------------------------------------------------
create or replace function public.log_campaign_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.campaign_events (campaign_slug, actor_id, kind, detail)
    values (new.slug, auth.uid(), 'create',
            coalesce(new.name, new.sponsor_name) || ' créée');
  elsif (tg_op = 'UPDATE') then
    -- state change (active boolean flipped)
    if (new.active is distinct from old.active) then
      insert into public.campaign_events (campaign_slug, actor_id, kind, detail)
      values (new.slug, auth.uid(),
              case when new.active then 'reactivate' else 'deactivate' end,
              case when new.active then 'Réactivée' else 'Terminée' end);
    end if;
    -- destination change
    if (new.destination_url is distinct from old.destination_url) then
      insert into public.campaign_events (campaign_slug, actor_id, kind, detail)
      values (new.slug, auth.uid(), 'destination_change',
              coalesce(old.destination_url,'?') || ' → ' || coalesce(new.destination_url,'?'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists qr_campaigns_log_event on public.qr_campaigns;
create trigger qr_campaigns_log_event
  after insert or update on public.qr_campaigns
  for each row execute function public.log_campaign_event();

-- ------------------------------------------------------------
-- 5. DELETE guard: a campaign may be hard-deleted ONLY when it has zero qr_scans
--    rows (Spec 2 §6 / AC-14/15). Enforced by a BEFORE DELETE trigger so it holds
--    for any client (and for the delete RPC below). Toggling (Active/Terminée) is
--    always allowed; only DELETE is gated.
-- ------------------------------------------------------------
create or replace function public.guard_campaign_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.qr_scans s where s.campaign_slug = old.slug) then
    raise exception 'Suppression impossible : cette campagne a déjà des scans (désactivez-la)'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists qr_campaigns_guard_delete on public.qr_campaigns;
create trigger qr_campaigns_guard_delete
  before delete on public.qr_campaigns
  for each row execute function public.guard_campaign_delete();

-- ------------------------------------------------------------
-- 6. RLS on qr_campaigns: REPLACE the legacy "members all" write policy with a
--    legacy-safe OWNER-GATED set. READ stays all-members. A campaign is WRITABLE when:
--      * deal_id is null  (legacy/unlinked rows the old index.html manages — keep all-member
--        writable so the live CRM never breaks), OR
--      * the caller owns the linked contact (owns_contact via deal_id → contact_id).
--    This is an intentional escape hatch for the cutover; it can tighten once all rows are linked.
--    qr_scans member-read is left UNCHANGED (still defined in supabase_qr_sql.md).
-- ------------------------------------------------------------
alter table public.qr_campaigns enable row level security;

-- READ: any member sees all campaigns (unchanged intent).
drop policy if exists "qr_campaigns members all"  on public.qr_campaigns;   -- legacy ALL policy
drop policy if exists "qr_campaigns read members"  on public.qr_campaigns;
create policy "qr_campaigns read members" on public.qr_campaigns
  for select to authenticated using (public.is_cupdom_member());

-- INSERT: a member creating a row that is either legacy/unlinked or on a contact they own.
drop policy if exists "qr_campaigns insert owner" on public.qr_campaigns;
create policy "qr_campaigns insert owner" on public.qr_campaigns
  for insert to authenticated
  with check (
    public.is_cupdom_member()
    and (
      deal_id is null
      or public.owns_contact(
           (select d.contact_id from public.deals d where d.id = deal_id))
    )
  );

-- UPDATE: same legacy-safe owner gate on both USING and WITH CHECK (slug is never updated
-- by the app; immutability is enforced in the client, and re-pointing deal_id to a deal you
-- don't own is blocked by WITH CHECK).
drop policy if exists "qr_campaigns update owner" on public.qr_campaigns;
create policy "qr_campaigns update owner" on public.qr_campaigns
  for update to authenticated
  using (
    deal_id is null
    or public.owns_contact(
         (select d.contact_id from public.deals d where d.id = deal_id))
  )
  with check (
    deal_id is null
    or public.owns_contact(
         (select d.contact_id from public.deals d where d.id = deal_id))
  );

-- DELETE: same legacy-safe owner gate (the zero-scans trigger above is the second gate).
drop policy if exists "qr_campaigns delete owner" on public.qr_campaigns;
create policy "qr_campaigns delete owner" on public.qr_campaigns
  for delete to authenticated
  using (
    deal_id is null
    or public.owns_contact(
         (select d.contact_id from public.deals d where d.id = deal_id))
  );

-- Grants unchanged from supabase_qr_sql.md (anon has none; authenticated manages campaigns).
revoke all on public.qr_campaigns from anon;
grant select, insert, update, delete on public.qr_campaigns to authenticated;

-- ------------------------------------------------------------
-- 7. ACTIVATE the 1E archive guard (supersedes the 1E no-op stub).
--    Body is IDENTICAL to 1E's archive_contact EXCEPT the no-op active-campaign comment
--    is replaced by the real guard: refuse to archive a contact that has an ACTIVE campaign.
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
  -- Lock the row and read ownership.
  select owner_id, company
    into v_owner, v_company
    from public.contacts
   where id = p_contact
   for update;

  if v_owner is null then
    raise exception 'contact introuvable' using errcode = 'no_data_found';
  end if;

  -- Owner gate (this is the security boundary; SECURITY DEFINER bypasses RLS).
  if v_owner <> auth.uid() then
    raise exception 'lecture seule : seul le propriétaire peut archiver ce contact'
      using errcode = 'insufficient_privilege';
  end if;

  -- ACTIVE-CAMPAIGN GUARD (Spec 1E AC-34, ACTIVATED by Spec 2A). The contact cannot be
  -- archived while any of its campaigns is Active (active = true). Désactivez-la d'abord.
  if exists (
    select 1
      from public.qr_campaigns c
      join public.deals d on d.id = c.deal_id
     where d.contact_id = p_contact
       and c.active = true
  ) then
    raise exception 'Désactivez la campagne active avant de supprimer ce contact'
      using errcode = 'check_violation';
  end if;

  update public.contacts
     set archived_at = now(),
         purge_after = now() + interval '30 days'
   where id = p_contact;

  -- 1B append-only history.
  insert into public.contact_history (contact_id, actor_id, kind, summary)
  values (p_contact, auth.uid(), 'archive',
          coalesce(v_company, 'Ce contact') || ' archivé (suppression dans 30 jours)');
end;
$$;

revoke all on function public.archive_contact(uuid) from public, anon;
grant execute on function public.archive_contact(uuid) to authenticated;

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: the three new columns exist on qr_campaigns, one on qr_scans.
select column_name from information_schema.columns
where table_schema='public' and table_name='qr_campaigns'
  and column_name in ('deal_id','name','distributed_count');
select column_name from information_schema.columns
where table_schema='public' and table_name='qr_scans'
  and column_name = 'campaign_state_at_scan';

-- Expected: rowsecurity = true for campaign_events and qr_campaigns.
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('campaign_events','qr_campaigns');

-- Expected: qr_campaigns -> 4 policies (read/insert/update/delete);
--           campaign_events -> 2 (read/insert). No "members all" policy remains.
select tablename, policyname, cmd from pg_policies
where tablename in ('qr_campaigns','campaign_events') order by tablename, cmd;
