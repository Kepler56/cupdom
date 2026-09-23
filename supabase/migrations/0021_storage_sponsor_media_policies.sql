-- ============================================================
-- 0021: RLS policies on storage.objects for the `sponsor-media` bucket (#8).
--       Spec: docs/superpowers/specs/2026-09-23-fiche-produit-et-logo-design.md
--
-- NOT YET APPLIED. Review before running against prod.
--
-- PREREQUISITE MANUAL STEP (cannot be a migration — do this in Supabase Studio →
-- Storage FIRST): create the bucket `sponsor-media` with
--   * Public: YES (brand assets; stable CDN URL; no per-render signing)
--   * File size limit: 2 MB
--   * Allowed MIME types: image/png, image/jpeg, image/webp   (NO image/svg+xml —
--     SVG can carry script and would be served from the origin the portal's CSP
--     img-src allow-lists.)
-- Then also widen CSP img-src to https://uqkbvwyspeqwlbulgzkj.supabase.co in BOTH
-- cupdom-dashboard/next.config.ts AND cupdom-dashboard/netlify.toml.
--
-- A policy on a not-yet-created bucket is harmless but does nothing, so create the
-- bucket first.
-- ============================================================

-- Public read (brand assets).
drop policy if exists "sponsor-media public read" on storage.objects;
create policy "sponsor-media public read" on storage.objects
  for select to public
  using (bucket_id = 'sponsor-media');

-- Members: full write (only the 3 trusted emails, enforced by is_cupdom_member()).
drop policy if exists "sponsor-media member write" on storage.objects;
create policy "sponsor-media member write" on storage.objects
  for all to authenticated
  using      (bucket_id = 'sponsor-media' and public.is_cupdom_member())
  with check (bucket_id = 'sponsor-media' and public.is_cupdom_member());

-- v2 ONLY — clients write ONLY inside logos/{their contact_id}/. The folder prefix
-- IS the boundary: a client physically cannot write outside their own folder.
-- Omit this policy (and client_set_logo in 0020) for a CRM-only v1.
drop policy if exists "sponsor-media client own-folder write" on storage.objects;
create policy "sponsor-media client own-folder write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sponsor-media'
    and (storage.foldername(name))[1] = 'logos'
    and (storage.foldername(name))[2] = (select public.current_client_contact())::text
  );
-- (Add a matching UPDATE policy with the same using/with check if replace-in-place is needed.)

-- VERIFICATION
select policyname, cmd from pg_policies
 where schemaname='storage' and tablename='objects' and policyname like 'sponsor-media%'
 order by policyname;
