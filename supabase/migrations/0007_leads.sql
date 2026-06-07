-- ============================================================
-- Spec 3A: leads + lead_consents + funnel_events
-- Depends on:
--   0001 (public.profiles, public.contacts, is_cupdom_member, set_updated_at),
--   0002 (public.deals(contact_id), public.owns_contact(uuid)),
--   0006 (Spec 2A: public.qr_campaigns reused — active boolean, deal_id, name,
--         distributed_count, sponsor_name; slug PK).
-- ADDITIVE ONLY. Never drops/alters crm_data, qr_campaigns, qr_scans, or 1A/1B/2A tables.
-- Safe to re-run (idempotent-friendly).
--
-- Privacy: consumer PII lives ONLY in public.leads (named columns) so Spec 3B can null
-- them; lead_consents stores NO IP and no extra identifiers; public writes happen ONLY
-- through the service-role Edge Function (no anon insert/select policy is granted).
-- ============================================================

-- ------------------------------------------------------------
-- 1. LEADS — one consumer per (campaign, email). Consumer end-users, NOT CRM contacts.
-- ------------------------------------------------------------
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  campaign_slug    text not null references public.qr_campaigns(slug) on delete cascade,
  first_name       text,
  last_name        text,
  email            text,
  phone            text,
  first_seen_at    timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),  -- 3B retention clock; refreshed on resubmit
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Dedup: at most ONE lead per (campaign, email). The Edge Function stores email already
-- NORMALISED (trim + lowercase via normaliseEmail), so this PLAIN unique index gives the same
-- case-insensitive dedup as lower(email) while remaining a valid PostgREST upsert conflict target
-- (a functional index cannot be named in ON CONFLICT via PostgREST). A repeat submission UPSERTs
-- onto this row (refreshing last_activity_at) instead of duplicating (AC-10); the same email on a
-- DIFFERENT campaign is a separate row (different campaign_slug → AC-11).
create unique index if not exists leads_campaign_email_uidx
  on public.leads (campaign_slug, email);
create index if not exists leads_campaign_idx       on public.leads (campaign_slug);
create index if not exists leads_last_activity_idx  on public.leads (last_activity_at);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. LEAD_CONSENTS — immutable accountability evidence. NO IP, no extra identifiers.
-- ------------------------------------------------------------
create table if not exists public.lead_consents (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references public.leads(id) on delete cascade,
  campaign_slug   text not null,
  sponsor_name    text,
  consent_text    text not null,   -- the EXACT wording shown (with sponsor injected)
  consent_version text,
  created_at      timestamptz not null default now()
);
create index if not exists lead_consents_lead_idx     on public.lead_consents (lead_id);
create index if not exists lead_consents_campaign_idx on public.lead_consents (campaign_slug);

-- ------------------------------------------------------------
-- 3. FUNNEL_EVENTS — one row per non-manual stage crossing (form_view/submit/offer_reached).
--    Anonymous; visitor_hash is best-effort (no IP). Survives lead anonymisation (3B) so the
--    funnel counts remain even after PII is removed.
-- ------------------------------------------------------------
create table if not exists public.funnel_events (
  id            uuid primary key default gen_random_uuid(),
  campaign_slug text not null references public.qr_campaigns(slug) on delete cascade,
  kind          text not null check (kind in ('form_view','form_submit','offer_reached')),
  visitor_hash  text,
  created_at    timestamptz not null default now()
);
create index if not exists funnel_events_campaign_kind_idx
  on public.funnel_events (campaign_slug, kind);
create index if not exists funnel_events_created_idx
  on public.funnel_events (created_at desc);

-- ------------------------------------------------------------
-- 4. OWNER-RESOLUTION HELPER — a member "owns" a campaign's leads when they own the
--    contact behind the campaign's deal: campaign.deal_id → deals.contact_id → owns_contact.
--    A campaign with a null deal_id (unlinked) resolves to NOT owned (read-only to all but
--    visible — see policy). SECURITY INVOKER + stable; mirrors 1B owns_contact semantics.
-- ------------------------------------------------------------
create or replace function public.owns_campaign_leads(p_slug text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.qr_campaigns qc
    join public.deals d     on d.id = qc.deal_id
    where qc.slug = p_slug
      and public.owns_contact(d.contact_id)
  );
$$;

-- ------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
--    READ: members only (view-everyone for funnel/consents; leads additionally owner-gated
--          at the application layer via owns_campaign_leads for the read-only/edit split).
--    WRITE: NONE for anon or authenticated — every public write is the service-role Edge
--           Function (service_role bypasses RLS). No insert/update/delete policy is granted.
-- ------------------------------------------------------------
alter table public.leads         enable row level security;
alter table public.lead_consents enable row level security;
alter table public.funnel_events enable row level security;

