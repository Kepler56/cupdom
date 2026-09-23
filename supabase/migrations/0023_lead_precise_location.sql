-- ============================================================
-- 0023: optional precise location on a lead (#5), opt-in and consented.
--
-- NOT YET APPLIED. Review before running. Depends on 0007 (leads) and 0008
-- (run_lead_anonymisation, erase_lead). ADDITIVE columns; the two PII-clearing
-- functions are re-created to ALSO clear the location — precise GPS is personal
-- data, so it must fall under the same retention sweep and the same
-- erasure-on-request as name/email/phone. Getting that wrong is a GDPR problem,
-- which is why this migration ships with the columns rather than after them.
--
-- The lead-submit Edge Function only writes these when the visitor explicitly
-- opts in on the form (a separate, unticked-by-default consent) and the browser
-- grants geolocation; absent = the normal case.
-- ============================================================

alter table public.leads add column if not exists latitude   numeric(9,6);
alter table public.leads add column if not exists longitude  numeric(9,6);
alter table public.leads add column if not exists geo_source text
  check (geo_source is null or geo_source in ('gps'));

comment on column public.leads.latitude is
  'Optional precise latitude, only when the visitor opted in and granted geolocation (#5). Cleared by anonymisation/erasure.';

-- ------------------------------------------------------------
-- run_lead_anonymisation(): re-created to also null the location columns and to
-- treat a lingering location as PII worth sweeping. Body otherwise identical to 0008.
-- ------------------------------------------------------------
create or replace function public.run_lead_anonymisation()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  update public.leads
     set first_name = null,
         last_name  = null,
         email      = null,
         phone      = null,
         latitude   = null,
         longitude  = null,
         geo_source = null
   where last_activity_at < now() - interval '36 months'
     and (first_name is not null
       or last_name  is not null
       or email      is not null
       or phone      is not null
       or latitude   is not null
       or longitude  is not null);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.run_lead_anonymisation() from public, anon, authenticated;

-- ------------------------------------------------------------
-- erase_lead(p_lead): re-created to also null the location columns. Owner gate and
-- resolution are byte-for-byte from 0008 — only the SET list grows.
-- ------------------------------------------------------------
create or replace function public.erase_lead(p_lead uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_contact uuid;
begin
  select d.contact_id
    into v_contact
    from public.leads l
    join public.qr_campaigns c on c.slug = l.campaign_slug
    join public.deals d        on d.id   = c.deal_id
   where l.id = p_lead;

  if v_contact is null then
    raise exception 'lead introuvable ou non rattaché à un contact'
      using errcode = 'no_data_found';
  end if;

  if not public.owns_contact(v_contact) then
    raise exception 'lecture seule : seul le propriétaire du contact peut effacer ce lead'
      using errcode = 'insufficient_privilege';
  end if;

  update public.leads
     set first_name = null,
         last_name  = null,
         email      = null,
         phone      = null,
         latitude   = null,
         longitude  = null,
         geo_source = null
   where id = p_lead;
end;
$$;
revoke all on function public.erase_lead(uuid) from public, anon;
grant execute on function public.erase_lead(uuid) to authenticated;

-- VERIFICATION
select column_name from information_schema.columns
 where table_schema='public' and table_name='leads' and column_name in ('latitude','longitude','geo_source');
