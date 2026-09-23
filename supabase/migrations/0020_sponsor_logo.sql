-- ============================================================
-- 0020: sponsor logo on the client's contact, surfaced to the portal (#8).
--       Spec: docs/superpowers/specs/2026-09-23-fiche-produit-et-logo-design.md
--
-- NOT YET APPLIED. Review before running against prod. Mirrors 0017's model:
-- store an absolute URL, the CRM owns it, the portal reads it. Depends on 0001
-- (contacts), 0009 (client_guard, current_client_contact). ADDITIVE.
--
-- The client_set_logo() write RPC (v2 — client self-upload) is included but is
-- only needed if you ship client self-upload. For a CRM-only-upload v1 (the
-- recommended first version), a member sets contacts.sponsor_logo_url through
-- the normal member UPDATE on contacts and this RPC is unused.
-- ============================================================

alter table public.contacts
  add column if not exists sponsor_logo_url text;

comment on column public.contacts.sponsor_logo_url is
  'Optional absolute URL of the sponsor logo (Supabase Storage public object). '
  'Set by a CRM member (v1) or by the client via client_set_logo() (v2). NULL = no logo.';

-- Portal read path: contacts is member-read-only, so a client reaches its own
-- profile fields only through this SECURITY DEFINER RPC (the 0009 pattern).
create or replace function public.client_profile()
returns table (contact_id uuid, display_name text, sponsor_logo_url text)
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.client_guard(null);
  return query
  select c.id, c.company, c.sponsor_logo_url
  from public.contacts c
  where c.id = (select public.current_client_contact());
end;
$$;
revoke execute on function public.client_profile() from public, anon;
grant  execute on function public.client_profile() to authenticated;

-- v2 ONLY — client self-write, scoped to the caller's OWN contact exactly like
-- client_mark_password_changed(). Only the project storage origin is accepted, so
-- a client cannot point sponsor_logo_url at an arbitrary external URL. Drop this
-- block if you ship CRM-only upload (v1).
create or replace function public.client_set_logo(p_url text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_url text := nullif(btrim(p_url), '');
begin
  perform public.client_guard(null);
  if v_url is not null and v_url !~* '^https://uqkbvwyspeqwlbulgzkj\.supabase\.co/storage/v1/object/public/sponsor-media/' then
    raise exception 'URL de logo invalide' using errcode = 'invalid_parameter_value';
  end if;
  update public.contacts
     set sponsor_logo_url = v_url
   where id = (select public.current_client_contact());
end;
$$;
revoke execute on function public.client_set_logo(text) from public, anon;
grant  execute on function public.client_set_logo(text) to authenticated;

-- VERIFICATION
select column_name from information_schema.columns
 where table_schema='public' and table_name='contacts' and column_name='sponsor_logo_url';
select proname, prosecdef from pg_proc where pronamespace='public'::regnamespace
 and proname in ('client_profile','client_set_logo') order by proname;
