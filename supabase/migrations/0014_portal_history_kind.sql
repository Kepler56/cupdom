-- ============================================================
-- Spec 5 (Portail Client) — stage 5.
-- Reconcile public.contact_history.kind with what the application actually
-- writes, and add the one value stage 5 needs.
--
-- WHY A RECONCILIATION: 0002_deals.sql created this constraint with six values.
-- 0005_archive_purge.sql then inserts 'archive' (line 68) and 'restore' (line
-- 113) from two SECURITY DEFINER functions, and NO migration widens the
-- constraint to permit them. Archiving works in production, so the live
-- constraint was widened by hand and no file records it. Rather than add a
-- seventh value to a definition that does not match reality, this drops the
-- constraint currently on the column — found by name, because a hand-patch may
-- have named it anything — and recreates it from the full known-good list.
--
-- ADDITIVE IN EFFECT: every value the application writes today stays legal.
-- Nothing is dropped but the constraint itself, and it is immediately replaced.
-- Safe to re-run.
-- ============================================================

do $$
declare
  v_name text;
begin
  select con.conname
    into v_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'contact_history'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%kind%'
  limit 1;

  if v_name is not null then
    execute format('alter table public.contact_history drop constraint %I', v_name);
  end if;
end;
$$;

alter table public.contact_history
  add constraint contact_history_kind_check check (kind in (
    'deal_stage', 'transfer', 'contact_edit', 'task', 'reminder', 'link',
    'archive', 'restore', 'portal_access'
  ));

-- ------------------------------------------------------------
-- Verify:
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'contact_history_kind_check';
-- Expect: all NINE values, 'portal_access' among them.
--
-- Then confirm nothing regressed, as a member:
--   select public.archive_contact('<some-test-contact-uuid>');
--   select public.restore_contact('<the same uuid>');
-- Both must succeed — they are the reason this file exists.
-- ------------------------------------------------------------
