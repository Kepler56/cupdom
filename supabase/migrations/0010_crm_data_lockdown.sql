-- ============================================================
-- 0010: crm_data lockdown — close a latent read leak
--
-- FOUND BY: the Spec 5 client-portal isolation suite
-- (tests/rls/client-portal-isolation.rls.test.ts), which is the first thing in
-- this project ever to hold an AUTHENTICATED NON-MEMBER session.
--
-- THE LEAK
-- A portal client could `select * from public.crm_data` and receive the
-- `singleton-users` row — the legacy blob holding the team's user list (and
-- historically contacts, deals and tasks). Verified by direct probe: crm_data
-- returned 1 row to a portal client while contacts, deals, profiles,
-- campaign_events, lead_consents, qr_scans, funnel_events, tasks, reminders,
-- contact_links, contact_history and notifications all correctly returned 0.
--
-- WHY IT WAS LATENT
-- Before the client portal, every authenticated user WAS a cupdom member, so a
-- permissive `authenticated` policy and a member-gated one behaved identically.
-- The portal introduces the first non-member authenticated session, which turns
-- the misconfiguration into a live leak.
--
-- WHY FULL LOCKDOWN RATHER THAN MEMBER-GATING
-- `crm_data` is dead. It is referenced nowhere in the application — a repo-wide
-- search finds it only in migration comments and the isolation test. It is
-- legacy from the single-file index.html CRM removed in 56852f4. Nothing reads
-- it, so nothing should be able to. The rows are NOT deleted: service_role and
-- the Supabase SQL editor still reach the table (RLS does not apply to the
-- table owner), so the legacy data remains fully inspectable and recoverable.
--
-- REVERSIBLE: to restore member read access, add
--   create policy "crm_data members all" on public.crm_data
--     for all to authenticated using (public.is_cupdom_member())
--     with check (public.is_cupdom_member());
--   grant select, insert, update, delete on public.crm_data to authenticated;
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Drop EVERY existing policy on crm_data.
--    Done by iteration rather than by name: the leak means at least one
--    permissive policy exists, and a `drop policy if exists` with a guessed
--    name would silently leave it in place — policies are OR'd, so one
--    surviving permissive policy keeps the table open.
-- ------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'crm_data'
  loop
    execute format('drop policy %I on public.crm_data', p.policyname);
    raise notice 'dropped policy % on crm_data', p.policyname;
  end loop;
end
$$;

-- ------------------------------------------------------------
-- 2. RLS on, with NO policy. With RLS enabled and zero policies, non-owner
--    roles can read nothing — deny by default. service_role and the table
--    owner are unaffected (RLS does not apply to them).
-- ------------------------------------------------------------
alter table public.crm_data enable row level security;

-- ------------------------------------------------------------
-- 3. Remove the table grants as well, so the lockdown does not depend on RLS
--    alone. Defence in depth: a future policy added by mistake still cannot
--    open the table without a grant.
-- ------------------------------------------------------------
revoke all on public.crm_data from anon, authenticated;

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: rowsecurity = true.
select relname, relrowsecurity
from pg_class
where relname = 'crm_data';

-- Expected: ZERO rows. Any policy here re-opens the table.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'crm_data';

-- Expected: no rows for anon or authenticated. service_role/postgres may remain.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'crm_data'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Expected: the legacy rows are still THERE — this migration hides the table,
-- it does not delete anything. Run as the SQL editor's owner role.
select id, type from public.crm_data order by id;
