# Validation du modèle : banc de rétro-prévision

*Révision notée : `edb11ebab`. Résultats agrégés : [`validation/results-edb11ebab.json`](validation/results-edb11ebab.json), tous les tableaux : [`validation/tables-edb11ebab.md`](validation/tables-edb11ebab.md).*

Le banc compare le modèle CPU aux vents mesurés à 10 m sur 28 jours de 2025 et 75 postes, soit 24 938 échantillons horaires. Il se relance en 30 s et note n'importe quelle révision.

## 1. Ce que montre le banc

**Le double compte de la brise, celui qu'on soupçonnait, est négligeable.** En fond de vallée, l'après-midi d'une journée de brise, les niveaux bas d'AROME n'ajoutent que +0,4 km/h de biais (IC 5–95 % : +0,1 à +0,8), et +0,6 km/h dans les grandes vallées (+0,2 à +1,2). Le modèle n'en garde que 26 % à ce niveau : le vent du sondage vers l'amont vaut +2,2 km/h, sa part synoptique +0,7 km/h.

**Le surplus des grandes vallées vient des brises du modèle lui-même.** Le long de ces vallées, l'observation donne +6,6 km/h vers l'amont et AROME 10 m +6,7 km/h, mais les brises du modèle +15,2 km/h. Le biais en vitesse est déjà de +5,7 km/h sans les couches (+6,3 avec).

**Le double compte du frottement existe, par vent fort, en fond de vallée et en plaine.** Les couches y font passer le biais de +1,6 à −5,3 km/h en fond de vallée, et de +0,9 à −7,6 en plaine ; AROME 10 m reste à +0,7 et +0,3. Sur les pentes, les sommets et les balises, les couches corrigent au contraire un net excès du vent de crête.

**Le défaut le plus rentable est ailleurs : les brises documentées ignorent la saison et les nuages.** Elles soufflent à leur vitesse documentée en hiver et sous ciel couvert. Dans les grandes vallées, par journée stable d'hiver, le biais est de +6,8 km/h avec l'atlas et de −2,4 sans. Un correctif d'une ligne (§ 6, P1) est le changement à essayer en premier.

**AROME 10 m brut bat le modèle dans presque toutes les cases :** RMSE vitesse 6,2 contre 9,8 km/h, RMSE vectoriel 9,6 contre 13,3, erreur de direction 36° contre 48°, classes de vol justes 80 % contre 67 %. Cette comparaison ne vaut qu'à 10 m. Elle ne dit rien de l'altitude de vol, que le banc ne mesure pas.

### Effet des couches, par cadre et par régime

Écart de biais couches − crêtes (km/h), et biais des couches entre parenthèses.

| Cadre | Brise matin | Brise après-midi | Vent modéré | Vent fort |
|---|--:|--:|--:|--:|
| Fond de vallée | 0,0 (+0,1) | +0,4 (+1,7) | −0,6 (−0,1) | **−6,8 (−5,3)** |
| Pente | −0,2 (−2,3) | +0,3 (−4,1) | −3,1 (−0,7) | −9,0 (−3,7) |
| Sommet, col, plateau | 0,0 (−1,6) | +1,5 (−0,1) | −2,7 (−0,2) | −7,2 (+5,7) |
| Plaine | +1,0 (−4,5) | +1,8 (−4,0) | −1,5 (−4,8) | **−8,5 (−7,6)** |
| Balise de décollage | −0,4 (−0,1) | +1,1 (+1,5) | −3,4 (+3,0) | −12,7 (+4,2) |

## 2. Données et licences

- **Observations Météo-France** : « Données climatologiques de base – horaires » (meteo.data.gouv.fr), Licence Ouverte Etalab 2.0. Vent moyen sur 10 min à 10 m (FF, DD), rafale (FXI), en UTC. Départements 01, 04, 05, 06, 26, 38, 73, 74, 84. Les valeurs de code qualité 2 (« douteuse ») sont écartées.
- **Balises Pioupiou / OpenWindMap** : licence *Community*, sans inscription, usage libre avec attribution, et mêlable à d'autres capteurs si ceux-ci sont ouverts (c'est le cas de Météo-France). Wind data (c) contributors of the OpenWindMap wind network, <https://openwindmap.org>. Moyenne des 10 minutes avant l'heure. Mât bas, de hauteur variable : elles sont notées à part.
- **Prévisions archivées** : Open-Meteo Historical Forecast API, CC BY 4.0, Weather data by Open-Meteo.com. Sondages avec le modèle et les variables de l'app (`meteofrance_seamless`, `cell_selection=nearest`, 49 variables, maille 0,25°). AROME brut : `meteofrance_arome_france`, vent à 10 m à la position du poste. Aucune valeur manquante sur les 1 020 fichiers de sondage. L'API n'indique pas le modèle source par heure : sur une fenêtre contrôlée (45,0 N, 6,25 E, juillet), `meteofrance_seamless` est identique à AROME France ; les autres fenêtres n'ont pas été contrôlées une à une.
- **Volume** : environ 190 Mo de données brutes sous `.cache/validation/` (non versionné), environ 6 400 appels pondérés Open-Meteo à 75 par minute (85 min de téléchargement, une seule fois). Seuls des agrégats sont versionnés.

Les archives sont demandées en UTC : Open-Meteo applique un seul décalage horaire à toute une réponse, faux en été quand on interroge en hiver avec `Europe/Paris`.

## 3. Postes et jours

**75 postes** : 35 fonds de vallée (dont 17 de grandes vallées), 13 pentes, 11 sommets, cols ou plateaux, 6 plaines, 10 balises à moins de 1 km d'un décollage de l'atlas. Par région : Avant-pays 4, Bauges, Bourget, Combe de Savoie 6, Briançonnais, Écrins, Queyras, Ubaye 8, Alpes de Haute-Provence, Alpes-Maritimes 12, Dévoluy, Gapençais, Buëch, Baronnies, Diois 11, Oisans, Maurienne, Arves 5, Grenoble, Vercors, Trièves, Matheysine 5, Chartreuse, Grésivaudan, Belledonne 5, Tarentaise, Vanoise 6, Mont-Blanc, Val d’Arly, Beaufortain 4, Haute-Savoie nord 7, Annecy, Bornes, Aravis 2.

Choix : au moins 70 % des heures notées, écart d'altitude poste − maille inférieur à 300 m, 8 km entre postes, au plus 2 par région et par cadre (3 pour les grandes vallées), 10 balises en tout.

Cadre, tiré du MNT à la maille du poste, avec `rel` = (altitude − fond) / profondeur de vallée :

| Cadre | Règle, dans cet ordre |
|---|---|
| Plaine | profondeur < 300 m et pente < 6° |
| Sommet, col, plateau | `rel` ≥ 0,7 ou TPI ≥ 100 m |
| Fond de vallée | `rel` ≤ 0,25 et pente < 12° ; « grande vallée » si `valley` ≥ 0,5 |
| Pente | le reste |

Les balises forment leur propre groupe. La liste complète, avec altitudes et profondeurs, est dans le fichier de résultats.

**28 jours de 2025**, choisis par une règle déterministe sur le vent de crête et la nébulosité archivés en 4 points (nord, ouest, sud intérieur, sud), de 6 h à 17 h UTC, avec 3 jours d'écart au moins :

- **Brise** : 2 jours par mois d'avril à septembre (1 seul en mai, faute de candidat assez espacé), vent de crête moyen < 13 km/h et nébulosité < 40 %.
- **Modéré** : 20–35 km/h, 2 jours par secteur (nord, sud, ouest).
- **Fort** : 2 jours chacun pour bise, sud, ouest, mistral.
- **Stable** : 3 jours d'hiver, vent < 15 km/h et gradient < 4,5 °C/km. L'année n'en offrait que 4 ; il en manque 1 à la cible à cause de l'écart de 3 jours.

