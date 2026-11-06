# Champs structurés corrigés — brianconnais_ecrins_queyras_ubaye

6 novembre 2026. 60 changements sur 41 éléments, chacun dans `champs_structures_brianconnais.json` (avant, après, source, raison). Aucune coordonnée n'a bougé, aucun id n'a été renommé, aucun élément ajouté ni retiré.

| Champ | Changements |
|---|---|
| `note` (suit un champ corrigé, ou dit une estimation) | 11 |
| `distance_km` | 10 (9 retirées, 1 corrigée : 138 km) |
| `hours` | 9 |
| `best_hours` | 8 (5 retirés) |
| `speed_kmh` | 6 |
| `trigger` | 6 (1 retiré) |
| `conditions` | 4 |
| `status` | 2 |
| `possible`, `name`, `wind_dirs`, `alt_m` | 1 chacun |

## Ce que le modèle lit

Fenêtres calculées avec une copie de `parseHours`, avant → après. Le score du modèle n'a pas été relancé.

| Élément | Avant | Après |
|---|---|---|
| `brise-durance-basse-guisane` | 10h-16h30 | 11h-16h30 |
| `transfert-lautaret-guisane` | 8h-10h30 | 8h-11h30 |
| `brise-descendante-vallouise` | 19h30-9h | 20h30-9h30 |
| `brise-durance` (Serre-Ponçon) | 12h-18h | 12h30-18h30 |
| `tempete-avant-orage-durance` (`conditions`) | 12h30-18h30 | aucune |
| `cb-pelvoux` (`conditions`) | 12h30-18h30 | aucune |
| `chabrieres-degueulante-brise-gap` (`conditions`) | 12h30-18h30 | aucune, flux de sud cité |
| `embrun-atterro-brise` (`conditions`) | 15h-19h | 12h30-20h30 |

- Vitesse du modèle changée sur une seule brise : `brise-descendante-vallouise`, 20 → 8 km/h (valeur par défaut). Les autres gardent leur typique, seul le maximum change.
- Fenêtre inchangée, texte seul : `brise-pente-puy-aillaud`, `brise-fournel`, `brise-freissinieres`, `brise-guil`, `brise-matinale-descendante-ubaye`.
- `best_hours`, lu par le contrôle des thermiques (12h-15h si absent) : `pentes-se-puy-aillaud`, `therm-conf-saint-chaffrey`, `therm-galibier-pente-herbeuse` ; retirés sur `therm-arete-clement-risoul`, `therm-aquila-rocher-sud`, `thermiques-mont-guillaume`, `therm-blanche-pic-des-tetes`, `therm-colombis-relance`.
- La Romanche et la Durance se chevauchent 30 minutes en Guisane (11h-11h30), sous le seuil d'une heure du contrôle des brises opposées.

## Estimations gardées, dites en note

- Vitesse typique sans mesure : `brise-durance-basse-guisane`, `brise-durance-embrun-briancon`, `brise-durance`, `lombarde-montgenevre`, `brise-montante-gyronde`, `brise-ubaye`, `brise-matinale-descendante-ubaye`.
- Heures : `transfert-lautaret-guisane`, `brise-descendante-vallouise`, `brise-fournel`, `brise-freissinieres`, `brise-guil`.
- Le maximum de 40 km/h de `brise-durance` vient de Sisteron (HS15), hors du massif : gardé, dit en note.

## Statuts

- `atterro-orres-pente-ecole` : `non-confirme` (S68 connue par la seule note de collecte).
- `atterro-telecabine-prorel-interdit` : `interdit`.
- Sans statut, parce que l'interdiction est datée ou conditionnelle et que le texte le dit : `atterro-saint-ours` (15 mai-15 septembre), `atterro-larche-plage` (autorisation du club), `atterro-halte-2000`, `atterro-chamousses`, `atterro-st-vincent-plage`.

## À décider

- Fusion de `atterro-hippodrome` et `atterro-la-chaup`, même terrain.
- `soaring-seolanes` : S82 décrit un vol d'école le long des falaises, pas du soaring. À retirer ou à reclasser.
- Statut de `atterro-saint-ours` : quatre mois d'interdiction en pleine saison. `SiteStatus` n'a pas de valeur saisonnière.
- Ids trompeurs, non renommés : `therm-galibier-pente-herbeuse`, `therm-serre-chevalier-est-matin`.

## Rien à corriger

- `clocher-saint-clement-pentes-ouest.best_hours` : le rapport de véracité le cite pour « fin d'après-midi », mais le champ porte déjà les valeurs kk7, sans cette mention.

## Non vérifié

- HS18 hors cache ; S68 derrière Cloudflare ; fiche S90 lue en extrait seulement.
- Fiches fédérales non ouvertes dans le navigateur : aucune n'aurait changé une décision.
- `best_hours`, `trigger`, `season` absents des rapports : pas relus. Exception : `therm-colombis-relance.best_hours`, retiré faute de source.
- `model:check` non relancé sur ces données ; interface non ouverte.
