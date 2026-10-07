# Passation : développement, déploiement sur la dev VM, reprise de la recherche

Document destiné à l'agent (Claude Code local ou autre) qui reprend le projet sur la machine de
l'utilisateur. Il est autoportant : lis-le en entier, puis `README.md` et `docs/ARCHITECTURE.md`.
Un **prompt d'amorçage** prêt à coller est donné à la fin (§ 10).

---

## 1. Mission et utilisateur

**Brises des Alpes** : carte 3D interactive de l'aérologie des Alpes françaises pour le parapente
et le cross. On y voit les brises de vallée et de pente, les convergences, les pièges, les
thermiques, le soaring, les décollages et les atterrissages. Le vent est simulé dans le
navigateur selon l'heure, le mois et le vent météo (ex. « ouest 10 km/h »).

Ce que l'utilisateur a demandé, et qui reste valable :

- **Langue** : il écrit en français et veut des réponses en français. L'interface est en français.
  Le code et les commentaires sont en anglais.
- **Qualité** : rendu 3D beau, optimisé et navigable. Animations de flux (au vent, sous le vent,
  thermiques). Calcul côté client, serveur léger. Navigation et changement de paramètres fluides.
  DA moderne et épurée, centrée sur l'info utile. UX intuitive, infos faciles à découvrir.
  UI « assez minimaliste mais pas trop », fonctionnelle et informative. Soin du détail.
- **Code** : propre et extensible, back-end compris, pour accueillir plus tard la météo en direct
  et la collecte de traces XCTrack (carte des thermiques et brises déduite de la vitesse des
  pilotes). Ces deux évolutions restent **de la feuille de route uniquement**, à ne pas implémenter
  sans demande explicite.
- **Données** : chaque phénomène affiche ses sources, de façon discrète mais utile pour creuser.
  Retours rapides des utilisateurs pour enrichir la base. Décollages et atterrissages officiels et
  communautaires. Ajout libre d'API gratuites simples qui apportent de l'info de base.
- **Une autre collecte exhaustive par massif** arrivera d'un autre agent de l'utilisateur. Elle
  doit s'intégrer sans friction (voir `docs/DONNEES.md`).
- **Hébergement** : full stack avec base de données sur serveur. Tout optimisé, back-end compris.
- **API gratuites** : attention aux quotas journaliers (Open-Meteo) et à la durée de cache, car
  la météo évolue. Benchmark fait : `docs/WEATHER_BENCHMARK.md`.
- **Prochaine étape demandée** : déployer sur sa **dev VM en SSH** pour avoir l'interface sur son
  serveur local, et **reprendre la recherche complète** sans les limites réseau de l'environnement
  cloud où le projet a été construit.

## 2. État actuel (branche `claude/french-alps-wind-simulation-g2ovxt`)

Fait et vérifié :

- Monorepo npm : `apps/web` (Vite 8, React 19, MapLibre GL 6, zustand), `apps/api` (Fastify 5,
  PostgreSQL/PostGIS ; PGlite en dev et en test), `packages/model` (modèle de vent en TS),
  `packages/shared` (types, contrats, clients d'API libres).
- Moteur de vent sur GPU (WebGL2), repli CPU en Web Worker. Particules, comètes le long des brises
  documentées, colonnes thermiques, surcouches (exposition, abri, thermique, convergence, vitesse).
- Atlas : 46 secteurs, 96 brises, 18 convergences, 69 pièges, 12 thermiques, 15 spots de soaring,
  64 décos, 34 attéros, 15 itinéraires, 278 sources. Fiches sourcées. Sonde avec prévision AROME.
- API : atlas pré-compressé avec ETag, requêtes bbox PostGIS, proxy des annuaires (OSM, PGE),
  contributions modérées, cache amont mémoire → base avec repli sur données périmées, quotas
  journaliers pondérés, expiration des prévisions alignée sur les runs des modèles.
- Docker : `docker compose` (PostGIS + API + Nginx). Testé de bout en bout dans le conteneur de
  dev : base vide → migration → seed auto → site en ligne. Parcours Chromium sans erreur console.
- 31 tests (vitest). La suite API passe aussi contre un vrai PostgreSQL via `TEST_DATABASE_URL`.
  CI GitHub Actions (typage, lint, tests, tests PostGIS, builds, images Docker).

Pas fait ou pas vérifiable dans l'environnement d'origine (réseau filtré) :

- **Recherche documentaire incomplète** : la plupart des sites de clubs, forums et PDF étaient
  bloqués, et le budget de recherche web était épuisé. Beaucoup de coordonnées sont estimées
  (`coord_quality: approx`). 24 alertes dans `docs/DATA_QA.md`. Plusieurs secteurs sont peu
  documentés (Bornes, Aravis, Dévoluy, Baronnies, Diois, Alpes-Maritimes, hautes vallées de
  Chartreuse).
- **Sites FFVL non importés** : `apps/web/public/data/sites-ffvl.json` est absent car data.gouv
  était bloqué. Le script `npm run data:sites` est prêt.
- **Météo réelle jamais appelée** : Open-Meteo était bloqué. Le code suit le benchmark mais doit
  être vérifié en conditions réelles (§ 6).
- **Fonds de carte** (IGN, OpenTopoMap, OpenFreeMap, kk7) non vérifiés depuis un vrai navigateur.
  Les tests ont utilisé le fond « Relief » autonome.
- `deploy/install.sh` n'a pas été exécuté de bout en bout. Ses étapes (build, compose, seed CLI,
  santé) ont été validées séparément.

