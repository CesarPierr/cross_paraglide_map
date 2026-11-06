# Véracité et réécriture des éléments — lot devoluy_gap_buech_diois

6 novembre 2026. Les 356 éléments du lot ont été vérifiés contre leurs sources : Dévoluy 34 (agent précédent, repris tel quel), Champsaur-Valgaudemar 54, Gapençais-Céüse 40, Buëch-Laragne-Chabre 83, Baronnies 59, Diois 86. 345 ont été réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`. Seuls `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Les constats sont dans `veracite_elements_devoluy_gap_buech_diois.json`, un objet par constat.

## Méthode

- Sources relues dans `.cache/research/docs/` :
  - les fiches fédérales, par fusion des récoltes (`ffvl_lot.json`, `ffvl_sites_alpes.json`, `ffvl_full.json`), tronquées à 600 caractères ;
  - les pages du Vol libre diois, d'Air Buëch, de Différen'ciel et de flylaragne ;
  - les fils parapentiste.info et la base du CHVD ;
  - les légendes des diaporamas Briffe, extraites des fichiers pptx. Les schémas eux-mêmes n'ont pas été rouverts, sauf ce qu'en dit le champ `figures`.
- Lus en ligne, faute de cache : S15, S27, S30, S32, S34, S36, S37, S39, S42 (fiche de Rabou, plan et texte en partie tournés), et la page 25 du fil S185 (réponses 25 à 30, qui documentent Chabre, Beaumont, Orpierre, Rosans).
- Aucune page bloquée n'a été contournée. Les fiches fédérales derrière Cloudflare n'ont pas été rouvertes. ParaglidingEarth est hors ligne (« We are preparing the new ParaglidingEarth »).
- Les pourcentages kk7 des 33 points chauds portant `S211` ont été recalculés sur `sources/kk7/`. Ils sont conformes à l'arrondi près. Une erreur de note a été corrigée à Saint-Hippolyte.

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 109 |
| NON SOURCÉ | 39 |
| NON VÉRIFIABLE | 14 |
| CONTREDIT | 6 |
| INVRAISEMBLABLE | 2 |
| **Total** | **170**, sur 154 éléments |

Les 202 autres éléments sont CONFIRMÉS. Par massif : Buëch 37, Champsaur 31, Diois 30, Baronnies 28, Dévoluy 24, Gapençais 20.

## Les constats les plus graves

1. **Deux terrains interdits présentés comme atterrissages.**
   - Montmaur-en-Diois (S102) et Les Jonchiers à Beauvoisin (S139) portent « pratique strictement interdite » : le texte disait l'inverse.
   - Les Gorges (S157), interdit du 1er juin au 15 novembre, était décrit sans réserve.
2. **Un terrain à éviter présenté comme atterrissage intermédiaire.** Les Guards à Nyons (S134) est un terrain de secours « à éviter à tout prix en aérologie alimentée ».
3. **Une phrase de sécurité inversée.** Pour Aspres, le texte écrivait « quand il n'y a pas de nord météo », alors que S186 conseille la montagne d'Oule justement par vent du nord.
4. **Un plafond réglementaire déplacé.** La R196B monte au FL125. Le FL115 est la limite générale du Diois, et le texte l'attribuait à la R196B.
5. **Des mots mal lus.**
   - « Col naturel » était devenu « naturellement sous le vent » au Rousset.
   - « Ça va monter plus fort » au Duffre parle du sentier, pas de l'air.
   - « Spine back » (crête en échine) était devenu « dos à la voile » à Chabre.
   - « Brise ronflante » (forte) était devenue « bruyante » au Valgaudemar.
   - L'approche en U à gauche à Lesches est celle des ULM, pas celle des parapentes.
6. **Des lieux déplacés.**
   - Le posé « contré par la brise » était donné à Chorges : il est à Thorame (S207, manche 5).
   - Les 500 m du « bottom landing » de Chabre étaient donnés au camping : ils désignent le Poisson.
   - Le plafond de Beaumont était placé au Suillet.
   - Les 4 km vers l'ouest du Colombier étaient placés à la Porte Sereine.
7. **Une distance d'atlas et une heure de course devenues des faits.** « 40,7 km » et « neuf balises » pour la WaterFly 2026 : la page donne sept balises, sans distance. « Avant 17h » est le départ de l'épreuve de canoë de la WaterFly 2025.
8. **Une question et une plaisanterie de forum devenues des faits.**
   - « Le fond de vallée entre Serres et Aspres » est une question sans réponse.
   - La « rue de nuages » de Beaumont à Nyons est une plaisanterie.
   - L'arrivée aux Richards est un projet : le groupe a reposé après une heure.
9. **Des règles, statuts ou conseils manquants.**
   - Les Richards : labellisé selon le club, privé et non conventionné selon la fiche.
   - Milmandre : autorisation systématique du club.
   - Arfuyen : interdit en période de chasse.
   - Vieux Chaillol : vol au sommet du 1er mai au 31 octobre (message de 2021).
   - Rabou : terrain toléré, dangereux quand l'orientation bascule de nord-ouest à nord.
