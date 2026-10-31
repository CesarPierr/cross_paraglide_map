# Méthodologie du modèle de vent

Le modèle est **conceptuel** : il ne résout pas les équations de la mécanique des fluides. Il
combine, maille par maille (≈ 216 m), des régimes de vent connus de la météorologie de montagne,
dont l'intensité dépend du soleil, de l'heure, de la saison et du vent météo, puis les corrige avec
la connaissance locale documentée (atlas). Objectif : une image juste *dans ses tendances*, lisible
et instantanée, pas une prévision.

Références principales : Whiteman, *Mountain Meteorology* (2000) ; Zardi & Whiteman, *Diurnal
mountain wind systems* (2013) ; Winstral et al. (2002) pour l'abri au vent ; supports de formation
FFVL et retours de pilotes cités dans l'atlas (voir `reports/`).

Code de référence : `packages/model/src` (TypeScript). Le moteur GPU (`apps/web/src/gpu/model-glsl.ts`)
en est la transcription GLSL. Constantes réglables : `packages/model/src/rules.ts`.

## 1. Analyse du terrain (une fois)

À partir du MNT (tuiles Terrarium zoom 9, bbox 4,85–7,85 E / 43,55–46,5 N, 1094 × 1521 mailles) :

- **Pente et exposition** (gradients), **TPI** (position topographique : crête/fond).
- **Drainage** par *priority-flood* : direction d'écoulement et surface drainée → présence et
  **axe des vallées** (orienté vers l'amont), lissé et pondéré par la cohérence locale.
- **Enveloppes** (min/max filtrés) : profondeur de vallée, hauteur des reliefs voisins.
- **Lacs** (remplissage depuis des graines connues : Léman, Annecy, Bourget, Serre-Ponçon…) et
  **mer** : champs « vers la rive » qui décroissent avec la distance.
- **Plaine → montagne** : direction de l'avant-pays vers le relief.

## 2. Soleil

Position du soleil (algorithme NOAA), heure légale française (changement d'heure inclus),
ensoleillement de chaque pente = produit scalaire normale·soleil, avec **ombres portées** calculées
par lancer de rayon sur le MNT (passe GPU dédiée). La saison module l'intensité (hauteur du soleil
à midi). La même passe cumule l'ensoleillement de chaque pente depuis le lever (déclenchement des
thermiques) et son ensoleillement récent, ombres comprises (inertie thermique, § 6).

## 3. Brises thermiques

| Régime | Moteur | Intensité de référence (`RULES`) | Horaire |
| --- | --- | --- | --- |
| Brise de pente montante | ensoleillement de la pente, raideur | jusqu'à 3 m/s, couche ≈ 140 m | suit le soleil (retard ≈ 1 h) |
| Brise catabatique | refroidissement nocturne | 1,6 m/s | nuit |
| Vent de glacier | air refroidi par la glace (part de neige et glace de la maille) | 3 m/s, couche ≈ 60 m | jour et nuit |
| Brise de vallée montante | taille de la vallée (surface drainée), suivant l'axe | jusqu'à 7 m/s (≈ 25 km/h) dans les grandes vallées | inversion ≈ 9 h 30, plein ≈ 13 h, déclin 16 h 30, inversion ≈ 19 h 30 (heure solaire) |
| Brise descendante de vallée | idem, sens inverse | 40 % du jour | nuit, matin |
| Brise de lac / de mer | distance au rivage, écart de température terre-eau du mois | 3 / 5 m/s | ≈ 9 h → 19 h 30 |
| Aspiration plaine → montagne | position en avant-pays | 2,5 m/s | après-midi |

Vent de glacier (`RULES.glacierWind`, Oerlemans et Grisogono 2002) : sur un glacier qui fond, l'air
refroidi par la glace descend la pente de jour comme de nuit, à 2 à 6 m/s dans une couche de quelques
dizaines de mètres. Là où la part de neige et glace de la maille (WorldCover) passe de 20 à 60 %, la
brise de pente devient ce flux descendant de 3 m/s, épais de 60 m, déjà complet vers 10° de pente
parce qu'il prend de la vitesse sur toute la langue. Sur le Glacier Blanc, le Tacul ou Bionnassay,
l'air descend ainsi à 15 h au lieu de monter avec le soleil.

