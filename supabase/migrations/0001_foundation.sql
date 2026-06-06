-- ============================================================
-- Spec 1A foundation: profiles + contacts + RLS
-- Depends on public.is_cupdom_member() (jwt email allowlist) from supabase_sql.md.
-- ADDITIVE ONLY. Never drops/alters crm_data, qr_campaigns, qr_scans.
-- Safe to re-run (idempotent-friendly).
-- ============================================================

-- shared trigger (may already exist)
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

-- ----- PROFILES: one row per CRM member (the 3 accounts) -----
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  display_name text not null,
  color        text not null default '#18181b'
);
alter table public.profiles enable row level security;
drop policy if exists "profiles read members" on public.profiles;
create policy "profiles read members" on public.profiles
  for select to authenticated using (public.is_cupdom_member());
-- profiles are seeded/managed by SQL only (no user writes)
revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;

-- Seed the 3 members from auth.users (run after the users exist).
insert into public.profiles (id, email, display_name, color)
select u.id, lower(u.email),
       initcap(split_part(u.email,'@',1)),
       case lower(u.email)
         when 'eliah@cupdom.fr'   then '#18181b'
         when 'maxime@cupdom.fr'  then '#175cd3'
         when 'contact@cupdom.fr' then '#067647'
         else '#18181b' end
from auth.users u
where lower(u.email) in ('eliah@cupdom.fr','maxime@cupdom.fr','contact@cupdom.fr')
on conflict (id) do update
  set email = excluded.email, display_name = excluded.display_name, color = excluded.color;

-- ----- CONTACTS: the hub -----
create table if not exists public.contacts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id),
  first_name   text,
  last_name    text,
  role         text,
  email        text,
  phone        text,
  company      text,
  sector       text check (sector in (
    'Boissons & Spiritueux','Restauration & Alimentaire','Mode & Accessoires',
    'Beauté & Cosmétiques','Technologie & Logiciels','Télécoms','Médias & Divertissement',
    'Événementiel & Nightlife','Sport & Fitness','Santé & Bien-être','Finance & Assurance',
    'Automobile & Mobilité','Commerce & Distribution','Tourisme & Hôtellerie',
    'Éducation & Formation','Secteur public & Associations','Autre')),
  company_size text check (company_size in (
    'Indépendant (0–1)','2–9','10–49','50–249','250–999','1 000–4 999','5 000–9 999','10 000+')),
  archived_at  timestamptz,                 -- null = active
  purge_after  timestamptz,                 -- set to archived_at + 30d when archived (plan 1E)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists contacts_owner_idx    on public.contacts(owner_id);
create index if not exists contacts_archived_idx on public.contacts(archived_at);
create index if not exists contacts_updated_idx  on public.contacts(updated_at desc);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;

-- READ: any member sees ALL contacts (the "view everyone" rule)
drop policy if exists "contacts read members" on public.contacts;
create policy "contacts read members" on public.contacts
  for select to authenticated using (public.is_cupdom_member());

-- INSERT: a member, creating a row owned by themselves
drop policy if exists "contacts insert own" on public.contacts;
create policy "contacts insert own" on public.contacts
  for insert to authenticated
  with check (public.is_cupdom_member() and owner_id = auth.uid());

-- UPDATE: only the owner; cannot reassign owner via direct update
-- (transfer is a SECURITY DEFINER RPC, added in plan 1B)
drop policy if exists "contacts update own" on public.contacts;
create policy "contacts update own" on public.contacts
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- DELETE: only the owner (UI uses archive; hard delete restricted further in 1E)
drop policy if exists "contacts delete own" on public.contacts;
create policy "contacts delete own" on public.contacts
  for delete to authenticated using (owner_id = auth.uid());

revoke all on public.contacts from anon;
grant select, insert, update, delete on public.contacts to authenticated;

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: rowsecurity = true for profiles and contacts
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('profiles','contacts');

-- Expected: contacts -> 4 policies (read/insert/update/delete); profiles -> 1 (read)
select tablename, policyname, cmd from pg_policies
where tablename in ('profiles','contacts') order by tablename, cmd;
