-- ============================================================
-- Spec 5 (Portail Client) — stage 3C.
-- ONE function: the consent wordings actually recorded against the caller's
-- own leads.
--
-- Why it exists: spec §4.3-D requires the Contacts page to state « the exact
-- consent wording that covers these records », but §5.3 deliberately makes
-- public.lead_consents invisible to clients. Reconstructing the sentence in the
-- application from CONSENT_TEXT_FR(sponsor) would be accurate only until the
-- wording changes — and lib/public/consent.ts marks the current text a
-- PLACEHOLDER pending DPO sign-off, so it WILL change while older leads keep
-- the version they actually accepted. This returns the recorded evidence
-- instead of a reconstruction.
--
-- ADDITIVE ONLY. Creates nothing but this function; drops nothing; alters no
-- table and no existing policy. Safe to re-run.
-- ============================================================

create or replace function public.client_lead_consents()
returns table (consent_text text, consent_version text, leads bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Same guard as every other client RPC. No p_slug: this is "the wordings that
  -- cover MY records", so there is no slug to validate.
  perform public.client_guard(null);
  return query
  select lc.consent_text,
         lc.consent_version,
         count(distinct lc.lead_id)::bigint
  from public.lead_consents lc
  -- lead_consents carries campaign_slug directly (migration 0007), so this
  -- needs no join to leads — which matters, because a join would be evaluated
  -- against a table the caller can read and this one they cannot.
  where lc.campaign_slug in (select public.client_slugs())
  group by lc.consent_text, lc.consent_version
  -- Most-used wording first: a client whose leads span two versions should read
  -- the one covering the bulk of their records at the top.
  order by count(distinct lc.lead_id) desc;
end;
$$;

revoke execute on function public.client_lead_consents() from public, anon;
grant  execute on function public.client_lead_consents() to authenticated;

-- ------------------------------------------------------------
-- Verify (run as a portal client, not as postgres):
--   select * from public.client_lead_consents();
-- Expect: one row per distinct (wording, version) across that client's leads.
-- Zero rows is valid — a client with no leads yet.
-- As a CRM member or anon it must raise: accès refusé (SQLSTATE 42501).
-- ------------------------------------------------------------
