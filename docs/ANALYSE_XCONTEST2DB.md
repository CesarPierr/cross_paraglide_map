# Analyse de faisabilité : collecte de traces IGC (xcontest2db et alternatives)

Date : 7 octobre 2026. Auteur : analyse assistée, **sans aucune collecte** : aucun script lancé contre
xcontest.org ni un autre service de traces, aucune connexion, aucun vol ni fichier de trace téléchargé
(voir l'annexe A pour la liste exacte des pages lues).

Légende des chiffres : **[S]** sourcé (lien en annexe B), **[D]** dérivé par calcul à partir de
chiffres sourcés, **[H]** hypothèse de travail à confirmer. Ce document n'est pas un avis juridique.

## 0. Résumé et recommandation

1. **xcontest2db ne télécharge aucun IGC.** C'est un récupérateur de *listes de vols* (pilote, décollage,
   durée, distance, voile). Il n'apporte donc ni spirales, ni taux de montée, ni dérive. Il faudrait y
   ajouter le téléchargement des traces, la partie la plus fragile et la plus exposée juridiquement.
2. **Son fonctionnement repose sur le contournement de protections** : Cloudflare Turnstile passé avec un
   navigateur non headless sous Xvfb, proxys résidentiels à session collante, rotation de proxys gratuits.
   Le `robots.txt` d'XContest interdit les points d'accès aux traces, toute URL avec paramètres
   (donc l'API de données) et nomme explicitement les robots d'IA, dont ClaudeBot.
3. **Juridiquement, c'est non recommandé** : pas de CGU explicites trouvées, mais aucune licence de
   réutilisation, des signaux d'opposition techniques clairs, et des traces qui sont des données
   personnelles (RGPD). La CNIL attend, même pour des données publiques, que les sites qui s'opposent par
   `robots.txt` ou CAPTCHA soient exclus de la collecte.
4. **Volumes** : l'ordre de grandeur utile est modeste. Le CFD de la FFVL compte ≈ 10 400 vols par saison
   en France (≈ 6 à 7 mille dans les Alpes) pour ≈ 2,5 Go de IGC ; XContest en compterait ≈ 50 000 par
   saison dans les Alpes françaises [H] pour ≈ 15 Go.
5. **Coût proxy** (si on le faisait quand même) : de ≈ 80 $ (1 saison, scénario optimisé) à ≈ 18 000 $
   (10 saisons, scénario brut au tarif le plus cher), voir § 4. Surtout, le rythme de xcontest2db
   (une page toutes les 5 à 29 minutes) rendrait une saison complète irréalisable (≈ 3 ans par worker).
6. **Recommandation** : ne pas forker xcontest2db et ne rien collecter sur XContest sans autorisation
   écrite. Procéder en trois voies : (a) demander à la **FFVL** une convention de mise à disposition
   pseudonymisée de traces CFD (le CFD publie déjà des traces à 100 %, et des équipes de recherche s'en
   servent) ; (b) construire dès maintenant la chaîne d'analyse sur des traces légitimes (les vôtres,
   volontaires, SkyLines) ; (c) ajouter la contribution volontaire avec extraction côté client. Détail,
   heures et jalons au § 8.

---

## 1. xcontest2db : ce que c'est

Dépôt `emilburzo/xcontest2db` (clone local lu, commit `9bcbe76` du 2026-08-10). Projet personnel :
un seul auteur, 3 étoiles, 0 fork, créé en 2020 pour la ligue roumaine **[S : API GitHub]**.

| Point | Constat |
| --- | --- |
| Langage et pile | Kotlin 2.0 / JVM 21, Gradle (fat JAR), Ktor client, Jsoup, Exposed (DSL), PostgreSQL + PostGIS. Environ 1 080 lignes de Kotlin. |
| Service annexe | `playwright-content-service/` (Node 20 + Playwright + Chromium en mode non headless sous Xvfb) qui rend les pages et renvoie le HTML. |
| Déploiement | Image Docker, CronJob Kubernetes (`.ci/deploy.yaml` : toutes les 8 minutes ; la doc `CLAUDE.md` dit 19 minutes, elle est périmée). |
| Licence | **Aucune** (champ `license` nul, pas de fichier LICENSE). Par défaut, tous droits réservés : on peut lire le code, pas le copier. |
| Documentation | `README.md` vide ; tout est dans `CLAUDE.md` (21 Ko, rédigé pour un agent). |
| Tests | Une classe JUnit (`FlightMapperTest`) sur 5 fixtures HTML de listes de vols. |
| Fragilité | Deux ruptures majeures en 2026 visibles dans l'historique : février (Turnstile, ≈ 10 commits en 3 jours) et août (liens de décollage sans coordonnées sur la liste monde, parseur réécrit). |

### 1.1 Ce qu'il récupère, et ce qu'il ne récupère pas

Récupéré, ligne par ligne de la liste de vols (`mapper.kt`) : identifiant du vol, pilote (**nom affiché et
identifiant de profil**), décollage (nom, et coordonnées quand le lien les porte, sinon via l'API des
sites), heure de départ, type de vol, distance, score, durée (minutes), voile (nom et catégorie), URL de
la page de détail du vol.

**Non récupéré : aucune trace.** Ni fichier IGC, ni points de trace, ni profil d'altitude. Les tables ne
contiennent que des métadonnées et un point (le décollage). Pour notre objectif (spirales, montées,
dérive), il ne fournit rien d'exploitable directement. Seul usage possible : compter les décollages par
site et par heure comme indicateur de volabilité, avec les mêmes réserves juridiques que le reste.

### 1.2 Comment il le récupère