La brise de lac et de mer suit, en plus du soleil, l'écart de température entre la terre et l'eau
(`RULES.waterContrast`) : l'eau retarde d'un à deux mois sur la terre, si bien que la brise est la
plus forte au printemps et au début de l'été, quand le lac est encore froid (≈ 10 °C en avril), et
s'affaiblit à l'automne, quand il est chaud (≈ 23 °C fin août) : × 1 en avril, × 1,1 en mai, × 0,37
en septembre et × 0,16 en octobre, au lieu de 0,76 / 0,96 / 0,61 / 0,36 avec le seul soleil.

Chaque régime a une épaisseur : l'altitude d'évaluation (au-dessus du sol ou absolue) atténue les
brises de pente puis de vallée et fait apparaître le vent météo au-dessus des crêtes.

Profil vertical de la brise de vallée (`RULES.valleyProfile`, Zardi & Whiteman 2013) : la profondeur
de la vallée est mesurée jusqu'aux crêtes voisines (enveloppe sur ≈ 6 km). La brise garde toute sa
force jusqu'à 30 % de cette profondeur, en garde la moitié vers 65 % et s'éteint à hauteur des
crêtes ; un contre-courant faible (`valleyAntiwind`, 15 %, hypothèse) apparaît juste au-dessus.
Au-dessus de Saint-Hilaire, à 15 h en juillet sans vent, la brise du Grésivaudan reste ainsi
sensible à 1500 m (≈ 6 à 10 km/h) et s'efface vers 2500 m. Les brises documentées de l'atlas
suivent le même profil selon leur type (vallée, pente, régionale : `curatedLayerKind`), ne
s'appliquent que dans leurs horaires, et donnent leur sens à la brise générique dans leur couloir.

Rétrécissements (`terrain.ts → valleyFunnel`, `RULES.funnelExponent`, `funnelMax`) : la brise de
vallée transporte à peu près le même débit le long de la vallée ; là où le chenal est plus étroit
qu'en amont et en aval (verrou, goulet), elle accélère. Pour chaque maille de vallée, la largeur du
chenal en travers de l'axe (jusqu'au tiers de la profondeur locale) est comparée à la largeur
médiane 0,9 à 4,3 km en amont et en aval : accélération (largeur ailleurs / largeur ici)^0,7, au plus
×1,5, de jour seulement (la nuit, l'air froid s'accumule en amont d'un verrou au lieu de le
franchir, Whiteman 2000). Les brises fortes signalées aux verrous et goulets (Châtillon-en-Diois,
Barcelonnette, Saint-Vincent-les-Forts) apparaissent ainsi par le relief seul.

## 4. Connaissance locale (atlas)

Les brises documentées (tracés de l'atlas, recalés sur le fond de vallée par plus court chemin sur
le MNT) sont rastérisées : dans leur couloir, elles remplacent la direction calculée et imposent
leur force typique et leurs horaires (extraits du texte : « fin de matinée à fin d'après-midi »,
« dès 11h », « 3 h après le lever du soleil » ; les mentions de pic sont ignorées). Leur poids
diminue avec la confiance de la source et avec le vent météo (une brise forte résiste mieux
qu'une faible) et suit leur activité horaire : hors de ses heures, une brise documentée ne force
pas le calme, et la brise générique de son couloir prend son sens.

- **Couches** (`curatedLayerKind`) : les brises de vallée suivent le profil vertical du § 3 ; les
  brises de pente (100–200 m, S1) et catabatiques (50–150 m, S3) forment une couche mince près du
  sol, sous la brise de vallée ; les flux régionaux occupent ≈ 1200 m (S4).
- **Brises conditionnelles** : une brise qui n'existe que dans une situation (« par forte
  chaleur », « en hiver, sous inversion », « par vent de nord », « par Lombarde »…) porte une
  condition, explicite (champ `condition`) ou lue dans son nom et ses horaires. Elle reste
  affichée avec un badge et n'entre dans la simulation que si la condition est remplie : vent
  météo dans le secteur (± 45°, nul au-delà de 70°) et assez fort, option « canicule », mois de
  novembre à février. Une condition que le modèle ne sait pas évaluer (schéma conceptuel) n'est
  jamais simulée.
