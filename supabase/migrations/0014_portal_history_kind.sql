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
  r record;
begin
  -- Drop EVERY check constraint guarding this column, not merely the first
  -- found: the live one was created by hand and we cannot assume there is
  -- exactly one, nor what it is called.
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'contact_history'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.contact_history drop constraint %I', r.conname);
  end loop;

  -- Inside the SAME block as the drops, deliberately. A do-block is a single
  -- statement, so if this add fails — a stray existing value, a name collision —
  -- every drop above rolls back with it and the column is never left unguarded.
  -- Two top-level statements would leave that window open and depend on the SQL
  -- client wrapping the script in a transaction, which the file cannot assume.
  execute $ct$
    alter table public.contact_history
      add constraint contact_history_kind_check check (kind in (
        'deal_stage', 'transfer', 'contact_edit', 'task', 'reminder', 'link',
        'archive', 'restore', 'portal_access'
      ))
  $ct$;
end;
$$;

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
