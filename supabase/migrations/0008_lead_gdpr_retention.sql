-- ============================================================
-- Spec 3B: lead PII retention, erasure-on-request & anonymisation
-- Depends on:
--   1A (0001): public.contacts(archived_at, purge_after), public.is_cupdom_member()
--   1B (0002): public.owns_contact(uuid), public.deals(contact_id)
--   1E (0005): public.run_contact_purge() (REDEFINED below — 1E body kept, lead-PII delete added),
--              pg_cron enabled, contact_purge_daily job
--   2A (0006): public.qr_campaigns(deal_id -> deals(id) ON DELETE SET NULL, campaign_slug = slug)
--   3A (0007): public.leads(id, campaign_slug, first_name, last_name, email, phone,
--              first_seen_at, last_activity_at, ...), public.funnel_events, public.lead_consents
-- Additive only: no DROP/ALTER of crm_data, qr_campaigns, qr_scans, or the leads/consent/funnel
-- tables. pg_cron already enabled by 1D/1E — NOT re-created here. The cron.schedule is GUARDED
-- (applies even if pg_cron is not enabled on this DB).
--
-- RETENTION = 36 months is mirrored in types/domain.ts RETENTION_MONTHS — keep them in sync.
-- The figure AND the consent wording/version are PLACEHOLDERS pending DPO sign-off (§7/§12).
-- ============================================================

-- ------------------------------------------------------------
-- run_lead_anonymisation(): daily. Anonymise lead PII past the retention window.
--   * For every lead whose last_activity_at < now() - interval '36 months' AND that still
--     has any PII, set first_name / last_name / email / phone = NULL.
--   * The ROW IS RETAINED: leads.id, campaign_slug, first_seen_at, last_activity_at and the
--     funnel_events / aggregate counts survive — only the four personal columns are cleared
--     (AC-16). lead_consents rows (no PII, no IP) are left untouched.
-- AC-17 honoured implicitly: the predicate reads last_activity_at, which 3A's repeat-submission
-- upsert refreshes, so fresh activity defers anonymisation by another 36 months.
-- SECURITY DEFINER so the cron job (no auth.uid()) can write; revoked from API roles.
-- ------------------------------------------------------------
create or replace function public.run_lead_anonymisation()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.leads
     set first_name = null,
         last_name  = null,
         email      = null,
         phone      = null
   where last_activity_at < now() - interval '36 months'
     and (first_name is not null
       or last_name  is not null
       or email      is not null
       or phone      is not null);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Cron-only (server-side). Lock it down from every API role.
revoke all on function public.run_lead_anonymisation() from public, anon, authenticated;

-- ------------------------------------------------------------
-- erase_lead(p_lead): member-callable RPC for erasure / consent withdrawal on request
-- (AC-15). Owner-gated via campaign -> deal -> contact using the 1B owns_contact() helper:
-- the caller may erase a lead only if they own the sponsor contact that lead belongs to.
-- Nulls the four PII columns (row + funnel counts retained, exactly like anonymisation).
-- SECURITY DEFINER so the explicit owner check (not RLS) is the boundary; authenticated only.
-- ------------------------------------------------------------
create or replace function public.erase_lead(p_lead uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact uuid;
begin
  -- Resolve the owning sponsor contact via campaign -> deal -> contact.
  select d.contact_id
    into v_contact
    from public.leads l
    join public.qr_campaigns c on c.slug = l.campaign_slug
    join public.deals d        on d.id   = c.deal_id
   where l.id = p_lead;

  if v_contact is null then
    -- Lead unknown, or its campaign has no linked deal/contact (detached, e.g. post-purge).
    raise exception 'lead introuvable ou non rattaché à un contact'
      using errcode = 'no_data_found';
  end if;

  -- Owner gate (this is the security boundary; SECURITY DEFINER bypasses RLS).
  if not public.owns_contact(v_contact) then
    raise exception 'lecture seule : seul le propriétaire du contact peut effacer ce lead'
      using errcode = 'insufficient_privilege';
  end if;

  update public.leads
     set first_name = null,
         last_name  = null,
         email      = null,
         phone      = null
   where id = p_lead;
end;
$$;

-- RPC exposure: members only. anon never calls this.
revoke all on function public.erase_lead(uuid) from public, anon;
grant execute on function public.erase_lead(uuid) to authenticated;

-- ------------------------------------------------------------
-- run_contact_purge(): REDEFINED — supersedes 1E's NO-OP "Spec 3 — lead PII" stub.
-- 1E's body is kept IDENTICAL except for the lead-PII delete prepended BEFORE the contact
-- delete, so the deal -> contact link still exists when we resolve which leads to clear
-- (AC-18). qr_campaigns rows survive via 2A's deal_id ON DELETE SET NULL; qr_scans survive
-- via their own FK to qr_campaigns. Only lead PII is removed; the anonymous funnel/scan
-- aggregates are retained.
-- ------------------------------------------------------------
create or replace function public.run_contact_purge()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Spec 3B (0008): delete the leads of contacts about to be purged. Runs BEFORE the contact
  -- delete so the campaign->deal->contact link still resolves.
  delete from public.leads l using public.qr_campaigns c, public.deals d
   where l.campaign_slug = c.slug and c.deal_id = d.id
     and d.contact_id in (
       select id from public.contacts
        where archived_at is not null and purge_after is not null and purge_after <= now()
     );

  -- 1E body (UNCHANGED): cascade deletes deals/tasks/reminders/contact_links/contact_history
  -- (1B/1C FKs). qr_campaigns.deal_id is SET NULL (2A) so campaigns + qr_scans aggregates survive.
  delete from public.contacts
   where archived_at is not null
     and purge_after is not null
     and purge_after <= now();
end;
$$;

-- run_contact_purge stays cron-only (1E already revoked it; re-assert after the replace).
revoke all on function public.run_contact_purge() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Schedule (pg_cron, UTC). Anonymisation at 04:00 UTC — AFTER 1E's 03:00 UTC contact purge, so a
-- same-day purge has already removed PII for purged contacts before the anonymisation sweep runs.
-- GUARDED: applies even if pg_cron is not enabled (re-run after enabling). Idempotent: unschedule
-- a prior job of the same name first.
-- ------------------------------------------------------------
do $cron$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron not enabled — skipping lead_anonymisation schedule. Enable pg_cron and re-run.';
    return;
  end if;

  begin perform cron.unschedule('lead_anonymisation_daily'); exception when others then null; end;
  perform cron.schedule('lead_anonymisation_daily', '0 4 * * *',
    $job$ select public.run_lead_anonymisation(); $job$);
end
$cron$;

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: the two new functions + the redefined purge exist.
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('run_lead_anonymisation','erase_lead','run_contact_purge')
order by proname;

-- Expected: run_contact_purge body now contains the lead-PII delete BEFORE the contact delete.
select position('delete from public.leads' in prosrc) > 0
   and position('delete from public.leads' in prosrc) < position('delete from public.contacts' in prosrc)
       as purge_clears_leads_first
from pg_proc where proname = 'run_contact_purge' and pronamespace = 'public'::regnamespace;

-- After pg_cron is enabled, verify the schedule (run separately; errors if cron schema absent):
--   select jobname, schedule from cron.job where jobname = 'lead_anonymisation_daily';  -- expect 0 4 * * *