10. **Des chiffres et des usages inventés.**
    - « 11h-15h » à Chabre et « 12h-17h » à la Longeagne sont des valeurs par défaut.
    - Grenoble « à 50 km » d'Aspres : environ 74 km sur l'atlas.
    - La « magic Longeagne » n'est pas le nom de la convergence.
    - Les usages des convergences (cumulus, repères, ascendance) étaient déduits de flèches.

## Champs structurés à corriger (non modifiés)

- **Vitesses déduites** : presque toutes les brises du lot (`speed_kmh`), notamment `brise-durance-tallard` et `brise-buech`, étendues de la cluse de Sisteron.
- **Heures par défaut ou sans source** :
  - `brise-buech.hours` ; `brise-pente-ceuse-sud.hours` ; `best_hours` de `falaise-ceuse`, `therm-malaup`, `therm-bure-gap`, `therm-chabre-crete`, `therm-longeagne`, `therm-glandasse-sud` ;
  - `therm-petite-ceuse-deco.best_hours`, `therm-villefranche-declenchements.best_hours`, `grun-de-saint-maurice-relance.best_hours` (≈16h) ;
  - au Dévoluy : `therm-bure-sud`, `therm-faisses`, `therm-chauvet-festre`.
- **Conditions** : `champsaur-patous` (Orcières, été) ; `ceuse-no-sous-le-vent` (vent de sud) ; `st-genis-combe-ouest-degueulante` (brise d'ouest) ; `pontias` (hours, season).
- **Orientations** : `les-richards` (N, défavorable sur la fiche 110) ; `col-des-faisses`.
- **Sources à ajouter** : FFVL 110 et 111 pour les éléments des Richards ; page « faune aérienne » du Vol libre diois pour `therm-clamontard-vautours` et `diois-vautours-rousset` ; S183 pour le Chauvet.
- **Sources ou altitudes à revoir** : `la-buc` (965 m avec la fiche 211, qui donne 851 m) ; `richards-atterro-pge.alt_m` (1100, fiche : 1141).
- **Noms** : `lan/mereuil` « Mévreuil » pour Mereuil.
- **Trigger** : `therm-duffre-sud-est-matin` (« montée par la crête »).
- **Waypoints** : `xc-richards-savines` (Orcières, Chorges, tracé de l'atlas).
- **Catégorie landing à revoir** : `la-montmaur`, `la-beauvoisin`, `veynes-vallee`, `sigoyer`.
- **`distance_km: 0`** sur quatre itinéraires du Diois.

## Hors périmètre

- Champsaur : conseil 8 et visite étape 8, « brise bruyante ».
- Gapençais :
  - résumé, conseil 1, effets 2 à 4, visite étapes 4 et 13 : Rabou, à reprendre avec la fiche S42 (bascule vers le nord, terrain toléré) ;
  - visite : altitudes de baptême et circuit de 44 km déjà relevés par l'audit des lots 7-12.
- Buëch : visite étape 14, « dos à la voile » ; visite étape 15, « le classique » d'Aspres, à dire comme un plan.
- Baronnies : visite étape 14, « rue de nuages » ; résumé, fin d'après-midi à Buc (audit 7-12).
- Dévoluy : les constats du résumé, des conseils et des visites de l'audit 7-12 restent à traiter.

## Ce qui n'a pas pu être vérifié

- **Fiches absentes de la récolte, derrière Cloudflare** : 14273 (Céüse NO), 14261 (Chabestan), 955 (Sahune), 141, 2340, 674 (Nyons, col d'Ey, Tarendol), 693, 694, 13656, 699, 5103, 5182 (Glandasse, L'Abel, Baise, Aup, Rousset, Garandons). Leurs textes sont conservés, sans chiffres nouveaux.
- **Fiches tronquées** : barbelés et ligne du Puy de Manse (S156), mistral à Aspres (S21), règle du vol vers Savoillan au Ventoux (S227).
- **Pages disparues** : tichodromes.org/couspeau (S33) et les fiches ParaglidingEarth.
- **Identités** : Garandons et atterrissage de Chamaloc ; « Colmar » de S85, lu Colmars-les-Alpes.
- **Valeurs de S85** : la page date d'environ 2005.
- **Période de vol du Vieux Chaillol** : message de 2021, à revérifier auprès du Parc.

## Contrôles

- `text_audit.py devoluy_gap_buech_diois` : 0 erreur, 0 attribution, aucun texte trop long. Il reste 20 avertissements « chiffres repris d'une source », tous dans des passages consignés ici.
- `text_fidelity.py` : 40 points, tous relus et justifiés :
  - des noms retirés avec une erreur (Chorges, Valgaudemar pour le parc, Lesches, Ribiers, Durance au Duffre) ;
  - des noms repris ailleurs dans l'élément ;
  - des directions tirées de la source (Rabou, Col d'Ey, La Faurie, Chevalet).
- `npm run data:build -- --check` : réussi (code 0).