- **Plaine, lac, mer** : l'aspiration de la plaine et les brises de lac ou de mer alimentent la
  brise de vallée au lieu de s'y ajouter (composante régionale × (1 − vallée)).

## 4 bis. Contrôle de fidélité (`npm run model:check`)

Chaque élément de l'atlas est confronté au modèle de référence sur le vrai MNT : brises le long
de leur tracé, à leurs heures, au sol et à 30 et 60 % de leur couche (sens, vitesse documentée,
silence hors horaires ou hors condition) ; convergences à l'heure indiquée ; thermiques à leurs
heures et à leur début documenté ; pièges sous le vent météo qu'ils citent, au point même (à
330 m près, et non plus dans un rayon de quelques kilomètres qui laissait passer un effet trouvé
ailleurs), avec et sans la couche des dangers documentés ; contrôle inverse : un décollage
documenté pour un vent ne doit pas apparaître sous le vent quand ce vent lui arrive de face
(`scripts/dev/lee-bench.ts` pour régler l'abri sur ces deux jeux). Le rapport
(`docs/MODEL_QA.md`) classe les échecs en défaut du modèle, défaut de donnée ou limite assumée, et
liste les données à corriger. À l'atlas de la seconde passe : 93 % des brises, 84 % des
convergences, 83 % des thermiques conformes.

## 4 ter. Traces GPS et positions (`npm run data:build`, `scripts/research/check_altitudes.py`)

Les textes disent pourquoi et quand ça monte ; les traces GPS disent où. Les points chauds de
[thermal.kk7.ch](https://thermal.kk7.ch) (probabilité de trouver un thermique, calculée sur les
traces publiées, par moment de la journée — du lever du soleil à +6 h, de +6 à +9 h, au-delà — et
par saison) sont croisés avec les thermiques documentés (`scripts/kk7.ts`) :

- un thermique documenté avec un point chaud à moins de 600 m en reçoit la probabilité et le
  profil horaire ; si sa position n'était qu'approximative, il est recalé sur le point mesuré ;
- un point chaud d'au moins 80 % qu'aucun texte ne décrit (rien à moins de 1 km) devient un
  thermique « mesuré » (`origin: 'kk7'`), affiché plus discrètement, animé selon sa probabilité,
  exclu du contrôle de fidélité (il ne décrit aucun phénomène) ;
- `docs/KK7_CROISEMENT.md` liste, secteur par secteur, les points chauds forts encore sans texte
  et les thermiques documentés loin de tout point chaud : c'est la liste de recherche.

Les données kk7 sont sous licence CC BY-NC-SA 4.0 : l'atlas qui les intègre hérite de cette
licence (attribution, pas d'usage commercial, partage à l'identique).

Les positions sont contrôlées par l'altitude : le terrain IGN (RGE ALTI, précision métrique) à la
position d'un point est comparé à son altitude déclarée (`docs/POSITIONS.md`). Les positions
vérifiées (fiche FFVL, toponyme IGN ou OSM, point chaud, terrain) sont consignées avec leur
méthode dans `research_notes/Seconde passe 2026/positions/corrections.json`, qui prime sur les
fichiers de recherche.

## 5. Vent météo et relief

- **Saisie** : à la main, un vent « des crêtes » (direction, force) et une masse d'air
  (stable, standard ou instable, inversion facultative) ; ou la prévision du jour, du lendemain
  ou du surlendemain : l'air par couches (ci-dessous) et le vent des crêtes (moyenne vectorielle
  850/700 hPa), qui reste la référence des conditions documentées (brises conditionnelles,
  dangers liés à un vent).
