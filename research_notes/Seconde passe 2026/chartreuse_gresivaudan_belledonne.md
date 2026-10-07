# Seconde passe 2026 : Chartreuse, Grésivaudan, Belledonne

Lot `chartreuse_gresivaudan_belledonne` (massifs `chartreuse`, `gresivaudan`, `belledonne`). Données : `data/chartreuse_gresivaudan_belledonne.json`. Fichiers bruts (PDF, pages, images, KML, fiches FFVL) : `.cache/research/docs/chartreuse_gresivaudan_belledonne/`. Sauvegarde de la première passe : `first_pass_backup.json` dans le même dossier.

## Résultat sur la question centrale : le sens de la brise du Grésivaudan

Le rapport de synthèse disait que l'air entre par la cluse de Chambéry et se vide vers le Drac. C'est vrai, avec trois précisions tirées des sources :

1. **Haut Grésivaudan et Grésivaudan moyen : la brise est NORD → SUD-OUEST** (de la sortie de la cluse de Chambéry vers Grenoble). Six sources concordent : Airshop (Lumbin « tendance Nord » dès la fin de matinée, rarement > 15 km/h), page FFVL « Voler en Chartreuse » (« vient généralement du Nord »), Vol Libre n°298 (brise « descendante anormale »), CHVD (branche « à droite vers Grenoble », 25-30 km/h près de la cluse), carte Largeault (flèche Chignin → Bernin), carte PNR/CD38 (grande flèche Chapareillan → Saint-Nazaire-les-Eymes). Côté Chamoux (Combe de Savoie), la brise est au contraire S/SO (vers Albertville) : forum et CHVD. Le point de partage est la sortie de la cluse près de Montmélian, pas « Pontcharra » (terme introuvable dans toutes les sources lues).
2. **Pourquoi** (Vol Libre n°298, fig. 1a) : la forte brise ascendante de la cluse de Voreppe (« 75 % de l'aérologie locale ») aspire l'air du Grésivaudan ; la rencontre des deux brises crée une confluence au NE de Grenoble (Meylan-Montbonnot-Saint-Ismier), au-dessus de 400-500 m, varios de 2-3 m/s, bord ouest turbulent.
3. **Horaires** : Voreppe dès 11h au printemps et en été (PNR/CD38 ; FFVL Chalais « fin de matinée ») ; Grésivaudan : fin de matinée à Lumbin (Airshop), « début d'après-midi » dans les schémas de Vol Libre ; brise de Chambéry sur le Granier et les Bauges établie vers 14h-14h30 (avril à mi-septembre, forum 2023). En soirée de forte canicule, brise renforcée à Chamrousse (> 25 km/h fixe, rafales 35, jusqu'à ~2500 m). **Exception documentée** : par fortes chaleurs de juin à août, une brise également montante peut s'installer dans le Grésivaudan (« faux vent du Sud » à Saint-Hilaire, fig. 1b, source unique).
4. En aval, après la confluence, le flux repart vers le sud par le Drac (flèches de la fig. 1a/1b et de la carte du club, page Grenoble) ; l'écoulement de Voreppe passe aussi par Grenoble puis remonte l'Isère vers Gières-Montbonnot (carte Largeault).

## Sources lues (accès OK sauf mention)

