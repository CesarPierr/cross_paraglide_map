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
heures et à leur début documenté ; pièges sous le vent météo qu'ils citent. Le rapport
(`docs/MODEL_QA.md`) classe les échecs en défaut du modèle, défaut de donnée ou limite assumée, et
liste les données à corriger. À l'atlas de la seconde passe : 93 % des brises, 84 % des
convergences, 83 % des thermiques conformes.

## 5. Vent météo et relief

- **Saisie** : vent « des crêtes » (direction, force), ou prévision AROME (moyenne vectorielle
  850/700 hPa) via la sonde.
- **Abri (sous le vent)** : indice de Winstral — angle maximal du relief au vent sur 200 m à 5 km ;
  un angle de 8° à 22° fait passer l'abri de 0 à 1. Les zones abritées perdent le vent météo
  et gagnent de la turbulence (rotors).
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
  saison, diminué sous le vent et par le vent fort. Il ne démarre que 2 h 30 après le lever du
  soleil et atteint son plein 4 h 30 après (`RULES.thermalOnset`, fiche de Saint-Hilaire :
  « dès 3 h d'ensoleillement : thermiques ») ; avant, une pente au soleil ne fait encore que de la
  brise de pente.
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
