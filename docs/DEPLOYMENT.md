# Déploiement

Pile de production : **Nginx** (front statique + proxy `/api`) → **API Node 22** (Fastify) →
**PostgreSQL 16 + PostGIS 3.4**. Un petit VPS (2 vCPU, 2 Go) suffit largement : le calcul du vent
est fait par les navigateurs, le serveur ne sert que des données mises en cache.

## Script d'installation (VM ou serveur)

```bash
bash deploy/install.sh --port 8080          # depuis un clone, ou via curl (voir l'en-tête du script)
```

Il clone ou met à jour le dépôt, génère `.env` avec des secrets aléatoires, construit et démarre la
pile, recharge l'atlas et affiche l'URL. Il est idempotent : le relancer met à jour.

## Avec Docker Compose (manuel)

```bash
git clone https://github.com/CesarPierr/cross_paraglide_map.git && cd cross_paraglide_map
cp .env.example .env        # renseigner POSTGRES_PASSWORD, ADMIN_TOKEN, IP_SALT (chaînes longues aléatoires)
docker compose up -d --build
curl http://localhost/api/health
```

Au premier démarrage, l'API applique les migrations puis charge l'atlas embarqué dans l'image
(`SEED_ATLAS`). Les données de la base (contributions, caches, compteurs) vivent dans le volume
`db-data`.

### HTTPS

Mettre un reverse proxy TLS devant le service `web` (Caddy, Traefik, ou Nginx + certbot), ou
changer `HTTP_PORT` et terminer TLS sur l'hôte. Si le front et l'API sont sur des domaines
différents, construire le front avec `VITE_API_URL=https://api.exemple.fr/api` et régler
`CORS_ORIGIN=https://carte.exemple.fr`. Derrière un proxy, l'API lit l'IP cliente dans `X-Forwarded-For`
(`TRUST_PROXY`, actif par défaut) pour les limites par IP.

## Variables d'environnement (API)

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | `pglite:.data/dev-db` | `postgres://…` en production ; `pglite:<dossier>` ou `pglite:memory` en dev |
| `PORT` / `HOST` | `8080` / `0.0.0.0` | écoute |
| `ADMIN_TOKEN` | — | jeton Bearer de modération (`/api/admin/*` désactivé s'il est vide) |
| `IP_SALT` | — | sel du hachage des IP des contributeurs |
| `CORS_ORIGIN` | `*` | origines autorisées, séparées par des virgules |
| `WEATHER_DAILY_BUDGET` | `8000` | appels Open-Meteo pondérés par jour UTC (plan gratuit : 10 000) |
| `TRUST_PROXY` | `true` | lit l'IP cliente dans `X-Forwarded-For` ; mettre `false` si l'API est exposée sans proxy |
| `LOG_LEVEL` | `info` | niveau des journaux (pino) |
| `SEED_ATLAS` / `SEED_SITES` | — | fichiers chargés si la base est vide |

## Sans Docker

```bash
npm ci && npm run build
# Base : créer une base PostgreSQL avec l'extension postgis.
DATABASE_URL=postgres://… ADMIN_TOKEN=… IP_SALT=… SEED_ATLAS=apps/web/public/data/atlas.json \
  node apps/api/dist/main.js
# Servir apps/web/dist avec deploy/nginx.conf (adapter le proxy_pass vers l'API).
```

`apps/api/dist/main.js` est un bundle autonome (migrations incluses) ; seuls `postgres` et, en dev,
PGlite restent des dépendances externes.

## Exploitation

- **Mise à jour de l'atlas** : `npm run data:build`, puis `DATABASE_URL=… npm run seed -w @brises/api`
  (lit `apps/web/public/data/atlas.json` et `sites-ffvl.json` par défaut ; remplace la base de connaissances, conserve contributions et caches), ou reconstruire l'image
  et vider la table `massifs` pour un nouveau seed automatique.
- **Modération** : `GET /api/admin/contributions?status=pending`, puis
  `PATCH /api/admin/contributions/<id>` avec `{"status":"accepted"|"rejected","reviewNote":"…"}`.
  Les contributions acceptées s'intègrent à l'atlas avec `npm run data:contributions` (voir
  [DONNEES.md](DONNEES.md)).
- **Quotas** : `GET /api/usage` montre les appels consommés aujourd'hui par fournisseur.
- **Sauvegardes** : `docker compose exec db pg_dump -U brises brises > sauvegarde.sql`.
- **Cache** : la table `http_cache` est purgée toutes les heures des entrées expirées depuis 48 h.

## Météo et usage commercial

Le plan gratuit d'Open-Meteo est réservé à l'usage non commercial (10 000 appels/jour par IP).
Pour un service commercial : abonnement Open-Meteo (≈ 29 €/mois et plus) ou auto-hébergement de
l'image Docker d'Open-Meteo (autorisé), ou données Météo-France directes. Détails :
[WEATHER_BENCHMARK.md](WEATHER_BENCHMARK.md).

## Intégration continue

`.github/workflows/ci.yml` : `npm ci`, typage, lint, tests (dont l'API sur PGlite + PostGIS), builds
du front et de l'API à chaque push et pull request.