- **Air par couches** (`air.ts`, `ModelParams.air`, `RULES.air`) : la prévision Open-Meteo
  (AROME 2,5 km, ARPEGE pour le troisième jour) donne heure par heure, au centre de la vue
  (maille de 0,25°), le vent, la température, le point de rosée et l'altitude géopotentielle de
  950, 925, 900, 850, 800, 750, 700, 600 et 500 hPa (≈ 550 → 5 700 m), et les nébulosités basse
  et moyenne. Le modèle en tire, pour chaque maille et l'altitude lue :
  - **le vent météo à cette altitude** : interpolation linéaire du vecteur (u, v) entre niveaux,
    tenu constant sous le plus bas et au-dessus du plus haut. Le fond de vallée voit le bas de la
    couche, les crêtes le milieu, l'air libre le haut : cisaillement et rotation du vent avec
    l'altitude, jet de basse couche, vallée calme sous une inversion quand le vent n'y est pas
    prévu. Ce vent local remplace le vent uniforme partout où il intervient (abri et direction
    amont, canalisation, venturi, faces au vent, rotor, tenue des brises, brassage de la poche
    froide, thermiques soufflés, turbulence) ;
  - **le plafond thermique** de chaque sol : une particule 1,5 °C plus chaude que l'air au sol
    monte selon l'adiabatique sèche (9,8 °C/km) jusqu'à rejoindre le profil (calcul exact sur
    chaque couche linéaire) ; la base des cumulus suit la règle d'Espy (125 m par °C d'écart
    température − rosée au sol) ; le plafond est la plus basse des deux. Sous le profil, la
    température suit la couche la plus basse (gradient borné entre −5 et 9,8 °C/km) et le point de
    rosée garde son rapport de mélange (1,8 °C/km) ;
  - **les thermiques** : × (épaisseur de la couche convective / 800 m)^(1/3) (vitesse convective
    de Deardorff), au plus × 1,15, et nuls au-dessus du plafond (fondu sur 200 m) ;
  - **les brises plafonnées** : de jour, brises de pente, de vallée, régionales et documentées
    s'effacent sur 300 m au-dessus du plafond (une couche stable coiffe le vent de vallée,
    Whiteman 2000) ; pas la nuit, où les écoulements froids vivent dans l'air stable ;
  - **la nébulosité** : l'ensoleillement qui pilote les brises de jour et les thermiques est
    × (1 − 0,75 N^3,4), N la couverture basse et moyenne (recouvrement aléatoire) : formule de
    Kasten et Czeplak (1980) ; ciel couvert : un quart du soleil.

  Sans couches (« standard » à la main), le modèle est exactement celui de la journée type
  (`npm run model:check` inchangé : 1203/1329). Les masses d'air manuelles (`presetAir`) sont des
  sondages d'ordre de grandeur : couche brassée (9,3 °C/km) jusqu'à 1 600 m (stable), 2 400 m
  (standard avec inversion) ou 3 200 m (instable), couche de couverture de 200 m, air libre
  (4,5 / 6 / 6,5 °C/km) jusqu'à 4 000 m puis 4 °C/km ; écart rosée au sol réglé pour des cumulus
  vers 2 800 m en instable, aucun en stable ; une inversion choisie coiffe la couche brassée à
  son altitude (+2 °C sur 200 m) et y réduit le vent à 30 % (vallée abritée). Les fonctions de
  profil sont dans `packages/model/src/air.ts`, transcrites dans `model-glsl.ts` (`airWind`,
  `airTemp`, `airCeiling`) ; GPU et CPU concordent à 0,007 m/s et 0,0003 de thermique près (sonde
  à 7 lieux × 4 réglages, avec et sans couches).
