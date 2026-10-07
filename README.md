# Brises des Alpes

Carte 3D interactive de l'aérologie des Alpes françaises pour le vol libre et le cross :
brises de vallée et de pente, convergences, pièges, thermiques connus, soaring, décollages
et atterrissages, simulés en direct dans le navigateur selon l'heure, la saison et le vent météo.

> Outil d'aide à la compréhension, pas un outil de décision. Les brises simulées sont un modèle
> conceptuel calé sur la littérature et les retours de pilotes ; vérifiez toujours la météo
> officielle, les fiches FFVL et les espaces aériens (SIA) avant de voler.

## Ce que fait le site

- **Relief 3D navigable** (MNT 216 m, exagération réglable) sur orthophoto IGN, plan IGN, OpenTopoMap
  ou relief ombré autonome, avec l'ombrage solaire réel de l'heure choisie.
- **Simulation de vent côté client (GPU WebGL2)** : brises de pente, de vallée, de lac, de plaine
  vers la montagne, vent météo canalisé, abrité (sous le vent) ou accéléré (venturi), convergences
  calculées. Changement d'heure, de mois ou de vent instantané ; repli CPU (Web Worker) si besoin.
- **Animations** : particules de vent avec traînées, comètes le long des brises documentées,
  colonnes thermiques ; surcouches « exposition au vent », « sous le vent », « potentiel thermique »,
  « convergences », « vitesse ».
- **Atlas sourcé** : 46 secteurs, 96 brises, 18 convergences, 69 pièges, 64 décos et 34 attéros cités,
  15 itinéraires, 278 sources. Chaque élément affiche ses sources numérotées (éditeur, type, lien).
- **Sonde** : clic sur la carte → décomposition du vent local (pente, vallée, plaine/lac, météo),
  thermique, convergence, turbulence, et prévision AROME du point (plafond, couche limite,
  isotherme 0°, émagramme simplifié) avec bouton « simuler avec ce vent ».
- **Sites et espaces aériens** : sites FFVL officiels, sites communautaires (OpenStreetMap,
  ParaglidingEarth) distingués visuellement, espaces aériens (données planeur-net, indicatif),
  cartes de thermiques et de cheminements kk7.
- **Retours des pilotes** : « je confirme / pas observé », corrections, commentaires, et ajout d'un
  phénomène tracé sur la carte. Relus par un modérateur avant d'entrer dans l'atlas.

## Démarrage rapide

Prérequis : Node.js 22+, npm 10+.

```bash
npm ci
npm run dev          # front seul (mode autonome : données statiques, retours via GitHub)
npm run dev:api      # dans un 2e terminal : API + base PGlite locale (aucune installation)
```

Ouvrir http://localhost:5173. Avec l'API lancée, le badge passe à « en ligne » (le serveur Vite
redirige `/api` vers le port 8080) : atlas servi par la base, prévisions mutualisées, contributions.

Contrôles : glisser pour tourner, clic droit / Ctrl+glisser pour incliner, `Espace` lecture de la
journée, `Maj+←/→` heure par heure, `Échap` ferme les fiches.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `npm run dev:api` | développement front / API |
| `npm run build` | typage + build du front (`apps/web/dist`) et de l'API (`apps/api/dist`) |
| `npm run typecheck` · `npm run lint` · `npm test` | contrôles (31 tests : modèle, données, API) |
| `npm run e2e` | parcours headless Chromium + captures (`test-results/`) |
| `npm run data:dem` | télécharge et assemble le MNT (tuiles Terrarium AWS) |
| `npm run data:build [-- dossier…]` | compile les recherches JSON en atlas (+ `docs/DATA_QA.md`) |
| `npm run data:airspace` | espaces aériens (planeur-net) |
| `npm run data:sites` | import des sites FFVL (data.gouv) |
| `npm run data:contributions` | contributions acceptées → jeu de données de l'atlas |

## Organisation

```
apps/web         Front React 19 + MapLibre GL 6 + moteur GPU (Vite)
apps/api         API Fastify 5 + PostgreSQL/PostGIS (PGlite en dev et tests)
packages/model   Modèle de vent de référence en TypeScript (terrain, soleil, brises)
packages/shared  Types de l'atlas, contrats des fournisseurs, schéma des contributions, clients API libres
scripts          Pipeline de données (MNT, atlas, espaces aériens, sites, contributions)
research_notes   Recherche brute par secteur (Markdown + JSON) et contrat de données (_schema.md)
reports          Synthèse rédigée de la recherche
deploy           Dockerfiles et configuration Nginx
docs             Architecture, méthodologie, déploiement, données, benchmark météo
```

## Documentation

- [Architecture et points d'extension](docs/ARCHITECTURE.md)
- [Méthodologie du modèle de vent](docs/METHODOLOGIE.md)
- [Données : contrat, ajout d'une collecte, contributions](docs/DONNEES.md)
- [Déploiement serveur](docs/DEPLOYMENT.md)
- [Benchmark des sources météo et règles de cache](docs/WEATHER_BENCHMARK.md)
- [Qualité des données](docs/DATA_QA.md) · [Synthèse de la recherche](reports/Brises%20des%20Alpes%20fran%C3%A7aises.md)

## Feuille de route (non implémentée)

1. **Météo en direct** : vent synoptique et profils sur une grille préchargée (AROME via
   Météo-France ou Open-Meteo auto-hébergé), balises temps réel (FFVL, Pioupiou, Holfuy).
2. **Collecte de traces** (XCTrack, IGC) : estimation des thermiques, des brises et des zones
   descendantes à partir de la vitesse et du taux de montée des pilotes, puis calage du modèle.
3. Extension aux Alpes suisses, italiennes et autrichiennes (même contrat de données).

L'architecture prévoit ces ajouts (fournisseurs abstraits, modules de carte, cache amont,
tables PostGIS) sans les activer. Voir [ARCHITECTURE.md](docs/ARCHITECTURE.md#evolutions-prevues).

## Licences des données

Relief : Terrain Tiles (AWS, Mapzen ; SRTM, EU-DEM…). Imagerie : IGN Géoplateforme, OpenTopoMap,
OpenFreeMap / OpenStreetMap. Prévisions : Open-Meteo (CC BY 4.0, usage non commercial du plan
gratuit). Sites : FFVL (data.gouv), OpenStreetMap (ODbL), ParaglidingEarth. Espaces aériens :
planeur-net (indicatif). Cartes kk7 : thermal.kk7.ch. Les textes de l'atlas citent leurs sources.