| Date | Cas | Crête km/h | Secteur | Nuages | Gradient °C/km | Pli |
|---|---|--:|--:|--:|--:|---|
| 2025-01-10 | ouest-fort | 55,6 | 308° | 97 % | 3,5 | A |
| 2025-01-27 | foehn-sud | 48,5 | 203° | 99 % | 5 | B |
| 2025-02-05 | stable-hiver | 14,3 | 54° | 1 % | 4,3 | A |
| 2025-02-14 | bise | 48,6 | 352° | 18 % | 4,8 | A |
| 2025-03-06 | modere-sud | 27,4 | 139° | 36 % | 6,6 | A |
| 2025-03-13 | modere-ouest | 26,3 | 235° | 68 % | 7,1 | B |
| 2025-03-20 | modere-sud | 27,8 | 204° | 38 % | 6,7 | A |
| 2025-03-31 | bise | 37 | 13° | 2 % | 4,5 | B |
| 2025-04-05 | brise-04 | 8,7 | 15° | 4 % | 7,2 | A |
| 2025-04-30 | brise-04 | 9,2 | 94° | 2 % | 8 | B |
| 2025-05-30 | brise-05 | 7,7 | 318° | 3 % | 6,7 | A |
| 2025-06-02 | modere-ouest | 26,6 | 235° | 95 % | 7 | B |
| 2025-06-09 | brise-06 | 7,7 | 297° | 7 % | 4,9 | B |
| 2025-06-29 | brise-06 | 7,5 | 193° | 5 % | 7,6 | A |
| 2025-07-11 | brise-07 | 7,9 | 306° | 0 % | 7,5 | B |
| 2025-07-17 | modere-nord | 27,6 | 344° | 7 % | 6,6 | A |
| 2025-07-30 | brise-07 | 9,2 | 272° | 13 % | 7,8 | A |
| 2025-08-11 | brise-08 | 9 | 170° | 5 % | 8,2 | B |
| 2025-08-18 | brise-08 | 7,5 | 277° | 6 % | 7,9 | A |
| 2025-09-18 | brise-09 | 11,3 | 316° | 7 % | 5,2 | B |
| 2025-09-29 | brise-09 | 8,2 | 330° | 6 % | 5,2 | A |
| 2025-10-06 | modere-nord | 27,6 | 8° | 3 % | 3,4 | B |
| 2025-10-24 | mistral | 38,9 | 297° | 30 % | 6 | A |
| 2025-10-27 | ouest-fort | 55,6 | 315° | 73 % | 3,8 | B |
| 2025-11-14 | foehn-sud | 47,7 | 184° | 94 % | 7,2 | A |
| 2025-11-18 | stable-hiver | 14,7 | 346° | 10 % | 3,4 | B |
| 2025-12-07 | mistral | 42,1 | 315° | 99 % | 4,8 | B |
| 2025-12-24 | stable-hiver | 13,2 | 69° | 43 % | 4,1 | A |

**Situation de chaque heure**, lue au sondage du poste :

| Situation | Règle |
|---|---|
| `fort` | vent de crête ≥ 40 km/h |
| `modere` | 20–40 km/h |
| `stable` | jour stable d'hiver, vent < 20 km/h |
| `calme-couvert` | vent < 20 km/h, nébulosité ≥ 60 % |
| `brise-matin` | sinon, 8–12 h |
| `brise-aprem` | sinon, 13–19 h |

## 4. Méthode

Pour chaque jour, chaque heure de 8 h à 19 h (heure légale) et chaque poste, `scripts/validation/evaluate.ts` construit les paramètres comme l'app : la réponse archivée passe par le vrai `openMeteo.synoptic` (fetch local), puis par `forecastAir`. Le modèle est évalué à `{ mode: 'agl', meters: 10 }` sur la maille du poste, avec l'atlas de la révision. Le sondage est celui de la maille 0,25° du poste, comme si la vue était centrée sur lui.

| Variante | Ce qui change |
|---|---|
| `layers` (i) | le modèle tel que l'app l'utilise |
| `ridge` (ii) | vent de crête seul, sans couches |
| `arome10` (iii) | AROME brut à 10 m, sans modèle |
| `sounding` | vent du sondage à l'altitude du poste, sans relief |
| `centre` | un seul sondage pour toute la carte (45,0 N, 6,25 E) |
| `envelope` | sous l'enveloppe des crêtes, le vent à l'enveloppe : séparation d'échelles émulée |
| `noBreeze`, `breeze50`, `calm` | brises à 0 ou à 50 %, ou vent météo nul |
| `noAtlas`, `noHazard` | sans atlas, ou sans ses dangers |

Métriques : biais et RMSE de vitesse, RMSE vectoriel, erreur de direction (observé ≥ 2 m/s), classes ≤ 15, 15–25, > 25 km/h. Les intervalles sont des 5–95 % par rééchantillonnage de jours entiers. La réduction du vent synoptique près du sol reste celle de `field.ts`.

## 5. Résultats

Cellules : biais / RMSE vitesse / RMSE vectoriel (km/h) / direction / classes justes.

### Cadre × situation

