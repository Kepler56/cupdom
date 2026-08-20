-- ============================================================================
-- CUPDOM — jeu de démonstration pour le Portail Client
-- ============================================================================
-- Crée un contact « Démo Nightlife », un deal, trois campagnes et ~180 jours de
-- scans réalistes (pic vendredi/samedi 23h-3h, heure de Paris), le tunnel
-- correspondant et les contacts captés.
--
-- SÛRETÉ : tout est préfixé `demo-` et rattaché au contact « Démo Nightlife ».
-- Aucune campagne réelle n'est touchée. Le bloc 0 supprime tout, donc le script
-- est rejouable autant de fois que voulu, et sert aussi de nettoyage.
--
-- À exécuter d'un bloc dans l'éditeur SQL Supabase.
-- ============================================================================


-- ── 0. Nettoyage / rejouabilité ─────────────────────────────────────────────
-- Les scans, funnel_events et leads partent en cascade avec les campagnes.
delete from public.qr_campaigns where slug like 'demo-%';
delete from public.contacts     where company = 'Démo Nightlife';  -- cascade → deals


-- ── 1. Le sponsor et son deal ───────────────────────────────────────────────
with owner as (
  select id from public.profiles limit 1
), c as (
  insert into public.contacts (owner_id, first_name, last_name, company, email, phone)
  select owner.id, 'Camille', 'Duret', 'Démo Nightlife',
         'camille.duret@demo-nightlife.test', '+33 6 12 34 56 78'
  from owner
  returning id
)
insert into public.deals (contact_id, title, stage, value_eur, expected_close)
select c.id, 'Démo Portail Client', 'GAGNÉ', 8500, current_date - 60 from c;


-- ── 2. Trois campagnes ──────────────────────────────────────────────────────
-- `venue` alimente le classement « Lieu / événement » (spec §4.8).
-- `invested_amount_eur` est ce qui fait apparaître la tuile « Coût par contact »
-- (spec §4.7) : elle ne s'affiche que si TOUTES les campagnes affichées en ont un.
insert into public.qr_campaigns
  (slug, sponsor_name, name, product, destination_url, active,
   deal_id, distributed_count, invested_amount_eur, venue, created_at)
select v.slug, 'Démo Nightlife', v.name, 'Couvercle 40 cl', v.url, v.active,
       d.id, v.distributed, v.invested, v.venue, now() - (v.age || ' days')::interval
from (values
  ('demo-rex-club',    'Rex Club — Été',       'https://demo-nightlife.test/rex',    true,  5000, 4200, 'Rex Club',     95),
  ('demo-badaboum',    'Badaboum — Été',       'https://demo-nightlife.test/bada',   true,  3000, 2600, 'Badaboum',     80),
  ('demo-nuits-fauves','Nuits Fauves — Août',  'https://demo-nightlife.test/nf',     false, 1500, 1500, 'Nuits Fauves', 40)
) as v(slug, name, url, active, distributed, invested, venue, age)
cross join lateral (
  select id from public.deals where title = 'Démo Portail Client' limit 1
) d;


-- ── 3. Les scans ────────────────────────────────────────────────────────────
-- Réalisme recherché :
--   • volume proportionnel au tirage de chaque campagne
--   • vendredi/samedi dominants, lundi/mardi creux
--   • croissance sur 180 jours. 180 et non 90 : le preset « 90 jours » compare
--     aux 90 jours PRECEDENTS, donc avec seulement 90 jours d'historique la
--     fenetre de comparaison est vide et le portail masque les tendances --
--     ce qui est le comportement correct, mais invisible en demo
--   • pic 22h-3h : les heures < 6h basculent au jour suivant, donc une
--     « soirée du vendredi » produit bien des scans le samedi à 1h
--   • ~28 % de re-scans le même jour → scans > personnes touchées
--   • ~4,5 % de bots, exclus de tous les chiffres par les RPC
insert into public.qr_scans
  (campaign_slug, scanned_at, country, region, city,
   device_type, os, browser, language, visitor_hash, is_bot)
select
  x.slug,
  ((x.night + case when x.hr < 6 then 1 else 0 end)::timestamp
     + x.hr * interval '1 hour'
     + floor(random() * 60) * interval '1 minute'
  ) at time zone 'Europe/Paris',
  split_part(x.geo, '|', 1),
  split_part(x.geo, '|', 2),
  split_part(x.geo, '|', 3),
  split_part(x.dev, '|', 1),
  split_part(x.dev, '|', 2),
  split_part(x.dev, '|', 3),
  x.lang,
  -- Le hash encode la DATE : la même personne deux soirs de suite compte deux
  -- fois. C'est la sémantique réelle de visitor_hash, et ce que la tuile
  -- « Personnes touchées » explique dans son infobulle.
  md5(x.slug || ':' || x.person || ':' || (x.night + case when x.hr < 6 then 1 else 0 end)::text),
  random() < 0.045