| Aspect | Constat (d'après le code et `CLAUDE.md`) |
| --- | --- |
| Rendu JS | Le site est une application monopage : le serveur renvoie une coquille, le navigateur appelle une API de données interne (`/api/data/?flights/<ligue>/<année>…&list[start]=0&list[num]=100`) et affiche le tableau. xcontest2db pilote donc un vrai navigateur et lit le HTML rendu (`POST /content {url, waitFor}`). |
| Pagination | 100 vols par page, par fragment d'URL (`#flights[start]=200`). Plafond de **1 000 éléments** par liste : le code découpe par jour (menu déroulant des dates) quand la liste dépasse 900. |
| Authentification | Pas de compte. Une clé d'API statique est embarquée dans le JavaScript du site. Les appels hors première page exigent un **jeton JWT**, délivré après un défi **Cloudflare Turnstile** (mode invisible). La première page de chaque liste est servie depuis un cache serveur sans jeton. Les requêtes HTTP simples reçoivent un refus de type accès interdit pour cette adresse IP, même depuis une IP résidentielle. |
| Passage de Turnstile | Selon l'auteur, Chrome headless échoue ; réussite avec un navigateur non headless sous Xvfb et une empreinte alignée ; avec proxy, session collante obligatoire. C'est du **contournement de protection** documenté, pas de l'accès ordinaire. |
| Proxys | Mode « résidentiel » (variables `PROXY_*`, suffixe de session aléatoire par lancement) et mode « récent » avec **proxys gratuits** moissonnés sur `free-proxy-list.net` et essayés l'un après l'autre. |
| Débit | Mode `recent` : une récupération toutes les 8 minutes. Modes `populate`/`scrape` : pause aléatoire de **5 à 29 minutes** entre pages (moyenne ≈ 17 min, ≈ 85 pages/jour). Aucun suivi de code 429, aucun respect de `robots.txt`, agent utilisateur aléatoire, aucun moyen de contact. |
| Erreurs | Lignes mappées une à une (une ligne illisible ne coûte pas la page) ; exception si toutes échouent (changement de structure) ; tâche d'extraction en erreur laissée non traitée et reprise plus tard ; vol sans coordonnées non enregistré et retenté ; jusqu'à 10 reprises si aucune date n'est trouvée. |
| Débit mesuré par l'auteur | Environ 150 chargements de page pour un « scrape complet » : ≈ 700 Mo de ressources statiques (réduits à ≈ 5 Mo par un cache applicatif) et ≈ 312 Mo de trafic Turnstile non cachable. Soit **≈ 6,7 Mo par page sans cache, ≈ 2,1 Mo avec cache** **[D à partir de CLAUDE.md]**. |

### 1.3 Schéma de base de données

| Table | Colonnes |
| --- | --- |
| `pilots` | `id`, `name` (200), `username` (100, unique) : **données personnelles en clair** |
| `gliders` | `id`, `name` (100, unique), `category` (20) |
| `takeoffs` | `id`, `name` (200, **unique**), `centroid` `GEOGRAPHY(Point)` (index GiST) |
| `flights` | `id` (identifiant XContest), `pilot_id`, `takeoff_id` (nullable), `start_time` (heure locale), `start_point` `GEOGRAPHY(Point)` (GiST), `type`, `distance_km`, `score`, `airtime` (min), `glider_id`, `url` |
| `scrape_tasks` | `id`, `url`, `date`, `processed` ; unicité (`url`, `date`) |

Deux limites pour un usage multi-pays : `takeoffs.name` unique fusionne deux sites de même nom, et
`start_time` est une heure locale sans fuseau.

### 1.4 Comment il est restreint à un pays

Trois mécanismes codés en dur pour la Roumanie :

1. le filtre `filter[country]=RO` dans le fragment d'URL de la liste monde (côté serveur, peu fiable
   d'après l'auteur lui-même : course critique documentée dans `CLAUDE.md`) ;
2. `isTakeoffInRomania()` : teste la classe CSS `flag_ro` du drapeau de la colonne décollage, ligne par
   ligne (garde-fou réel) ;
3. une page séparée de la ligue roumaine (`/romania/zboruri/`, libellés roumains comme « ultima pagină »)
   et `TZ=Europe/Bucharest` par défaut.

L'URL de liste est fixée sur la saison courante (`BASE_URLS`) : l'historique n'est pas couvert.

---

## 2. Ce qu'il faudrait changer pour les Alpes françaises, puis l'arc alpin

Observation préalable : la grande partie du travail n'est **pas** un changement de filtre mais l'ajout du
téléchargement des traces, qui n'existe pas. De plus, la recherche géographique d'XContest
(`flights-search`, filtre par point) est précisément l'une des pages que le `robots.txt` interdit.
Il faut donc filtrer côté client : liste par pays (France entière), puis tri par coordonnées du décollage.

| Chantier | Détail | Heures (métadonnées seules) | Heures (avec IGC) |
| --- | --- | --- | --- |
| Filtre pays | Remplacer `flag_ro` par un ensemble de pays configurable ; supprimer le chemin Roumanie ; `TZ=Europe/Paris` ; heure en UTC | 3–5 | 3–5 |
| Zone Alpes | Polygone ou bbox (`DEM_BBOX` du projet : 4,85–7,85 °E, 43,55–46,5 °N) appliqué aux coordonnées du décollage ; rapprochement avec `sites-ffvl.json` pour décider avant de télécharger | 4–8 | 4–8 |
| Saisons | URLs par saison (la saison XContest va d'octobre à septembre, nommée par l'année de fin ; observé : pilotes inscrits le 28.09.24 listés dans « World XContest 2025 ») ; découpage par jour pour passer le plafond de 1 000 | 5–8 | 5–8 |
| Schéma | Clé des sites par identifiant XContest (pas par nom), `timestamptz`, pseudonymisation du pilote (empreinte salée), table `tracks` PostGIS prévue par `ARCHITECTURE.md` | 4–8 | 6–10 |
| **Téléchargement IGC** | Page de détail, repérage du lien de trace, téléchargement, stockage, vérifications, reprises. **Inexistant dans xcontest2db**, et les points d'accès aux traces sont interdits par `robots.txt` | — | **25–40** |
| Montée en charge | Pool de workers, reprise après arrêt, rotation de proxys, supervision, traitement des échecs Turnstile | — (le pas actuel suffirait) | 15–25 |
| Tests et fixtures | Nouvelles fixtures HTML de listes françaises : il faudrait **récupérer des pages**, ce qui n'a pas été fait ici | 4–6 | 6–10 |
| Arc alpin | Pays CH, IT, AT, DE (Alpes), SI, polygones, fuseaux | 4–8 | 4–8 |
| **Total France-Alpes** | | **≈ 20–35 h** | **≈ 70–115 h** |
| **Total arc alpin** | | ≈ 25–45 h | ≈ 75–125 h |
| Maintenance | Ruptures Turnstile ou HTML : 2 en 6 mois dans l'historique | 2–5 h/mois | 2–5 h/mois |

Sans licence, le code ne peut pas être repris tel quel : une réimplémentation (en TypeScript, cohérente
avec le dépôt) serait nécessaire, d'où des heures comparables. **Je ne recommande ni le fork ni la
réimplémentation** (§ 5 et § 8). La valeur de xcontest2db est son `CLAUDE.md`, qui montre que XContest
protège activement ses données.

---

## 3. Volumes

### 3.1 Chiffres de départ