- **Abri (sous le vent)** : indice de Winstral — angle maximal du relief au vent sur 200 m à 5 km,
  pris au quart de la hauteur simulée (le décollement et ses rotors collent à la pente sous la
  crête) ; un angle de 8° à 22° fait passer l'abri de 0 à 1. Les zones abritées perdent le vent
  météo et gagnent de la turbulence (rotors).
- **Dangers documentés** : un piège que les sources lient à un vent (« turbulent par nord même
  faible », « rouleaux par vent d'ouest ») est une zone de 300 m à 1 km autour de l'endroit
  signalé. Quand le vent simulé correspond (direction à ±45°, force : dès 5 km/h si « même
  faible », 18 km/h si « fort », 10 km/h sinon), la zone s'affiche sous le vent, en venturi ou
  turbulente, et la sonde nomme le danger avec ses sources. Le relief seul ne voit pas tout : au
  col du Coq par nord faible, il ne trouve presque rien, les pilotes y décrivent une « machine à
  laver ».
- **Brises fortes documentées** : une brise que les sources disent forte à un endroit (« brise de
  vallée très forte au col-parking », « dans le dos au déco après 12 h 30 ») y atteint au moins
  25 km/h (30 si « très forte ») aux heures citées, ou par le vent cité ; jamais par vent météo
  fort (elle s'efface comme toute brise thermique), seulement par canicule si elle le dit, jamais
  pour un orage (événement, pas journée type). Sa direction vient des sources quand elles la
  donnent (`research_notes/…/dangers/directions.json`, relu cas par cas) ; sinon celle de
  l'écoulement local, ou la montée de la pente au décollage. Un même endroit peut porter jusqu'à
  quatre dangers documentés aux conditions différentes (rotors par nord, brise forte par sud…).
- **Exposition (au vent)** : composante du vent face à la pente → ascendance dynamique.
- **Canalisation** : dans les vallées, le vent est ramené sur l'axe, proportionnellement à la
  profondeur de la vallée.
- **Venturi** : accélération jusqu'à +45 % dans les passages confinés (cols, cluses).
- **Compétition brise / météo** : au-delà d'environ 35 km/h de vent météo, les brises thermiques
  sont largement effacées ; en dessous, elles se combinent vectoriellement.

**Occupation du sol** (`landcover.ts`, `RULES.surfaceHeating`) : la carte ESA WorldCover 10 m (2021)
donne pour chaque maille de 216 m la part de forêt, de roche et sol nu, de neige et glace et de bâti.
Le sol chauffe l'air selon son albédo, son humidité (rapport de Bowen) et sa capacité thermique :
roche, éboulis, sol sec et bâti × 1,25, prairies et cultures × 1, forêt × 0,8 (elle stocke et rend la
chaleur le soir), neige et glace × 0,1 (pas de thermique sur un glacier) ; le facteur est divisé par
sa moyenne sur les terres de toute la grille (0,909), la même pour la carte et pour la fenêtre du
jeu. Contrôle : 21 thermiques documentés de plus au-dessus de la médiane locale (atterrissages,
terrains de sport, confluences et plaines bâties, que les pilotes disent déclencher), 7 cas limites
en moins ; total 1203/1329 au lieu de 1189.

**Faces au vent** (`RULES.windwardExposure`) : plus bas dans la vallée, le vent météo faiblit
(abri du relief), sauf sur une face tournée vers lui, où l'air est forcé vers le haut : la
réduction s'efface quand la pente que le vent remonte passe de 3° à 17°, sauf si la face est
elle-même sous le vent d'un autre relief. Contrôle sur les 115 sites de soaring de l'atlas, sous
leur vent documenté à 20 km/h, à 100 m du sol : de l'air qui monte à plus de 1 m/s (de quoi tenir
en l'air) sur 47 sites au lieu de 17, médiane 0,9 m/s au lieu de 0,6.

**Ascendance dynamique par échelles** (`RULES.dynamicLiftScales`) : la vitesse verticale U·∇z
forcée par le relief est décomposée en trois parts, la pente (gradient lissé sur ≈ 0,2 km), la
crête (≈ 0,5 km) et le massif (≈ 1,2 km), qui s'effacent avec la hauteur sur 350, 700 et 1500 m :
en écoulement potentiel, la perturbation d'un relief de demi-largeur a s'éteint sur ≈ a. Les parts
sont des différences d'échelles, si bien qu'une pente uniforme ne compte qu'une fois. La portance
d'une crête large monte donc plus haut que celle d'une petite pente : 59 sites de soaring sur 115
au-dessus de 1 m/s (au lieu de 47), médiane 1,0 m/s.

**Stabilité de l'air** (`stabilityFactors`, `RULES.lapseStandard`…) : la prévision
donne, heure par heure, le gradient de température entre 850 et 700 hPa (≈ 1500 → 3000 m, AROME
via Open-Meteo, avec les altitudes géopotentielles des deux niveaux). Règle des pilotes : en dessous
de ≈ 5 °C/km l'air est stable (thermiques faibles et bas), au-dessus de ≈ 7 il est instable (bons
thermiques, le vent d'altitude descend dans les vallées). Le potentiel thermique est multiplié par
1 + 0,18 × (Γ − 6,5), entre 0,4 et 1,3 ; le vent météo prend le dessus sur les brises à partir de
35 km/h × (1 − 0,1 × (Γ − 6,5)), entre × 0,7 et × 1,4 : l'air stable laisse les vallées dans leur
brise sous un vent fort en altitude. À la main, « standard » garde l'atmosphère standard (6,5 °C/km,
facteurs neutres) ; « stable » et « instable » prennent 4,5 et 7,8 °C/km. Pentes : hypothèses
d'ordre de grandeur. Ce gradient global règle la force des thermiques et la tenue des brises ;
l'air par couches y ajoute, maille par maille, le plafond, l'épaisseur convective et le vent de
chaque altitude (ci-dessus). Le panneau « Situation » résume l'air en une ligne de briefing
(« Instable, base 2 800 m, NO 20 km/h aux crêtes, inversion 1 400 m à 9 h » : stabilité du
gradient 850–700 hPa, base des cumulus ou plafond des thermiques bleus au-dessus du sol lu, vent
des crêtes, première inversion — couche où la température ne baisse plus, ≤ 0,5 °C/km — au-dessus
du sol, ou celle du matin de 6 h à 11 h), le profil vertical (vent par altitude, couches
stables et inversions, couche convective, base, altitude lue) et les phénomènes documentés actifs
dans la vue (`air-brief.ts`).

## 6. Grandeurs dérivées

- **Convergence** : divergence horizontale lissée du champ, convertie en vitesse verticale sur
  une épaisseur de 700 m. Les lignes de convergence ressortent là où deux brises se rencontrent.
- **Potentiel thermique** : ensoleillement × convexité du relief (éperons, crêtes > creux) ×
  saison, diminué par le vent fort et, sous le vent d'un relief (abri ou danger documenté),
  déchiré par le rotor et l'air qui descend : jusqu'à −60 % quand le sous-le-vent est complet,
  à mesure que le vent passe de 10 à 30 km/h (`RULES.leeThermalCut`, comme dans le jeu). Le déclenchement se fait **face par face** :
  chaque maille cumule l'ensoleillement reçu depuis le lever du soleil sur sa propre pente
  (intégrale de cos(incidence) × atténuation du soleil bas, par pas d'au plus 30 min, sans ombres
  portées), exprimé en heures équivalentes de plein soleil. Le potentiel est nul en dessous de
  1 h équivalente et complet à 3 h (`RULES.thermalSunHours`) : une face est à 30° atteint 1 h
  environ 2 h après le lever (fin de la phase calme de la fiche de Saint-Hilaire : « du lever du
  soleil à 2 h après : calme ; … dès 3 h d'ensoleillement : thermiques ») et 3 h environ 4 h 30
  après, au milieu des 3 h 30 à 5 h que met le soleil à détruire l'inversion nocturne d'une
  vallée alpine (Whiteman 2000, ordre de grandeur). Les faces est démarrent donc le matin, les
  faces ouest en fin de matinée ou l'après-midi, les fonds plats entre les deux ; l'atténuation de
  l'après-midi (déclin du cycle des brises, jusqu'à moitié) est inchangée. Ce cumul ne dépend que
  de l'heure et de la date : il est recalculé dans la passe d'ensoleillement (canal g de la
  texture), pas à chaque image.
  Contrôle (`npm run model:check`, 53 débuts explicites des fiches) : écart médian modèle − fiche
  de −1 h 30 avec l'ancien facteur global à −45 min ; 22 sites à ±1 h au lieu de 11. Restent en
  avance les débuts « à partir de 16 h » de faces ouest de l'Oisans (Vaujany, Deux-Alpes), qui ne
  sont pas limités par l'ensoleillement, et en retard d'environ 1 h les faces documentées « dès le
  matin » ou « dès 8 h » (Flégère, Planpraz, façade de Saint-Hilaire) : le MNT à 216 m adoucit les
  falaises (la façade de Saint-Hilaire y est une pente de 20° au sud-est), qui reçoivent donc
  moins de soleil matinal que dans la réalité.
  **Poche froide du matin** (`coldPoolBurial`, `RULES.coldPoolShare`…) : l'air froid de la nuit
  remplit le bas de chaque vallée, et le soleil doit détruire cette inversion avant que les
  thermiques n'en sortent (3 h 30 à 5 h après le lever, Whiteman 2000), alors que les pentes
  au-dessus n'ont qu'une mince inversion de surface à réchauffer. La poche occupe 35 % de la
  profondeur de la vallée, entre 100 et 500 m, davantage après une longue nuit (× durée de la
  nuit / 9 h, au plus × 1,5 : printemps, automne) ; un vent météo de 10 à 30 km/h la brasse.
  Une maille est dans la poche jusqu'à mi-hauteur, dehors au-dessus de son sommet ; dans la
  poche, il lui faut 2 à 4 h équivalentes de soleil au lieu de 1 à 3 h. Un fond plat montre
  ainsi sa première colonne 5 à 6 h après le lever en juillet (Montlambert, « dès le début
  d'après-midi » : 12 h au lieu de 11 h).
  **Inertie thermique** (`RULES.thermalMemory`, `TimeContext.sunRecent`) : le moteur thermique
  est le plus grand du soleil direct et de la moitié de l'ensoleillement récent, c'est-à-dire la
  moyenne, ombres portées comprises, des 2 dernières heures pondérées par exp(−âge / 1 h). Une face
  qui passe à l'ombre garde donc des thermiques une heure environ, et une ascendance douce reste
  le soir sur les faces chauffées l'après-midi et sur les fonds de vallée, un peu après le coucher
  du soleil : c'est la « restitution du soir » de 82 fiches de l'atlas, que le modèle ignorait.
  Le cumul et l'ensoleillement récent sont calculés dans la passe d'ensoleillement (canaux g et
  b), seulement quand l'heure change ; GPU et CPU concordent à 0,001 près (sonde à 7 lieux × 6
  heures).
  **Saison des thermiques** (`thermalSeasonFactor`, `RULES.thermalSeason`) : les brises gardent le
  facteur de saison de la § 2, mais l'incidence du soleil bas sur chaque pente est déjà dans
  l'ensoleillement ; pour les thermiques, la saison n'ajoute que le trajet plus long du soleil
  de midi dans l'atmosphère (transmittance 0,75 par masse d'air, rapportée au soleil de midi
  de juillet) et le rendement moindre d'un sol froid sous des inversions plus fréquentes
  (jusqu'à × 0,75, hypothèse). Une face sud garde ainsi ≈ 0,65 de son intensité d'été en
  février et 0,7 en octobre, au lieu de 0,3 : les thermiques d'hiver de la Riviera (Gourdon,
  Courmettes, Tourrettes) et d'octobre (Aussois, Grande Ruine) ont leur colonne, et les fonds
  de vallée restent sous l'inversion.
