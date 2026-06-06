-- ============================================================
-- Spec 1B: owns_contact + contact_history + deals + transfer + derived statut
-- Depends on 0001_foundation.sql (public.profiles, public.contacts,
--   public.is_cupdom_member(), public.set_updated_at()).
-- ADDITIVE ONLY. Never drops/alters crm_data, qr_campaigns, qr_scans, contacts, profiles.
-- Safe to re-run (idempotent-friendly).
-- ============================================================

-- ------------------------------------------------------------
-- 1. owns_contact(): effective-owner check for contact-level sub-records.
--    A member "owns" a contact when contacts.owner_id = auth.uid().
--    SECURITY INVOKER + stable; referenced by every sub-record write policy
--    (here, and in plans 1C/1E for tasks/reminders/links/campaigns).
-- ------------------------------------------------------------
create or replace function public.owns_contact(p_contact uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.contacts c
    where c.id = p_contact and c.owner_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 2. contact_history: append-only activity timeline (owned via owns_contact).
--    Plan 1C builds the Historique tab UI on this table and also writes
--    'task'/'reminder'/'link' events here. This plan writes 'deal_stage',
--    'transfer', and 'contact_edit'.
-- ------------------------------------------------------------
create table if not exists public.contact_history (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  actor_id    uuid references public.profiles(id),
  kind        text not null check (kind in
                ('deal_stage','transfer','contact_edit','task','reminder','link')),
  summary     text,
  created_at  timestamptz not null default now()
);
create index if not exists contact_history_contact_idx
  on public.contact_history(contact_id, created_at desc);

alter table public.contact_history enable row level security;

-- READ: any member sees all history (view-everyone rule).
drop policy if exists "history read members" on public.contact_history;
create policy "history read members" on public.contact_history
  for select to authenticated using (public.is_cupdom_member());

-- INSERT: only the parent contact's owner (the transfer RPC is SECURITY DEFINER
-- and bypasses RLS, so it can log the new-owner row even mid-transfer).
drop policy if exists "history insert owner" on public.contact_history;
create policy "history insert owner" on public.contact_history
  for insert to authenticated
  with check (public.owns_contact(contact_id));

-- Append-only: no UPDATE/DELETE policies -> members cannot edit/erase the timeline.
-- (ON DELETE CASCADE from contacts still purges history when a contact is hard-deleted in 1E.)

revoke all on public.contact_history from anon;
grant select, insert on public.contact_history to authenticated;

