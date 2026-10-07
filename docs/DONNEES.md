# Données

## Fichiers servis au navigateur (`apps/web/public/data`)

| Fichier | Produit par | Contenu |
| --- | --- | --- |
| `dem.png` + `dem.json` | `npm run data:dem` | MNT 1094 × 1521 mailles (≈ 216 m) encodé Terrarium, bbox et résolution |
| `atlas.json` | `npm run data:build` | secteurs, éléments géolocalisés (GeoJSON), brises rastérisables, règles, sources |
| `airspace.json` | `npm run data:airspace` | espaces aériens simplifiés (planeur-net), à titre indicatif |
| `sites-ffvl.json` | `npm run data:sites` | sites FFVL (data.gouv) ; absent si l'import n'a pas pu être fait |

En production, l'API charge `atlas.json` et `sites-ffvl.json` dans PostgreSQL ; le front les reçoit
par `/api/atlas` et `/api/sites`. En mode autonome, il lit directement ces fichiers.

## Contrat des jeux de données de recherche

Le format d'entrée unique est décrit dans
[`research_notes/Brises des Alpes françaises/_schema.md`](../research_notes/Brises%20des%20Alpes%20fran%C3%A7aises/_schema.md).
Résumé : un fichier JSON par thème/région contenant `massifs[]` (avec `breezes`, `convergences`,
`hazards`, `thermal_spots`, `soaring_spots`, `takeoffs`, `landings`, `synoptic_effects`, `xc_routes`,
`tips`) et `sources[]`. Règles essentielles :

- coordonnées WGS84 `lon`, `lat` ; `coord_quality: "approx"` si la position est estimée ;
- les `waypoints` d'une brise sont **dans le sens de l'écoulement** (d'où vient l'air vers où il va) ;
- chaque élément cite des identifiants de `sources` du même fichier (`"S3"`) ; sans source :
  `confidence: "low"` et la mention « déduction » ;
- `hours` en texte libre (« 12h-19h (été) », « fin de matinée à fin d'après-midi ») : le pipeline
  en extrait la plage horaire ;
- vitesses en km/h (`speed_kmh.typical`, `speed_kmh.max`).

## Ajouter une nouvelle collecte (par ex. celle d'un autre agent)

1. Déposer les fichiers JSON au format ci-dessus dans un dossier, par exemple
   `research_notes/<titre de la collecte>/data/`.
2. Compiler en ajoutant ce dossier :

   ```bash
   npm run data:build -- "research_notes/<titre de la collecte>/data"
   # ou plusieurs : BRISES_DATA_DIRS="dossier1:dossier2" npm run data:build
   ```

3. Lire `docs/DATA_QA.md` (sources inconnues, coordonnées hors zone, brises non recalées…).
4. Vérifier sur la carte (`npm run dev`), puis recharger la base en production
   (`npm run seed -w @brises/api`).

Fusion : un secteur portant le **même `id`** qu'un secteur existant est complété (éléments,
conseils, effets du vent météo et sources ajoutés ; résumé concaténé s'il diffère) au lieu d'être
dupliqué. Les identifiants des sources sont préfixés par le nom du fichier, les doublons d'URL sont
fusionnés. Pour rattacher la collecte aux secteurs actuels, réutiliser leurs `id` (liste :
`jq '.massifs[].id' apps/web/public/data/atlas.json`).

Traitements appliqués par `scripts/build-data.ts` :

- recalage des brises de vallée sur le fond de vallée (plus court chemin sur le MNT entre waypoints) ;
- relocalisation des points approximatifs vers l'altitude déclarée (`alt_m`) dans un petit rayon ;
- extraction des horaires et de la force, conversion en brises « rastérisables » pour le modèle ;
- nettoyage des descriptions (les notes sur la méthode de collecte vont dans « Note de collecte ») ;
- numérotation des éléments et statistiques.

## Contributions des pilotes

Les retours saisis sur le site (`POST /api/contributions`) sont stockés avec le statut `pending`.

| `kind` | Usage | Effet |
| --- | --- | --- |
| `confirm` / `dispute` | « Je confirme » / « Pas observé » sur une fiche | compteurs affichés sous la fiche (hors refusés) |
| `correct` / `comment` | précision ou remarque sur une fiche | liste à reporter à la main |
| `new` | nouveau phénomène placé ou tracé sur la carte (`category` : breeze, convergence, hazard, thermal, soaring, takeoff, landing, other) | converti en élément d'atlas |

`targetRef` identifie l’élément visé (`atlas:<id>`, `massif:<id>`, `sites:<id>`, `airspace:<id>`). Le contexte de simulation vu par
le pilote (heure, mois, vent météo, vue) est joint pour faciliter la relecture.

Après modération (voir [DEPLOYMENT.md](DEPLOYMENT.md#exploitation)) :

```bash
API_URL=https://carte.exemple.fr ADMIN_TOKEN=… npm run data:contributions
# ou à partir d'un export enregistré : npm run data:contributions -- export.json
npm run data:build -- data/contributions
```

Le script écrit `data/contributions/contributions.json` (nouveaux éléments, rattachés au plus petit
secteur qui les contient, confiance « low », source « Contribution utilisateur ») et
`data/contributions/a-traiter.md` (corrections et commentaires à reporter dans les données sources).