| setting | situation | n | obs km/h | layers biais / RMSE / vect. / dir / ok | ridge biais / RMSE / vect. / dir / ok | arome10 biais / RMSE / vect. / dir / ok |
|---|---|--:|--:|--:|--:|--:|
| fond | brise-matin | 2031 | 5,3 | +0,1 / 6,5 / 9,1 / 53° / 90 % | +0,1 / 6,4 / 9,2 / 61° / 90 % | -0,8 / 3,6 / 5,6 / 40° / 97 % |
| fond | brise-aprem | 2795 | 10,8 | +1,7 / 8,9 / 13,3 / 43° / 57 % | +1,3 / 8,6 / 13,2 / 46° / 59 % | -1,3 / 4,7 / 8,1 / 31° / 82 % |
| fond | calme-couvert | 626 | 7,8 | +2,5 / 10,1 / 13,5 / 44° / 66 % | +2,7 / 9,1 / 13,0 / 49° / 67 % | -0,4 / 4,6 / 7,5 / 34° / 87 % |
| fond | modere | 3195 | 8,3 | -0,1 / 9,5 / 13,3 / 57° / 70 % | +0,5 / 8,0 / 12,7 / 65° / 77 % | -0,0 / 5,1 / 8,4 / 38° / 85 % |
| fond | fort | 2156 | 11,6 | -5,3 / 11,2 / 14,3 / 50° / 63 % | +1,6 / 9,4 / 15,6 / 57° / 56 % | +0,7 / 6,4 / 9,6 / 30° / 74 % |
| fond | stable | 919 | 7,3 | +1,6 / 12,1 / 14,8 / 66° / 66 % | +1,6 / 11,6 / 14,6 / 70° / 68 % | -2,0 / 6,2 / 7,8 / 33° / 89 % |
| pente | brise-matin | 799 | 6,7 | -2,3 / 6,7 / 8,3 / 55° / 92 % | -2,1 / 6,2 / 8,8 / 68° / 93 % | -1,1 / 4,4 / 7,6 / 45° / 93 % |
| pente | brise-aprem | 1063 | 10,0 | -4,1 / 7,8 / 10,2 / 52° / 77 % | -4,4 / 8,1 / 11,3 / 65° / 77 % | -1,4 / 5,0 / 8,5 / 36° / 83 % |
| pente | calme-couvert | 383 | 9,5 | -3,7 / 7,7 / 11,0 / 61° / 79 % | -2,6 / 7,5 / 11,4 / 66° / 78 % | +1,1 / 5,6 / 11,3 / 48° / 78 % |
| pente | modere | 1048 | 10,1 | -0,7 / 9,0 / 11,9 / 49° / 67 % | +2,4 / 8,5 / 13,9 / 59° / 61 % | +1,6 / 7,3 / 11,8 / 44° / 69 % |
| pente | fort | 691 | 17,8 | -3,7 / 15,8 / 18,2 / 36° / 47 % | +5,3 / 16,1 / 22,0 / 44° / 33 % | -0,2 / 9,0 / 12,8 / 25° / 60 % |
| pente | stable | 364 | 6,7 | -2,7 / 7,0 / 8,8 / 59° / 88 % | -1,9 / 6,5 / 9,2 / 57° / 89 % | -1,0 / 5,3 / 8,4 / 49° / 88 % |
| sommet | brise-matin | 660 | 6,9 | -1,6 / 5,5 / 9,2 / 65° / 91 % | -1,6 / 5,6 / 9,5 / 69° / 91 % | -2,5 / 5,4 / 8,4 / 61° / 90 % |
| sommet | brise-aprem | 830 | 10,5 | -0,1 / 8,4 / 11,8 / 44° / 66 % | -1,6 / 9,1 / 12,8 / 54° / 64 % | -3,2 / 6,3 / 9,4 / 38° / 76 % |
| sommet | calme-couvert | 309 | 13,9 | -5,9 / 13,2 / 16,7 / 52° / 60 % | -5,4 / 12,4 / 15,7 / 49° / 61 % | -3,9 / 10,0 / 16,3 / 54° / 65 % |
| sommet | modere | 1059 | 13,2 | -0,2 / 10,3 / 16,5 / 54° / 53 % | +2,5 / 10,0 / 17,4 / 56° / 43 % | -2,7 / 8,4 / 14,0 / 44° / 65 % |
| sommet | fort | 390 | 16,4 | +5,7 / 17,0 / 23,8 / 49° / 36 % | +12,9 / 20,0 / 29,0 / 59° / 26 % | -4,0 / 11,5 / 16,2 / 41° / 56 % |
| sommet | stable | 327 | 6,4 | -0,5 / 8,0 / 10,5 / 69° / 84 % | +0,1 / 7,7 / 10,9 / 68° / 83 % | -2,3 / 6,1 / 8,1 / 48° / 91 % |
| plaine | brise-matin | 278 | 9,6 | -4,5 / 7,0 / 8,8 / 40° / 87 % | -5,5 / 8,4 / 10,4 / 58° / 87 % | +0,3 / 4,8 / 6,8 / 25° / 85 % |
| plaine | brise-aprem | 416 | 12,2 | -4,0 / 8,2 / 10,6 / 32° / 63 % | -5,7 / 9,5 / 13,2 / 62° / 66 % | +0,3 / 4,0 / 6,6 / 19° / 82 % |
| plaine | calme-couvert | 37 | 8,6 | -3,1 / 5,1 / 6,9 / 37° / 92 % | -2,0 / 4,7 / 9,2 / 63° / 89 % | +0,2 / 3,7 / 6,2 / 26° / 86 % |
| plaine | modere | 461 | 13,5 | -4,8 / 9,5 / 11,4 / 30° / 62 % | -3,3 / 10,7 / 16,4 / 59° / 64 % | +0,3 / 4,8 / 7,7 / 20° / 86 % |
| plaine | fort | 729 | 18,8 | -7,6 / 12,6 / 14,8 / 25° / 46 % | +0,9 / 14,5 / 20,6 / 40° / 31 % | +0,3 / 6,6 / 9,4 / 19° / 75 % |
| plaine | stable | 95 | 20,4 | -14,5 / 17,3 / 17,9 / 24° / 28 % | -16,8 / 20,1 / 22,2 / 73° / 28 % | +3,1 / 8,3 / 9,3 / 10° / 73 % |
| balise | brise-matin | 551 | 6,4 | -0,1 / 5,5 / 8,6 / 51° / 91 % | +0,3 / 5,6 / 9,3 / 64° / 91 % | -1,7 / 4,9 / 7,0 / 44° / 93 % |
| balise | brise-aprem | 756 | 11,1 | +1,5 / 7,3 / 11,7 / 39° / 63 % | +0,4 / 7,5 / 12,4 / 47° / 65 % | -2,0 / 6,0 / 9,7 / 39° / 75 % |
| balise | calme-couvert | 168 | 8,9 | +1,3 / 7,5 / 12,9 / 62° / 74 % | +2,2 / 7,6 / 14,0 / 70° / 73 % | -1,2 / 5,7 / 10,8 / 55° / 80 % |
| balise | modere | 871 | 11,1 | +3,0 / 11,0 / 15,5 / 51° / 54 % | +6,4 / 13,1 / 19,2 / 60° / 35 % | -2,2 / 7,5 / 11,3 / 45° / 75 % |
| balise | fort | 679 | 16,7 | +4,2 / 13,9 / 18,9 / 37° / 44 % | +16,9 / 22,9 / 29,8 / 41° / 34 % | -1,1 / 11,1 / 14,8 / 30° / 50 % |
| balise | stable | 252 | 7,1 | +1,0 / 8,4 / 11,2 / 45° / 77 % | +1,4 / 8,3 / 11,6 / 53° / 77 % | -2,7 / 6,4 / 8,4 / 51° / 89 % |

### Variantes de diagnostic