-- ------------------------------------------------------------
-- 3. deals: sponsorship rounds under a contact (Spec §3.3 / AC-15/16).
--    Effective owner = parent contact's owner (owns_contact).
-- ------------------------------------------------------------
create table if not exists public.deals (
  id             uuid primary key default gen_random_uuid(),
  contact_id     uuid not null references public.contacts(id) on delete cascade,
  title          text,
  stage          text not null default 'QUALIFICATION' check (stage in
                   ('QUALIFICATION','PROPOSITION','NÉGOCIATION','GAGNÉ','PERDU')),
  value_eur      numeric,
  expected_close date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists deals_contact_idx on public.deals(contact_id);
create index if not exists deals_stage_idx    on public.deals(stage);

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at before update on public.deals
  for each row execute function public.set_updated_at();

alter table public.deals enable row level security;

-- READ: any member sees all deals (view-everyone rule).
drop policy if exists "deals read members" on public.deals;
create policy "deals read members" on public.deals
  for select to authenticated using (public.is_cupdom_member());

-- INSERT: only on a contact the caller owns.
drop policy if exists "deals insert owner" on public.deals;
create policy "deals insert owner" on public.deals
  for insert to authenticated
  with check (public.owns_contact(contact_id));

-- UPDATE: only on a contact the caller owns; cannot re-point to a contact
-- they do not own (both USING and WITH CHECK gate on owns_contact).
drop policy if exists "deals update owner" on public.deals;
create policy "deals update owner" on public.deals
  for update to authenticated
  using (public.owns_contact(contact_id))
  with check (public.owns_contact(contact_id));

-- DELETE: only on a contact the caller owns.
drop policy if exists "deals delete owner" on public.deals;
create policy "deals delete owner" on public.deals
  for delete to authenticated using (public.owns_contact(contact_id));

revoke all on public.deals from anon;
grant select, insert, update, delete on public.deals to authenticated;

-- ------------------------------------------------------------
-- 4. log_deal_stage(): trigger that appends a 'deal_stage' history row
--    whenever a deal is created or its stage changes (Spec §3.3 / AC-17).
--    SECURITY DEFINER so the insert into contact_history is not re-gated by RLS
--    (the deal write itself already proved ownership). Actor = auth.uid().
-- ------------------------------------------------------------
create or replace function public.log_deal_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.contact_history (contact_id, actor_id, kind, summary)
    values (new.contact_id, auth.uid(), 'deal_stage',
            coalesce(new.title,'Deal') || ' créé — ' || new.stage);
  elsif (tg_op = 'UPDATE' and new.stage is distinct from old.stage) then
    insert into public.contact_history (contact_id, actor_id, kind, summary)
    values (new.contact_id, auth.uid(), 'deal_stage',
            coalesce(new.title,'Deal') || ' : ' || old.stage || ' → ' || new.stage);
  end if;
  return new;
end;
$$;

drop trigger if exists deals_log_stage on public.deals;
create trigger deals_log_stage
  after insert or update on public.deals
  for each row execute function public.log_deal_stage();

-- ------------------------------------------------------------
-- 5. transfer_contact(): re-assign ownership atomically (Spec §5.9 / AC-31/32).
--    Caller must currently own the contact; new owner must be a member (profiles).
--    Re-points contacts.owner_id (which transitively moves every sub-record's
--    effective ownership) and appends a 'transfer' history row. SECURITY DEFINER
--    so the post-transfer history insert (now owned by the NEW owner) succeeds.
-- ------------------------------------------------------------
create or replace function public.transfer_contact(p_contact uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_owner uuid;
  v_old_name  text;
  v_new_name  text;
begin
  if not public.is_cupdom_member() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  -- Caller must currently own the contact.
  select owner_id into v_old_owner from public.contacts where id = p_contact;
  if v_old_owner is null then
    raise exception 'Contact introuvable' using errcode = 'P0002';
  end if;
  if v_old_owner <> auth.uid() then
    raise exception 'Transfert refusé : vous n''êtes pas le propriétaire' using errcode = '42501';
  end if;

  -- New owner must be a member.
  if not exists (select 1 from public.profiles where id = p_new_owner) then
    raise exception 'Destinataire invalide' using errcode = '23503';
  end if;

  if p_new_owner = v_old_owner then
    return; -- no-op transfer to self
  end if;

  update public.contacts set owner_id = p_new_owner where id = p_contact;

  select display_name into v_old_name from public.profiles where id = v_old_owner;
  select display_name into v_new_name from public.profiles where id = p_new_owner;

  insert into public.contact_history (contact_id, actor_id, kind, summary)
  values (p_contact, auth.uid(), 'transfer',
          'Transfert de ' || coalesce(v_old_name,'?') || ' à ' || coalesce(v_new_name,'?'));
end;
$$;

revoke all on function public.transfer_contact(uuid, uuid) from public, anon;
grant execute on function public.transfer_contact(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. contacts_with_status: contact rows + derived statut (Spec §3.4).
--    Evaluated top-down, first match wins:
--      any GAGNÉ                                      -> 'Client'
--      else any QUALIFICATION/PROPOSITION/NÉGOCIATION -> 'En cours'
--      else has deals (all PERDU)                     -> 'Perdu'
--      else (no deals)                                -> 'Prospect'
--    The view inherits the base table's RLS (security_invoker), so it returns
--    exactly the rows the caller may read. Used by the contacts list + hub badge.
-- ------------------------------------------------------------
create or replace view public.contacts_with_status
with (security_invoker = true) as
select
  c.*,
  case
    when exists (select 1 from public.deals d
                 where d.contact_id = c.id and d.stage = 'GAGNÉ') then 'Client'
    when exists (select 1 from public.deals d
                 where d.contact_id = c.id
                   and d.stage in ('QUALIFICATION','PROPOSITION','NÉGOCIATION')) then 'En cours'
    when exists (select 1 from public.deals d
                 where d.contact_id = c.id) then 'Perdu'
    else 'Prospect'
  end as statut
from public.contacts c;

grant select on public.contacts_with_status to authenticated;

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: rowsecurity = true for deals and contact_history
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('deals','contact_history');

-- Expected: deals -> 4 policies (read/insert/update/delete); contact_history -> 2 (read/insert)
select tablename, policyname, cmd from pg_policies
where tablename in ('deals','contact_history') order by tablename, cmd;