## 3. Repères dans le code

Lire `docs/ARCHITECTURE.md` (modules, fournisseurs, routes, cache), `docs/METHODOLOGIE.md` (modèle),
`docs/DONNEES.md` (contrat et pipeline), `docs/DEPLOYMENT.md` (exploitation).

| Besoin | Fichier |
| --- | --- |
| Constantes physiques du modèle | `packages/model/src/rules.ts` |
| Modèle de référence (TS) | `packages/model/src/field.ts`, `terrain.ts`, `curated.ts`, `sun.ts` |
| Même modèle en GLSL (**à garder synchrone avec field.ts**) | `apps/web/src/gpu/model-glsl.ts` |
| Rendu particules, comètes, bulles, drapage | `apps/web/src/gpu/scene-glsl.ts`, `engine.ts`, `wind-scene.ts` |
| Orchestration de la carte | `apps/web/src/map/controller.ts` |
| Une famille de couches | `apps/web/src/map/modules/*.ts` (interface `MapModule`) |
| Style, couleurs, icônes | `apps/web/src/map/style.ts`, `palette.ts`, `icons.ts`, `apps/web/src/styles.css` |
| Accès aux données (API ou statique) | `apps/web/src/data/client.ts` |
| Panneaux UI | `apps/web/src/ui/*.tsx` |
| Client Open-Meteo (profil AROME + couche limite IFS) | `packages/shared/src/open-meteo.ts` |
| Cache amont, quotas, expiration météo | `apps/api/src/services/cache.ts`, `weather.ts` |
| Schéma SQL | `apps/api/src/db/migrations/001_init.sql` |
| Compilation de l'atlas | `scripts/build-data.ts` (sortie : `apps/web/public/data/atlas.json`, `docs/DATA_QA.md`) |
| Contrat des données de recherche | `research_notes/Brises des Alpes françaises/_schema.md` |
| Synthèse de la recherche, sources prioritaires | `reports/Brises des Alpes françaises.md` (§ « Seconde passe ») |

## 4. Travailler en local

```bash
npm ci
npm run dev            # front : http://localhost:5173
npm run dev:api        # API + PGlite (.data/), seed auto depuis apps/web/public/data/atlas.json
npm run typecheck && npm run lint && npm test
npm run e2e            # parcours Chromium + captures (CHROMIUM_PATH=<chemin de chrome> si besoin)
```

À valider avant chaque push : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
Si l'UI a changé, faire `npm run e2e` et **regarder les captures**. Si l'API ou le SQL a changé,
lancer aussi `TEST_DATABASE_URL=postgres://… npx vitest run apps/api` contre un vrai PostGIS.

## 5. Déploiement sur la dev VM (SSH)

### 5.1 Informations à demander à l'utilisateur (ne pas deviner)