| setting | situation | n | obs km/h | envelope biais / RMSE / vect. / dir / ok | noBreeze biais / RMSE / vect. / dir / ok | calm biais / RMSE / vect. / dir / ok | centre biais / RMSE / vect. / dir / ok | sounding biais / RMSE / vect. / dir / ok |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| fond | brise-matin | 2031 | 5,3 | +0,1 / 6,3 / 9,1 / 60° / 90 % | -3,9 / 5,8 / 6,8 / 70° / 96 % | -0,5 / 6,8 / 9,2 / 59° / 89 % | -0,3 / 6,7 / 9,2 / 64° / 90 % | +0,4 / 5,5 / 8,7 / 72° / 92 % |
| fond | brise-aprem | 2795 | 10,8 | +1,0 / 8,4 / 12,7 / 41° / 59 % | -8,1 / 10,3 / 11,4 / 53° / 78 % | +1,9 / 9,1 / 13,9 / 48° / 54 % | +1,3 / 9,1 / 13,3 / 47° / 56 % | -2,4 / 6,1 / 11,4 / 59° / 77 % |
| fond | calme-couvert | 626 | 7,8 | +2,6 / 9,2 / 12,9 / 47° / 68 % | -5,2 / 8,3 / 9,4 / 57° / 88 % | +2,3 / 10,4 / 13,9 / 51° / 65 % | +2,5 / 9,4 / 13,2 / 51° / 67 % | -0,6 / 5,7 / 10,2 / 66° / 87 % |
| fond | modere | 3195 | 8,3 | +0,5 / 8,8 / 13,5 / 63° / 73 % | -5,5 / 8,7 / 9,9 / 56° / 84 % | -0,7 / 10,2 / 14,2 / 71° / 69 % | -1,0 / 8,6 / 12,8 / 68° / 75 % | +1,6 / 8,0 / 12,3 / 57° / 75 % |
| fond | fort | 2156 | 11,6 | -1,9 / 9,8 / 13,9 / 48° / 62 % | -8,4 / 11,5 / 12,4 / 42° / 68 % | -6,7 / 12,9 / 16,7 / 87° / 62 % | -4,8 / 10,7 / 14,5 / 64° / 66 % | +3,0 / 10,6 / 14,6 / 43° / 61 % |
| fond | stable | 919 | 7,3 | +1,4 / 11,2 / 14,1 / 69° / 69 % | -5,5 / 9,8 / 10,4 / 67° / 87 % | +1,3 / 12,3 / 15,0 / 76° / 65 % | +1,6 / 12,1 / 15,0 / 76° / 65 % | -2,0 / 9,5 / 11,8 / 73° / 85 % |
| pente | brise-matin | 799 | 6,7 | -0,9 / 6,6 / 9,5 / 58° / 91 % | -3,6 / 6,7 / 8,2 / 61° / 93 % | -4,5 / 7,6 / 8,6 / 69° / 93 % | -3,0 / 6,8 / 9,2 / 74° / 93 % | +0,6 / 6,7 / 10,0 / 60° / 85 % |
| pente | brise-aprem | 1063 | 10,0 | -3,1 / 7,7 / 11,2 / 58° / 74 % | -6,0 / 7,9 / 9,8 / 50° / 81 % | -6,8 / 9,6 / 11,2 / 74° / 81 % | -5,1 / 8,4 / 11,7 / 71° / 80 % | -0,4 / 6,5 / 11,0 / 50° / 75 % |
| pente | calme-couvert | 383 | 9,5 | +2,6 / 11,1 / 15,8 / 62° / 63 % | -4,1 / 7,7 / 11,0 / 63° / 80 % | -8,3 / 10,7 / 11,5 / 66° / 80 % | -3,2 / 7,5 / 11,6 / 69° / 81 % | +1,9 / 7,6 / 13,9 / 63° / 67 % |
| pente | modere | 1048 | 10,1 | +5,4 / 12,3 / 17,0 / 56° / 49 % | -1,2 / 8,8 / 11,8 / 51° / 69 % | -8,4 / 11,2 / 12,2 / 82° / 77 % | -2,0 / 8,0 / 12,7 / 63° / 71 % | +9,8 / 15,8 / 20,0 / 49° / 42 % |
| pente | fort | 691 | 17,8 | +4,3 / 18,4 / 22,0 / 35° / 39 % | -3,9 / 15,8 / 18,1 / 36° / 47 % | -15,6 / 20,8 / 22,6 / 94° / 51 % | -7,7 / 15,6 / 19,5 / 48° / 45 % | +15,4 / 23,8 / 27,4 / 27° / 29 % |
| pente | stable | 364 | 6,7 | -0,9 / 7,4 / 10,0 / 63° / 85 % | -3,6 / 7,5 / 8,5 / 53° / 89 % | -5,2 / 7,8 / 8,8 / 80° / 90 % | -3,7 / 7,2 / 8,9 / 69° / 90 % | +2,5 / 8,2 / 10,8 / 45° / 80 % |
| sommet | brise-matin | 660 | 6,9 | -0,2 / 6,0 / 10,3 / 65° / 89 % | -3,4 / 6,3 / 8,4 / 54° / 91 % | -4,0 / 6,6 / 9,1 / 86° / 91 % | -2,5 / 6,1 / 9,2 / 73° / 90 % | -0,5 / 5,8 / 9,5 / 56° / 88 % |
| sommet | brise-aprem | 830 | 10,5 | +0,5 / 9,3 / 13,0 / 42° / 64 % | -5,2 / 8,5 / 10,7 / 44° / 75 % | -3,6 / 9,2 / 11,7 / 56° / 69 % | -2,3 / 8,7 / 12,5 / 53° / 69 % | -0,9 / 7,0 / 11,4 / 46° / 73 % |
| sommet | calme-couvert | 309 | 13,9 | +0,5 / 12,5 / 19,3 / 49° / 55 % | -7,3 / 13,3 / 16,2 / 55° / 61 % | -11,2 / 16,0 / 17,5 / 71° / 65 % | -5,6 / 11,1 / 15,3 / 51° / 64 % | -1,9 / 11,5 / 17,2 / 56° / 55 % |
| sommet | modere | 1059 | 13,2 | +6,7 / 15,4 / 22,8 / 56° / 42 % | -2,1 / 10,5 / 15,7 / 50° / 57 % | -9,0 / 13,3 / 16,2 / 79° / 63 % | -1,2 / 9,3 / 16,3 / 60° / 57 % | +6,7 / 13,8 / 21,3 / 52° / 44 % |
| sommet | fort | 390 | 16,4 | +11,4 / 19,8 / 28,4 / 57° / 32 % | +4,1 / 17,1 / 23,3 / 48° / 43 % | -11,5 / 16,0 / 21,1 / 92° / 50 % | -2,0 / 11,8 / 19,9 / 61° / 40 % | +17,6 / 25,8 / 33,3 / 51° / 31 % |
| sommet | stable | 327 | 6,4 | +2,1 / 8,2 / 12,2 / 67° / 75 % | -3,1 / 7,1 / 8,7 / 60° / 89 % | -2,4 / 7,8 / 10,1 / 82° / 87 % | -0,9 / 7,5 / 10,3 / 74° / 85 % | +0,4 / 7,8 / 10,6 / 60° / 85 % |
| plaine | brise-matin | 278 | 9,6 | -4,4 / 6,9 / 8,8 / 42° / 87 % | -5,0 / 7,2 / 9,0 / 44° / 87 % | -8,0 / 10,3 / 11,0 / 65° / 87 % | -7,1 / 9,6 / 10,8 / 75° / 87 % | +4,0 / 7,9 / 12,2 / 44° / 68 % |
| plaine | brise-aprem | 416 | 12,2 | -4,0 / 8,2 / 10,6 / 31° / 63 % | -7,1 / 8,7 / 9,8 / 26° / 72 % | -6,6 / 10,4 / 13,9 / 63° / 63 % | -6,3 / 10,1 / 14,1 / 67° / 65 % | +2,8 / 5,9 / 9,5 / 26° / 72 % |
| plaine | calme-couvert | 37 | 8,6 | -3,0 / 5,0 / 6,8 / 36° / 92 % | -3,8 / 5,6 / 7,2 / 37° / 92 % | -7,2 / 8,5 / 9,0 / 51° / 95 % | -4,0 / 5,7 / 9,9 / 69° / 95 % | +5,1 / 9,5 / 12,3 / 37° / 70 % |
| plaine | modere | 461 | 13,5 | -4,8 / 9,4 / 11,4 / 30° / 62 % | -5,8 / 9,3 / 11,1 / 32° / 67 % | -10,8 / 15,1 / 16,1 / 67° / 62 % | -8,1 / 13,1 / 16,4 / 67° / 63 % | +9,2 / 14,4 / 17,7 / 32° / 57 % |
| plaine | fort | 729 | 18,8 | -7,1 / 12,5 / 14,7 / 25° / 47 % | -7,6 / 12,6 / 14,8 / 26° / 46 % | -17,8 / 21,6 / 22,6 / 82° / 43 % | -11,7 / 17,3 / 19,6 / 41° / 43 % | +16,7 / 20,9 / 24,9 / 25° / 51 % |
| plaine | stable | 95 | 20,4 | -13,9 / 17,2 / 17,8 / 23° / 28 % | -14,6 / 17,4 / 18,0 / 25° / 28 % | -19,8 / 22,0 / 22,6 / 82° / 28 % | -18,5 / 21,0 / 22,1 / 77° / 28 % | -0,7 / 12,6 / 15,3 / 26° / 44 % |
| balise | brise-matin | 551 | 6,4 | +1,0 / 6,0 / 9,6 / 51° / 89 % | -1,7 / 6,0 / 8,3 / 52° / 92 % | -3,2 / 6,5 / 8,5 / 72° / 92 % | -2,2 / 5,9 / 8,8 / 75° / 92 % | +0,8 / 6,6 / 9,7 / 53° / 86 % |
| balise | brise-aprem | 756 | 11,1 | +1,0 / 7,6 / 12,2 / 42° / 63 % | -2,5 / 7,7 / 11,4 / 46° / 71 % | -3,1 / 8,9 / 12,4 / 46° / 71 % | -1,8 / 8,0 / 12,3 / 51° / 68 % | -0,2 / 7,4 / 11,6 / 44° / 67 % |
| balise | calme-couvert | 168 | 8,9 | +2,5 / 8,2 / 14,0 / 65° / 71 % | -2,1 / 8,8 / 11,7 / 52° / 79 % | -2,2 / 8,4 / 13,2 / 77° / 77 % | +0,4 / 7,6 / 13,7 / 73° / 76 % | +0,3 / 7,2 / 11,5 / 53° / 72 % |
| balise | modere | 871 | 11,1 | +9,5 / 17,7 / 23,4 / 58° / 39 % | +1,0 / 10,7 / 14,6 / 52° / 59 % | -5,5 / 12,1 / 15,5 / 80° / 69 % | +0,6 / 11,0 / 16,4 / 64° / 57 % | +7,3 / 13,9 / 18,6 / 48° / 53 % |
| balise | fort | 679 | 16,7 | +10,3 / 18,4 / 24,2 / 36° / 39 % | +3,4 / 14,0 / 18,6 / 36° / 46 % | -13,7 / 19,1 / 21,1 / 88° / 51 % | -1,8 / 12,3 / 19,3 / 47° / 40 % | +15,2 / 21,7 / 26,6 / 35° / 43 % |
| balise | stable | 252 | 7,1 | +3,0 / 9,9 / 13,0 / 51° / 71 % | -1,6 / 7,8 / 10,3 / 47° / 80 % | -1,8 / 9,6 / 11,8 / 72° / 81 % | -0,4 / 8,8 / 11,8 / 66° / 79 % | +0,1 / 8,1 / 10,6 / 45° / 81 % |