from (
  select
    s.slug,
    s.night,
    (array[20,21,21,22,22,22,23,23,23,23,0,0,0,0,0,1,1,1,1,2,2,2,3,3,12,14,16,18,19])
      [1 + floor(random() * 29)::int] as hr,
    (array[
      'FR|Île-de-France|Paris','FR|Île-de-France|Paris','FR|Île-de-France|Paris',
      'FR|Île-de-France|Paris','FR|Île-de-France|Paris','FR|Île-de-France|Paris',
      'FR|Île-de-France|Boulogne-Billancourt','FR|Île-de-France|Montreuil',
      'FR|Auvergne-Rhône-Alpes|Lyon','FR|Auvergne-Rhône-Alpes|Lyon',
      'FR|Provence-Alpes-Côte d''Azur|Marseille','FR|Provence-Alpes-Côte d''Azur|Nice',
      'FR|Occitanie|Toulouse','FR|Occitanie|Montpellier',
      'FR|Nouvelle-Aquitaine|Bordeaux','FR|Hauts-de-France|Lille',
      'FR|Grand Est|Strasbourg','FR|Pays de la Loire|Nantes',
      'BE|Bruxelles-Capitale|Bruxelles','CH|Genève|Genève','GB|England|London'
    ])[1 + floor(random() * 21)::int] as geo,
    (array[
      'mobile|iOS|Safari','mobile|iOS|Safari','mobile|iOS|Safari','mobile|iOS|Safari',
      'mobile|iOS|Safari','mobile|iOS|Safari','mobile|iOS|Chrome','mobile|iOS|Instagram',
      'mobile|Android|Chrome','mobile|Android|Chrome','mobile|Android|Chrome',
      'mobile|Android|Samsung Internet','desktop|Windows|Chrome','desktop|macOS|Safari',
      'tablet|iOS|Safari'
    ])[1 + floor(random() * 15)::int] as dev,
    -- Etiquettes REGIONALES, pas des codes de base : la edge function stocke le
    -- premier token brut d'Accept-Language, donc la vraie table contient
    -- 'fr-FR', 'fr', 'fr-fr' et 'fr-CA' comme quatre valeurs distinctes. Un pool
    -- de codes de base ('fr','en','es','it') rendait la demo trop propre et
    -- masquait le defaut d'agregation du portail.
    (array['fr-FR','fr-FR','fr-FR','fr-FR','fr-FR','fr-FR','fr','fr',
           'fr-fr','fr-FR','fr-CA','fr-FR','en-US','en-GB','es-ES','it-IT'])
      [1 + floor(random() * 16)::int] as lang,
    -- Pool de personnes plus petit que le nombre de scans → re-scans du soir.
    floor(random() * greatest(1, (s.n * 0.72)))::int as person
  from (
    select
      d.slug,
      d.night,
      greatest(0, round(
        d.base
        * case d.dow when 5 then 1.00   -- vendredi
                     when 6 then 1.15   -- samedi
                     when 4 then 0.55   -- jeudi
                     when 3 then 0.30
                     when 7 then 0.25   -- dimanche
                     else 0.15 end
        * d.growth
        * (0.7 + random() * 0.6)        -- bruit
      ))::int as n
    from (
      select c.slug,
             c.distributed_count / 120.0                          as base,
             (current_date - g)::date                             as night,
             extract(isodow from (current_date - g))::int          as dow,
             0.6 + 0.8 * (180 - g)::numeric / 180                  as growth
      from public.qr_campaigns c
      cross join generate_series(0, 179) g
      where c.slug like 'demo-%'
    ) d
  ) s
  cross join lateral generate_series(1, s.n)
  where s.n > 0
) x;


