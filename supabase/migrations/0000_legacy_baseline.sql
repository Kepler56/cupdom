-- ============================================================
-- 0000: legacy baseline — the objects that predate this migration set
--
-- RECONSTRUCTED, NOT ORIGINAL. Recovered 2026-08-23 by introspecting the live
-- project (pg_proc, information_schema.columns, pg_indexes, pg_policies).
--
-- WHY THIS FILE EXISTS
-- crm_data, qr_campaigns, qr_scans and is_cupdom_member() were created by
-- supabase_sql.md and supabase_qr_sql.md, both of which were deleted from the
-- repository. Migrations 0001-0014 assume they already exist: 0002 calls
-- is_cupdom_member(), 0006 ALTERs both qr_ tables. Applying 0001-0014 to an
-- empty project therefore FAILED before this file existed.
--
-- Numbered 0000 so it sorts first. ADDITIVE ONLY, idempotent, safe to re-run.
-- Against the existing production database every statement is a no-op; it
-- matters for a rebuild, and as the readable record of what the root security
-- predicate actually says.
--
-- Depends on: nothing (this is the base).
-- Later migrations add: 0006 -> qr_campaigns.deal_id/name/distributed_count,
--                               qr_scans.campaign_state_at_scan
--                       0009 -> qr_campaigns.invested_amount_eur/venue
--                       0010 -> the crm_data lockdown
-- ============================================================

-- ------------------------------------------------------------
-- 1. is_cupdom_member() — THE root security predicate.
--
-- Referenced by roughly half of the 39 RLS policies in this database. Recovered
-- verbatim from pg_proc.
--
-- SECURITY INVOKER and STABLE: it reads only the JWT, never a table, which is
-- why it cannot recurse and needs no search_path pin (unlike every SECURITY
-- DEFINER function here).
--
-- coalesce(..., false): an anonymous caller has no email claim, so the IN
-- yields NULL. RLS treats NULL as false anyway; the explicit false removes the
-- ambiguity for anyone reading the policy.
--
-- THIS LIST AND lib/auth.ts#ALLOWED_EMAILS ARE ONE RULE STATED TWICE.
-- They matched as of 2026-08-23. Change both together: changing only this one
-- produces a member who passes the client check and reads nothing; changing
-- only the other produces the reverse.
-- ------------------------------------------------------------
create or replace function public.is_cupdom_member()
returns boolean
language sql
stable
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in (
      'eliah@cupdom.fr',
      'contact@cupdom.fr',
      'maxime@cupdom.fr'
    ),
    false
  );
$$;

-- ------------------------------------------------------------
-- 2. qr_campaigns — one row per printed campaign.
--
-- The slug is the PK and is physically printed on the product, so it is
-- immutable by definition: a print run cannot be recalled to change it.
-- ------------------------------------------------------------
create table if not exists public.qr_campaigns (
  slug             text        not null,
  sponsor_name     text        not null,
  product          text,
  destination_url  text        not null,
  active           boolean     not null default true,
  created_at       timestamptz not null default now(),
  constraint qr_campaigns_pkey primary key (slug)
);

alter table public.qr_campaigns enable row level security;

-- RLS policies for qr_campaigns are owned by 0006 (owner-gated set) and
-- tightened by 0011 (is_cupdom_member guard on UPDATE/DELETE). Deliberately not
-- duplicated here — one definition, in the migration that reasons about it.

-- GRANTS. Production was found (2026-08-23) holding the FULL privilege set for
-- `authenticated` here — SELECT/INSERT/UPDATE/DELETE plus REFERENCES, TRIGGER
-- and TRUNCATE, inherited from supabase_qr_sql.md's `grant all`. That is NOT
-- reproduced: a rebuild should not recreate a mistake that 0016 then has to
-- undo. These are the privileges the application actually uses; 0016 revokes
-- the extras on the existing database.
revoke all on public.qr_campaigns from anon, authenticated;
grant select, insert, update, delete on public.qr_campaigns to authenticated;

-- ------------------------------------------------------------
-- 3. qr_scans — one row per scan. Written ONLY by the Netlify edge function
--    netlify/edge-functions/scan.js, using the service-role key.
--
-- PRIVACY: no raw IP and no cookie is ever stored. visitor_hash is
-- sha256(ip|ua|slug|secret|Europe/Paris-date): a same-day, same-campaign dedupe
-- key carrying no cross-day and no cross-campaign identity. That is what lets
-- scan analytics run without a consent banner. Do not add anything to this
-- table that could re-identify a person.
-- ------------------------------------------------------------
create table if not exists public.qr_scans (
  id            uuid        not null default gen_random_uuid(),
  campaign_slug text        not null,
  scanned_at    timestamptz not null default now(),
  country       text,
  region        text,
  city          text,
  device_type   text,
  os            text,
  browser       text,
  language      text,
  visitor_hash  text,
  is_bot        boolean     not null default false,
  constraint qr_scans_pkey primary key (id),
  constraint qr_scans_campaign_slug_fkey
    foreign key (campaign_slug) references public.qr_campaigns (slug)
    on delete cascade
);