### Budget le long de la vallée (km/h, + = vers l'amont)

« Conservé » : pente de la part synoptique du modèle sur le vent du sondage. « Trouvé » : pente du vent observé sur ce même vent. Un double compte demanderait conservé > trouvé avec un biais positif ; or conservé < trouvé en brise d'après-midi (0,26 contre 0,68, et 0,39 dans les grandes vallées).

| groupe | situation | n | obs | AROME 10 m | sondage à l’altitude | part synoptique modèle | brises modèle | total modèle | conservé | trouvé | sous le sol AROME | vit. sondage | vit. synoptique modèle |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| fond | brise-matin | 2031 | +0,3 | +0,6 | -0,5 | -0,1 | +0,2 | +0,1 | 0,28 | 0,33 | 87 % | 5,7 | 1,2 |
| grand-fond | brise-matin | 1049 | +0,4 | +1,0 | -0,1 | +0,1 | +0,6 | +0,7 | 0,27 | 0,03 | 100 % | 4,8 | 0,7 |
| fond | brise-aprem | 2795 | +5,1 | +4,5 | +1,9 | +0,7 | +10,4 | +11,1 | 0,26 | 0,68 | 86 % | 8,4 | 1,7 |
| grand-fond | brise-aprem | 1420 | +6,6 | +6,7 | +2,2 | +0,7 | +15,2 | +15,9 | 0,26 | 0,39 | 100 % | 8,0 | 1,3 |
| fond | calme-couvert | 626 | +2,6 | +2,8 | +1,5 | +0,5 | +7,7 | +8,3 | 0,29 | 0,46 | 85 % | 7,2 | 1,5 |
| grand-fond | calme-couvert | 372 | +3,1 | +3,6 | +1,6 | +0,5 | +11,2 | +11,7 | 0,29 | 0,33 | 100 % | 6,7 | 1,2 |
| fond | modere | 3195 | +1,0 | +2,0 | +2,1 | +0,8 | +4,8 | +5,7 | 0,27 | 0,39 | 86 % | 10,0 | 2,3 |
| grand-fond | modere | 1606 | +0,8 | +2,3 | +1,9 | +0,7 | +8,0 | +8,7 | 0,30 | 0,14 | 100 % | 8,4 | 1,6 |
| fond | fort | 2156 | -2,4 | -2,0 | -0,8 | -0,1 | +2,2 | +2,1 | 0,26 | 0,60 | 83 % | 14,7 | 3,2 |
| grand-fond | fort | 726 | -2,2 | -1,3 | -0,1 | +0,1 | +4,7 | +4,8 | 0,26 | 0,51 | 100 % | 10,9 | 1,6 |
| fond | stable | 919 | -1,2 | -0,1 | +0,2 | +0,1 | +6,3 | +6,4 | 0,27 | 0,49 | 90 % | 5,3 | 1,0 |
| grand-fond | stable | 527 | +1,3 | +1,0 | +1,1 | +0,3 | +9,2 | +9,6 | 0,24 | -0,16 | 100 % | 4,9 | 0,7 |

Tous les postes de grande vallée sont sous le sol AROME de leur maille 0,25° : ils lisent des niveaux extrapolés.

### Écarts avec intervalles

| cas | n | obs | couches biais [IC] | crêtes biais [IC] | AROME 10 m biais [IC] | enveloppe biais | sans brises biais | couches − crêtes biais [IC] | couches − crêtes RMSE [IC] | couches − enveloppe RMSE [IC] | couches − sondage centre RMSE [IC] |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| fond|brise-aprem | 2795 | 10,8 | +1,7 [+0,9 ; +2,5] | +1,3 [+0,5 ; +2,0] | -1,3 [-1,7 ; -1,0] | +1,0 | -8,1 | +0,4 [+0,1 ; +0,8] | +0,3 [+0,1 ; +0,4] | +0,4 [+0,3 ; +0,6] | -0,2 [-0,4 ; +0,0] |
| grand-fond|brise-aprem | 1420 | 10,6 | +6,3 [+5,5 ; +7,1] | +5,7 [+4,7 ; +6,5] | -0,5 [-1,0 ; -0,1] | +5,2 | -7,4 | +0,6 [+0,2 ; +1,2] | +0,5 [+0,3 ; +0,8] | +0,7 [+0,4 ; +0,9] | +0,0 [-0,2 ; +0,5] |
| fond|brise-matin | 2031 | 5,3 | +0,1 [-0,4 ; +0,5] | +0,1 [-0,4 ; +0,6] | -0,8 [-1,2 ; -0,6] | +0,1 | -3,9 | 0,0 [-0,2 ; +0,2] | +0,1 [+0,0 ; +0,2] | +0,2 [+0,1 ; +0,3] | -0,1 [-0,2 ; +0,0] |
| fond|modere | 3195 | 8,3 | -0,1 [-1,4 ; +1,0] | +0,5 [-1,1 ; +1,6] | -0,0 [-0,6 ; +0,5] | +0,5 | -5,5 | -0,5 [-0,9 ; -0,0] | +1,6 [+1,1 ; +2,0] | +0,7 [+0,2 ; +1,3] | +0,9 [+0,3 ; +1,5] |
| fond|fort | 2156 | 11,6 | -5,3 [-7,5 ; -3,3] | +1,6 [-0,9 ; +3,8] | +0,7 [+0,1 ; +1,3] | -1,9 | -8,4 | -6,8 [-7,6 ; -6,1] | +1,8 [+0,5 ; +3,0] | +1,4 [+0,9 ; +1,8] | +0,5 [+0,2 ; +0,8] |
| pente|brise-aprem | 1063 | 10,0 | -4,1 [-4,6 ; -3,7] | -4,4 [-5,0 ; -3,9] | -1,4 [-1,8 ; -0,9] | -3,1 | -6,0 | +0,3 [+0,1 ; +0,5] | -0,3 [-0,5 ; -0,1] | +0,1 [-0,3 ; +0,4] | -0,7 [-1,1 ; -0,3] |
| sommet|brise-aprem | 830 | 10,5 | -0,1 [-0,9 ; +0,5] | -1,6 [-2,5 ; -0,9] | -3,2 [-3,6 ; -2,7] | +0,5 | -5,2 | +1,5 [+1,0 ; +1,9] | -0,7 [-1,0 ; -0,4] | -0,8 [-1,7 ; -0,2] | -0,3 [-0,7 ; +0,1] |
| plaine|brise-aprem | 416 | 12,2 | -4,0 [-5,5 ; -2,5] | -5,7 [-7,4 ; -4,1] | +0,3 [-0,1 ; +0,7] | -4,0 | -7,1 | +1,8 [+1,3 ; +2,3] | -1,3 [-1,7 ; -0,8] | +0,0 [0,0 ; +0,0] | -1,9 [-2,6 ; -1,2] |

### Cycle diurne en fond de vallée, journées de brise (km/h)

