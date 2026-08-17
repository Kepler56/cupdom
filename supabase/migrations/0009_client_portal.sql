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

-- ------------------------------------------------------------
-- 2. HELPER FUNCTIONS. All SECURITY DEFINER so they bypass RLS — this is what
--    keeps the client_accounts self-read policy free of recursion (Spec §5.5-1).
--    All STABLE so Postgres may cache them within a statement.
-- ------------------------------------------------------------

-- The contact behind the calling client, or NULL when the caller is not an
-- active portal client (a CRM member, anon, or a deactivated account).
create or replace function public.current_client_contact()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ca.contact_id
  from public.client_accounts ca
  where ca.auth_user_id = auth.uid()
    and ca.active
  limit 1;
$$;

create or replace function public.is_client()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_client_contact() is not null;
$$;

-- THE single definition of "campaigns this client owns". Every policy and every
-- RPC below funnels through it. A campaign with deal_id IS NULL joins to nothing
-- and is therefore invisible to every client (Spec §2) — that is the safe default.
create or replace function public.client_slugs()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select c.slug
  from public.qr_campaigns c
  join public.deals d on d.id = c.deal_id
  where d.contact_id = (select public.current_client_contact());
$$;

create or replace function public.client_owns_campaign(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.client_slugs() s where s = p_slug);
$$;

-- The guard every RPC opens with. Two refusals, one message: the caller is not a
-- client at all, or they named a campaign that is not theirs.
create or replace function public.client_guard(p_slug text default null)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select public.current_client_contact()) is null then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
  if p_slug is not null and not public.client_owns_campaign(p_slug) then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke execute on function public.current_client_contact()          from public, anon;
revoke execute on function public.is_client()                       from public, anon;
revoke execute on function public.client_slugs()                    from public, anon;
revoke execute on function public.client_owns_campaign(text)        from public, anon;
revoke execute on function public.client_guard(text)                from public, anon;
grant  execute on function public.current_client_contact()          to authenticated;
grant  execute on function public.is_client()                       to authenticated;
grant  execute on function public.client_slugs()                    to authenticated;
grant  execute on function public.client_owns_campaign(text)        to authenticated;
grant  execute on function public.client_guard(text)                to authenticated;

-- ------------------------------------------------------------
-- 3. NEW qr_campaigns COLUMNS (additive, nullable).
--    invested_amount_eur — the owner-confirmed amount the sponsor invested in
--      THIS campaign, deliberately distinct from deals.value_eur. It exists so
--      the portal's "coût par contact" KPI can never leak a deal value
--      automatically (Spec §4.7). The CRM input for it ships in stage 5.
--    venue — optional lieu/événement label, unlocking the portal's venue ranking
--      (Spec §4.8). Granularity is per-campaign: one campaign spread across five
--      clubs cannot be split by venue.
-- ------------------------------------------------------------
alter table public.qr_campaigns add column if not exists invested_amount_eur numeric(12,2);
alter table public.qr_campaigns add column if not exists venue               text;

-- ------------------------------------------------------------
-- 4. CLIENT READ POLICIES — additive and PERMISSIVE. They OR with the existing
--    member policies from 0006/0007, which are left untouched.
--    Both route through public.client_slugs() rather than inlining a subquery
--    over public.deals: deals has no client-read policy (by design — clients
--    must never read it directly), so a policy body that queries deals as the
--    calling client would see zero rows and every campaign/lead would be
--    invisible. client_slugs() is SECURITY DEFINER, so it resolves ownership
--    as the function owner, bypassing RLS on deals/qr_campaigns entirely —
--    no recursion, since a policy ON qr_campaigns calling a SECURITY DEFINER
--    function that reads qr_campaigns does not re-trigger that same policy.
--    The `in (select …)` form still evaluates the set ONCE per query rather
--    than once per row (Spec §5.5-3). For a member (or anon)
--    current_client_contact() is NULL inside client_slugs(), the set is
--    empty, and the policy contributes nothing — no leak.
-- ------------------------------------------------------------
drop policy if exists "qr_campaigns read client" on public.qr_campaigns;
create policy "qr_campaigns read client" on public.qr_campaigns
  for select to authenticated
  using (slug in (select public.client_slugs()));

drop policy if exists "leads read client" on public.leads;
create policy "leads read client" on public.leads
  for select to authenticated
  using (campaign_slug in (select public.client_slugs()));

-- NOTE: NO client policy is created on qr_scans or funnel_events. Raw scan rows
-- never leave Postgres; visitor_hash is never exposed. Section 5's RPCs are the
-- only client path to that data (Spec §5.3).
