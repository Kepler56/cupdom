-- ============================================================
-- 0016: tighten the legacy table grants on qr_campaigns / qr_scans
--
-- FOUND BY: the 0000 baseline's own VERIFICATION block, run 2026-08-23.
--
-- WHAT WAS FOUND
-- `authenticated` holds the FULL privilege set on both legacy tables:
--
--   qr_campaigns -> SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
--   qr_scans     -> SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
--
-- That is a `grant all`, inherited from supabase_qr_sql.md. 0006 later issued a
-- narrower `grant select, insert, update, delete on qr_campaigns`, but a GRANT
-- only ever ADDS — it never removes what was already there. `anon` correctly
-- holds nothing on either table (verified), and crm_data is clean (0010).
--
-- WHY IT MATTERS, AND WHY IT IS NOT A LIVE VULNERABILITY
-- For SELECT/INSERT/UPDATE/DELETE the grants are harmless today, because RLS is
-- the gate that actually decides: qr_scans has exactly ONE policy (member
-- SELECT), so an authenticated INSERT/UPDATE/DELETE matches no policy and is
-- denied regardless of the grant.
--
-- TRUNCATE is the exception, and it is the reason this file exists.
-- **PostgreSQL row-level security does not apply to TRUNCATE.** RLS covers
-- SELECT, INSERT, UPDATE and DELETE only. A role holding TRUNCATE can empty the
-- table outright, and no policy on it will intervene. `authenticated` includes
-- every portal client.
--
-- It is NOT reachable through the API as things stand: PostgREST issues
-- SELECT/INSERT/UPDATE/DELETE and RPC calls, never TRUNCATE, and no function
-- here truncates anything. So this is a latent over-grant, not an open door —
-- the same shape as the crm_data grant that 0010 closed, and worth closing for
-- the same reason: it is only safe because of a second thing that happens to be
-- true.
--
-- WHAT THIS DOES
-- Revoke everything from anon and authenticated, then re-grant exactly what the
-- application uses:
--   qr_campaigns -> select, insert, update, delete   (members manage campaigns;
--                   0006/0011's owner-gated policies still decide WHICH rows)
--   qr_scans     -> select only                      (every write is the
--                   service-role edge function, which bypasses both grants and
--                   RLS; no member code path writes a scan)
--
-- service_role and the table owner are untouched — REVOKE ... FROM anon,
-- authenticated names those two roles only.
--
-- Depends on: 0000 (the tables), 0006/0011 (the qr_campaigns policies).
-- TIGHTENING ONLY. No table, policy or row is changed. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- qr_campaigns: members manage campaigns through the CRM, so the four DML
-- privileges stay. REFERENCES / TRIGGER / TRUNCATE go.
-- ------------------------------------------------------------
revoke all on public.qr_campaigns from anon, authenticated;
grant select, insert, update, delete on public.qr_campaigns to authenticated;

-- ------------------------------------------------------------
-- qr_scans: read-only for members. Scans are written exclusively by
-- netlify/edge-functions/scan.js with the service-role key.
--
-- If a future member-facing feature ever needs to delete a scan, add the
-- privilege AND an RLS policy in the same migration — the grant alone would
-- still be denied by RLS, which is the correct failure but a confusing one to
-- debug.
-- ------------------------------------------------------------
revoke all on public.qr_scans from anon, authenticated;
grant select on public.qr_scans to authenticated;

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected, and NOTHING else:
--   qr_campaigns | authenticated | DELETE
--   qr_campaigns | authenticated | INSERT
--   qr_campaigns | authenticated | SELECT
--   qr_campaigns | authenticated | UPDATE
--   qr_scans     | authenticated | SELECT
-- In particular: no TRUNCATE, no TRIGGER, no REFERENCES, and no `anon` row.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('qr_campaigns', 'qr_scans')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- Expected: unchanged. The member SELECT policy is what still gates the rows;
-- this migration only removed privileges nothing was using.
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('qr_campaigns', 'qr_scans')
order by tablename, cmd, policyname;

-- Regression check — run as a MEMBER, not as postgres. Expected: the campaign
-- list still loads and scan stats still render. If either returns zero rows
-- where it previously returned data, this migration removed too much.
--   select count(*) from public.qr_campaigns;
--   select count(*) from public.qr_scans;
