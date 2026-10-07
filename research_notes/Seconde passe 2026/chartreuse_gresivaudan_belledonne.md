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
