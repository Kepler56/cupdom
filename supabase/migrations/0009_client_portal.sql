-- ============================================================
-- Spec 5: client portal — accounts, client-side RLS, aggregate RPCs
-- Depends on:
--   0001: public.profiles, public.contacts, public.is_cupdom_member()
--   0002: public.deals(contact_id)
--   0006: public.qr_campaigns (deal_id, name, distributed_count)
--   0007: public.leads, public.funnel_events
--   PROD: public.qr_scans
-- ADDITIVE ONLY. Never drops/alters existing tables, policies or functions.
-- Every policy created here is PERMISSIVE and OR's with the existing member
-- policies; no is_cupdom_member() policy is modified.
-- Safe to re-run (idempotent-friendly).
-- ============================================================

-- ------------------------------------------------------------
-- 1. CLIENT_ACCOUNTS — one row per portal login.
--    auth_user_id is UNIQUE (one login = one auth user).
--    contact_id is INDEXED but NOT unique: several people at the same sponsor
--    may each have a login pointing at the same CRM contact (Spec §2).
--    active = false revokes access without destroying history.
-- ------------------------------------------------------------
create table if not exists public.client_accounts (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid not null unique references auth.users(id) on delete cascade,
  contact_id           uuid not null references public.contacts(id)  on delete cascade,
  email                text not null,
  display_name         text,
  active               boolean not null default true,
  must_change_password boolean not null default true,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  last_login_at        timestamptz
);

create index if not exists client_accounts_contact_idx on public.client_accounts(contact_id);
create index if not exists client_accounts_active_idx  on public.client_accounts(auth_user_id) where active;

alter table public.client_accounts enable row level security;

-- SELF-READ. The comparison is auth_user_id = (select auth.uid()) DIRECTLY.
-- It must NEVER call a function that reads client_accounts, or RLS recurses
-- infinitely (Spec §5.5-1). The scalar sub-select also makes Postgres evaluate
-- auth.uid() once per query rather than once per row.
drop policy if exists "client_accounts self read" on public.client_accounts;
create policy "client_accounts self read" on public.client_accounts
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

-- MEMBER READ: the CRM must be able to show which contacts have portal access.
drop policy if exists "client_accounts read members" on public.client_accounts;
create policy "client_accounts read members" on public.client_accounts
  for select to authenticated
  using (public.is_cupdom_member());

-- NO insert/update/delete policies. Writes are service-role only (stage 5's
-- client-provision Edge Function), plus the two SECURITY DEFINER RPCs in section 8.
revoke all on public.client_accounts from anon, authenticated;
grant select on public.client_accounts to authenticated;
