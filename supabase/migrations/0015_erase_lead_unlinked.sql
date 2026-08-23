-- ============================================================
-- 0015: erase_lead() must work on leads whose campaign has no deal
--
-- FOUND BY: the 2026-08-23 documentation/verification pass.
--
-- THE GAP
-- 0008's erase_lead() resolves the owning contact with an INNER join through
-- qr_campaigns.deal_id:
--
--     from public.leads l
--     join public.qr_campaigns c on c.slug = l.campaign_slug
--     join public.deals d        on d.id   = c.deal_id
--
-- When deal_id IS NULL the join yields nothing, v_contact is NULL, and the
-- function raises 'lead introuvable ou non rattaché à un contact'. deal_id
-- becomes NULL in two ordinary situations:
--
--   1. legacy / unlinked campaigns (0006 kept an explicit escape hatch for
--      them, and one such campaign is live today);
--   2. AFTER A CONTACT PURGE — 0006 made qr_campaigns.deal_id ON DELETE SET
--      NULL precisely so a purge detaches the campaign and retains its
--      anonymous scans.
--
-- So the lead whose sponsor relationship has ENDED — the one most likely to
-- attract an erasure request — is exactly the lead the RPC cannot serve. There
-- is no UI fallback; honouring such a request means hand-written SQL.
--
-- CURRENTLY LATENT: verified 2026-08-23, zero leads sit on an unlinked
-- campaign. This closes the gap before it opens.
--
-- THE FIX
-- Resolve the contact with a LEFT join, then branch:
--   * lead does not exist at all            -> no_data_found (unchanged)
--   * lead IS linked to a contact           -> owner-gated, exactly as before
--   * lead is NOT linked to any contact     -> member-gated
--
-- The relaxation is deliberate and narrow. When no contact can be resolved
-- there is no owner to check, so the choice is between "any member may erase"
-- and "nobody may erase, ever". For an ERASURE path — a right people can
-- exercise, on data Cupdom holds — refusing everyone is the worse failure.
-- is_cupdom_member() still gates it, so this is never reachable by a portal
-- client or by anon.
--
-- Depends on: 0007 (leads), 0008 (erase_lead), 0002 (owns_contact),
--             0000/legacy (is_cupdom_member, qr_campaigns).
-- ADDITIVE / WIDENING ONLY. No table, policy or grant is changed.
-- Safe to re-run.
-- ============================================================

create or replace function public.erase_lead(p_lead uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact uuid;
  v_exists  boolean;
begin
  -- Does the lead exist at all? Answered separately from ownership, so a
  -- genuinely unknown id still reports 'introuvable' rather than being
  -- mistaken for an unlinked-but-real lead.
  select exists (select 1 from public.leads where id = p_lead) into v_exists;
  if not v_exists then
    raise exception 'lead introuvable' using errcode = 'no_data_found';
  end if;

  -- LEFT joins: an unlinked campaign (deal_id IS NULL) now yields v_contact =
  -- NULL instead of collapsing the whole row away, which is what 0008's inner
  -- joins did.
  select d.contact_id
    into v_contact
    from public.leads l
    left join public.qr_campaigns c on c.slug = l.campaign_slug
    left join public.deals d        on d.id   = c.deal_id
   where l.id = p_lead;

  if v_contact is not null then
    -- Linked: owner gate, byte-for-byte the 0008 behaviour.
    if not public.owns_contact(v_contact) then
      raise exception 'lecture seule : seul le propriétaire du contact peut effacer ce lead'
        using errcode = 'insufficient_privilege';
    end if;
  else
    -- Unlinked: no owner exists to check, so fall back to membership. Without
    -- this branch the erasure is impossible through the application.
    if not public.is_cupdom_member() then
      raise exception 'lecture seule : réservé à l''équipe Cupdom'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Identical to 0008: null the four PII columns, RETAIN the row. id,
  -- campaign_slug, first_seen_at and every funnel count survive, so a campaign's
  -- historical performance never develops a hole.
  update public.leads
     set first_name = null,
         last_name  = null,
         email      = null,
         phone      = null
   where id = p_lead;
end;
$$;

-- RPC exposure unchanged from 0008: members only, never anon.
revoke all on function public.erase_lead(uuid) from public, anon;
grant execute on function public.erase_lead(uuid) to authenticated;

-- ============================================================
-- VERIFICATION (read results below the query)
-- ============================================================
-- Expected: prosecdef = true (SECURITY DEFINER preserved).
select proname, prosecdef from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'erase_lead';

-- Expected: the body now LEFT joins rather than inner joins.
select position('left join public.qr_campaigns' in prosrc) > 0 as uses_left_join
from pg_proc where proname = 'erase_lead' and pronamespace = 'public'::regnamespace;

-- Expected: anon holds EXECUTE on nothing here.
select routine_name, grantee from information_schema.role_routine_grants
where specific_schema = 'public' and routine_name = 'erase_lead' and grantee = 'anon';

-- The leads this fixes. Expected ZERO rows today; any row it returns was
-- previously impossible to erase through the application.
select l.id, l.campaign_slug, l.email
from public.leads l
join public.qr_campaigns c on c.slug = l.campaign_slug
where c.deal_id is null and l.email is not null;
