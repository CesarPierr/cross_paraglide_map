# Architecture

Principes : le calcul lourd (simulation du vent, rendu) tourne chez le client ; le serveur sert des
données compactes et mutualise les appels aux API externes. Chaque source de données est derrière
une interface ; chaque famille de couches de la carte est un module indépendant.

```
                    ┌──────────────────────── navigateur ────────────────────────┐
 atlas, MNT,        │ React (UI, zustand)                                       │
 espaces aériens ──►│   │ état (heure, vent, couches)                           │
 (fichiers          │   ▼                                                       │
  statiques)        │ MapController ──► modules : Relief · Kk7 · Airspace ·     │
                    │                   Knowledge · Sites · Labels · Wind       │
                    │                                              │            │
                    │                    GpuWindEngine (WebGL2) ◄──┘            │
                    │                    textures terrain ← Worker (packages/model)
                    │ DataClient : ApiClient | StaticClient                      │
                    └──────────────┬─────────────────────────────────────────────┘
                                   │ /api
                    ┌──────────────▼───────────── serveur ───────────────────────┐
                    │ Fastify : atlas (br/gzip + ETag) · features/sites (PostGIS)│
                    │ contributions (modération) · météo · annuaires             │
                    │ UpstreamCache (mémoire → table http_cache → amont)         │
                    │ QuotaMeter (appels pondérés / jour / fournisseur)          │
                    └──────────────┬─────────────────────────────────────────────┘
                                   ▼
                     PostgreSQL + PostGIS        Open-Meteo, Overpass, PGE…
```

## Paquets

| Paquet | Contenu | Dépendances |
| --- | --- | --- |
| `packages/model` | Analyse du terrain (drainage, axes de vallée, enveloppes, lacs, plaines), position du soleil, champ de vent de référence en TS pur. Sert au worker (repli CPU, précalcul des textures), aux scripts et aux tests. | aucune |
| `packages/shared` | Types de l'atlas, contrats `WeatherProvider` / `SiteProvider`, schéma TypeBox des contributions (validé par l'API, typé côté web), clients Open-Meteo, OSM Overpass, ParaglidingEarth, indicateurs thermiques. | `@sinclair/typebox` |
| `apps/web` | Application. | model, shared |
| `apps/api` | Serveur. | shared |

## Front (`apps/web/src`)

- `map/controller.ts` — orchestrateur mince : crée la carte, ordonne les modules, relaie l'état,
  route les clics (`describe()` du module) vers la fiche, sinon vers la sonde.
- `map/modules/*` — un module = un ensemble de couches. Interface `MapModule` (`types.ts`) :
  `add(ctx)`, `apply(state, prev)`, `describe(id, props)`, `dispose()`. Les couches s'insèrent
  dans des *slots* ordonnés (`base`, `analysis`, `areas`, `lines`, `scene`, `points`, `labels`),
  ce qui permet d'ajouter un module sans connaître les autres.
- `gpu/` — moteur WebGL2. `model-glsl.ts` est le portage GLSL de `packages/model/src/field.ts`
  (**à garder synchrones** : toute modification de la physique se fait dans les deux fichiers ; le repli CPU et les tests du modèle utilisent la version TS).
  Passes : ensoleillement avec ombres portées → champ (vent, portance dynamique, turbulence,
  thermique, abri, venturi) → convergence/portance totale → sonde / points chauds / échantillons.
  `wind-scene.ts` : couches personnalisées MapLibre (moteur, drapage sur le relief, scène 3D :
  particules, comètes, bulles).
- `engine/` — worker du modèle CPU (précalcul des textures statiques, repli sans GPU).
- `data/client.ts` — `DataClient` : `ApiClient` si `/api/health` répond, sinon `StaticClient`
  (fichiers `public/data`, Open-Meteo et annuaires appelés directement, retours via un ticket
  GitHub pré-rempli). Le reste de l'UI ignore le mode.