Hôte ou IP, utilisateur SSH, port, clé utilisée, port HTTP souhaité (8080 par défaut), et si la VM
a déjà Docker. Vérifier l'accès sans interaction : `ssh -o BatchMode=yes user@host 'uname -a; docker --version; docker compose version'`.

### 5.2 Prérequis sur la VM

- Linux x86_64 ou arm64, au moins 2 Go de RAM et 5 Go de disque.
- Git, Docker Engine et le plugin `docker compose`. Installation Debian/Ubuntu si absent, après
  accord de l'utilisateur : `curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER`,
  puis se reconnecter.
- Accès sortant vers GitHub, Docker Hub et le registre npm (build des images). Le navigateur des
  utilisateurs accède lui-même aux tuiles (IGN, AWS Terrarium, OpenFreeMap…).

### 5.3 Installation et mise à jour

```bash
ssh user@host
curl -fsSL https://raw.githubusercontent.com/CesarPierr/cross_paraglide_map/claude/french-alps-wind-simulation-g2ovxt/deploy/install.sh \
  | bash -s -- --port 8080
# ou, depuis un clone existant :
bash deploy/install.sh --dir ~/brises-des-alpes --port 8080 [--refresh-data]
```

Le script est idempotent : le relancer met à jour. Il fait :