- **Ascendance totale** (sonde) : dynamique + thermique + convergence.

## 7. Prévision du point (sonde)

Profil vertical AROME 2,5 km (10 niveaux de 950 à 500 hPa : température, point de rosée, vent,
géopotentiel) et hauteur de couche limite ECMWF IFS. Indicateurs :

- base des cumulus par la règle d'Espy (125 m par °C d'écart température / point de rosée) ;
- sommet des thermiques : ascension d'une particule 1,5 °C plus chaude que l'air à 2 m,
  adiabatique sèche puis humide, jusqu'à l'équilibre avec le profil ;
- vitesse convective de Deardorff `w*` à partir d'un flux de chaleur estimé (saison, nébulosité),
  taux de montée ≈ `w*` − 1,1 m/s (taux de chute d'une voile).

La sonde lit aussi l'air par couches de la simulation (§ 5) à l'altitude lue : vent de la masse
d'air avant le relief, gradient de la couche et sa lecture (inversion, couche stable, instable,
brassée), plafond thermique de ce sol (ou base des cumulus) et l'écart à l'altitude lue, prochaine
inversion au-dessus. Le profil du point (AROME, 10 niveaux) reste l'émagramme détaillé ; l'air
qui pilote la carte est celui de la maille de 0,25° du centre de la vue.