create index if not exists qr_scans_campaign_idx on public.qr_scans (campaign_slug);
create index if not exists qr_scans_scanned_idx  on public.qr_scans (scanned_at desc);

-- NOTE THE NAME: this index is NOT unique, despite reading as though it were.
-- It is a plain btree, and it could not enforce per-day dedupe even if it were
-- unique, because scanned_at is a timestamp — every row is already distinct on
-- it. De-duplication is a REPORTING-time concern
-- (count(distinct visitor_hash)), never a write-time constraint. The index is a
-- reasonable covering index for exactly those aggregates. The name is
-- reproduced as-is so this file matches production; renaming it would need an
-- ALTER INDEX in a later migration.
create index if not exists qr_scans_unique_idx
  on public.qr_scans (campaign_slug, visitor_hash, scanned_at);

alter table public.qr_scans enable row level security;

-- Members read every scan. Clients get NO policy here, ever: raw scan rows must
-- never leave Postgres, and visitor_hash is never exposed to a sponsor. The
-- client path is the SECURITY DEFINER aggregate RPCs in 0009/0011/0012, and
-- 0009's verification block asserts that no %client% policy exists here.
drop policy if exists "qr_scans members read" on public.qr_scans;
create policy "qr_scans members read" on public.qr_scans
  for select to authenticated using (public.is_cupdom_member());

-- Read-only for members; every write is the service-role edge function. As
-- above, production was found with a full `grant all` here — including TRUNCATE,
-- which RLS does NOT gate. See 0016.
revoke all on public.qr_scans from anon, authenticated;
grant select on public.qr_scans to authenticated;

-- ------------------------------------------------------------
-- 4. crm_data — DEAD. The legacy single-table blob from the original one-file
--    index.html CRM (removed in 56852f4). Contacts, deals, tasks and the team
--    user list were all crammed in here, discriminated by `type`.
--
-- 0010 locked it down after the portal isolation suite proved a live read leak:
-- a portal client could select * and receive the 'singleton-users' row. RLS is
-- on with ZERO policies and ZERO grants. The rows are NOT deleted —
-- service_role and the SQL editor still reach the table, so the legacy data
-- stays inspectable. Nothing in either application references it.
-- ------------------------------------------------------------
create table if not exists public.crm_data (
  id         text        not null,
  type       text        not null,
  data       jsonb       not null,
  updated_at timestamptz default now(),
  constraint crm_data_pkey primary key (id)
);

-- Live in production and recorded in no migration until now. It is the ninth
-- trigger in this database. Harmless — nothing writes to crm_data — but it
-- exists, so a rebuilt database should have it too.
--
-- Depends on public.set_updated_at(), which 0001 creates. Guarded so 0000 can
-- be applied first on an empty project; re-run 0000 after 0001 to attach it,
-- or simply let 0001 run and re-run this file.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists crm_data_set_updated_at on public.crm_data;
    create trigger crm_data_set_updated_at
      before update on public.crm_data
      for each row execute function public.set_updated_at();
  else
    raise notice 'set_updated_at() not present yet (0001 creates it) — skipping crm_data trigger. Re-run 0000 after 0001 to attach it.';
  end if;
end
$$;

-- The lockdown itself (RLS on, zero policies, grants revoked) is applied by
-- 0010. Not duplicated here.

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: the recovered allow-list, matching lib/auth.ts#ALLOWED_EMAILS.
select prosrc from pg_proc
where proname = 'is_cupdom_member' and pronamespace = 'public'::regnamespace;

-- Expected: rowsecurity = true for both qr_ tables.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('qr_campaigns','qr_scans','crm_data');

-- Expected: exactly one policy on qr_scans — "qr_scans members read", SELECT.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'qr_scans';

-- Expected: ZERO rows. Clients must never hold a policy on raw scan data.
select policyname from pg_policies
where schemaname = 'public' and tablename in ('qr_scans','funnel_events')
  and policyname ilike '%client%';

-- ------------------------------------------------------------
-- GRANTS: ANSWERED 2026-08-23. `anon` holds nothing on any of the three tables
-- (correct), and crm_data is fully revoked (0010 worked). `authenticated` held
-- a full `grant all` on both qr_ tables — see 0016, which tightens it.
--
-- STILL UNVERIFIED: the FK delete rule. This file assumes ON DELETE CASCADE, as
-- CLAUDE.md documents. Run the query below and reconcile if it disagrees.
-- ------------------------------------------------------------
-- 1. FK delete rule. This file assumes CASCADE (as CLAUDE.md documents).
--    Expect: qr_scans.campaign_slug -> qr_campaigns.slug, delete_rule = CASCADE.
select tc.table_name, tc.constraint_name, kcu.column_name,
       ccu.table_name as references_table, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
  and tc.table_name in ('qr_scans','qr_campaigns');

-- 2. Table grants — AFTER 0016 has been applied. Expect exactly five rows:
--    qr_campaigns/authenticated SELECT+INSERT+UPDATE+DELETE, qr_scans/
--    authenticated SELECT. No TRUNCATE, no anon, nothing on crm_data.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('qr_campaigns','qr_scans','crm_data')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