| cadre | heure | n | obs | couches | crêtes | AROME 10 m | brises seules | enveloppe | sans atlas |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| fond | 8 h | 393 | 3,4 | 5,0 | 4,9 | 3,2 | 4,5 | 5,1 | 5,0 |
| fond | 9 h | 412 | 4,0 | 4,8 | 4,7 | 3,3 | 4,3 | 4,9 | 4,8 |
| fond | 10 h | 415 | 4,6 | 3,2 | 3,4 | 4,0 | 2,6 | 3,5 | 3,0 |
| fond | 11 h | 408 | 6,4 | 4,2 | 4,4 | 5,1 | 3,5 | 4,3 | 1,7 |
| fond | 12 h | 403 | 8,0 | 9,7 | 9,6 | 6,7 | 9,3 | 9,4 | 3,1 |
| fond | 13 h | 407 | 9,5 | 12,8 | 12,5 | 7,9 | 12,7 | 12,3 | 6,8 |
| fond | 14 h | 421 | 10,7 | 13,9 | 13,4 | 9,2 | 14,2 | 13,2 | 9,7 |
| fond | 15 h | 396 | 11,3 | 13,9 | 13,6 | 10,0 | 14,3 | 13,2 | 10,2 |
| fond | 16 h | 396 | 11,7 | 13,6 | 13,1 | 10,0 | 14,0 | 12,7 | 9,9 |
| fond | 17 h | 388 | 11,7 | 13,4 | 13,0 | 10,5 | 14,1 | 12,5 | 9,9 |
| fond | 18 h | 389 | 11,0 | 13,1 | 12,6 | 9,9 | 13,6 | 12,1 | 10,0 |
| fond | 19 h | 398 | 9,5 | 6,1 | 6,1 | 8,6 | 5,7 | 6,3 | 7,6 |

Le modèle saute de 4,2 à 9,7 km/h entre 11 h et 12 h et tombe de 13,1 à 6,1 entre 18 h et 19 h, alors que l'observation reste à 9,5 km/h à 19 h et monte sans à-coup. Sans atlas, la chute de 19 h est moindre (7,6 km/h) : les horaires des brises documentées y contribuent.

### Fond de vallée par taille

