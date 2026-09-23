-- ============================================================
-- 0017: an optional product photo on a campaign, surfaced to the client portal
--
-- WHY
-- The portal's « Mon compte » screen gains a fiche per campaign: QR, campaign
-- details, and a picture of the object the QR is printed on. Nothing stored a
-- picture until now — `qr_campaigns.product` is a text descriptor ("gourde",
-- "tote"), not an image.
--
-- WHY A URL COLUMN AND NOT STORAGE
-- The portal has no client UPDATE path on qr_campaigns and deliberately so:
-- 0009 gives clients SELECT through SECURITY DEFINER RPCs only, and 0011 FIX 8
-- hardened UPDATE/DELETE further. A Storage bucket would need an upload policy,
-- a client write path, and a new public origin — all to let a sponsor change a
-- field the CRM already owns. The CRM sets this like it sets `venue` and
-- `invested_amount_eur`; the portal reads it.
--
-- The column is a URL, NOT a path: it is rendered by a browser on a different
-- origin from this database, and the reader (cupdom-dashboard) widens its CSP
-- img-src to the Supabase origin. A bare path would put the job of knowing the
-- storage origin in two repositories.
--
-- NULLABLE, with no default and no check constraint. Absent is the normal case
-- (every existing campaign), and the portal renders a fiche without a photo as
-- a first-class layout rather than a broken one.
-- ============================================================

alter table public.qr_campaigns
  add column if not exists product_image_url text;

comment on column public.qr_campaigns.product_image_url is
  'Optional absolute URL of a photo of the product the QR is printed on. Set by the CRM, read-only to portal clients. NULL = no photo, which is the normal case.';

-- ------------------------------------------------------------
-- client_campaigns(): re-created, not replaced.
--
-- `create or replace function` CANNOT change a function's return type, and
-- adding a column to a `returns table (...)` does exactly that — Postgres
-- answers 42P13 ("cannot change return type of existing function"). So this is
-- a DROP then a CREATE, and the grants must be re-applied because DROP takes
-- them with it.
--
-- Body is otherwise verbatim from 0011 FIX 7, INCLUDING the two
-- `campaign_slug in (select public.client_slugs())` filters pushed into the
-- rollup subqueries. Those are the fix that stopped this function full-scanning
-- qr_scans and leads on the portal's first call; re-typing the body around a
-- new column is exactly how such a fix gets quietly lost.
--
-- `product_image_url` is placed last in the row so the column order of every
-- pre-existing field is untouched. PostgREST serialises to a JSON object and
-- the portal reads by name, so order is not load-bearing for the caller — but
-- appending keeps this diff readable as "one column added".
-- ------------------------------------------------------------
drop function if exists public.client_campaigns();

create function public.client_campaigns()
returns table (
  slug                text,
  name                text,
  sponsor_name        text,
  product             text,
  destination_url     text,
  active              boolean,
  venue               text,
  distributed_count   int,
  invested_amount_eur numeric,
  created_at          timestamptz,
  scans               bigint,
  uniques             bigint,
  leads               bigint,
  product_image_url   text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.client_guard(null);
  return query
  select
    c.slug, c.name, c.sponsor_name, c.product, c.destination_url, c.active,
    c.venue, c.distributed_count, c.invested_amount_eur, c.created_at,
    coalesce(s.scans, 0), coalesce(s.uniques, 0), coalesce(l.leads, 0),
    c.product_image_url
  from public.qr_campaigns c
  join public.client_slugs() cs on cs = c.slug
  left join (
    select q.campaign_slug,
           count(*)::bigint                        as scans,
           count(distinct q.visitor_hash)::bigint  as uniques
    from public.qr_scans q
    where q.is_bot = false
      and q.campaign_slug in (select public.client_slugs())
    group by q.campaign_slug
  ) s on s.campaign_slug = c.slug
  left join (
    select ld.campaign_slug, count(*)::bigint as leads
    from public.leads ld
    where ld.campaign_slug in (select public.client_slugs())
    group by ld.campaign_slug
  ) l on l.campaign_slug = c.slug
  order by c.created_at desc;
end;
$$;

-- Re-applied after the DROP above, which discarded the 0011 grants.
revoke execute on function public.client_campaigns() from public, anon;
grant  execute on function public.client_campaigns() to authenticated;