- **Vol Libre n°298 (2001), « Surfez le vent dans l'Y grenoblois »** (N. Bertrand, C. Kerkhove) : les 4 pages scannées sont publiées dans le fil parapentiste.info t49137 (images servimg). Lues en image : introduction (Grenoble au cœur d'un Y : Drac, cluse de Voreppe NNO, Grésivaudan NE ; brises remontant jusqu'à ~900 m), cinq régimes cartographiés : 1a-1b (été anticyclonique), 2a-2d (S/SO de plus en plus établi), 3 (front froid stagnant), 4 (air polaire N/NE). Notes de l'auteur sur les cols du Coq, de Vence et des Ayes. Les « 6 schémas d'Arnaud Campredon » annoncés dans le fil n'apparaissent pas (images supprimées des messages #1 et #3).
- **PDF club St Hil'Air « Cross, massifs et transitions »** (48 p., identique chez bluehouse.fr) : texte + images, pages Chartreuse (7), Épine (8), Belledonne sud (9), Belledonne nord/Lauzière (10, hors lot), transitions Grésivaudan (19), Grenoble (20), Aiguebelette (21), Chambéry (22), Bauges (23-27, hors lot), Chamrousse (28-30) et traces CFD (33-35). Légende : numéros de pièges mais pas de légende de couleur de flèche.
- **PDF club « Préparation Cross »** (J.-N. Michel, 2017, 29 p.) : parcours Saint-Eynard, Dent, Barraux, Granier, Saint-Genis, Prapoutel, Chamrousse (texte tronqué récupéré avec `pdftotext -x 0 -y 0 -W 5000 -H 5000`).
- **Carte officielle « Rapace et vol libre – Chartreuse »** (PNR de Chartreuse / Département de l'Isère, 2021, PDF image 2 pages) : carte 3D (flèches de brise, thermiques, rapaces, espaces aériens) et fiches de sites avec coordonnées. https://www.parc-chartreuse.net/content/uploads/2020/07/WEB_VL_Chartreuse21.pdf
- **Page FFVL « Survolez les plus beaux massifs alpins : la Chartreuse »** (11/08/2025, via navigateur intégré) et **page PNR « Le survol »**.
- **Carte Largeault (Rock The Outdoor)** : Google My Maps, KML public téléchargé et analysé (dossiers Chartreuse 26 lignes, Belledonnes 16 lignes). Les polylignes fléchées ont fourni la géométrie de 18 brises et de 3 convergences de basse couche. Aucune description ni horaire dans le KML.
- **toutleparapente** : page lue, mais le PDF « VL_ChartreuseWEB » et « VL_BelledonneWEB » ne se téléchargent pas (le lien redirige vers l'accueil) et les images sont des pixels 1x1 (voir `blocked_urls.txt`).
- **Airshop (topo Saint-Hilaire)**, **FlySaintHilaire (cross-country)**, **XC Mag (guide Saint-Hilaire)**, **CHVD « Le passage de la Savoyarde »** (page entière), **carnet Largeault** (Granier, Collet d'Allevard), **fils parapentiste.info** (cartographie des brises p. 1 et p. 20, vent de nord autour de Grenoble t5840, aérologie et cheminement en Chartreuse t43513, transitions Granier-Savoyarde t62480 et t62128).
- **Fiches FFVL** (une cinquantaine de sites du lot) : via le fichier `ffvl_sites_alpes.json` du coordinateur, complété par mes relevés dans le navigateur (curl : Cloudflare 403 sur federation.ffvl.fr ; le navigateur intégré passe).
- **Club St Hil'Air** (WordPress, API publique, 136 articles) : lus en entier « Cross hasardeux de 154 km », « Premières 100, 150 et 200 », « Vol de groupe 140 km », « Grand tour du Bocal », « Trilogie de Chartreuse » ; parcourus les autres.
- **Club des Coccin'ailes (Allevard)**, **chamrousse.com / Air Ailes Chamrousse** (page ancienne), pages commerciales Belledonne (Sacha parapente, Là-Haut, summits.fr : sans information aérologique utile).

## Changements par rapport à la première passe

Corrigé :
- `brise-nord-gresivaudan` : tracé refait avec les villages le long du Grésivaudan (la première passe plaçait Montmélian en tête ; départ remplacé par la sortie de la cluse aux Marches), vitesse typique 12 km/h (Lumbin ≤ 15), confiance « high » justifiée par six sources.
- `brise-voreppe` : prolongée à travers Grenoble jusqu'à Montbonnot (Largeault), 20 km/h typiques, max 35 ; source PNR/CD38 ajoutée (« très forte dès 11h »).
- `confluence-grenoble` (ex-hypothèse sans source) : documentée par Vol Libre n°298, Largeault et le club, confiance « high » ; position NE de Grenoble (et non « au-dessus de Grenoble »).
- `st-hilaire-sud-nord` : le point unique douteux (45°18'41"N 5°53'22"E, qualifié d'« atterrissage » par un extrait de moteur de recherche) est remplacé par des fiches FFVL distinctes : Sud, Nord/moquette, Est, delta ; l'ancien id devient le déco Sud.
- `mont-granier` : coordonnées Wikipédia au lieu de valeurs de mémoire ; orientation SO (déco du sommet).
- `lumbin` : coordonnées de la fiche FFVL 1253 ; Lumbin 2, delta, Voreppe, Montbonnot ajoutés.
- `traversee-gresivaudan` : points complétés (Sainte-Marie-du-Mont, Saint-Genis, Barioz), altitudes (> 2000 m selon le PDF, > 2200 m selon FlySaintHilaire), laisse de chien vers le nord (FFVL).
- `passage-savoyarde` : géométrie CHVD complétée (viser le Mont Saint-Michel puis l'épaule NO du Montgelas), critères d'altitude, TMA/CTR.
- `facade-est-st-hilaire` (thermique) : position estimée devant les décos, horaires ajoutés ; `brise-pente-est-st-hilaire` : horaires, force, waypoints sourcés.
- `brise-pente-balcon-belledonne` : horaire 14h+ du PDF du club, FFVL Chamrousse, waypoints sourcés ; `drainage-hivernal-grenoble` complété par Vol Libre (inversion hivernale).

Ajouté (en volume, voir le message final) : 24 brises dont 18 issues de la carte Largeault et de la carte PNR/CD38 (Guiers Mort, Entremont, Cucheron, Col du Granier, Col du Couz, Manival, Quaix, Corenc-Saint-Eynard, Barioz, Bréda...), 8 convergences (Granier, Cucheron, Barioz, Sept Laux, confluences de Vol Libre, La Terrasse-Tencin), 28 dangers (espaces aériens, bulle circaète, Saint-Même, Col du Coq, Perquelin, Venturi du Collet et de la digue d'Allevard, Grand Colon, tyrolienne de Chamrousse, brise de soirée de canicule, orage...), thermiques, soarings, 27 décollages et 19 atterrissages FFVL avec ffvl_id, effets synoptiques par direction, 15 routes de cross (traces CFD, récits du club), 21 entrées de figures.

Retiré : aucun élément de la première passe n'a été démontré faux. Les sources S2, S6, S8, S11-S14, S19, S21, S23, S24 ne sont plus citées par ce lot (elles concernaient les Bauges ou n'ont pas été relues) et ont été retirées de la liste des sources du fichier ; les numéros restants n'ont pas été modifiés (S43 prévue puis fusionnée dans S15).

## Figures déclarées (`figures`)

Douze figures de base, scindées par massif (le contrôle exige des éléments du massif de la figure) : club PDF p. 7, 9, 19, 20, 21, 22, 33-35 ; Vol Libre n°298 (images p2 et p4, URL directes servimg) ; carte PNR/CD38 p. 1 et p. 2 ; carte Largeault (image de l'article Rock The Outdoor).

## Divergences entre sources (gardées, confiance abaissée)

- Dates de la CTR/TMA de Chambéry 1 : 15/12-7/04 (PDF club), fin décembre-mi-avril (forum), « jusqu'au 15 avril, week-end » (CHVD). Hazard `tma-ctr-chambery-chignin`.
- Altitude de départ pour la Savoyarde : 2400 m (club, CHVD), 2300 m (forum, club 12 km), « 2200 avec tendance sud » ; la FFVL parle de viser « les faces ouest au-dessus de Chignin », CHVD l'épaule NO du Montgelas.
- Altitude du Grand Som : fiche FFVL 5004 = 1030 m (erreur apparente), page FFVL Chartreuse = 2020 m ; retenu 2020 m.
- Col de Baure : la fiche FFVL signale le décollage interdit depuis l'été 2024 ; la page FFVL Chartreuse (2025) le cite encore.

## Ce qui reste à vérifier ou non trouvé

- **Hautes vallées de Chartreuse** (Saint-Pierre-de-Chartreuse, Entremont, Col de Porte, Sappey, Saint-Pancrasse) : seulement les flèches de la carte PNR/CD38 et de la carte Largeault, sans horaires ni vitesses. Aucune source lue sur la brise du Col de Porte ni sur le « Bec Margain » (randonnée seulement dans les résultats web). Piste : PDF toutleparapente de la carte Chartreuse (bloqué), plaquette CDVL 38 de 2017 (page FFVL https://federation.ffvl.fr/actus/pour-information-plaquette-vol-libre-en-chartreuse, non ouverte).
- **Belledonne** : brise sur Pinsot, Saint-Mury et le Collet : flèches Largeault uniquement. **Bachat-Bouloud** est un site d'escalade (Wiki-Climb), pas un site de vol : aucun élément créé. Pas de PDF Vol Libre Belledonne (bloqué).
- Direction exacte et horaires de plusieurs flèches Largeault (marquées confiance « low »). Les couleurs de flèches des PDF du club ne sont pas définies par la légende (lecture proposée : bleu large = brise de vallée, vert = flux de pente/thermique).
- Positions estimées (`approx`) : Mont Saint-Genis (PDF club p. 19), Bramefarine (PDF + lac du Flumet), cirque de Saint-Même, bulle du circaète, ZIT de Grenoble (rayon), TMA de Chambéry (centre), thermique devant les décos, pilier sud de la Dent, Roc des Bœufs et relais du Mont du Chat (triangles CFD), col de la Forclaz.
- `.cache` : Nominatim a répondu 429 (limite) et Overpass 504 pendant la recherche ; coordonnées complétées par Wikipédia (API) et par une première requête Overpass réussie.
- Coupe Icare : pas de page technique exploitée (seulement la règle « atterrissage de l'office du tourisme interdit pendant la Coupe Icare »).

## URL bloquées ou inutilisables

- https://toutleparapente.fr/app/download/8931377175/VL_ChartreuseWEB.pdf et .../8931378175/VL_BelledonneWEB.pdf : redirigent vers l'accueil ; images de l'article = pixel 1x1 (inscrit dans `.cache/research/blocked_urls.txt`).
- https://federation.ffvl.fr/... et https://parapente.ffvl.fr/... : 403 Cloudflare à curl, accessibles par le navigateur intégré.
- Fils parapentiste.info, « 6 schémas d'Arnaud Campredon » : non affichés dans le fil t49137.

## Thermiques et points de relance (passe complémentaire)

Constat de départ : la seconde passe ne retenait que les endroits appelés « thermique » ; les pilotes parlent de points de raccroche et de relance le long des cheminements. Cette passe relit les récits du club St Hil'Air (articles 1597, 2072, 2105, 2729, 1690, 1767, 1809, 1933, 2114, 2255, 2562, 3101, 3233, 1309 et la manche de compétition de 2017 `benj.docx`), les PDF « Préparation Cross » (Jean-Nono, diapositives 20-26 vues en image) et « Cross, massifs et transitions », la carte PNR/CD38 et les fils parapentiste.info. Les documents « Jean-nono » cités par l'article 2072 sont le PDF Préparation Cross (S27) ; l'article 1450 (« Les cross pour les débutants ») pointe vers le même document.

**Avant → après (thermiques)** : chartreuse 11 → 24, belledonne 5 → 8, gresivaudan 0 → 0 (Grésivaudan : les relances de la vallée sont sur les reliefs voisins, rattachées à la Chartreuse et à Belledonne). Routes : waypoints ajoutés à `route-st-eynard`, `route-dent-de-crolles`, `route-granier`, `grand-tour-du-bocal`, `transition-chamrousse-vercors`. Sources S99 à S111. Confiance renseignée sur tous les éléments ajoutés ou complétés.

**Points demandés par le propriétaire**
- **Les Antennes** (`antennes-st-hilaire`, confiance medium, position approx) : « la frontière Sud du bocal de Saint Hil » (S22), « à quelle altitude quitter les antennes » (S99), « percée jusqu'aux antennes » à 15h30 = mauvaise option (S101). Le lieu-dit n'existe ni à l'IGN ni dans OSM ; position déduite des pylônes OSM « FT/TDF » (45.2938 N, 5.8755 E), seul groupe d'antennes sur ce relief. À confirmer par le propriétaire (autre candidat peu probable : mât Orange à 1 km au sud du déco, 45.3024 N, 5.8787 E).
- **Château Nardent** (`chateau-nardent`, medium, position source) : raccroche du parcours classique (S22), limite psychologique (S100). Lieu-dit IGN et sommet OSM (1217 m).

**Autres points ajoutés (Chartreuse)** : gencives de la Dent de Crolles (approx, medium), Émeindras (col, source), faces est de la Dent / Col de Bellefond (plafond, approx), Pas de Rocheplane, cirque de Saint-Même (bascule et plafond avant Belledonne), La Scia (plafond 3000-3100 m), Montagne du Sac (au vent, tour par l'ouest), Saint-Marcel d'en haut (thermique de service, arrivée des Bauges), Mont Outheran/Corbelet, falaises du Touvet–Saint-Vincent–La Flachère (low, déduction d'après la trace d'exemple de la diapositive 22), falaises de Lumbin (low). **Belledonne** : Roche Béranger (trois récits : 2400-2650 m avant le Connex), antenne de la station du Collet d'Allevard (low, mât TDF déduit), Bramefarine (arrivée des Bauges). **Complétés** (rôle de relance, citations, confiance) : Manival/Bec Charvet, pilier sud, Rachais (« la pompe qui me ramènera »), Saint-Eynard, Néron, façade est de Saint-Hilaire, Granier, Chamechaude, Sainte-Marie-du-Mont, Saint-Genis, Crêt du Poulet, Pipay.

**Méthode de positionnement** : lieux-dits, cols et sommets par le géocodeur IGN et OSM (`coord_quality: source`) ; un déclencheur sans nom cartographié est placé par déduction (`approx`). Pour les diapositives 20 à 26 de la Préparation Cross, les étoiles rouges (thermiques relevés sur une trace XContest) ont été détectées par traitement d'image mais le géoréférencement du fond de carte reste trop imprécis (échelles non isotropes) : elles ne servent qu'à confirmer l'ordre des points (Antennes puis Château Nardent puis crête du Saint-Eynard : une étoile tombe à 400 m de Château Nardent) et ne fournissent aucune coordonnée.

**Introuvable ou non localisé** : « pare-avalanches » entre le Bec Charvet et la Dent (cité par la manche de 2017), « l'école d'escalade » (repli de Matmute), « réservoirs » avant le Saint-Eynard (balise B1 de la manche 2017), air de service du Granier, thermique « Aulp du Seuil » (cité par Bluehouse, hors lot). Dôme de Bellefond : absent du géocodeur IGN, point placé par déduction sur la crête. Le tuto vidéo « St Hil – La Dent de Crolles » (article 2066) et la liste Aiglons du club n'ont pas de texte. L'API de recherche WordPress du club est exposée par `public-api.wordpress.com` (le `/wp-json/` du domaine renvoie 404). Aucune URL nouvelle à ajouter à `blocked_urls.txt`.

## Passe secteurs minces

Date : 7 octobre 2026. Demande du coordinateur : présentation de Belledonne jugée lacunaire (brises du matin et de l'après-midi de chaque vallée, thermiques et points de relance de la chaîne, convergences du balcon, cheminement réel le long de la chaîne). Même convention de confiance : récit précis ou plusieurs récits = `medium` ; extrapolation du relief = `low` avec « déduction ». Identifiants existants conservés, rien supprimé. `npm run data:build -- --check` : aucune alerte nouvelle.

### Belledonne (`belledonne`)

Volumes avant → après : brises 9 → 12, convergences 2 → 2 (une complétée), hazards 9 → 14, thermiques 8 → 17, soarings 3 → 3, décollages 12 → 14, atterrissages 8 → 10, effets synoptiques 6 → 8, routes 3 → 6, conseils 6 → 12 ; 26 sources (S112 à S137) ; aucune figure ajoutée.

**Sources nouvelles** : une vingtaine de récits du CHVD (club de Grenoble), lus en entier à partir de l'API WordPress du blog (`.cache/research/docs/oisans_maurienne/chvd_wp/`) : le vol de 155 km du 31 juillet 2020 (Chartreuse → Belledonne → Chamrousse → Vif), la crête de Chamrousse à Chamoux du 13 août 2021, la compétition B'Ailedonne X'Plore (Allevard, 3-4 septembre 2022), la compétition de Val Pelouse (juin 2023), le stage Prévol x CHVD (juin 2025), le retour du 30 mai 2026, les vols de 2006, 2008, 2010, 2011, 2014, 2020 et 2022 autour de Chamrousse, de la crête sud et d'Allevard ; le récit Blues Team de mai 2015 (faces est) ; une étude de typologie des sites de Belledonne (page personnelle, Saint-Pierre-d'Allevard « site du matin ») ; le géocodeur IGN pour toutes les positions.

**Ajouté**
- *Thermiques et relances nommés* : Orionde / col du Rafour (2640 m), combe et dents de Bédina (2700 m), gorge sous les Rochers de la Far (dynamique de sauvetage devenu pompe jusqu'à 4000 m), Puy Gris, Grand Charnier / Pic du Frêne (3600 m), Plagnes (premier plein), col du Merdaret (3100 m), vallon de la Pra (4146 m), hautes crêtes de Comberousse (2750 m). Complétés avec les récits : Saint-Genis, Crêt du Poulet, Pipay / Jas des Lièvres, Grand Colon, Chamrousse face ouest, Brame Farine, antenne du Collet (plusieurs jours, plusieurs altitudes d'arrivée).
- *Brises* : faces est de Belledonne (`low`, avec l'indication que les faces est semblent précéder la face ouest, déduction ; tracé le long de la crête du Pas de la Coche au lac de Belledonne, et non plus du lac de Grand-Maison, après le contrôle `model:check` qui l'opposait à `eau-d-olle-brise` du secteur Oisans : 0 paire opposée ensuite) ; deux écoulements descendants nocturnes et matinaux, du Bréda et du balcon ouest (`low`, déductions : seule la matinée calme est sourcée, départs dès 7h à Allevard, Saint-Pierre « site du matin », Chamrousse conseillé jusqu'à 12h) ; horaires et observations ajoutés à la brise du balcon, au Bréda, à la brise Grenoble-Uriage et à celle de Fond de France.
- *Dangers* : lame d'air d'Orionde, crête par sud établi (-1000 m à chaque transition), enterrement après le col du Barioz, confluence au-dessus de la cluse de Vizille (placée à Vizille), bourrasques sous voile de cirro-stratus à l'Aiguillette ; convergence du Barioz complétée par cinq observations contradictoires selon les jours.
- *Routes* : `col-vert-chartreuse-belledonne-chamrousse-vif-2020` (11 points, de Saint-Genis à Vif), `chamrousse-crete-belledonne-chamoux-2021` (11 points, toute la crête), `aiguillette-grand-colon-7-laux-aller-retour-2022`.
- *Équipements* : La Botte (Chamrousse), Orionde et La Boutière, grand champ avant Fond de France ; effets synoptiques « Vent du Sud » et « E » ; compléments sur le nord et le nord-ouest.

**Erreurs évitées** : le 20 juillet 2020, les « faces ouest qui commencent à bien donner à 15h » concernent la Dent du Chat (Épine), pas Belledonne ; la face ouest de la Lauzière « un peu tôt » (2024) ne prouve pas à elle seule l'horaire de la face ouest de Belledonne, d'où la mention « déduction ».

**Introuvable ou non fait**
- Brises documentées du **Bréda**, de l'**Eau d'Olle** et de la **Romanche côté Chamrousse** : aucun texte avec horaire ; les deux dernières existent déjà dans le massif `oisans-grandes-rousses` (`eau-d-olle-brise`, `romanche-brise-montante`) et n'ont pas été dupliquées ; le Bréda n'a qu'une déduction matinale.
- Aucune convergence nouvelle documentée sur le balcon (la confluence de Vizille est classée en danger, sans géométrie) ; flèches de Theys, Le Cheylas, Froges et Brignoud toujours sans horaire.
- PDF Vol Libre « brises, thermiques et décollages dans Belledonne » (toutleparapente) : toujours inaccessible ; site du club d'Allevard vide ; traces CFD derrière Cloudflare (voir `pages_bloquees.txt`).
- Saint-Mury et le Col du Loup : récits de vol rando seulement (pas de brise documentée) ; Rocher Blanc, Belle Étoile, Rocher d'Arguille, Grand Charnier : non localisés par le géocodeur.


## Audit des thermiques (octobre 2026)

Contexte : le propriétaire, pilote local, a relevé l'oubli des Antennes, de Château Nardent et du Grand Ratz. Les listes de lacunes (`docs/COUVERTURE.md`, `docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`) ont été reprises une à une pour les trois massifs, et les sources ont été relues : carte PNR/CD38 « Vol libre Chartreuse » (`WEB_VL_Chartreuse21.pdf`, vue en image : elle dessine une icône « thermique » par lieu, que la première lecture avait regroupées en trois éléments), récits du club St Hil'Air, fiches FFVL, fil parapentiste.info, CHVD. Les thermiques créés suivent la règle de confiance du lot : `medium` pour une source nommant le lieu ou plusieurs indices concordants, `low` avec « déduction » pour un seul indice (icône PNR ou point chaud kk7 + relief). Les points chauds kk7 (`thermal.kk7.ch`) disent où ça monte, pas pourquoi : leur position est reprise quand un déclencheur est à moins de 600 m, mais aucun texte ne décrit le déclencheur dans les cas `low`.

### Chartreuse (`chartreuse`)

**Thermiques créés (9)**
- `grande-sure-faces-ouest` (`medium`) : icône PNR + récit du 154 km (Grande Sûre « en dynamique à 1800 m » à 15h05 par NO) + point chaud kk7 82 % à 1,3 km. Position : décollage FFVL 5071, altitude IGN (la fiche donne 1578 m).
- `charmant-som-versant-est` (`low`) : icône PNR + point chaud kk7 à 350 m au sud du décollage FFVL 5119 (76 %, 83 % le matin).
- `la-pinea-sarcenas` (`low`) : icône PNR de la Pinéa (jusque-là noyée dans « Chamechaude et La Pinéa », placé à Chamechaude) + point chaud kk7 89 % à 900 m au sud du sommet.
- `pas-de-la-fosse-thermique` (`medium`) : icône PNR et forum (« site en dynamique qui reprend depuis assez bas, mais grosse brise qui balaye les bulles thermiques », 07/02/2023). C'est le texte « bulle » signalé par COUVERTURE : il parlait bien d'un thermique, pas d'une zone de quiétude.
- `roche-veyrand-corbel` (`low`) : icône PNR seule, aucun récit ni point chaud mesuré.
- `bannettes-pente-sud` (`low`) : décollage FFVL 5276 (issu des traces, sans texte) + point chaud kk7 71 % à 1,1 km.
- Points chauds ≥ 90 % classés au Grésivaudan par la géométrie mais situés dans le massif : `roche-rousse-sappey` (98 %, barre de Roche Rousse au nord du Sappey ; probablement l'icône « Le Sappey » de la carte PNR, rapprochement non prouvé), `belvedere-du-puy-saint-bernard` (96 %, bord est du plateau des Petites Roches à Saint-Bernard-du-Touvet : cohérent avec « le nord peut vous bloquer sur St Bernard » du parcours Barraux), `pierre-morin-saint-ismier` (91 %, `low`, aucun texte).

**Positions corrigées**
- `cirque-saint-meme-bascule` (cas signalé par le propriétaire) : la position était le fond du cirque (960 m), où personne ne prend de hauteur. Les récits du 06/09/2021 situent la bascule des faces est vers les faces ouest « au cirque de St-Même quasiment sans enrouler jusqu'au Granier » et le plafond de 2200-2400 m au retour, en bordure de nuage ; la carte PNR/CD38 dessine deux icônes « thermique » autour du cirque. Le point est ramené sur le rebord est (l'Alpette, toponyme IGN, 1561 m). Position déduite du texte, pas mesurée : aucun point chaud kk7 à moins de 1,7 km. La convention du PNR demande de traverser par l'Alpette de Chapareillan, plus au nord, et de ne pas survoler Saint-Même sous 1900 m du 1er février au 30 août ; les pilotes qui y passent le font à plus de 1900 m.
- `antennes-st-hilaire` : l'altitude déclarée (720 m) ne collait pas au terrain IGN (969 m) ; la position (pylônes OSM FT/TDF, 45.2938 N 5.8755 E) est conservée, l'altitude corrigée. Aucun point chaud kk7 à moins de 1 km.
- `sainte-marie-du-mont-barraux` : la position était l'église du village (940 m) ; ramenée sur le point chaud kk7 de la crête qui le domine à l'ouest (1560 m).
- `scia-plafond-transition` : position ramenée sur le point chaud kk7 de la Scia (99 %), au pied du décollage, et non au sommet ; `pilier-sud-dent-de-crolles` et `gencives-dent-de-crolles` occupaient presque le même point : le pilier est mis sur le point chaud au pied de la face sud (93 %), les gencives sur le point chaud à l'ouest de la Dent au-dessus de Saint-Pancrasse (90 %, 1671 m, cohérent avec les « 1600 m minimum »).
- Altitudes seules corrigées (position conservée) : `manival-bec-charvet` (1630 m), `montagne-du-sac` (1263 m), `falaises-touvet-saint-vincent` (1039 m), `pas-de-rocheplane` (1778 m).
- Noms précisés : `scia-grand-som-charmant-som` devient « Grand Som (centre du massif) », `chamechaude-pinea` « Chamechaude (face est) et crêtes du Sappey », pour ne plus laisser croire qu'un seul point vaut pour plusieurs icônes.

**Lacunes écartées**
- `bulle-circaete-lumbin-terrasse` : zone de quiétude réglementaire (survol à plus de 300 m/sol), aucune ascendance dans le texte.
- `pas-de-la-fosse-tht` : danger (lignes THT, zone R48) ; le thermique du même texte est créé ci-dessus.
- `Grande Sûre` (takeoff, 89 m d'écart d'altitude) : le décollage garde la position FFVL, l'écart vient de l'altitude de la fiche.
- `emeindras`, `ffvl13287-saint-hugues-declenchements` : loin d'un point chaud kk7 (2 km, 2,8 km) mais position vérifiée (col IGN ; atterrissage en fond de vallée où l'on vole peu).
- Le « thermique salvateur » des avant-reliefs et l'« école d'escalade » du récit de Matmute (2018), les « pare-avalanches », l'icône PNR à l'est du col du Cucheron : non localisés (aucun toponyme, aucun point chaud mesuré à moins de 1 km).

### Grésivaudan (`gresivaudan`)

- Créé : `chalais-faces-voreppe` (`low`) : le décollage de Chalais (FFVL 324, sud) et sa réserve PMR n'avaient aucun thermique ; deux points chauds kk7 (87 % et 84 %, actifs de midi au soir, jamais le matin, ce qui concorde avec « la brise de nord, montante en vallée dès la fin de matinée ») à 1,9 et 2,4 km au nord.
- Altitude corrigée : `bannettes-gres` (1845 → 1678 m, terrain IGN à la position de la fiche ; l'altitude de la fiche est la même que celle du Charmant Som).
- Les trois points chauds ≥ 90 % de la liste (Roche Rousse, Saint-Bernard, Pierre Morin) sont dans le massif Chartreuse (voir ci-dessus). Aucun thermique de fond de vallée n'est décrit par les sources du massif.

### Belledonne (`belledonne`)

**Thermiques créés (7)** : `barley-col-du-barioz` (`low`, 98 %, le sommet de Barley à 600 m du col du Barioz : les récits décrivent ce secteur comme un piège de l'arrivée de Chartreuse, d'où la formulation prudente), `collet-pre-rond-thermique` (`medium` : la fiche FFVL 13415 dit « décollage sous le vent du thermique », point chaud 92 % à 310 m), `col-de-pipay-face-ouest` (`medium` : récit du 1er juin 2019 « un bon thermique à Pipay », « point dur » du club ; le col de Pipay est à 3 km au nord du Jas des Lièvres où l'ancien élément était placé), `grand-colon-versant-ouest-source`, `pre-du-mollard-sitre`, `sept-laux-vallon-des-lacs`, `col-du-glandon-pente-nord` (tous `low`, point chaud seul ; le décollage du Glandon relève de la couverture Belledonne, les thermiques de la Croix de Fer voisine sont dans `maurienne`).

**Positions corrigées** : `saint-genis` était à 4 km au sud-sud-ouest du sommet (5.9900 E, 45.3150 N, estimé sur le PDF du club, terrain à 1047 m pour 1250 m déclarés) ; le sommet de Saint-Genis est à 6.0117 E, 45.3505 N (toponyme IGN, 1175 m), à 7 km au sud-est de Sainte-Marie-du-Mont comme le dit FlySaintHilaire. Position ramenée sur le point chaud kk7 à 400 m à l'ouest du sommet (93 %, 1041 m). `pipay-jas-des-lievres` est renommé « Jas des Lièvres » (c'est le sommet du Jas).

**Lacunes écartées** : `col-du-barioz-enterrement-arrivee-chartreuse` et `pipay-point-dur` (pièges ; chacun a maintenant un thermique voisin) ; `bramefarine` (position approximative au nord de la crête, côté de l'arrivée des Bauges : conservée, car le récit arrive à 1100 m et « longe Bramefarine vers le sud » ; deux points chauds kk7 à 0,8 et 1,2 km au sud (86 %, 87 %) restent à décrire quand un récit en parlera) ; `puy-gris-belledonne-relance`, `pic-du-frene-grand-charnier-plafond`, `vallon-de-la-pra-plafond-4146`, `comberousse-hautes-cretes-plafond` (plafonds de crête donnés par des récits, positions vérifiées sur les sommets IGN ; loin des points chauds parce que les traces GPS y sont rares et que les thermiques naissent plus bas).

## Résolution des limites (octobre 2026)

Date : 7 octobre 2026. Les limites de données restantes après l'audit des thermiques (`docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`, `docs/COUVERTURE.md`) ont été reprises pour Chartreuse, Grésivaudan, Belledonne. Aucun identifiant supprimé ni renommé ; chaque correction est notée dans la description de l'élément (« Résolution des limites (octobre 2026) : … »).

### 1. Points chauds forts à 600 m – 1 km d'un thermique documenté

Règle de tri appliquée à chaque cas : le thermique documenté est **recalé** sur le point chaud kk7 quand sa position n'était qu'approximative (ou celle du décollage), que le texte de sa source décrit un relief que le point chaud occupe (la crête, la pente, le relief « qui encadre le col ») et qu'il n'a pas déjà son propre point chaud à moins de 600 m ; sinon le point chaud est une **seconde ascendance**, créée à part, `medium` quand un texte la décrit (fiche FFVL, fil de pilotes, récit), `low` avec « déduction » quand seuls le point chaud et le relief l'indiquent. Les élément créés citent la source kk7 (`thermal.kk7.ch`) et la source du texte rapproché, dans l'ordre. Les points chauds forts à 600 m – 1 km passent de 27 à 0 dans `docs/KK7_CROISEMENT.md`.

- **Combe du Manival** (`manival-combe`, `medium`) : les sources du club exigent 1200-1400 m à la combe du Manival avant la traversée, ce qui ne correspond pas à la pointe du Bec Charvet (1630 m) où `manival-bec-charvet` est placé. Le point chaud kk7 à 99 % est à 1285 m, à 480 m à l'est de la gorge du Manival (IGN) : c'est le thermique de la combe, créé à part. Le Bec Charvet garde sa position.
- **Château Nardent, rochers des Communaux** (`nardent-rochers-des-communaux`, `low`) : point chaud à 98 % à 780 m à l'est du sommet, 500 m plus bas, aux rochers des Communaux (OSM) ; le sommet reste la raccroche décrite par Matmute.
- **Jas Mouton** (`far-jas-mouton`, `low`) : point chaud à 97 % (midi et soir) 470 m plus haut que la gorge des Rochers de la Far, étage supérieur probable de la pompe du récit du 31 juillet 2020 ; la gorge garde sa position approximative.

### 2. Écarts d'altitude (`docs/POSITIONS.md`)

Constat préalable : le relevé d'altitudes IGN demandait les points par lots de 100, or le service d'altimétrie (`data.geopf.fr/altimetrie`) n'est exact que jusqu'à une trentaine de points par requête (testé : lots de 25 et 30 identiques aux requêtes unitaires, lots de 33 et plus décalés de 10 à 110 m, parfois bien plus). 1159 des 1349 valeurs du cache `positions/altitudes_ign.json` étaient décalées ; le cache a été régénéré par lots de 25. Sur les altitudes exactes la liste n'était plus de 16 mais de 17 écarts : quatre faux positifs disparaissaient (Plaines de Poët 878 m pour 880 m, Méruz – Char Marin, Roche Veyrand, Aiguille Grande 76 m), cinq écarts apparaissaient (Manival, Mont Julioz, L'Écureuil et le versant de Peisey-Vallandry, Cuchon). Tous sont tranchés : 0 écart. La règle suivie : on garde la position quand elle est confirmée par un repère indépendant (gare d'arrivée de télésiège OSM, point de ParaglidingEarth, nœud OSM d'un sommet, coordonnées du guide papier) et l'on corrige l'altitude ; on déplace la position quand c'est elle que le repère indépendant contredit.

- **Col de Pipay, face ouest** (`col-de-pipay-face-ouest`) : l'altitude de 2015 m était mal reportée (le col est à 2045 m, le point chaud, 775 m plus à l'ouest, à 1857 m) ; altitude 1857 m.
- **Grande Sûre** (`grande-sure`) : la position de la fiche FFVL 5071 est à 1667 m de terrain pour 1578 m déclarés (la fiche et ParaglidingEarth donnent la même altitude) ; le point de ParaglidingEarth n°21259, à 190 m à l'ouest, est à 1575 m sur une pente de 17° exposée à l'ouest (vents favorables SO/O/NO) : position remplacée. **Manival / Bec Charvet** (`manival-bec-charvet`) : l'altitude 1630 m posée à l'audit venait d'un relevé d'altitude dégradé (voir ci-dessus) ; le terrain exact à la position est à 1723 m (sommet 1738 m à OSM), altitude 1723 m.
- **Roche Veyrand (Corbel)** (`roche-veyrand-corbel`, écart de 86 m dans POSITIONS.md) : écart artificiel, terrain exact 1275 m pour 1275 m déclarés.

### 3. Thermiques documentés loin de tout point chaud

Examen des 119 thermiques à plus de 2 km de tout point chaud ≥ 70 % : position contrôlée contre le géocodeur IGN (toponyme à moins de 120 m pour 51 d'entre eux), l'altitude déclarée contre le terrain IGN exact (concordante à 35 m près pour 30 autres) et le relief (croupe, flanc ou creux, orientation). Très peu sont mal placés ; la plupart sont loin des points chauds parce que le site est peu volé, parce que l'ascendance est un plafond ou une relance de haute montagne, ou parce qu'elle vient d'une confluence ou d'une plaine que les traces ne distinguent pas. Le plus proche point chaud ≥ 70 % et la raison sont notés ci-dessous ; un point chaud plus faible (30 à 70 %) à moins de 1 km est mentionné quand il existe.

**Gardés à leur place, avec la raison :**

| Élément | Position vérifiée par | Point chaud ≥ 70 % le plus proche | Pourquoi loin des traces |
| --- | --- | --- | --- |
| `chartreuse/emeindras` | altitude déclarée 1350 m concordante avec le terrain IGN (1374 m) | 2,0 km (84 %) | ascendance de passage d'un cheminement de cross peu enregistré |
| `chartreuse/pas-de-la-fosse-thermique` | altitude déclarée 874 m concordante avec le terrain IGN (874 m) | 2,1 km (90 %) | site peu volé |
| `chartreuse/roche-veyrand-corbel` | toponyme IGN « Roche Veyrand » à 5 m | 3,1 km (81 %) | site peu volé |
| `belledonne/bramefarine` | centre de la relation OSM (approximative) ; chalet de Brame-Farine (IGN) à 1,0 km, sommet à 1,6 km | 2,1 km (86 %) (plus faible : 539 m (68 %)) | ascendance de passage d'un cheminement de cross peu enregistré |
| `belledonne/puy-gris-belledonne-relance` | toponyme IGN « Puy Gris » à 5 m | 2,1 km (81 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `belledonne/pic-du-frene-grand-charnier-plafond` | toponyme IGN « Pic du Frêne » à 2 m | 2,3 km (83 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `belledonne/vallon-de-la-pra-plafond-4146` | position déduite du texte (approximative) | 2,2 km (81 %) | ascendance de passage d'un cheminement de cross peu enregistré |
| `belledonne/comberousse-hautes-cretes-plafond` | toponyme IGN « Pointe de Comberousse » à 3 m | 2,1 km (72 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `chartreuse/ffvl13287-saint-hugues-declenchements` | altitude déclarée 867 m concordante avec le terrain IGN (879 m) | 2,8 km (90 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