Les vents observés ne suivent pas la taille de la vallée (10,6 km/h dans les grandes, 10,3 dans les petites l'après-midi), alors que le modèle les fait croître avec elle : +6,3 de biais dans les grandes, −3,5 dans les petites.

| taille | situation | n | obs km/h | layers biais / RMSE / vect. / dir / ok | ridge biais / RMSE / vect. / dir / ok | arome10 biais / RMSE / vect. / dir / ok | envelope biais / RMSE / vect. / dir / ok | breeze50 biais / RMSE / vect. / dir / ok | noBreeze biais / RMSE / vect. / dir / ok | noAtlas biais / RMSE / vect. / dir / ok |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| grande (valley ≥ 0,5) | brise-matin | 1049 | 5,0 | +2,7 / 7,6 / 10,9 / 59° / 85 % | +2,5 / 7,4 / 10,8 / 60° / 85 % | -0,7 / 3,8 / 5,7 / 44° / 98 % | +2,4 / 7,3 / 10,5 / 59° / 85 % | -0,7 / 5,1 / 7,9 / 61° / 95 % | -3,8 / 5,9 / 7,0 / 87° / 97 % | -0,6 / 5,2 / 7,1 / 51° / 97 % |
| grande (valley ≥ 0,5) | brise-aprem | 1420 | 10,6 | +6,3 / 10,3 / 15,1 / 38° / 42 % | +5,7 / 9,8 / 14,6 / 39° / 45 % | -0,5 / 4,4 / 7,8 / 27° / 83 % | +5,2 / 9,7 / 14,2 / 38° / 45 % | -0,8 / 7,0 / 10,9 / 38° / 73 % | -7,4 / 10,5 / 11,7 / 57° / 77 % | +2,2 / 7,1 / 11,7 / 38° / 59 % |
| grande (valley ≥ 0,5) | calme-couvert | 372 | 7,6 | +6,5 / 11,9 / 15,8 / 43° / 51 % | +6,2 / 10,7 / 14,8 / 44° / 52 % | +0,1 / 4,6 / 7,5 / 35° / 86 % | +5,6 / 10,4 / 14,5 / 46° / 56 % | +0,7 / 7,6 / 10,9 / 44° / 77 % | -4,5 / 8,6 / 9,9 / 61° / 86 % | -3,0 / 6,4 / 8,4 / 45° / 91 % |
| grande (valley ≥ 0,5) | modere | 1606 | 7,5 | +4,3 / 10,9 / 15,4 / 65° / 58 % | +2,3 / 8,4 / 13,2 / 67° / 73 % | +0,2 / 5,0 / 8,3 / 43° / 86 % | +2,7 / 9,2 / 14,1 / 68° / 69 % | -0,6 / 7,7 / 11,2 / 63° / 83 % | -4,9 / 8,5 / 9,9 / 71° / 86 % | -2,8 / 6,6 / 9,9 / 66° / 89 % |
| grande (valley ≥ 0,5) | fort | 726 | 9,6 | -1,0 / 11,0 / 16,1 / 72° / 62 % | +2,0 / 9,7 / 15,1 / 65° / 64 % | +0,6 / 6,8 / 10,3 / 44° / 76 % | +0,4 / 9,8 / 14,6 / 62° / 65 % | -4,9 / 10,1 / 12,9 / 71° / 77 % | -8,0 / 11,0 / 11,8 / 63° / 77 % | -6,2 / 10,1 / 12,3 / 71° / 77 % |
| grande (valley ≥ 0,5) | stable | 527 | 5,4 | +6,8 / 11,9 / 14,9 / 56° / 60 % | +6,6 / 11,3 / 14,3 / 58° / 61 % | -0,7 / 4,1 / 5,8 / 34° / 96 % | +5,9 / 10,6 / 13,6 / 57° / 63 % | +1,6 / 7,0 / 9,7 / 56° / 87 % | -3,2 / 6,8 / 7,8 / 73° / 92 % | -2,4 / 4,7 / 6,6 / 61° / 97 % |
| moyenne (0,2–0,5) | brise-matin | 326 | 6,0 | -2,5 / 5,6 / 7,6 / 60° / 92 % | -2,6 / 5,7 / 8,0 / 65° / 92 % | -1,2 / 3,8 / 5,6 / 28° / 94 % | -2,4 / 5,5 / 8,0 / 68° / 92 % | -3,7 / 6,0 / 7,2 / 59° / 92 % | -4,6 / 6,5 / 7,1 / 49° / 92 % | -2,9 / 5,6 / 7,1 / 54° / 92 % |
| moyenne (0,2–0,5) | brise-aprem | 488 | 11,9 | -2,5 / 8,5 / 14,5 / 63° / 62 % | -3,0 / 8,5 / 14,6 / 67° / 64 % | -2,4 / 5,5 / 8,8 / 34° / 74 % | -2,7 / 8,4 / 14,2 / 59° / 62 % | -6,5 / 9,4 / 12,5 / 58° / 70 % | -9,7 / 11,5 / 12,2 / 43° / 70 % | -4,7 / 8,0 / 13,0 / 63° / 70 % |
| moyenne (0,2–0,5) | calme-couvert | 64 | 9,0 | -4,5 / 8,4 / 11,9 / 78° / 77 % | -3,2 / 7,5 / 13,6 / 86° / 78 % | -0,6 / 5,2 / 9,0 / 34° / 81 % | -3,6 / 7,7 / 12,3 / 75° / 78 % | -6,0 / 8,5 / 10,6 / 69° / 83 % | -7,1 / 9,2 / 10,1 / 39° / 83 % | -6,1 / 8,4 / 10,5 / 76° / 83 % |
| moyenne (0,2–0,5) | modere | 492 | 10,2 | -5,3 / 9,1 / 12,4 / 54° / 76 % | -2,8 / 8,3 / 12,3 / 56° / 77 % | -0,5 / 6,1 / 8,7 / 31° / 75 % | -3,2 / 9,2 / 13,0 / 58° / 72 % | -6,8 / 9,7 / 11,4 / 50° / 77 % | -7,8 / 10,4 / 11,1 / 41° / 77 % | -6,7 / 9,8 / 11,6 / 54° / 77 % |
| moyenne (0,2–0,5) | fort | 460 | 11,4 | -6,4 / 11,5 / 14,7 / 52° / 67 % | +2,3 / 9,3 / 14,8 / 47° / 54 % | -0,1 / 6,8 / 9,8 / 30° / 72 % | -2,0 / 10,6 / 14,0 / 43° / 62 % | -7,7 / 11,7 / 13,3 / 47° / 69 % | -8,3 / 11,8 / 12,6 / 34° / 69 % | -8,2 / 11,9 / 12,9 / 39° / 69 % |
| moyenne (0,2–0,5) | stable | 174 | 14,1 | -9,9 / 17,2 / 19,8 / 92° / 55 % | -9,3 / 16,3 / 19,9 / 88° / 58 % | -7,0 / 11,5 / 12,7 / 26° / 66 % | -9,1 / 16,5 / 20,3 / 92° / 56 % | -11,7 / 17,3 / 18,6 / 85° / 63 % | -12,9 / 17,5 / 17,9 / 62° / 63 % | -12,1 / 17,0 / 18,1 / 83° / 63 % |
| petite (< 0,2) | brise-matin | 656 | 5,3 | -2,8 / 4,9 / 6,0 / 42° / 97 % | -2,4 / 4,9 / 6,7 / 59° / 97 % | -0,8 / 3,2 / 5,6 / 39° / 96 % | -2,1 / 5,0 / 6,8 / 57° / 97 % | -3,3 / 5,2 / 6,1 / 43° / 97 % | -3,6 / 5,4 / 6,3 / 57° / 97 % | -3,0 / 5,1 / 6,2 / 46° / 97 % |
| petite (< 0,2) | brise-aprem | 887 | 10,3 | -3,5 / 6,1 / 9,0 / 41° / 80 % | -3,4 / 6,2 / 9,5 / 45° / 80 % | -1,9 / 4,7 / 8,1 / 36° / 86 % | -3,7 / 6,0 / 8,8 / 37° / 80 % | -6,1 / 7,5 / 9,0 / 42° / 82 % | -8,2 / 9,4 / 10,3 / 54° / 82 % | -5,9 / 7,8 / 9,6 / 51° / 82 % |
| petite (< 0,2) | calme-couvert | 190 | 7,6 | -3,0 / 6,2 / 8,1 / 34° / 93 % | -2,1 / 5,3 / 8,2 / 45° / 92 % | -1,4 / 4,2 / 6,7 / 30° / 92 % | -1,3 / 6,8 / 9,1 / 38° / 88 % | -4,6 / 6,6 / 7,6 / 35° / 93 % | -5,8 / 7,4 / 8,2 / 54° / 93 % | -5,4 / 7,2 / 8,1 / 50° / 93 % |
| petite (< 0,2) | modere | 1097 | 8,7 | -4,0 / 7,4 / 9,8 / 49° / 85 % | -0,7 / 7,2 / 12,2 / 67° / 82 % | -0,1 / 4,8 / 8,3 / 35° / 87 % | -1,2 / 8,0 / 12,8 / 59° / 80 % | -4,9 / 7,7 / 9,4 / 46° / 85 % | -5,5 / 8,2 / 9,5 / 44° / 85 % | -5,0 / 7,8 / 9,3 / 44° / 85 % |
| petite (< 0,2) | fort | 970 | 13,2 | -7,9 / 11,3 / 12,8 / 37° / 61 % | +0,9 / 9,4 / 16,3 / 56° / 52 % | +1,1 / 5,8 / 8,8 / 23° / 72 % | -3,7 / 9,4 / 13,3 / 43° / 60 % | -8,4 / 11,6 / 12,7 / 36° / 61 % | -8,7 / 11,8 / 12,8 / 35° / 61 % | -8,6 / 11,8 / 12,7 / 33° / 61 % |
| petite (< 0,2) | stable | 218 | 6,6 | -1,9 / 6,2 / 8,5 / 49° / 92 % | -1,6 / 6,5 / 9,3 / 69° / 91 % | -1,1 / 4,1 / 6,9 / 43° / 92 % | -1,4 / 6,0 / 8,3 / 59° / 92 % | -3,6 / 6,0 / 7,5 / 51° / 92 % | -5,1 / 6,9 / 7,5 / 64° / 92 % | -4,6 / 6,6 / 7,6 / 68° / 92 % |

### Situations et lieux les plus faibles

- **Grandes vallées surestimées**, tous régimes sauf vent fort : Grenoble-CEA +10,5, Barcelonnette +10,6, Bourg-Saint-Maurice +9,9, Sainte-Marie-de-Cuines +9,6 km/h.
- **Plaines sous-estimées** : Avignon −11,3, Valence-Chabeuil −11,1 km/h. En plaine, `stable` ressort à −14,5 km/h pour 20,4 observés, sous un vent de crête faible : un vent de basses couches que le sondage voit (−0,7 km/h), probablement de type mistral (cause non vérifiée).
- **Vent fort** : RMSE de 13,1 km/h contre 8,2 pour AROME. Régions les plus faibles : Oisans–Maurienne (−10,2 / 18,4), Grenoble–Vercors (−6,9 / 15,6), Chartreuse–Belledonne (−4,1 / 15,4).
- **Pentes** : biais de −4,1 km/h en brise d'après-midi. Le modèle y plafonne vers 6 km/h pour 10–11 observés.
- **Balises** : les dangers « brise forte » dégradent la note (après-midi : RMSE 7,3 avec, 6,6 sans ; classes 63 % contre 69 %).

| poste | cadre | région | alt. | n | biais | RMSE | AROME 10 m biais / RMSE |
|---|---|---|--:|--:|--:|--:|--:|
| AVIGNON | plaine | Avant-pays | 34 | 336 | -11,3 | 15,5 | -0,6 / 4,2 |
| LESCHES EN DIOIS / Montagne du Puy | balise | Dévoluy, Gapençais, Buëch, Baronnies, Diois | 1462 | 313 | +5,5 | 14,8 | +0,5 / 11,6 |
| BOURG ST MAURICE | fond | Tarentaise, Vanoise | 865 | 336 | +9,9 | 14,7 | -2,1 / 5,1 |
| VALENCE-CHABEUI | plaine | Grenoble, Vercors, Trièves, Matheysine | 163 | 336 | -11,1 | 14,5 | -0,4 / 4,6 |
| GRENOBLE-CEA-RADOME | fond | Grenoble, Vercors, Trièves, Matheysine | 213 | 336 | +10,5 | 14,3 | +3,9 / 6,7 |
| STE MARIE CUINES | fond | Oisans, Maurienne, Arves | 460 | 336 | +9,6 | 13,7 | -0,6 / 4,8 |
| MURS | pente | Alpes de Haute-Provence, Alpes-Maritimes | 488 | 336 | -9,1 | 13,6 | -1,2 / 6,1 |
| AIGLETON-NIVOSE | sommet | Chartreuse, Grésivaudan, Belledonne | 2240 | 332 | +4,2 | 13,4 | +1,5 / 6,6 |
| ST CREPIN | fond | Briançonnais, Écrins, Queyras, Ubaye | 906 | 336 | +7,8 | 13,3 | -1,3 / 5,4 |
| MONT DU CHAT | sommet | Bauges, Bourget, Combe de Savoie | 1496 | 336 | +6,4 | 12,8 | -5,0 / 8,6 |
| Déco Téléphérique Salève 1086m | balise | Haute-Savoie nord | 1100 | 312 | +10,5 | 12,8 | +3,3 / 5,1 |
| BARCELONNETTE | fond | Briançonnais, Écrins, Queyras, Ubaye | 1155 | 336 | +10,6 | 12,8 | +2,0 / 4,5 |
| DAUPHIN | fond | Alpes de Haute-Provence, Alpes-Maritimes | 427 | 336 | -8,9 | 12,7 | -2,7 / 6,1 |
| GALIBIER-NIVOSE | pente | Oisans, Maurienne, Arves | 2559 | 336 | -7,8 | 12,7 | -2,6 / 7,3 |
| EMBRUN | fond | Briançonnais, Écrins, Queyras, Ubaye | 873 | 335 | +6,5 | 12,5 | -2,0 / 5,6 |

### Un seul sondage pour la carte

Le sondage local apporte surtout de la direction : après-midi de brise, 43° contre 54° tous cadres, 52° contre 71° sur les pentes, 32° contre 67° en plaine. En vitesse, il compte en plaine (vent fort : RMSE 12,6 contre 17,3 km/h). En montagne, il n'améliore pas nettement la vitesse.

## 6. Essais de correctifs

Essais faits sur un worktree jetable, en CPU seulement, sans toucher au dépôt. Colonnes : biais / RMSE / RMSE vectoriel (km/h) / direction / classes.

| Essai | Tous échantillons | Pli A | Pli B | Fond, brise après-midi | Plaine, vent fort |
|---|--:|--:|--:|--:|--:|
| HEAD | −0,9 / 9,8 / 13,3 / 48° / 67 % | 9,8 / 13,4 | 9,8 / 13,1 | +1,7 / 8,9 / 13,3 | −7,6 / 12,6 / 14,8 |
| **P1** brises documentées × soleil | −2,3 / 9,2 / 12,1 / 47° / 73 % | 9,3 / 12,3 | 9,1 / 11,9 | 0,0 / 7,9 / 11,9 | −7,6 / 12,6 / 14,8 |
| **P1 + P3b** relief dans le facteur de niveau | −1,7 / 8,9 / 12,0 / 46° / 73 % | 9,0 / 12,1 | 8,8 / 11,8 | +0,1 / 7,8 / 11,8 | +0,3 / 8,8 / 13,3 |
| P1 + P2 vent lu au-dessus du relief | −1,3 / 9,4 / 12,8 / 48° / 71 % | 9,3 / 12,8 | 9,5 / 12,9 | −0,4 / 7,8 / 11,7 | −7,6 / 12,6 / 14,8 |
| P1 + P6 `valleyBreezeMax` 5 m/s | −2,5 / 9,2 / 12,0 / 46° / 73 % | 9,3 / 12,2 | 9,1 / 11,8 | −0,6 / 7,9 / 11,6 | −7,6 / 12,6 / 14,8 |
| P1 + P4 profil log des brises sous 100 m | −3,1 / 9,2 / 11,8 / 46° / 75 % | 9,3 / 12,0 | 9,0 / 11,6 | −3,2 / 7,5 / 10,4 | −7,6 / 12,6 / 14,8 |
| P5 cycle de vallée décalé de 1 à 1,5 h | −0,9 / 9,8 / 13,3 / 48° / 67 % | 9,8 / 13,4 | 9,8 / 13,1 | +2,0 / 8,9 / 13,5 | −7,6 / 12,6 / 14,8 |

P1, dans `evalCell`, pour les brises non pilotées par un vent et non catabatiques, de jour :

```ts
const dayF = !b.condition?.wind && c.time.valleyPhase > 0 && kind !== CuratedLayerKind.Katabatic ? c.time.season * sunCloud : 1;
const sp = b.speedMs * act * vf * funnel * scale * dayF; // same factor on the thin layer
```

P3b :

```ts
const fLevel = 1 - (0.7 - 0.7 * smoothstep(-0.1, 1.05, level)) * (0.45 + 0.55 * smoothstep(200, 800, t.env[k] - t.floor[k]));
```

Avec P1, le fond de vallée en journée de brise donne 11,7 à 12,0 km/h de 14 h à 17 h pour 10,7 à 11,7 observés. P1 découvre aussi le déficit par vent fort : fond de vallée de −5,3 à −7,6 km/h.

P2 aide les fonds de vallée par vent fort (biais −7,6 → −3,1, RMSE 11,2 → 9,8) mais dégrade balises et pentes (balises en vent modéré : 10,6 → 13,3 ; pentes en vent fort : 15,8 → 17,0).

## 7. Recommandations, par gain attendu

1. **P1 : faire suivre aux brises documentées le soleil du jour** (CPU et GLSL). RMSE global −0,6 km/h, vectoriel −1,2, classes +6 points ; fond de vallée sous ciel couvert 10,1 → 7,4, stable 12,1 → 9,2. À repasser par `npm run model:check`, dont les cas de juillet sans nuage devraient peu bouger (non testé).
2. **P3b : ne plus traiter les plaines ouvertes en fond de vallée.** Plaine en vent fort : RMSE 12,6 → 8,8, biais −7,6 → +0,3 ; global 9,2 → 8,9. Coefficient choisi à la main.
3. **Ancrer le sol sur le vent AROME à 10 m** pour la lecture près du sol, le relief à 216 m n'apportant que le détail. C'est la marge la plus grande (RMSE AROME 6,2 km/h) mais aussi le plus gros chantier : champ spatialisé à servir, et hybride non testé.
4. **Revoir le vent fort en fond de vallée** sans le mécanisme global de séparation d'échelles : le vent lu au-dessus du relief, restreint aux vrais chenaux, pour éviter les pertes de P2 sur les pentes et les balises (non testé).
5. **Plusieurs sondages**, surtout pour la direction et l'avant-pays (§ 5).
6. **Taille de vallée et fin de journée** : rendre la brise à 10 m moins dépendante de la surface drainée (après P1 : +3,7 dans les grandes, −4,1 dans les petites) et adoucir la fin des horaires documentés (19 h : 5,7 km/h pour 9,5 observés). Non testé ; P5 et P6 n'apportent presque rien.
7. **Dangers « brise forte »** : leur appliquer aussi le facteur de soleil (non testé).

## 8. Limites

- **10 m seulement** : ni jet de vallée, ni altitude de vol. Une anémométrie à 10 m lit moins que le jet, donc une partie du surplus des grandes vallées peut venir de l'absence de couche de surface pour les brises, et un correctif doit préserver le profil documenté en altitude. Les thermiques et l'ascendance ne sont pas notés.
- **Avantage à AROME** : l'archive assemble les premières échéances de chaque run, meilleures que les prévisions à J+1 et J+2 de l'app. Le modèle en profite aussi, via ses sondages.
- **Échantillon** : 28 jours d'une seule année et 75 postes, 3 jours stables, 10 balises (mât bas, n'importe quelle exposition). Les intervalles rééchantillonnent les jours, pas les postes. Ils suffisent pour les conclusions ci-dessus, sans extension à ce stade.
- **Plis** : le pli B n'est pas un vrai témoin pour P1–P6, car les essais ont été conçus en regardant tout le banc. Il garde sa valeur pour les réglages à venir.
- **Représentativité** : maille de 216 m, stations parfois abritées, cadre issu de seuils sur le MNT, sondage local d'une maille 0,25° prise au plus proche, dont le relief peut être sans rapport avec le poste.
- **Essais CPU** : P1–P6 ne sont pas portés dans `model-glsl.ts` et n'ont pas été testés avec `model:check`.

## 9. Relancer le banc

```sh
npm run model:hindcast -- --prepare                         # une fois : télécharge et met en cache
npm run model:hindcast                                      # note l'arbre de travail
npm run model:hindcast -- --rev <rev> --write               # note une révision, écrit docs/validation/results-<rev>.json
npm run model:hindcast -- --compare edb11ebab               # arbre de travail contre edb11ebab
npm run model:hindcast -- --rev <a> --compare <b>           # deux révisions
```

`--rev` crée un worktree temporaire dont `node_modules/@brises/*` pointent vers ses propres paquets, y copie le harnais, puis le retire. Les passes sont en cache dans `.cache/validation/runs/` ; `--force` les recalcule. `--keep-tree <rev>` puis `--tree <dossier> --label <nom>` servent à essayer un correctif sans commit. Deux passes de `--rev HEAD` donnent un fichier identique octet pour octet.

Le banc mesure la version donnée tant que `forecastAir` et `openMeteo.synoptic` restent les points d'entrée de l'app. Pour plusieurs sondages, il faudra lire `evaluate.ts` (choix de la colonne par poste) : les 60 mailles sont déjà en cache.