-- LEADS READ: any member may SELECT leads (so colleague/Tous scope can view read-only,
-- AC-13). Owner-gating (who may EXPORT/act) is enforced in the app via owns_campaign_leads;
-- there is no member write path at all (consumers write through the Edge Function).
drop policy if exists "leads read members" on public.leads;
create policy "leads read members" on public.leads
  for select to authenticated using (public.is_cupdom_member());

-- LEAD_CONSENTS READ: members only (accountability evidence; never written by members).
drop policy if exists "lead_consents read members" on public.lead_consents;
create policy "lead_consents read members" on public.lead_consents
  for select to authenticated using (public.is_cupdom_member());

-- FUNNEL_EVENTS READ: members only (feeds the funnel rollup; never written by members).
drop policy if exists "funnel_events read members" on public.funnel_events;
create policy "funnel_events read members" on public.funnel_events
  for select to authenticated using (public.is_cupdom_member());

-- NO insert/update/delete policies on any of the three tables for anon/authenticated.
-- The Edge Function uses the service-role key, which bypasses RLS entirely.
revoke all on public.leads         from anon, authenticated;
revoke all on public.lead_consents from anon, authenticated;
revoke all on public.funnel_events from anon, authenticated;
grant select on public.leads         to authenticated;
grant select on public.lead_consents to authenticated;
grant select on public.funnel_events to authenticated;

-- ------------------------------------------------------------
-- 6. campaign_funnel — read-only VIEW (security_invoker), the SINGLE funnel data
--    source. One row per campaign, five counter columns. Inherits the caller's RLS,
--    so a member sees a campaign's counts only if they may read the campaign.
--    Spec 4 charts it; AC-14 makes these counts "available".
--      distribues        = qr_campaigns.distributed_count (owner-entered)
--      scannes           = distinct non-bot visitor_hash in qr_scans
--      formulaire_vu     = count of funnel_events kind='form_view'
--      formulaire_soumis = count of funnel_events kind='form_submit'
--      offre_atteinte    = count of funnel_events kind='offer_reached'
-- ------------------------------------------------------------
-- ONE row per campaign (all campaigns), so Spec 4 can chart a single campaign
-- (detail funnel, AC-9) AND a deal's several campaigns (nested Deals-tab stats,
-- AC-7) from the same object — they can never disagree. `distribues` comes from
-- qr_campaigns.distributed_count; the other four are aggregated here.
-- security_invoker = true → a member sees only the campaigns their RLS exposes.
create or replace view public.campaign_funnel
with (security_invoker = true) as
select
  ca.slug                                   as campaign_slug,
  coalesce(ca.distributed_count, 0)         as distribues,
  coalesce(s.scannes, 0)                    as scannes,
  coalesce(f.formulaire_vu, 0)              as formulaire_vu,
  coalesce(f.formulaire_soumis, 0)          as formulaire_soumis,
  coalesce(f.offre_atteinte, 0)             as offre_atteinte
from public.qr_campaigns ca
left join (
  -- unique non-bot scanners per campaign (Spec 2 AC-22/24)
  select campaign_slug, count(distinct visitor_hash) as scannes
  from public.qr_scans
  where is_bot = false
  group by campaign_slug
) s on s.campaign_slug = ca.slug
left join (
  -- conditional counts of the three measured funnel events.
  -- NOTE: the stored kind is the English 'offer_reached'; the French alias
  -- `offre_atteinte` is a COLUMN NAME only — filter on the stored value.
  select campaign_slug,
         count(*) filter (where kind = 'form_view')     as formulaire_vu,
         count(*) filter (where kind = 'form_submit')   as formulaire_soumis,
         count(*) filter (where kind = 'offer_reached') as offre_atteinte
  from public.funnel_events
  group by campaign_slug
) f on f.campaign_slug = ca.slug;

grant select on public.campaign_funnel to authenticated;

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: rowsecurity = true for all three tables.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('leads','lead_consents','funnel_events');

-- Expected: leads -> 1 (SELECT), lead_consents -> 1 (SELECT), funnel_events -> 1 (SELECT).
-- (No INSERT/UPDATE/DELETE policies — writes are service-role only.)
select tablename, policyname, cmd from pg_policies
where tablename in ('leads','lead_consents','funnel_events') order by tablename, cmd;

-- Expected: the dedup unique index exists.
select indexname from pg_indexes
where schemaname = 'public' and indexname = 'leads_campaign_email_uidx';