1. clone ou `git merge --ff-only` de la branche ;
2. génère `.env` avec des secrets aléatoires, une seule fois ;
3. avec `--refresh-data` : réimporte les sites FFVL et les espaces aériens (Node 22 requis sur l'hôte) ;
4. lance `docker compose up -d --build` ;
5. recharge l'atlas en base (contributions conservées) et redémarre l'API ;
6. affiche l'URL.

**Ne jamais afficher le contenu de `.env`** dans une sortie partagée. Le jeton de modération se
lit avec `grep ADMIN_TOKEN ~/brises-des-alpes/.env`, seulement si l'utilisateur le demande.

### 5.4 Accès à l'interface

- Sur le réseau local : `http://<ip-de-la-vm>:8080`. Ouvrir le port dans le pare-feu si besoin
  (`sudo ufw allow 8080/tcp`).
- Sinon, par tunnel depuis le poste de l'utilisateur : `ssh -L 8080:localhost:8080 user@host`,
  puis `http://localhost:8080`.
- WebGL2 est requis côté navigateur. Le badge « en ligne » en haut à gauche confirme que le front
  parle à l'API.

### 5.5 Exploitation

```bash
cd ~/brises-des-alpes
docker compose ps
docker compose logs -f api
curl -s localhost:8080/api/health        # état et volumes de l'atlas
curl -s localhost:8080/api/usage         # quotas consommés aujourd'hui
docker compose exec db pg_dump -U brises brises > ~/sauvegarde-$(date +%F).sql
```

Après une mise à jour de l'atlas dans git, relancer `deploy/install.sh`. Modération :
`docs/DEPLOYMENT.md#exploitation`.

### 5.6 Pièges de déploiement déjà rencontrés et corrigés

- `tsconfig.base.json` doit être copié dans les images, sinon le build Vite échoue.
- Nginx ne connaît pas `.mjs` : le worker MapLibre était refusé (MIME `application/octet-stream`).
  Corrigé dans `deploy/nginx.conf`.
- Pilote `postgres` : le JSON passé en texte à `$1::jsonb` était ré-encodé en chaîne JSON, d'où
  l'erreur « cannot extract elements from a scalar » au seed. Corrigé dans `apps/api/src/db/client.ts`.
  PGlite ne reproduit pas ce bug : toujours tester l'API contre un vrai PostgreSQL.
- Docker Hub renvoie 429 depuis les IP partagées : réessayer, ou se connecter avec `docker login`.

## 6. Vérifications à faire en premier sur la VM (accès réseau complet)

1. **Météo réelle**. Cliquer un point de la carte puis « Prévision du jour ici ». Vérifier que
   `GET /api/weather/point?lat=45.3&lon=5.9` renvoie un profil de 10 niveaux et `boundaryLayerM`,
   et que `X-Model-Run` correspond à `last_run_initialisation_time` de
   `https://api.open-meteo.com/data/meteofrance_arome_france0025/static/meta.json`. Comparer
   quelques valeurs avec meteo-parapente.com ou l'émagramme de Météo-France. Rejouer la requête :
   pas de nouvel appel amont, `/api/usage` inchangé.
2. **Sites FFVL**. Lancer `npm run data:sites`, vérifier le nombre de sites et leurs
   orientations, puis `bash deploy/install.sh` pour les recharger.
3. **Fonds de carte**. Tester orthophoto IGN, plan IGN, OpenTopoMap, noms de lieux OpenFreeMap et
   couches kk7 dans un vrai navigateur. Pour chaque hôte en échec (CORS, clé, licence), désactiver
   ou remplacer, et noter le résultat dans `docs/ARCHITECTURE.md`.
4. **Performance** sur un vrai GPU (portable intégré et mobile) : fluidité de la navigation, de
   la lecture de la journée et du changement de vent. Ajuster le nombre de particules par défaut
   si besoin.
5. **Mobile** (≤ 860 px) : panneaux en feuilles, sonde, frise horaire.

## 7. Reprise de la recherche complète

Objectif : combler les lacunes, corriger les coordonnées et documenter chaque massif à fond, en
respectant **exactement** le contrat `_schema.md`, pour que la sortie entre dans l'atlas avec
`npm run data:build -- <dossier>`.

Méthode recommandée :

1. Créer `research_notes/<Titre de la seconde passe>/` avec `data/`. Copier `_schema.md` dedans.
2. Découper par secteur, en réutilisant les **identifiants de massifs existants** pour que la
   fusion complète au lieu de dupliquer (`jq -r '.massifs[].id' apps/web/public/data/atlas.json`).
   Lots suggérés, un sous-agent chacun :
   - Chablais, Giffre, Arve, Salève ;
   - Annecy, Bornes, Aravis ;
   - Mont-Blanc, Beaufortain, Val Montjoie, Megève ;
   - Bauges, cluse de Chambéry, Bourget ;
   - Chartreuse, Grésivaudan, Belledonne ;
   - Vercors, Trièves, Matheysine, cuvette grenobloise ;
   - Oisans, Maurienne, Tarentaise, Vanoise ;
   - Briançonnais, Écrins, Queyras, Ubaye ;
   - Dévoluy, Gapençais, Champsaur, Buëch, Baronnies, Diois ;
   - Provence (Saint-André, Lure), Alpes-Maritimes (Gréolières) ;
   - un lot transverse : convergences, effets du vent synoptique et itinéraires de cross (traces
     XContest).
3. Lire **en priorité** les 17 sources du tableau « Seconde passe » de
   `reports/Brises des Alpes françaises.md` : fil parapentiste.info sur la cartographie des
   brises, *Vol Libre* n°298, PDF du club St Hil'Air, carte vol libre du PNR des Bauges, PCHT,
   Chocard Airlines, CHVD, FFVL Mont-Blanc, Toiles du Sud, etc. Ensuite les sites de clubs et
   d'écoles de chaque secteur, les fiches FFVL et les récits de cross.
4. **Coordonnées** : prendre celles des fiches FFVL (demander une clé API à informatique@ffvl.fr si
   besoin), de ParaglidingEarth ou d'OSM. Pour un relief, vérifier l'altitude avec le MNT ; le
   pipeline relocalise à l'altitude déclarée (`alt_m`) et signale les écarts dans `DATA_QA.md`.
   Ne jamais inventer : `coord_quality: "approx"` si la position est estimée.
5. **Brises** : `waypoints` dans le sens de l'écoulement, horaires en texte (« 12h-19h (été) »),
   vitesses en km/h. Garder la formulation d'origine dans la description, avec la source citée.
6. Compiler : `npm run data:build -- "research_notes/<Titre>/data"`. Corriger toutes les alertes
   de `docs/DATA_QA.md` qui viennent de la nouvelle passe. Vérifier visuellement sur la carte
   (brises recalées dans les bonnes vallées, sens des flèches).
7. Traiter les 24 alertes existantes de `docs/DATA_QA.md` (décos recalés de plus de 600 m, deux
   éléments sans coordonnées au Chalvet).
8. Quand la collecte de l'autre agent arrive, la passer par le même chemin et arbitrer les
   conflits : garder les deux versions si elles divergent, citer les deux sources, baisser la
   confiance.
9. Mettre à jour `reports/Brises des Alpes françaises.md` (ou une nouvelle synthèse) en indiquant
   ce que la seconde passe change.

Extension future (sur demande seulement) : Alpes suisses, italiennes et autrichiennes. Il faudra
élargir `DEM_BBOX` (`packages/model/src/grid-config.ts`), régénérer le MNT (`npm run data:dem`),
surveiller la taille des textures GPU et ajouter des jeux de données au même contrat.

## 8. Backlog proposé (par priorité)

**P0, fiabilité**
- Vérifications du § 6 (météo réelle, FFVL, fonds de carte, perf, mobile).
- Seconde passe de recherche (§ 7) et correction des alertes QA.

**P1, produit**
- Page de modération dans l'interface (aujourd'hui, seulement via l'API et le jeton Bearer).
- Panneaux semi-transparents : les icônes de la carte se voient à travers le panneau droit,
  augmenter l'opacité ou le flou.
- Cache hors ligne (service worker) pour le MNT, l'atlas et les tuiles déjà vues : utile en montagne.
- Test de parité GLSL/TS du modèle (rendu headless ou comparaison sur un échantillon de mailles)
  pour éviter qu'ils divergent.
- Atlas découpé par massif si sa taille dépasse ~1,5 Mo (aujourd'hui 0,9 Mo brut, 160 Ko en Brotli).

**P2, feuille de route (pas sans demande explicite)**
- Météo en direct sur une grille AROME (texture de vent spatialisée envoyée au GPU), balises
  temps réel.
- Collecte de traces XCTrack/IGC et carte des thermiques déduite des vols.
- Autres pays alpins.

## 9. Conventions

- Branche de travail : `claude/french-alps-wind-simulation-g2ovxt`, sauf autre consigne de
  l'utilisateur. Pas de pull request sans demande. Messages de commit en anglais, à l'impératif,
  avec un corps qui explique le pourquoi.
- Ne pas ajouter de dépendance lourde sans raison. Le bundle principal fait ~420 Ko gzip, dont
  287 Ko pour MapLibre.
- Toute nouvelle source de données passe par un fournisseur (`packages/shared/src/providers.ts`) et
  un module de carte. Tout appel à une API externe côté serveur passe par `UpstreamCache` et
  `QuotaMeter`.
- Toute modification de la physique se fait dans `field.ts` **et** dans `model-glsl.ts`.
- Chaque phénomène affiché garde ses sources. Une déduction sans source doit être marquée comme
  telle (confiance « low »).
- Commandes destructrices (`rm -rf`, `docker compose down -v`, `git push --force`) : uniquement
  avec l'accord explicite de l'utilisateur. `down -v` efface la base, contributions comprises.

## 10. Prompt d'amorçage pour l'agent local

```text
Tu reprends le projet « Brises des Alpes » (carte 3D de l'aérologie des Alpes françaises pour le
parapente) dans le dépôt CesarPierr/cross_paraglide_map, branche
claude/french-alps-wind-simulation-g2ovxt. Réponds-moi en français.

1. Lis docs/PASSATION.md en entier, puis README.md, docs/ARCHITECTURE.md et docs/DONNEES.md.
2. Déploie l'application sur ma dev VM en SSH selon docs/PASSATION.md § 5. Demande-moi l'hôte,
   l'utilisateur et le port si tu ne les as pas. Vérifie l'accès avec ssh -o BatchMode=yes avant
   toute action, et demande mon accord avant d'installer Docker ou d'ouvrir un port.
3. Fais les vérifications du § 6 (météo réelle, sites FFVL, fonds de carte, perf, mobile) et
   corrige ce qui ne va pas. Teste, puis commit et push sur la branche.
4. Lance la seconde passe de recherche du § 7, une recherche par lot de massifs en parallèle,
   en respectant strictement _schema.md et en réutilisant les identifiants de massifs existants.
   Compile avec npm run data:build, traite docs/DATA_QA.md, vérifie sur la carte, redéploie.
5. Fais-moi un point clair à chaque étape : ce qui marche, ce qui reste, ce que tu n'as pas pu
   vérifier.
```
