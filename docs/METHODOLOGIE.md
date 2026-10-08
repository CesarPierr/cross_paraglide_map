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
à midi).

## 3. Brises thermiques

| Régime | Moteur | Intensité de référence (`RULES`) | Horaire |
| --- | --- | --- | --- |
| Brise de pente montante | ensoleillement de la pente, raideur | jusqu'à 3 m/s, couche ≈ 140 m | suit le soleil (retard ≈ 1 h) |
| Brise catabatique | refroidissement nocturne | 1,6 m/s | nuit |
| Brise de vallée montante | taille de la vallée (surface drainée), suivant l'axe | jusqu'à 7 m/s (≈ 25 km/h) dans les grandes vallées | inversion ≈ 9 h 30, plein ≈ 13 h, déclin 16 h 30, inversion ≈ 19 h 30 (heure solaire) |
| Brise descendante de vallée | idem, sens inverse | 40 % du jour | nuit, matin |
| Brise de lac / de mer | distance au rivage | 3 / 5 m/s | ≈ 9 h → 19 h 30 |
| Aspiration plaine → montagne | position en avant-pays | 2,5 m/s | après-midi |

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

- **Saisie** : vent « des crêtes » (direction, force), ou prévision AROME (moyenne vectorielle
  850/700 hPa) via la sonde.
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
- **Exposition (au vent)** : composante du vent face à la pente → ascendance dynamique.
- **Canalisation** : dans les vallées, le vent est ramené sur l'axe, proportionnellement à la
  profondeur de la vallée.
- **Venturi** : accélération jusqu'à +45 % dans les passages confinés (cols, cluses).
- **Compétition brise / météo** : au-delà d'environ 35 km/h de vent météo, les brises thermiques
  sont largement effacées ; en dessous, elles se combinent vectoriellement.

## 6. Grandeurs dérivées

- **Convergence** : divergence horizontale lissée du champ, convertie en vitesse verticale sur
  une épaisseur de 700 m. Les lignes de convergence ressortent là où deux brises se rencontrent.
- **Potentiel thermique** : ensoleillement × convexité du relief (éperons, crêtes > creux) ×
  saison, diminué sous le vent et par le vent fort. Le déclenchement se fait **face par face** :
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
- **Ascendance totale** (sonde) : dynamique + thermique + convergence.

## 7. Prévision du point (sonde)

Profil vertical AROME 2,5 km (10 niveaux de 950 à 500 hPa : température, point de rosée, vent,
géopotentiel) et hauteur de couche limite ECMWF IFS. Indicateurs :

- base des cumulus par la règle d'Espy (125 m par °C d'écart température / point de rosée) ;
- sommet des thermiques : ascension d'une particule 1,5 °C plus chaude que l'air à 2 m,
  adiabatique sèche puis humide, jusqu'à l'équilibre avec le profil ;
- vitesse convective de Deardorff `w*` à partir d'un flux de chaleur estimé (saison, nébulosité),
  taux de montée ≈ `w*` − 1,1 m/s (taux de chute d'une voile).

## 8. Limites connues

- Résolution 216 m : les petites combes et les effets de détail des décollages échappent au modèle.
- Pas de dynamique : pas de fœhn, de ressauts, d'ondes, ni d'interaction stable/instable fine.
- Les horaires de brise suivent une journée ensoleillée type ; nébulosité et humidité du sol ne
  sont pas prises en compte dans la simulation.
- Le déclenchement thermique reste en avance d'environ 1 h 30 en médiane sur les débuts documentés
  (`docs/MODEL_QA.md`) : les fiches « le matin » et « dès 11h » tirent en sens opposés.
- La recherche (deux passes, 1435 sources) laisse des secteurs moins documentés (basse Maurienne,
  Queyras, Champsaur, Montagne de Lure) et des positions estimées, signalées dans les fiches. Les
  retours de pilotes sont le moyen prévu pour combler ces lacunes.