- `state/store.ts` — `useApp` (réglages de simulation et d'affichage) et `useRuntime` (état éphémère : sonde, fiche, brouillon de contribution). La vue caméra est dans le hash de l'URL (partageable).
- `ui/` — composants (barre latérale, fiches, sonde, panneau de contrôle, frise horaire, retours).

## API (`apps/api/src`)

| Route | Rôle | Cache HTTP |
| --- | --- | --- |
| `GET /api/health`, `/api/usage` | état, compteurs de quotas | non |
| `GET /api/atlas` | atlas complet, pré-compressé br/gzip au démarrage, ETag → 304 | `max-age=300, stale-while-revalidate` |
| `GET /api/massifs/:id` | un secteur | oui |
| `GET /api/features?bbox&category` | GeoJSON depuis PostGIS (index GiST) | oui |
| `GET /api/sites?bbox` | sites FFVL importés | oui |
| `GET /api/sites/external/:provider?bbox` | OSM / PGE via cache partagé (tuiles 0,5°, 24 h) | oui |
| `GET /api/weather/synoptic`, `/point` | prévisions mutualisées (voir ci-dessous) | durée restante avant le prochain run |
| `POST /api/contributions` | retours et ajouts (TypeBox strict, 20/h/IP) | — |
| `GET /api/contributions/summary` | compteurs « confirmé / pas observé » | oui |
| `GET/PATCH /api/admin/contributions[/export]` | modération (`Authorization: Bearer ADMIN_TOKEN`) | — |

Base : `db/migrations/*.sql` (appliquées au démarrage, table `schema_migrations`). Tables `massifs`,
`features` (géométrie + propriétés jsonb), `curated_breezes`, `model_rules`, `sources`, `sites`,
`contributions` (IP hachée avec sel, jamais en clair), `http_cache`, `api_usage`.
`db/client.ts` abstrait `postgres` (production) et PGlite + PostGIS (dev, tests) derrière `Db`.

### Météo : cache et quotas

- Une prévision est partagée par maille : 0,25° pour le vent synoptique, 0,02° (maille AROME)
  pour le profil d'un point.
- Chaque entrée est étiquetée par le run du modèle de référence (`meta.json` d'Open-Meteo, lu
  toutes les 5 min et non décompté). Elle reste fraîche jusqu'à la disponibilité du run suivant
  + 10 min, bornée entre 10 min et 3 h (1 h si le run est inconnu). Un nouveau run rend
  toutes les entrées obsolètes d'un coup.
- Si l'amont échoue ou si le quota est atteint, l'entrée précédente est servie avec
  `X-Data-Stale: 1`. Sans entrée : 503 + `Retry-After`.
- Requêtes concurrentes identiques fusionnées (un seul appel amont).
- `QuotaMeter` compte les appels pondérés selon la règle Open-Meteo
  (`max(1, variables / 10)` par requête et par lieu ; un point ≈ 6,6 appels) et refuse au-delà de
  `WEATHER_DAILY_BUDGET`. Un 429 « daily » de l'amont épuise le budget jusqu'au lendemain UTC.

## Points d'extension

- **Nouvelle couche de données** : un module dans `map/modules/` + son ordre dans `controller.ts`
  + une bascule dans `ControlPanel`.
- **Nouveau fournisseur météo** : implémenter `WeatherProvider` (`packages/shared/src/providers.ts`)
  et l'injecter dans `WeatherService` (serveur) ou `StaticClient`.
- **Nouvel annuaire de sites** : implémenter `SiteProvider` ; le proxy `/api/sites/external/:id`
  et le module Sites le prennent en charge.
- **Nouvelles données d'atlas** : voir [DONNEES.md](DONNEES.md).
- **Nouvelle table** : un fichier `db/migrations/00N_*.sql`.

## Évolutions prévues

Non implémentées, mais préparées :

1. **Météo en direct** : un `WeatherProvider` « grille » (champ AROME précalculé côté serveur sur
   la bbox du MNT, envoyé en texture au moteur GPU à la place du vent uniforme). Le moteur accepte
   déjà un vent synoptique par heure ; il faudra une texture de vent spatialisée (`uSynopticTex`).
   Balises temps réel : un module de carte + un fournisseur derrière le cache amont.
2. **Traces de vol (XCTrack, IGC)** : table PostGIS `tracks` (LineStringZM), découpage en segments
   (spirales = thermiques, lignes droites = transitions), agrégats par maille (taux de montée,
   vent dérivé de la dérive) servis comme couche de chaleur, puis calage des paramètres de
   `RULES` et des brises documentées par comparaison avec le modèle.
3. **Autres Alpes** : élargir `DEM_BBOX`, régénérer le MNT, ajouter des jeux de données au même
   contrat.