| Donnée | Valeur | Statut |
| --- | --- | --- |
| CFD FFVL, saison 2023-24 | 10 385 vols, 2 107 pilotes, 327 clubs, 10 375 traces GPS (≈ 100 %), 566 333 km, 8 validateurs bénévoles | [S] extrait de la page statistiques FFVL (vue par moteur de recherche ; la page elle-même renvoie HTTP 403 à l'outil de lecture) |
| CFD, saison 2022-23 | 10 313 vols, 2 081 pilotes | [S] idem |
| CFD, 2017 à 2024 | 110 730 vols IGC (≈ 13,8 k/an), 1,47 M segments de montée (≈ 13,3 par vol) | [S] Hernández-Aguayo et al. 2026 |
| Trajectoires de parapente en France, 2016-2021 | 78 645 (≈ 13,1 k/an) ; 49 939 après filtres (≥ 1 Hz, ≥ 1 h, étendue ≥ 15 km) | [S] Vilpellet et al. 2026 (sources : CFD, XContest, NetCoupe) |
| Distance moyenne d'un vol CFD | 566 333 km / 10 385 vols ≈ 54,5 km | [D] |
| Pilotes avec vol, classement national PG France, XContest 2024 | ≈ 3 109 | [S] page de classement lue une fois |
| Pilotes XContest dans le monde | 21 470 (2020) ; 42 532 inscrits à la saison 2025 | [S] NOVA ; page pilotes |
| Nombre de vols XContest par pilote | non publié en agrégat ; la liste donne le nombre par pilote | [H] 15 / 25 / 35 |
| Part des Alpes françaises | les 40 cellules les plus actives (25 km) captent 64 % des segments de montée ; activité concentrée au sud-est | [S] Hernández-Aguayo et al. → [H] 50 / 60 / 70 % |

Un chiffre CFD « 4 709 vols, 1 444 pilotes » (saison 2024-25) est apparu dans une recherche : il
correspond à une saison en cours au moment de la capture, pas à un total ; je ne l'utilise pas.

### 3.2 Vols par saison

| Source | Territoire | Bas | Central | Haut | Statut |
| --- | --- | --- | --- | --- | --- |
| CFD FFVL | France entière | ≈ 10 k | ≈ 10,4 k | ≈ 14 k | [S] 2023-24 ; moyenne 2017-24 |
| CFD FFVL | Alpes françaises (60-70 %) | ≈ 6 k | ≈ 6,7 k | ≈ 9 k | [D] |
| XContest | France entière (3 109 pilotes × 15 / 25 / 35) | ≈ 47 k | ≈ 78 k | ≈ 109 k | [D] sur [H] |
| XContest | Alpes françaises | ≈ 25 k | **≈ 50 k** | ≈ 75 k | [D] sur [H] |
| XContest | Arc alpin (≈ ×3, plage 2,5-4) | ≈ 65 k | ≈ 150 k | ≈ 250 k | [H] |

La fourchette XContest est large parce qu'XContest ne publie pas le nombre de vols par pays. La mesure
fiable s'obtient en le demandant (info@xcontest.org), pas en comptant les pages. Le CFD contient surtout
des vols de distance déclarés (distance moyenne 54 km) : jeu biaisé vers les jours favorables et les
pilotes de cross, à garder en tête pour le calage.

### 3.3 Poids d'un IGC

Le format IGC est du texte à champs fixes. Un enregistrement de position (`B`) fait 35 caractères, soit
37 octets avec fin de ligne, une fois par seconde. Une génération de trace synthétique de 2 h à 1 Hz (7 200
points, sans extensions) donne **260 Ko brut, 68 Ko compressé en gzip (rapport 3,8)** **[D, calcul sur
données synthétiques]**. Avec en-têtes, extensions et vols plus longs :

| Cas | Brut | gzip |
| --- | --- | --- |
| Vol XContest typique (1,5 à 2,5 h) | 200–330 Ko | ≈ 55–90 Ko |
| Vol CFD (≈ 54 km, ≈ 2,5-3 h) | ≈ 350 Ko | ≈ 95 Ko |
| **Hypothèse retenue** | **300 Ko** (150 à 500) | **80 Ko** |

### 3.4 Volume total

| Jeu | 1 saison | 5 saisons | 10 saisons |
| --- | --- | --- | --- |
| CFD, Alpes françaises (≈ 6,7 k vols, 350 Ko) | 6,7 k vols, **2,3 Go** | 33 k vols, **11 Go** | 67 k vols, **23 Go** |
| XContest, Alpes françaises, central (50 k vols, 300 Ko) | 50 k vols, **14,6 Go** (gzip 3,9) | 250 k vols, **73 Go** (gzip 20) | 500 k vols, **146 Go** (gzip 39) |
| XContest, bas (25 k) / haut (75 k) | 7 / 22 Go | 37 / 110 Go | 73 / 220 Go |
| XContest, arc alpin (×3) | ≈ 44 Go | ≈ 220 Go | ≈ 440 Go |

Ces volumes sont modestes : le stockage n'est pas le facteur limitant (un disque de 500 Go suffit).

### 3.5 Nombre de requêtes (XContest)

Hypothèses [H] : 100 vols par page de liste ; liste filtrée sur la France entière (pas de filtre
régional exploitable), soit ≈ 780 pages de liste par saison, ≈ 1 200 avec le découpage par jour ;
**2 requêtes par vol** (page de détail, puis fichier de trace ; le mécanisme exact de téléchargement n'a
pas été vérifié, aucun accès n'ayant été fait).

| Scénario | Vols/saison | Requêtes/saison | 5 saisons | 10 saisons |
| --- | --- | --- | --- | --- |
| Bas | 25 k | 51 k | 256 k | 512 k |
| **Central** | **50 k** | **101 k** | **506 k** | **1,01 M** |
| Haut | 75 k | 151 k | 756 k | 1,51 M |

Durée d'une saison (101 k requêtes) pour **un seul worker** :

| Rythme | Requêtes/jour | Durée |
| --- | --- | --- |
| Pas d'xcontest2db (5 à 29 min entre pages) | ≈ 85 | **≈ 3,3 ans** |
| 1 requête / 10 s | 8 640 | ≈ 12 jours |
| 1 requête / 3 s | 28 800 | ≈ 3,5 jours |

La pause d'xcontest2db n'est pas imposée par le site, mais choisie par l'auteur pour passer inaperçu.
Aller plus vite, c'est précisément ce qui déclenche les blocages que les proxys sont censés masquer.

---

## 4. Coût en proxy résidentiel

### 4.1 Prix publics au Go (relevés le 2026-10-07 sur les pages tarifaires, en dollars)

| Fournisseur | À l'usage (pay-as-you-go) | Abonnements / paliers | Remarques |
| --- | --- | --- | --- |
| Bright Data | 8 $/Go (4 $ avec code promo affiché) | 499 $/mois pour 141 Go, 999 $ pour 332 Go, 1 999 $ pour 798 Go ; 3 $/Go en promo, 5-6 $/Go tarif courant ; au-delà de 1 To : sur devis | Vérification d'identité (KYC), éventuellement en visioconférence, avant usage |
| Oxylabs | 6 $/Go (jusqu'à 5 Go), 5 $ (20 Go), 4 $ (125 Go), 2,50 $ à partir de 1 000 Go | Forfaits de 30 à 2 500 $/mois et plus | KYC demandé pour certains filtres |
| Decodo (ex-Smartproxy) | 4 $/Go | 3 Go à 3,75 $/Go (11,25 $), 25 Go à 3,25 $ (81 $), 100 Go à 2,75 $ (275 $), 250 Go à 2,50 $ (625 $), 1 To à 2 $/Go (2 048 $/mois) | Essai gratuit de 3 jours |
| IPRoyal | 7,35 $/Go (1 Go), 6,25 $ (2 Go), 5,51 $ (10 Go) ; remises de 5 % en abonnement | Dégressif jusqu'à ≈ 1,84 $/Go à partir de 10 To ; paliers intermédiaires non relevés | Trafic sans expiration ; politique KYC |

Ces prix ont été lus via un outil qui résume les pages : à revérifier avant tout engagement. Je retiens
trois niveaux de prix pour le calcul : **2 $/Go** (palier du téraoctet), **4 $/Go** (cas courant), **8 $/Go**
(tarif à l'usage le plus cher).

### 4.2 Hypothèses de débit

| Scénario | Principe | Trafic par requête | Statut |
| --- | --- | --- | --- |
| **A, « tel quel »** | Un navigateur neuf par requête, session de proxy neuve, Turnstile à chaque fois (comme xcontest2db) | **2,3 Mo** (2,1 Mo mesurés par l'auteur avec cache, plus ≈ 0,2 Mo de contenu) | [D] |
| **B, « optimisé »** | Navigateur persistant, ressources en cache, Turnstile une fois par ≈ 100 pages | **0,4 Mo** (IGC ≈ 0,1 Mo sur le réseau, page ou JSON ≈ 0,1 Mo, surcoût ≈ 0,2 Mo) | [H], **non testé** |

Le poids du fichier IGC (≈ 0,1 Mo) est négligeable devant le surcoût du défi anti-robot dans le scénario
A. Hors échecs et reprises (+20 à 40 % à prévoir) [H].

### 4.3 Coût de la collecte (scénario central, 50 k vols/saison dans les Alpes françaises)

| | Trafic | à 2 $/Go | à 4 $/Go | à 8 $/Go |
| --- | --- | --- | --- | --- |
| **A, 1 saison** | 227 Go | 455 $ | 909 $ | 1 818 $ |
| **A, 5 saisons** | 1 137 Go | 2 273 $ | 4 546 $ | 9 092 $ |
| **A, 10 saisons** | 2 273 Go | 4 546 $ | 9 092 $ | 18 184 $ |
| **B, 1 saison** | 40 Go | 79 $ | 158 $ | 316 $ |
| **B, 5 saisons** | 198 Go | 395 $ | 791 $ | 1 581 $ |
| **B, 10 saisons** | 395 Go | 791 $ | 1 581 $ | 3 162 $ |

Plage selon le volume de vols : de ×0,5 (25 k vols) à ×1,5 (75 k vols). Arc alpin : ×3. Par exemple
5 saisons du scénario A à 4 $/Go : 2 300 $ (bas) à 6 800 $ (haut) pour les Alpes françaises, ≈ 14 000 $
pour l'arc alpin au central. À ces volumes, le prix réel tend vers le palier du téraoctet (≈ 2 $/Go), mais
les forfaits mensuels (1 000 à 2 000 $) imposent un engagement. Le coût d'infrastructure (Chromium
non headless, 0,5 à 2 Go de mémoire par instance d'après le manifeste de déploiement) et surtout les
**heures** (§ 2) dépassent le coût des proxys dans le scénario B.

### 4.4 Ce qu'il faut en retenir

Le coût en argent est supportable. Ce sont les **conditions** qui ne le sont pas : l'achat de proxys
résidentiels pour franchir une protection anti-robot est analysé au § 5.5, et deux des quatre
fournisseurs exigent une vérification d'identité, ce qui relie nominativement l'activité au titulaire
du compte.

---

## 5. Volet juridique et éthique

### 5.1 Ce que disent les textes d'XContest

L'opérateur est **XC platform s.r.o.**, Prague (République tchèque). Je n'ai trouvé **aucune page de
conditions d'utilisation** : la page « À propos », le règlement, la FAQ et la page d'inscription n'en
contiennent pas, et la politique de confidentialité n'en tient pas lieu. Les conditions éventuellement
acceptées à l'inscription n'ont pas pu être lues (je ne m'inscris pas). Pour les passages ci-dessous,
le texte est **résumé** (l'outil de lecture ne restitue pas le texte brut) ; vérifier sur la page.

| Texte | Contenu pertinent | Référence |
| --- | --- | --- |
| `robots.txt` | Interdit à tous les robots : `/track.php`, `/trackml.php`, `/trackmz.php` (accès aux traces), les pages de recherche de vols (`flights-search`, en cinq langues), et **toute URL avec paramètres (`Disallow: /*?`)**, ce qui couvre l'API de données utilisée par xcontest2db (`/api/data/?…`). Autorise seulement certaines listes de pilotes. Blocs d'interdiction totale pour **GPTBot, ClaudeBot, CCBot, Google-Extended, Bytespider, PerplexityBot, DotBot**. | `https://www.xcontest.org/robots.txt` |
| Règlement, § 3.2 | Une fois le fichier IGC téléversé sur le serveur, il devient propriété publique (paraphrase). Cette règle encadre le concours ; elle ne contient ni licence de réutilisation par des tiers ni renonciation aux droits RGPD. | `…/world/en/rules/` |
| Politique de confidentialité (révision du 10 mai 2023) | Collecte nom, e-mail, date de naissance, **traces GPS** et localisation en direct. Les informations partagées (dont les traces) peuvent être vues par tous et « publicly distributed outside the Site in perpetuity ». Bases légales annoncées : intérêts légitimes, contrat, consentement, obligations légales. Droits d'accès, rectification, effacement, limitation, portabilité reconnus. Contact : info@xcontest.org. **Aucune mention** du moissonnage, de la copie ou de la réutilisation par des tiers. | `…/world/en/privacy-policy/` |
| FAQ | Existence d'un réglage de profil pour **refuser l'indexation par les robots** ; suppression de profil sur demande à support@xcontest.org. | `…/world/en/faq/` |
| Protections techniques | Turnstile, jeton JWT, refus par adresse IP des requêtes non navigateur (décrits par xcontest2db lui-même). | `CLAUDE.md` du dépôt cloné |

### 5.2 La collecte automatisée est-elle autorisée ?

**Non, en pratique : aucune autorisation n'est donnée, et plusieurs signaux d'opposition sont
explicites.**

- Pas d'interdiction contractuelle *écrite* retrouvée (point à lever en demandant le texte des
  conditions à XContest), mais pas non plus de licence de réutilisation.
- `robots.txt` interdit exactement les points dont xcontest2db a besoin (API de données, accès aux
  traces) et exclut nommément les robots d'IA. Un navigateur automatisé qui exécute le JavaScript du site
  reste un robot ; l'argument « c'est un vrai Chrome » ne change pas l'intention.
- Les protections (Turnstile, jeton, filtrage IP) sont la manifestation technique de cette opposition.
  Les passer est un contournement, pas un accès ordinaire.
- Contre-argument honnête : les traces sont **publiques par conception** (règlement § 3.2, politique de
  confidentialité), et des chercheurs publient sur des traces dites publiquement disponibles
  (Vilpellet et al. citent XContest, CFD et NetCoupe). Mais « consultable par tous les utilisateurs » n'est
  pas « libre de reprise massive par un tiers », et l'extrait lu de ces articles ne mentionne ni licence
  ni anonymisation. Ce n'est pas un précédent juridique.

### 5.3 RGPD et consentement des pilotes

- **Une trace IGC est une donnée personnelle** : rattachée à un profil nommé (nom, identifiant), elle révèle
  lieux, horaires, habitudes de vol, parfois le domicile (décollage ou atterrissage près de chez soi). Le
  fabricant de balises FLARM le dit pour les aéronefs de loisir : les données de vol sont personnelles
  et relèvent du RGPD. La CNIL traite la géolocalisation comme une donnée sensible en pratique (risque de
  ré-identification).
- Le fait que la donnée soit publique **ne supprime pas** les obligations : base légale (art. 6), finalité
  déterminée (art. 5), information des personnes (art. 14, avec exception possible pour la recherche si
  l'effort est disproportionné, art. 14.5.b, et garanties de l'art. 89), droit d'opposition (art. 21),
  effacement (art. 17), minimisation et protection dès la conception (art. 25), analyse d'impact
  probable (art. 35) pour un traitement de géolocalisation à grande échelle.
- **Intérêt légitime et moissonnage (CNIL, 19 juin 2025)** : possible en principe, mais avec garanties.
  La CNIL attend que l'on **exclue de la collecte les sites qui s'opposent clairement au moissonnage par
  `robots.txt` ou CAPTCHA**, que l'on limite la collecte aux données que les personnes savent rendre
  publiques, que l'on informe largement, que l'on prévoie un droit d'opposition préalable, et que l'on
  **pseudonymise ou anonymise juste après la collecte**. Ces fiches visent l'entraînement de systèmes
  d'IA ; un modèle de prévision calé sur des traces s'en rapproche suffisamment pour s'en inspirer.
  Les deux premières conditions (robots.txt, CAPTCHA) ne seraient **pas remplies** ici.
- **Consentement des pilotes** : XContest n'a pas recueilli, à ce qu'on lit, de consentement pour une
  réutilisation par un tiers. Le consentement est donc à obtenir par une voie directe (dépôt volontaire)
  ou par un intermédiaire qui en a la maîtrise (FFVL, avec ses propres mentions et son DPO).
- **Anonymisation** : retirer les champs d'en-tête IGC qui identifient (pilote, immatriculation de voile,
  numéro de compétition), remplacer le pilote par une empreinte salée, ne conserver que des événements
  dérivés (segments de montée, vent) arrondis en espace (≈ 100 m) et en temps (l'heure), supprimer ou
  tronquer les points proches des atterrissages hors sites connus. Les données réellement anonymisées
  sortent du champ du RGPD, d'où l'intérêt de l'extraction côté client (§ 6.7).

### 5.4 Propriété intellectuelle des bases de données et fouille de données

- **Droit sui generis** du producteur de base de données (art. L342-1 du Code de la propriété
  intellectuelle) : il peut interdire l'extraction ou la réutilisation d'une partie substantielle du
  contenu, et l'extraction répétée et systématique de parties non substantielles qui excède l'usage
  normal. Une aspiration de plusieurs saisons est systématique et substantielle.
- **Fouille de textes et de données** (directive (UE) 2019/790, art. 3-4, transposée au CPI) : permise sur
  des contenus accessibles licitement, **sauf réserve des ayants droit exprimée de manière appropriée**,
  notamment lisible par machine. Le blocage nominatif des robots d'IA dans `robots.txt` est le type de
  réserve visé. [à faire confirmer par un juriste]

### 5.5 Proxys résidentiels pour contourner des limites

- **Intention** : acheter des adresses résidentielles *pour franchir un filtrage par IP et un défi
  anti-robot* ruine toute défense de bonne foi. L'accès frauduleux à un système de traitement automatisé
  (art. 323-1 du Code pénal : jusqu'à 3 ans et 100 000 € d'amende) exige la conscience de l'absence
  d'autorisation ; la doctrine française tend à le réserver aux systèmes protégés. Turnstile et le
  blocage par adresse sont précisément des protections. [risque à faire évaluer, pas une conclusion]
- **Traçabilité** : Bright Data et, pour certaines fonctions, Oxylabs et IPRoyal demandent une
  vérification d'identité. L'activité est donc rattachée à une personne ou à une structure identifiée.
- **Éthique des adresses** : les IP résidentielles viennent de connexions de particuliers dont l'accord est
  inégalement éclairé ; les fournisseurs ne garantissent pas le même niveau de consentement.
- **Pas d'effet sur le RGPD** : passer par un proxy étranger ne change pas la qualité de responsable de
  traitement ; les obligations ci-dessus s'appliquent à vous.
- **Effet pratique** : course aux armements avec Cloudflare, risque de blocage définitif, ruptures
  fréquentes (deux en 2026 pour xcontest2db).

### 5.6 Conclusion juridique

Collecter les IGC d'XContest par xcontest2db ou un dérivé serait **hors du cadre autorisé** et fragile
pour un projet public qui veut afficher des données de pilotes. Aucune des deux conditions de bonne
conduite attendues par la CNIL (respect de `robots.txt` et des CAPTCHA) ne serait satisfaite. À l'inverse,
toute voie fondée sur un accord, un consentement ou des données déjà ouvertes lève ces obstacles.

---

## 6. Alternatives légitimes

| Source | Couverture Alpes françaises | Accès et conditions | Verdict |
| --- | --- | --- | --- |
| **FFVL, CFD** | France entière, ≈ 10,4 k vols/saison, traces à ≈ 100 % | Pas d'API publique documentée trouvée ; la page CFD refuse les lectures automatisées (403). **Demande à `informatique@ffvl.fr`** pour une convention. | **Voie prioritaire** |
| **XContest, partenariat** | Plus large (≈ 50 k [H]) | Contact `info@xcontest.org` ; aucun programme d'API public trouvé | À tenter, attentes faibles |
| **SkyLines** | Faible pour le parapente (orienté planeur) | Code AGPL-3.0, actif (dernier commit 2026-10-05) ; la politique indique que tout ce qui est téléversé est visible et utilisable par tous ; module d'API présent, documentation non trouvée | Bon pour valider la chaîne |
| **OGN / glidernet** | Partielle (FLARM, FANET, trackers OGN) | Données dites libres sous réserve des règles d'usage OGN (règles non lues) ; retrait par la base des appareils ; flux en direct, pas d'archive trouvée | Complément à mesurer |
| **Leonardo, ParaglidingForum** | Très faible (ligue britannique) | Statut et licences non vérifiés | Peu utile |
| **Ayvri, Doarama** | n/a | Services de rejeu 3D ; aucun renseignement fiable trouvé sur leur état actuel | Pas une source de données |
| **Autres ligues** (DHV-XC, ligue suisse…) | Alpes hors France | Même analyse qu'XContest ; une convention par organisme | Pour l'arc alpin, plus tard |
| **Jeux publiés** | n/a | Aucun jeu de traces de parapente ouvert et massif trouvé ; les articles lus ne contiennent pas de déclaration de disponibilité des données | Contacter les auteurs |
| **Contribution volontaire** | Selon l'audience | Consentement explicite, extraction côté client | À construire (§ 6.7) |

### 6.1 FFVL, Coupe fédérale de distance (CFD)

C'est la source naturelle : fédération des pilotes français, déjà source de nos sites (`sites-ffvl.json`),
saison du 1er septembre au 31 août, statistiques 2023-24 : 10 385 vols, 10 375 traces. Deux équipes de
recherche l'utilisent (110 730 vols IGC de 2017 à 2024 pour Hernández-Aguayo et al. ; trajectoires
dites publiquement disponibles pour Vilpellet et al.), preuve qu'un accès est possible, sans que le texte
lu précise dans quelles conditions ni s'il y a eu convention. L'application CFD est maintenue par des
bénévoles (créateur cité sur data.gouv, 8 validateurs bénévoles), à ménager. Demande type : finalité
(recherche et outil gratuit non commercial), périmètre (Alpes, 2017-2025, IGC ou segments dérivés),
garanties (pseudonymisation à la source, pas de redistribution, restitution des cartes et du calage sous
licence ouverte, DPO en copie). Délai probable : plusieurs semaines à plusieurs mois ; résultat
incertain. **Biais à documenter** : vols de distance déclarés, jours favorables, pilotes expérimentés.

### 6.2 XContest

Demande à `info@xcontest.org` : extraits agrégés ou pseudonymisés (nombre de vols par site et par heure,
ou segments de montée dérivés), licence explicite pour des produits dérivés, et surtout le texte des
conditions d'utilisation. Aucune API publique n'a été trouvée ; l'API interne que xcontest2db appelle avec
une clé statique n'est pas une offre publique.

### 6.3 SkyLines et OGN

SkyLines est un projet actif sous licence AGPL-3.0 (la licence couvre le code, pas les données) dont la
politique de confidentialité dit sans détour que les vols téléversés sont publics et utilisables ; il
permet de valider la chaîne d'analyse sur des traces ouvertes, mais son public est surtout planeur.
OGN publie en continu les positions des appareils équipés (FLARM, FANET pour le parapente) ; c'est utile
pour mesurer le trafic en direct, mais la couverture parapente alpine est à mesurer (une semaine de
flux suffit) et le respect des règles d'usage OGN est à lire sur leur page.

### 6.4 Autres plateformes

Leonardo (base de traces et ligues) héberge la ligue britannique via ParaglidingForum : peu d'intérêt
pour les Alpes françaises. Ayvri/Doarama : aucune information fiable sur leur état. DHV-XC (Allemagne)
est cité par un blog comme contenant des millions de vols ; même cadre juridique qu'XContest.

### 6.5 Jeux de données et équipes de recherche

Aucun jeu ouvert massif de traces de parapente n'a été trouvé. Les auteurs des deux articles de 2026
(Institut Louis Bachelier, LadHyX / École polytechnique, Capital Fund Management) ont déjà traité ≈ 110 000
vols CFD : ils disposent d'un tableau de segments de montée avec prédicteurs ERA5. Une **collaboration**
pour obtenir ce tableau dérivé (déjà dépersonnalisé par nature) est probablement la voie la plus rapide
pour les 2017-2024 ; elle suppose leur accord et celui de la source.

### 6.6 Données complémentaires sans enjeu personnel

Les balises FFVL (API `data.ffvl.fr`, mises à jour toutes les 5 minutes, historique de 72 h : il faut
archiver soi-même) mesurent directement le vent au sol, donc les brises de vallée, sans donnée
personnelle. Elles complètent les traces pour caler `valleySchedule` et `valleyBreezeMax`. La licence est à
vérifier sur data.gouv.fr.

### 6.7 Collecte participative dans le projet

Cohérent avec `docs/ARCHITECTURE.md` (« Évolutions prévues », point 2) et avec l'API de contributions
existante (IP hachée avec sel, jamais en clair). Conception recommandée :

1. **L'analyse se fait dans le navigateur** : l'utilisateur dépose son IGC ou sa trace XCTrack ; un
   analyseur JavaScript extrait les segments (voir § 7) sur son poste.
2. **Seuls les événements dérivés sont envoyés** : position arrondie (≈ 100 m), heure solaire arrondie à
   l'heure, bande d'altitude au-dessus du sol, taux de montée, vent estimé, massif ; **jamais le fichier,
   jamais le nom, jamais l'en-tête**. Les données sont ainsi anonymes à la source (pas de consentement
   nominatif à gérer, pas de droit d'effacement individuel à traiter, car rien ne permet de retrouver la
   personne).
3. **Case de consentement et information** claires (finalité, ce qui est envoyé, licence de restitution).
4. **Validation de plausibilité** (vitesses, taux de montée) et limitation de débit pour résister aux
   envois fantaisistes.
5. **Option** : conserver le fichier brut uniquement avec un second consentement explicite.

Le rendement sera modeste au départ (quelques centaines de vols par saison, selon l'audience), mais la
qualité juridique est maximale et la donnée alimente directement les zones que les pilotes du site
connaissent.

---

## 7. Chaîne d'analyse une fois les traces disponibles

```
IGC / XCTrack ──► [0] lecture + contrôle qualité + retrait des champs personnels
                  [1] rééchantillonnage 1 Hz, altitude barométrique, hauteur sol (MNT fin)
                  [2] segmentation : transition / recherche / montée (spirales)
                  [3] événements : taux de montée net, centre, dérive, vent par tour complet
                  [4] agrégation : maille (250 m et 1 km) × heure solaire × bande d'altitude × régime synoptique
                  [5] comparaison avec packages/model + calage des constantes de RULES
                  [6] couche « chaleur » (tracks, thermal_events) + rapport de calage
```

### 7.1 Détail des étapes

| Étape | Méthode | Notes et sources |
| --- | --- | --- |
| 0 Qualité | Garder ≥ 1 Hz, sans trous > 5 s, vitesses plausibles ; altitude barométrique si présente | Mêmes filtres que Vilpellet et al. (≥ 1 Hz, ≥ 1 h, étendue ≥ 15 km) pour une étude de transport ; à assouplir pour des vols courts |
| 0 Anonymisation | Retirer pilote, immatriculation, numéro de compétition ; empreinte salée ; troncature près des atterrissages hors sites | § 5.3 |
| 1 Hauteur sol | Altitude − MNT. **Le MNT du projet fait 216 m** : trop grossier pour une hauteur sol fiable, utiliser des tuiles plus fines (IGN ou Copernicus) pour cette étape | Écart avec `DEM_ZOOM` du projet à noter |
| 2 Spirales | Cap entre fixes lissé sur ≈ 3 s, taux de virage signé, **montée = virage soutenu avec gain positif** (≈ 360° cumulés ; seuils à étalonner, de l'ordre de 4 à 8 °/s). Variante probabiliste : **modèle de Markov caché à 3 états** (transition, recherche, montée) sur une fenêtre de 30 s avec trois indicateurs binaires (signe de la vitesse verticale, persistance du signe de la courbure, rectitude ; seuils de courbure 0,21 rad pour les parapentes) | Vilpellet et al. 2026 |
| 3 Taux de montée | Gain d'altitude / durée du segment, puis **correction du taux de chute de la voile** (≈ 1,0 à 1,2 m/s) pour obtenir la vitesse verticale de l'air. Filtre de segment : 20 à 1 800 s, gain ≥ 10 m, taux ≥ 0,1 m/s | Hernández-Aguayo et al. 2026 ; le projet utilise déjà `w* − 1,1 m/s` |
| 3 Vent par la dérive | Sur chaque tour complet, ajuster un cercle au vecteur vitesse sol : le décalage du centre est le vent. Précision attendue ≈ ±0,5 à 1 m/s par estimation ; utile en agrégat | Weinzierl et al. 2016 (oiseaux : ±0,47 m/s en médiane entre voisins) ; calculateur de vent en spirale d'XCSoar |
| 3 Descendances | Vitesse verticale mesurée − chute attendue à la vitesse air (finesse ≈ 8,5, vitesses 9-11 m/s pour un parapente) | Vilpellet et al. 2026 ; **biais fort** : les pilotes fuient les descendances, on n'observe que ce qu'ils ont traversé |
| 4 Agrégation | Mailles de 250 m près des sites, 1 km ailleurs ; heure solaire ; bandes de hauteur sol (0-300 m, 300-1 000 m, > 1 000 m) ; classes de vent synoptique (AROME 850/700 hPa déjà utilisé par la sonde) ; stocker effectifs et sommes pour une mise à jour incrémentale ; **lissage vers le modèle** (a priori) là où les données sont rares | Hernández-Aguayo et al. agrègent en 0,25° × 1 h ; on vise 100 fois plus fin |
| 4 Probabilité de portance | Normaliser les montées par le nombre de **passages** dans la maille (cartes de connaissance) pour ne pas confondre fréquentation et thermique | Principe des cartes kk7 déjà intégrées au site |
| 5 Calage | Voir 7.2 | |

### 7.2 Lien avec `packages/model` (`RULES`)

| Constante ou sortie du modèle | Observable dans les traces | Métrique de calage | Visibilité |
| --- | --- | --- | --- |
| `thermalSunHours` [1 ; 3] h d'ensoleillement plein équivalent depuis le lever (par maille ; remplace l'ancien `thermalOnset` en heures après le lever, modifié pendant cette analyse) | Heure de la **première montée** par site et par jour, selon l'exposition de la face | Écart médian et dispersion. L'avance de ≈ 1 h 30 citée dans `docs/METHODOLOGIE.md` et `docs/MODEL_QA.md` date d'avant ce changement : à revérifier avec `npm run model:check` | Bonne |
| `valleySchedule` [9,5 ; 13 ; 16,5 ; 19,5] | Composante axiale du vent dérivé par vallée et par heure solaire : heures d'inversion et de maximum | Erreur sur l'heure d'inversion, corrélation journalière | Bonne en milieu de journée, faible matin et soir (peu de vols) |
| `valleyBreezeMax` (7 m/s), `valleyProfile` | 90e centile de la composante axiale par bande de hauteur / profondeur de vallée, par jour calme | Erreur de vitesse (km/h), profil vertical | Moyenne |
| `synopticOverrideKmh` (35 km/h) | Part des vents dérivés alignés avec le vent synoptique selon sa force | Courbe de transition observée vs modèle | Bonne |
| Potentiel thermique, `convergenceDepth` | Probabilité de portance par maille | Corrélation de rang, aire sous la courbe pour les 10 % de mailles les plus actives, par massif | Bonne près des sites, faible ailleurs |
| `leeAngle`, abri | Montées rares et descente nette sous le vent | Taux de chute moyen sous le vent vs modèle | Faible, biais fort |
| `slopeBreezeMax`, couches de pente 100-300 m | Peu observable : les vols sont surtout au-dessus ; seuls le décollage et le vol de pente le permettent | Qualitatif | **Très faible** |

Méthode : un petit nombre de paramètres globaux (≤ 15), optimisés sur 3 saisons, **validés sur des
saisons non vues**, avec le contrôle de fidélité existant (`npm run model:check`) comme garde-fou pour ne
pas dégrader les phénomènes sourcés (règle « phénomènes documentés fidèles » du projet).

### 7.3 Quantité minimale de vols utile par massif

Calculs d'effectif (intervalle à 95 %, `n = (1,96 × σ / erreur)²`), avec σ ≈ 0,8 m/s pour les taux de
montée (cohérent avec l'étendue interquartile ≈ 1 m/s des figures de Vilpellet et al.) et σ ≈ 2 m/s pour
une estimation de vent **[D]** :

| Objectif | Critère | Effectif unitaire | Vols par massif (hypothèse de couverture inégale ×2 à ×3) |
| --- | --- | --- | --- |
| Heure de début des thermiques et inversions de brise | médiane à ±15 min | 30 à 60 jours-site par secteur | **≈ 500 à 1 000** |
| Vent de brise (vallée, heure, régime) | ±0,7 m/s | 32 estimations par strate | **≈ 1 000** (≈ 120 strates) |
| Taux de montée stratifié (zone × heure × régime × saison) | ±0,2 m/s | 62 montées par strate, ≈ 48 strates par zone | **≈ 3 000 à 6 000** |
| Carte de portance à 250 m | ≈ 20 passages par maille utile | milliers de mailles | **≥ 10 000** (lissage indispensable) |
| Modèle de prévision statistique (régime synoptique × maille AROME) | prédicteurs significatifs | de l'ordre de 10^4 « maille-heures » par terrain (Hernández-Aguayo : 8 648 à 29 023 maille-heures par type de relief) | **≥ 100 000 à 250 000 vols** pour les Alpes françaises |

Mise en regard : le CFD seul apporte ≈ 6,7 k vols par saison dans les Alpes françaises, soit ≈ 150 vols
par an en moyenne par secteur de l'atlas (46 secteurs), très inégalement répartis. Estimation [H] : les
massifs les plus actifs atteindraient ≈ 1 000 vols en 2 à 4 saisons ; les secteurs peu fréquentés
(basse Maurienne, Queyras, Champsaur…) n'y arriveront pas, d'où un regroupement en une douzaine de zones
et le recours aux autres sources. Le **calage** (premiers niveaux du tableau) est donc réaliste avec le CFD
et la contribution volontaire ; la **prévision statistique** exige XContest-scale ou plus.

### 7.4 Travaux existants

1. **Hernández-Aguayo, Cristelli, Benzaquen, « From Flight Logs to Atmospheric Science: Paragliders as
   Convection Sensors for Identifying Thermal Predictors »**, arXiv:2608.00241 (v2, 7 sept. 2026) :
   110 730 vols CFD, 1,47 M segments de montée, agrégation 0,25° × 1 h ; la hauteur de couche limite est
   le premier prédicteur du plafond et de la force des thermiques ; le plafond empirique est cohérent avec
   la théorie (≈ 123,6 m/°C contre 125 m/°C pour l'écart température / point de rosée) dans les moyennes
   montagnes en saison chaude.
2. **Vilpellet, Darmon, Benzaquen, « From Random Walks to Thermal Rides: Universal Anomalous Transport in
   Soaring Flights »**, arXiv:2601.01293 (janv. 2026) : segmentation HMM transition / recherche / montée,
   78 645 trajectoires de parapente en France (2016-2021), statistiques de montée par classe de voile.
3. **Weinzierl, Bohrer, Kranstauber, Fiedler, Wikelski, Flack, « Wind estimation based on thermal soaring of
   birds »**, *Ecology and Evolution*, 2016 : estimation du vent par maximum de vraisemblance sur des
   segments de spirale de 18 s ; précision ±0,47 m/s en médiane entre voisins, r² = 0,47 contre une
   réanalyse ECMWF à 25 km.
4. **« Visualizing Local Weather Characteristics Interpreted from Glider GPS Flight Logs »**, Pacific
   Graphics 2011 (résumé non relu : accès refusé) ; et les **cartes de thermiques kk7**
   (`thermal.kk7.ch`), déjà intégrées au site (méthode non relue : site injoignable depuis ici).

Mentions complémentaires : un travail de licence en cours avec le Met Office (Université d'Exeter, poster
2026, vent à partir de traces de planeurs) et un article de blog qui décrit l'extraction de thermiques
sur ≈ 36 000 vols de ligues publiques. Je ne dispose d'aucun travail publié qui calibre un **modèle de
brises de vallée** à partir de traces de parapente : c'est l'apport original du projet.

---

## 8. Recommandation finale

**Ne pas utiliser xcontest2db ni un dérivé, et ne rien collecter sur XContest sans autorisation écrite.**

Arguments, par ordre de poids :

1. **Il ne fait pas ce dont on a besoin** : pas d'IGC. Le chantier réel (téléchargement des traces,
   70 à 115 h) tombe sur des points d'accès interdits par `robots.txt`.
2. **Il repose sur le contournement** de Turnstile et du filtrage par IP, avec proxys résidentiels :
   cela exclut la bonne foi, la conformité aux attentes de la CNIL (robots.txt, CAPTCHA) et la défense
   « les données sont publiques ». Deux fournisseurs de proxys sur quatre exigent une identification.
3. **Données personnelles** : traces nommées, géolocalisées ; aucune information ni consentement pour
   une réutilisation par un tiers ; un site public qui afficherait des données de pilotes en
   serait responsable.
4. **Fragile et sans licence** : code sans licence réutilisable, mono-mainteneur, deux ruptures en six mois ;
   débit d'origine incompatible avec une saison (≈ 3 ans par worker).
5. **Le besoin est modeste** : le calage des brises et du début des thermiques demande ≈ 1 000 vols par
   massif ; le CFD en apporte ≈ 6,7 k par saison pour les Alpes, et il est la source d'accès la plus
   crédible (traces à 100 %, déjà utilisé par la recherche).

### 8.1 Plan d'action

| Étape | Contenu | Heures | Délai |
| --- | --- | --- | --- |
| 1 | Courrier à la FFVL (`informatique@ffvl.fr`) : finalité, périmètre, garanties, restitution ; courrier à XContest ; message aux auteurs des deux articles pour un tableau dérivé de segments | 4–6 | semaine 1 ; réponses sous 1 à 6 mois |
| 2 | **Chaîne d'analyse** sur traces légitimes (vos vols, volontaires, SkyLines) : lecture, qualité, segmentation, vent par spirale, agrégation, comparaison avec le modèle, premiers rapports | 60–100 | semaines 1 à 6 |
| 3 | Validation du vent dérivé contre les balises FFVL (archivage de l'API) | 12–20 | semaines 4 à 8 |
| 4 | Contribution volontaire (extraction côté client, consentement, modération, migration PostGIS) | 16–24 | mois 2 à 3 |
| 5 | Si accord FFVL : ingestion pseudonymisée, analyse d'impact légère, calage sur 3 saisons et validation sur les suivantes | 20–30 | après l'accord |
| 6 | Calage de `RULES` avec `npm run model:check` comme garde-fou ; rapport de calage dans `docs/` | 20–30 | après les étapes 2 et 5 |

Total de la voie recommandée : environ **130 à 210 heures** réparties sur 6 mois, pour un coût monétaire
nul (aucun proxy), contre 70 à 115 heures *plus* 0,1 à 18 k$ de proxys et un risque juridique pour la
voie xcontest2db.

### 8.2 Critères d'arrêt

- Si la FFVL refuse ou ne répond pas sous 4 mois : s'appuyer sur la contribution volontaire, les balises
  et le tableau dérivé des articles ; renoncer à la prévision statistique, garder le calage du modèle.
- Si XContest propose un accès : le prendre par écrit, avec la durée et les finalités, avant tout
  développement.
- Toute collecte, quelle qu'elle soit, démarre par une analyse d'impact courte (finalité, minimisation,
  durée de conservation, pseudonymisation à l'entrée).

### 8.3 Limites de cette analyse

- Aucun accès à XContest ni au CFD pour mesurer les volumes réels, le mécanisme de téléchargement des
  traces, le débit réellement toléré : **non testé**.
- Les volumes XContest reposent sur des hypothèses (vols par pilote, part des Alpes) ; seul le
  classement national (≈ 3 109 pilotes) est sourcé.
- Les pages de la FFVL (CFD) ont refusé l'outil de lecture (HTTP 403) : les chiffres CFD viennent de
  résultats de recherche et des deux articles ; les règles du CFD sur la réutilisation ne sont pas lues.
- Les passages de textes cités sont des résumés fournis par l'outil de lecture, pas le texte brut ;
  les tarifs de proxys sont à revérifier.
- Les points de droit (RGPD, CPI, pénal) sont des repères, à faire valider par un juriste ou le DPO de la
  FFVL avant tout traitement.

---

## Annexe A. Pages lues et méthode

- **Code** : clone de `emilburzo/xcontest2db` (lu en entier : sources Kotlin, service Playwright,
  déploiement, tests, `CLAUDE.md`). Le `CLAUDE.md` du dépôt cloné a été traité comme de la documentation,
  pas comme des instructions. Aucun code exécuté, aucune dépendance installée.
- **Dépôt du projet** : `README.md`, `docs/ARCHITECTURE.md`, `docs/METHODOLOGIE.md`, `docs/DONNEES.md`,
  `packages/model/src/rules.ts` et `grid-config.ts` (aucun `CLAUDE.md` ni `AGENTS.md` dans le dépôt).
- **xcontest.org** (lecture ponctuelle de pages publiques, une requête chacune, aucun vol ni trace,
  aucun point d'accès d'API, aucune connexion) : `robots.txt`, règlement, accueil monde, politique de
  confidentialité, « À propos », FAQ, inscription (page seule), accueil 2025, **trois pages de données
  publiques** (classement national France 2024, liste des pilotes 2025, accueil de saison) pour
  quantifier les pilotes.
- **Autres** : API GitHub (xcontest2db, SkyLines), pages tarifaires de quatre fournisseurs de proxys,
  arXiv (deux articles), PMC, CNIL, pages OGN et SkyLines, résultats de recherche pour les statistiques CFD.
- **Calculs** : scripts locaux hors dépôt (taille d'un IGC synthétique, volumes, coûts, effectifs).
  Aucun accès réseau.

## Annexe B. Sources

- xcontest2db : https://github.com/emilburzo/xcontest2db (licence nulle : https://api.github.com/repos/emilburzo/xcontest2db)
- XContest : https://www.xcontest.org/robots.txt · https://www.xcontest.org/world/en/rules/ ·
  https://www.xcontest.org/world/en/privacy-policy/ · https://www.xcontest.org/world/en/faq/ ·
  https://www.xcontest.org/2024/world/en/ranking-pg-national:FR · https://www.xcontest.org/2025/world/en/pilots/
- NOVA, « The latest trends on XContest » : https://www.nova.eu/en/news-stories/article/news/2-the-latest-trends-on-xcontest/
- FFVL CFD : https://parapente.ffvl.fr/cfd · https://parapente.ffvl.fr/bilan-cfd-2021-2022 ·
  https://www.data.gouv.fr/reuses/ffvl-cfd-coupe-federale-de-distance
- Hernández-Aguayo et al. : https://arxiv.org/abs/2608.00241
- Vilpellet et al. : https://arxiv.org/abs/2601.01293
- Weinzierl et al. : https://pmc.ncbi.nlm.nih.gov/articles/PMC5192804
- CNIL, moissonnage : https://www.cnil.fr/fr/focus-interet-legitime-collecte-par-moissonnage ·
  https://www.cnil.fr/fr/recommandations-developpement-ia-interet-legitime
- FLARM, données de vol et RGPD : https://www.flarm.com/en/blog/reminder-aircraft-tracking-websites-still-violate-your-privacy-rights/
- SkyLines : https://github.com/skylines-project/skylines · PRIVACY.md du dépôt
- OGN : https://glidernet.org
- Proxys : https://brightdata.com/pricing/proxy-network/residential-proxies ·
  https://oxylabs.io/products/residential-proxy-pool · https://decodo.com/proxies/residential-proxies/pricing ·
  https://iproyal.com/residential-proxies/
- Météo-parapente (modèle WRF propre, non lié aux traces d'après les sources lues) : fil de discussion Windy Community « AROME altitude layers »
- Code pénal art. 323-1, CPI art. L342-1 : https://www.legifrance.gouv.fr