-- ── 4. Le tunnel ────────────────────────────────────────────────────────────
-- Volontairement emboîté : on ne peut envoyer le formulaire qu'après l'avoir
-- vu, et l'offre est atteinte surtout après envoi (+ 4 % qui filent direct).
-- Résultat : un tunnel décroissant, comme celui d'un vrai client.
with draws as materialized (
  -- MATERIALIZED est obligatoire : sans lui, Postgres peut inliner la CTE et
  -- réévaluer random() à chaque référence, ce qui casserait l'emboîtement et
  -- produirait plus d'envois que de vues.
  select s.campaign_slug, s.visitor_hash, s.scanned_at,
         random() as r_view, random() as r_sub, random() as r_off
  from public.qr_scans s
  where s.campaign_slug like 'demo-%' and s.is_bot = false
)
insert into public.funnel_events (campaign_slug, kind, visitor_hash, created_at)
  select campaign_slug, 'form_view', visitor_hash,
         scanned_at + (random() * 120) * interval '1 second'
  from draws
  where r_view < 0.62
union all
  select campaign_slug, 'form_submit', visitor_hash,
         scanned_at + (random() * 200) * interval '1 second'
  from draws
  where r_view < 0.62 and r_sub < 0.38
union all
  select campaign_slug, 'offer_reached', visitor_hash,
         scanned_at + (random() * 260) * interval '1 second'
  from draws
  where (r_view < 0.62 and r_sub < 0.38 and r_off < 0.88)
     or (r_view >= 0.62 and r_off < 0.04);


-- ── 5. Les contacts captés ──────────────────────────────────────────────────
-- Un lead par envoi de formulaire. L'index unique (campaign_slug, email) est
-- respecté grâce au compteur dans l'adresse.
insert into public.leads
  (campaign_slug, first_name, last_name, email, phone, first_seen_at, last_activity_at)
select
  f.campaign_slug,
  fn.v,
  ln.v,
  lower(
    translate(fn.v || '.' || ln.v, 'éèêëàâäïîôöùûüçÉÈÊÀÂÎÔÙÇ', 'eeeeaaaiioouuucEEEAAIOUC')
  ) || row_number() over () || '@example.test',
  '+336' || lpad(floor(random() * 100000000)::bigint::text, 8, '0'),
  f.created_at,
  f.created_at
from public.funnel_events f
cross join lateral (
  select (array['Camille','Léa','Hugo','Manon','Nathan','Chloé','Enzo','Jade',
                'Louis','Emma','Rayan','Inès','Théo','Sarah','Malik','Anaïs'])
         [1 + floor(random() * 16)::int] as v
) fn
cross join lateral (
  select (array['Martin','Bernard','Dubois','Petit','Durand','Leroy','Moreau',
                'Simon','Laurent','Michel','Garcia','Roux','Fontaine','Chevalier'])
         [1 + floor(random() * 14)::int] as v
) ln
where f.campaign_slug like 'demo-%' and f.kind = 'form_submit'
on conflict (campaign_slug, email) do nothing;


-- ── 6. Rattacher les comptes portail de test au sponsor de démo ─────────────
-- must_change_password est REMIS À PLAT ici, pas seulement le contact. Les deux
-- comptes ont un rôle fixe : `portail-e2e@` reste bloqué sur l'écran de
-- changement de mot de passe (c'est ce que teste auth.spec.ts), `portail-e2e-ok@`
-- est déjà passé et sert à atteindre le tableau de bord. Sans cette ligne le
-- drapeau dérive dès qu'on se connecte manuellement avec l'un d'eux, et le test
-- E2E échoue sur un état de données, pas sur une régression du code.
update public.client_accounts ca
set contact_id = c.id,
    display_name = case
                     when ca.email = 'portail-e2e@cupdom-test.invalid'
                     then 'Démo Nightlife (mdp temporaire)'
                     else 'Démo Nightlife'
                   end,
    must_change_password = (ca.email = 'portail-e2e@cupdom-test.invalid')
from public.contacts c
where c.company = 'Démo Nightlife'
  and ca.email in ('portail-e2e-ok@cupdom-test.invalid',
                   'portail-e2e@cupdom-test.invalid');


-- ── 7. Vérification : ce que le portail va afficher ─────────────────────────
select
  c.slug,
  c.venue,
  c.distributed_count                                as distribues,
  count(*) filter (where not s.is_bot)               as scans,
  count(distinct s.visitor_hash) filter (where not s.is_bot) as personnes,
  count(*) filter (where s.is_bot)                   as bots_exclus,
  (select count(*) from public.leads l where l.campaign_slug = c.slug) as contacts,
  c.invested_amount_eur                              as investi_eur
from public.qr_campaigns c
left join public.qr_scans s on s.campaign_slug = c.slug
where c.slug like 'demo-%'
group by c.slug, c.venue, c.distributed_count, c.invested_amount_eur
order by scans desc;