## 8. Limites connues

- Résolution 216 m : les petites combes et les effets de détail des décollages échappent au modèle.
- Pas de dynamique : pas de fœhn, de ressauts ni d'ondes ; la stabilité ne règle que la force et le
  plafond des thermiques, la tenue des brises et leur plafond, pas encore le sous-le-vent (nombre
  de Froude). La journée type « Foehn » ne pose que le vent et l'air stable.
- Un seul sondage pour toute la carte : celui de la maille de 0,25° du centre de la vue, repris
  quand la vue bouge de plus de 20 km ; pas de champ spatialisé (évolution prévue, ARCHITECTURE).
  Les niveaux sous le relief lissé d'AROME sont extrapolés par le modèle de prévision ; on les
  garde, faute de mieux, pour les fonds de vallée. Le vent bas d'AROME est déjà freiné par son
  relief, et le modèle le freine encore en fond de vallée : les vallées peuvent être trop calmes
  sous un vent de basse couche.
- La particule thermique a un excès fixe de 1,5 °C, sans dépendre de l'ensoleillement de la pente ;
  les sommets au-dessus de la couche convective régionale ont un plafond de quelques centaines de
  mètres, sans la couche convective propre aux reliefs chauffés.
- Les horaires de brise suivent une journée ensoleillée type ; la nébulosité prévue affaiblit
  brises et thermiques (Kasten et Czeplak) sans décaler leurs horaires, et l'humidité du sol
  n'est pas prise en compte. À la main, le ciel est clair.
- Déclenchement thermique : écart médian de −30 min sur les 58 débuts explicites, testés dans
  leur saison (`docs/MODEL_QA.md`). Les fiches « dès 11h », qui donnent souvent l'heure des
  thermiques utiles, et les points chauds « le matin », qui démarrent dans le modèle 15 à 45 min
  après le milieu de matinée, tirent en sens opposés.
- Automne et hiver : le rendement du sol froid (× 0,75 au plus bas) est une hypothèse ; la neige,
  qui supprime les thermiques, n'est pas encore modélisée (occupation du sol, audit § 3).
- La recherche (deux passes, 1435 sources) laisse des secteurs moins documentés (basse Maurienne,
  Queyras, Champsaur, Montagne de Lure) et des positions estimées, signalées dans les fiches. Les
  retours de pilotes sont le moyen prévu pour combler ces lacunes.
