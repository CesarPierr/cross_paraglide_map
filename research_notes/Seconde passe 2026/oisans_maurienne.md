# Seconde passe 2026 — lot `oisans_maurienne`

Massifs : `oisans-grandes-rousses`, `maurienne`, `haute-maurienne`, `arves-thabor-galibier`. Données : `data/oisans_maurienne.json`. Date de la recherche : 7 octobre 2026. `npm run data:build -- --check` : aucune alerte sur ces quatre massifs en fin de travail.

## Sources lues (et ce qu'on y a trouvé)

**Fiches FFVL** (lecture dans le navigateur intégré, puis `ffvl_sites_alpes.json` fourni par le coordinateur) : toutes les fiches de l'Alpe d'Huez / Bourg-d'Oisans / Auris (2341, 2342, 2343, 2344, 1923, 1924, 13473, 13499, 13204, 13194, 14279, 14280), de Villard-Reymond (13507), des Deux Alpes (1242, 1243, 1245, 13104), de La Grave et du Lautaret (5212, 5213, 5214, 13336), de Maurienne (1456, 1460, 1461, 13188, 13180, 5225, 5226, 5232, 5299, 5302, 3150, 3098), de Haute-Maurienne (619-625, 14170-14180, 3096, 3153, 5240, 5243) et d'Arves/Galibier (13680, 13735, 13736, 3086, 3094). Elles donnent coordonnées, altitudes, secteurs de vent et surtout des avertissements d'atterrissage chiffrés (« > 50 km/h l'après-midi » à Saint-Jean, « ne pas voler après 12h d'avril à octobre » à La Chambre, etc.).

**Carte « Brises des Alpes » de F. Largeault** (Google My Maps, export KML) : la capture publiée par Rock The Outdoor ne montre pas la Maurienne ni l'Oisans, mais la carte interactive contient des flèches sur ces secteurs. Les pointes de flèche (derniers points du tracé) donnent le sens : Combe de Savoie → Aiguebelle → Épierre → La Chambre ; Saint-Jean → Modane → Aussois → Termignon → Lanslebourg ; Saint-Michel → Valloire → Plan Lachat (annotée « à vérifier ») ; Rochetaillée → Bourg-d'Oisans → Venosc → La Bérarde ; plaine de Bourg → Le Freney ; lac du Chambon → La Grave ; Huez → col de Sarenne ; Suse → Mont-Cenis ; Briançon → Monêtier. C'est la source des tracés (`coord_quality: source`) de six brises et de la convergence du Lautaret.

**Club de Briançon (Chocard Airlines)** : pages « La brise de la Romanche et celle de la Guisane », « Col du Lautaret », « Col du Galibier », « Voler dans le Parc national », « Règlementation aérienne », et deux cartes Google My Maps lues par KML (« Zones à éviter » : gorges du Freney et du Chambon classées « posé complexe / impossible » ; « PROTECT Ecrins » : polygone du cœur et de la réserve du Lauvitel).

**Guide « Site de Parapente en Oisans »** (thierry.gaucher.free.fr, 14 pages) : Éclose, Bras, Pic Blanc, 2e tronçon, Villard-Reymond, Sabot, Cheminée de Vaujany, Deux Alpes, Venosc, Meije, Bourg ; heures de brise, plans de vol, pièges (texte ancien).

**Club de Saint-Jean-de-Maurienne** (Envol de la Croix des Fleurs) et **CDVL 73** : coordonnées GPS du club, règles d'atterrissage, stratégie « haut ou tard ».

**Forum parapentiste.info** (fils lus) : Aérologie Oisans, Voler à l'Alpe d'Huez, Aussois et Lombarde (topo détaillé d'un pilote de cross), Aussois en automne, Cross en Maurienne, Vol à Montgellafrey, Valloire/Valmeinier, col du Glandon, Survoler la Meije, cartographie des brises.

**Statistiques Syride** (heures et mois de décollage des vols publiés) : Aussois (pic 9h-10h), Montgellafrey (pic 10h, records 206 et 175 km), Alpe d'Huez Signal (pic 12h-14h, mars à avril, records 187 et 166 km), Éclose, Perrons, Plan Lachat, Bonneval (août-octobre), Valloire-Sétaz, Crey du Quart.

**Réglementation** : Parc national des Écrins (arrêté 113/2013 et cartes, lus ; polygone en KML) ; Parc national de la Vanoise : arrêté 2026-31 du 5 juin 2026 (parapentes, lu par OCR avec ses quatre cartes annexées : Orgère-Barbier, Dent Parrachée / Loza, Turra / Adrets, Grande Feiche) et arrêté 2024-24 (objets dans l'espace aérien). Attention : une page de démarche trouvée par recherche web portait en réalité sur le Parc national de forêts (Haute-Marne) et n'a pas été utilisée.

Autres : CHVD « Verti'Oisans », école Parapente Alpe d'Huez, Air2Alpes, office de tourisme de La Grave, Wikipédia (coordonnées de pics, altiports, aérodromes, villages), OpenStreetMap via Overpass (Crey du Quart 2534 m).

## Changements par rapport à la première passe

**Corrigé**
- *Alpe d'Huez 2700* : position 45,1197 N ; 6,1032 E (fiche FFVL 2342) au lieu de l'estimation 45,11 ; 6,095 ; orientations favorables N, O, NO conservées ; divergence avec le guide (Sud/Ouest) signalée.
- *Grand Châtelard* : 45°18'12" N ; 6°18'07" E (GPS du club) au lieu de 45,283 ; 6,296 (≈ 2,3 km d'écart) ; *La Balme (Jarrier)* : fiche FFVL 1460 (1570 m, 45,2919 ; 6,3197) et GPS club, au lieu de 45,287 ; 6,3165.
- *Arcelle (Val Cenis)* : 45,2734 N ; 6,9366 E, 2302 m (fiche FFVL 14178), au lieu de 45,265 ; 6,900 (≈ 3 km à l'ouest).
- *Éclose* : position et altitude de la fiche ; orientations SO, O, NO ; atterrissages de Bourg-d'Oisans remplacés par trois terrains FFVL (stade, Minardière, Le Vert) avec leurs coordonnées ; l'id `bourg-oisans-atterrissages` désigne désormais le stade municipal.
- *Atterrissage de Saint-Jean* : 529 m (FFVL) / 540 m (club) / 800 m (CDVL 73), divergence gardée ; vitesse « > 50 km/h » sourcée.
- *Brises* : tracés de la Maurienne, de la Haute-Maurienne, de la Valloirette alignés sur les flèches de Largeault (sens montant désormais sourcé) ; la Romanche haute et le Vénéon, sans source en première passe, sont maintenant tracés et sourcés.
- *Lombarde / Mont-Cenis* : conservées, enrichies par les fiches d'Aussois et de Val Cenis et le forum.

**Ajouté** : 11 brises, 1 convergence (Romanche × Guisane au Lautaret), 25 hazards (Écrins, Lauvitel, 5 secteurs Vanoise, foehn, venturi de Modane et de Venosc, altiport d'Alpe d'Huez, aérodromes de Saint-Rémy, Sollières et Valloire, gorges du Freney et du Chambon, zones militaires du Galibier…), 5 thermiques, 7 soarings, 34 décollages, 20 atterrissages, 12 effets synoptiques, 5 routes, 15 conseils (volumes exacts dans le message de fin).

**Retiré** : les sources VS1-VS11, VS17-VS34 et MS10-MS21, MS26-MS27 (Monteynard, Trièves, Vercors, Briançonnais, grand vol touristique, etc., non citées par les éléments de ce lot) ont été retirées du tableau `sources` ; les identifiants conservés gardent leur numéro (VS12-VS16 = fiches FFVL de l'Alpe d'Huez et de Bourg-d'Oisans, MS1-MS9, MS22-MS25) ; aucun élément de la première passe n'a été supprimé (ils ont été corrigés ou précisés).

## Figures déclarées (`figures`)
F1 panorama de l'Oisans (Gaucher, sans flèches : situe les vallées) ; F2-F5 annexes de l'arrêté Vanoise 2026-31 (pages 6 à 9, lues en image) ; F6 carte de l'arrêté Écrins 113/2013 ; F7-F10 carte de Largeault (Oisans-Lautaret, Maurienne, Haute-Maurienne, Valloirette). Le brief demandait de regarder les schémas annotés : aucun club de ces secteurs n'en publie sur le web ouvert ; le seul document de ce type est la carte de Largeault.

## Ce qui reste à vérifier ou qui manque
- **Brises du bas Romanche** (Vizille, Séchilienne, gorges de Livet-et-Gavet) : sens et horaires uniquement déduits (confiance moyenne). Aucune source sur Séchilienne (FFVL 3115 sans texte), les Souillets ou Livet.
- **Eau d'Olle / Oz / Allemont** : un seul texte ancien (guide de site) ; aucune mesure.
- **Orelle, Saint-Michel, Valmeinier, Villards** : aucun document aérologique ; brise des Villards déduite (confiance faible) ; le Crey du Quart et la Setaz n'ont pas d'orientation ni d'altitude de décollage sourcées.
- **Cross** : seuls des indices existent (Montgellafrey vers Bauges/Belledonne, Aussois → Bonneval, Aussois → Albertville, 300 km du Galibier cités par Chocard Airlines, records Syride de 206 km à Montgellafrey, 187 km au Signal, 144 km aux Perrons). Aucune trace n'a pu être lue (voir ci-dessous) : les routes déclarées sont donc des routes décrites par des pilotes, pas des traces.
- **Vanoise** : les secteurs de l'arrêté sont placés par centre et rayon indicatifs (pas de polygone vectoriel) ; les cartes sont jointes en figure.
- Les km/h des brises sont des interprétations de « forte / très forte » (sauf 50 km/h cités à Saint-Jean).

## URL bloquées ou en échec (voir aussi `.cache/research/blocked_urls.txt`)
- `https://parapente.ffvl.fr/cfd/liste/deco/20256846` et `https://parapente.ffvl.fr/cfd/liste/2005/vol/20051766` : Cloudflare (listes CFD des vols, traces).
- `https://www.xcontest.org/2014/world/en/flights/detail:tputhod/17.7.2014/07:20` et `…/2017/world/en/flights/detail:JonathanMarin/6.7.2017/08:26` : « You are not approved to see the flight » (seuls le titre et la distance sont lisibles).
- `https://www.vanoise-parcnational.fr/fr/download/file/fid/182` : 404.
- Pages de club introuvables ou sans site propre : Club de parapente de l'Oisans, Vol libre des Deux Alpes, Arves en l'Air, Vol libre Vanoise (domaine `vol-libre-vanoise.fr` disparu).
- API FFVL (`data.ffvl.fr`) : clé requise.
- Une demande d'envoi de données depuis le navigateur vers un serveur local a été refusée par le système de permissions ; la récupération des fiches FFVL s'est faite en lisant les résultats dans la session, sans contournement.

## Thermiques et points de relance (passe complémentaire)

Date : 7 octobre 2026. Objectif : ajouter aux `thermal_spots` les points de raccroche, de relance, de déclenchement et de plafond que les pilotes citent le long des cheminements, et non plus seulement les lieux explicitement appelés « thermique ». Convention de confiance appliquée : plusieurs récits concordants ou un récit isolé à lieu précis = `medium` ; extrapolation du relief sans récit explicite = `low`, avec le mot « déduction » dans la description. Volumes : thermiques 4 → 25 (Oisans), 0 → 3 (Maurienne), 1 → 5 (Haute-Maurienne), 0 → 5 (Arves-Thabor-Galibier) ; 8 nouvelles routes (6 en Oisans, 1 en Haute-Maurienne, 1 en Arves) ; 1 soaring (Pic Bayle) ; 19 sources ajoutées (S103 à S121) ; rien supprimé, aucun id renommé. `npm run data:build -- --check` : aucune alerte.

### Sources exploitées (relues ou nouvelles)
- **Guide « Site de Parapente en Oisans »** (S1) relu page par page : Éclose, Bras, 2e tronçon, Pic Blanc, Sabot, Cheminée, Rousses, Deux Alpes, Meije. C'est la source des cheminements classiques de l'Alpe d'Huez (clocher d'Huez, schistes du Bras, Poutran, Côte Belle, Rissiou).
- **Blog du CHVD** (club grenoblois), aspiré par l'API WordPress `/wp-json/wp/v2/posts` (1326 articles, grep sur les noms du lot) : récits de vol en Oisans (Survol de la Meije 2006, Rochail 2006, Soaring aux Grandes Rousses 2015, Écrins 2020 et 2021, Prégentil 2024, Coche de Lanchâtra 2025, Petit Chalvet 2019, Goléon 2011, Saussaz 2025), en Haute-Maurienne (D'Tour d'Aussois 2023) et à l'entrée de la Maurienne (cross des faces est de Belledonne, 2024). Fichiers locaux : `.cache/research/docs/oisans_maurienne/chvd_wp/`.
- **Forums parapentiste.info** relus : Aussois en automne (thermique à partir de 2350 m, Sollières +4), Aussois et Lombarde, Bisanne ou Aussois en août (plafonds à 4000 m), Valloire / Valmeinier (Grand Galibier à plus de 3200 m, thermique de la station), Survoler la Meije (Meijette), Voler à l'Alpe d'Huez (thermiques au Signal), Val Cenis, Valfréjus.
- **Club de Briançon (Chocard Airlines)** : Galibier sud « bon potentiel thermique », Granges du Galibier « potentiel énorme de cross » (300 FAI de 2014 et 2017).
- **Fiches de randonnée Cirkwi** (Turra), **page d'accueil de l'école Parapente Alpe d'Huez** (thermique dès fin février, jusqu'à 3000 m), **Syride** (Turra de Termignon, vol de 144 km le 17 avril 2026), fiches FFVL (Auris : variations d'enneigement).
- Positions : géocodeur IGN (`data.geopf.fr`) et OpenStreetMap pour les sommets, cols, lieux-dits et villages ; chaque position issue d'un toponyme est `source`, les positions déduites du décollage sont `approx`.

### Oisans (oisans-grandes-rousses), 21 thermiques ajoutés
- **Alpe d'Huez** : `bras-schistes-huez` (relance après le clocher d'Huez, aussi sur le trajet Poutran → Bras → Bourg), `poutran-arete-relance`, `alpe-huez-2700-pentes-ouest` (déclencheur du 2e tronçon), `signal-huez-pentes` (printemps, 12h-14h, mars-avril, records 187 et 166 km), `signal-de-lhomme-relance` (déduction, `low`). Le point existant `huez-toits` a été recalé sur l'église Saint-Ferréol d'Huez (clocher cité par le guide) et complété.
- **Vaujany / Rissiou** : `sabot-crete-cote-belle` (raccroche commune du Pic Blanc, du 2e tronçon et de la Cheminée, plafond jusqu'à 2700 m puis traversée vers l'Alpe d'Huez), `cheminee-vaujany-ascenseur` (« l'impression de se trouver dans un ascenseur » vers 16h), `rissiou-rochers`.
- **Deux Alpes / Vénéon** : `deux-alpes-coche-muzelle` (crête de la Coche, « faire le plein au-dessus des Perrons »), `deux-alpes-rachas`, `aiguille-de-venosc-matin`, `deux-alpes-diable-toura-jandri`, `plat-de-la-selle-face-sud` (ravine sèche de 1500 m, 3600 m), `pointe-thorant-pompe`, `meije-breche-face-sud`, `grande-ruine-plafond` (17h).
- **La Grave / Lautaret** : `meijette-la-grave`, `goleon-raccroche-lautaret` (`low` : l'ordre du récit ne colle pas avec la position de l'aiguille), `lautaret-plafond-4050`.
- **Bourg-d'Oisans** : `pic-col-ornon-rochail` (nuage à 3400 m), `grand-galbert-faces-sud-est`. `villard-reymond-falaise` complété (CHVD 2024 : thermique du versant sud de Prégentil).
- Routes ajoutées (xc_routes, avec ordre réellement volé) : `alpe-huez-2700-poutran-bras-bourg`, `eclose-huez-bras-vert`, `sabot-cote-belle-vers-alpe-huez`, `deux-alpes-diable-bearde-meije-ecrins` (vol de 2006, 10 points), `rochail-grand-galbert-gavet`, `deux-alpes-coche-muzelle-venosc`. Soaring : `soaring-pic-bayle-face-nord`.

### Maurienne, 3 thermiques ajoutés
`lauziere-face-ouest-entree-maurienne` (relance après la traversée depuis Belledonne, `medium`), `montgellafrey-crete-depart-cross` et `jarrier-balme-crete-cols` (déductions, `low`). Aucun récit de pilote n'a été trouvé sur les ascendances précises de Saint-Jean, du Grand Châtelard, de La Balme ni de Montgellafrey : seuls les départs de cross, les records Syride et la consigne du comité (« rester haut vers le Glandon et la Croix de Fer ») sont documentés.

### Haute-Maurienne, 4 thermiques et 1 route ajoutés
`turra-falaises-termignon` (« thermique exceptionnel » des falaises, vol de 144 km décollé de la Turra), `sollieres-sardieres-relance` (+4 au retour de Termignon), `arcelle-val-cenis-relance` et `druges-grande-feiche-dernier-relief` (déductions, `low`). `bellecote-turra` complété (plafonds 2500 m en octobre, 3600 m en mars, 4000 m en août) et la route Aussois → Bonneval enrichie des relances. Route `aussois-barbier-arplane-norma` (parcours « Corneille » 2 de la D'Tour : 18 km à vol d'oiseau entre les trois points, 23 km annoncés).

### Arves-Thabor-Galibier, 5 thermiques et 1 route ajoutés
`grand-galibier-plan-lachat` (remontée à plus de 3200 m), `galibier-sud-thermique`, `granges-du-galibier-depart-300`, `valmeinier-station-thermique` (+4 « de partout » à l'approche), `crey-du-quart-crete` (déduction, `low`) ; route `plan-lachat-grand-galibier`. Le décollage `granges-du-galibier` a été recalé sur le lieu-dit IGN (il était placé au col).

### Ce qui n'a pas pu être localisé ou lu
- **Itinéraires des grands cross** : les 300 km du Galibier (314,68 km le 17 juillet 2014, 316,69 km le 6 juillet 2017, « 300 Galibier / Liechtenstein »), les 206 et 175 km de Montgellafrey, les 187 et 166 km du Signal, les 144 km de la Turra : traces sur XContest ou la CFD derrière un compte ou Cloudflare, donc points de passage et relances inconnus (voir `blocked_urls.txt`).
- **Aucun point de relance nommé** trouvé pour Saint-Jean-de-Maurienne, Orelle, Saint-Michel, Valfréjus, Termignon (hors Turra), Bessans, Albiez, Saint-Jean-d'Arves et Saint-Sorlin : recherche web sans récit de pilote ; seules des déductions `low` ont été posées pour Jarrier, Montgellafrey, Val Cenis, Bonneval et le Crey du Quart.
- Le « Rachas » du guide des Deux Alpes est identifié avec la montagne de Rachas de l'IGN sans confirmation ; l'itinéraire de la D'Tour « Gypaète » (20 balises : Grand Arc, col du Galibier, fond de la vallée de Bonneval) n'est pas tracé faute de coordonnées des balises.
- Aucune image annotée (cheminements dessinés, cercles de thermiques) n'a été trouvée pour ces secteurs : les captures d'écran de la carte de Largeault ne couvrent pas le lot ; aucune figure ajoutée.

## Passe secteurs minces

Date : 7 octobre 2026. Objectif : creuser les secteurs les moins documentés de l'atlas, un par un. Même convention de confiance que plus haut (récit précis ou plusieurs récits = `medium` ; extrapolation du relief = `low` avec « déduction »). Les identifiants existants sont conservés, rien n'est supprimé. `npm run data:build -- --check` : aucune alerte nouvelle (seule l'alerte antérieure du massif `alpes-francaises` reste).

### Maurienne (`maurienne`)

Volumes avant → après : brises 3 → 4, convergences 0 → 0, hazards 4 → 7, thermiques 3 → 4, soarings 1 → 1 (complété), décollages 7 → 9, atterrissages 5 → 6, effets synoptiques 4 → 5, routes 0 → 3, conseils 6 → 10 ; 14 sources (S122 à S135) et 2 figures (F11, F12).

**Sources nouvelles ou relues**
- *Blues Team* (blog), vol du col de Bleine à Passy, mai 2015 : traversée de la Maurienne depuis les faces est de Belledonne, Grande Lauzière contrée par la brise du nord, Grand Arc, L'Ébaudiaz, Albertville (S123). Récit lu en entier ; il alimente aussi les secteurs Champsaur, Val d'Arly et Matheysine.
- *CHVD*, vol du 24 mai 2010 (187 km) : crête de Belledonne sud avec du sud dans le dos, traversée de la Maurienne à 18h45, descente de 5 minutes à -100 m/min, crête de Valmorel (S124). Récits de vol au Glandon de 2012, 2017 et 2022 (S125 à S127), stages cross 2019, 2020, 2021 sur l'entrée de la Maurienne (S128 à S130), cross du 28 août 2024 déjà cité (S110, relu pour tracer la route).
- *La Grosse Miche*, présentation « Cross avancé : massifs et transitions » (2018, PDF) : carte « Belledonne Nord & Lauzière » (page 10) et transition Grand Arc (page 26), lues en image (S122, figures F11 et F12).
- Forum parapentiste.info : « Transition Bauges → Belledonne » (2008, brise de la Maurienne qui contre à Chamoux, S131) ; « Trois jours de vol rando en Maurienne » (2020, thermique dès 10h, brise installée vers 11h-11h30, S132).
- Fiches FFVL 2321, 2322, 2323 (Saint-François-Longchamp), absentes de l'atlas jusque-là (S133 à S135).

**Ajouté ou corrigé**
- *Brise montante* : horaire précisé (installation vers 11h-11h30 « parfois plus tard », 20-30 km/h un jour de brouillard) et comportement à l'entrée de la vallée (la brise pousse vers l'amont ; un jour elle s'éteint). Confiance déjà `high`.
- *Brise des Villards / Glandon* : passée de `low` à `medium` grâce à trois récits CHVD (brise de nord au col l'après-midi jusqu'à 17h) ; le tracé dans le vallon reste déduit.
- *Brise matinale descendante* (`low`, déduction) : seule la matinée calme est sourcée (fiche du Mollaret, Syride, thermique de 10h) ; le sens descendant est un raisonnement de relief, avec horaires 21h-9h distincts de la brise montante pour ne pas l'annuler dans le modèle.
- *Dangers* : entrée de la Maurienne (traversée contrée par la brise ; 6 sources), troupeau et buvette au col du Glandon, câble « Catex » de Saint-François-Longchamp (position approximative, nature déduite).
- *Thermiques* : point de relance de Belledonne au bout de la chaîne (Pointe de Rognier, position approximative, identification par le nom « rogné » du récit) ; `lauziere-face-ouest-entree-maurienne` complété par deux récits concordants (2010, 2015).
- *Routes* : `chamrousse-belledonne-est-lauziere-albertville-2024`, `belledonne-faces-est-maurienne-lauziere-ebaudiaz-2015` (extrait d'un 280 km), `belledonne-sud-maurienne-lauziere-valmorel-2010` (extrait d'un 187 km). Chaque point nommé est localisé par le géocodeur IGN ; les points non nommés (col, ligne électrique, atterrissage) ne sont pas tracés.
- *Soaring du Glandon* : conditions détaillées (nord 15-20 km/h à 2000 m, 1h15 et 600 m de gain ; sud en fin d'après-midi ; arrêt de la brise vers 17h) ; effet synoptique « Vent du Sud » ajouté ; décollages et atterrissage de Saint-François-Longchamp ajoutés.

**Introuvable**
- Aucun récit ne décrit les ascendances précises de Saint-Jean, du Grand Châtelard, de La Balme ni de Montgellafrey (les départs de cross sont cités, pas leurs relances) ; pas de point de relance nommé à Orelle, Saint-Michel, Sainte-Marie-de-Cuines, Albiez ou La Toussuire.
- Aucune convergence documentée dans la vallée elle-même ; les brises latérales (Villards, Arvan) n'ont pas de description propre.
- Traces des cross de Montgellafrey (206 et 175 km), listes CFD, XContest et XCFinder : inaccessibles (voir `pages_bloquees.txt`).


### Maurienne, complément (listes de lacunes COUVERTURE, KK7 et fichiers du comité de Savoie)

Date : 7 octobre 2026. Volumes avant ce complément → après : brises 4 → 5, hazards 7 → 9 (le câble de Saint-François-Longchamp repositionné), thermiques 4 → 17, décollages 9 → 16, atterrissages 6 → 12, conseils 10 → 13 ; 8 sources nouvelles (S136 à S143). `npm run data:build -- --check` : aucune alerte nouvelle ; `npm run model:check` : 0 paire de brises opposées.

**Sources nouvelles**
- Club *Speedbelles'air* (La Toussuire), pages « Voler en parapente l'été » et « l'hiver », lues dans la copie de web.archive.org (le domaine ne répond plus) : décollage d'été de la Grande Verdette (orientation nord-est, vent favorable nord, « vol du matin essentiellement », thermique dès 10h-10h30, danger sous le vent de la pointe de Comborcière) ; décollages d'hiver de la Pierre du Turc et du Grand Truc, crête infranchissable par tendance ouest, atterrissage hors piste.
- Fichier KMZ du comité de Savoie *SitesDeVolsSkiSFL2020* (cité par la fiche FFVL 2323) : positions de toutes les zones de décollage et d'atterrissage à ski de Saint-François-Longchamp et tracé du câble d'avalanches (légende « présence de câble »). Le câble « Catex » est donc localisé (il n'était que placé au hasard sur le décollage).
- Fiches FFVL 3086, 3094 et 13736 relues (Saint-Sorlin-d'Arves, Grande Verdette, La Balme), ParaglidingEarth 10679 (col de la Madeleine : décollage sud-est le matin, nord-est « si vent de vallée ») et 2987 (Val Pelouse), vidéo d'un pilote « trois vols du matin au col de la Croix de Fer ».
- Points chauds de thermal.kk7.ch (probabilités par saison et par moment de la journée) et IGN (BD TOPO : toponymes et remontées ; RGE ALTI : altitude, pente et exposition à 150 m).

**Ajouté ou corrigé**
- *Décollages sans thermique documenté* : La Grande Verdette (thermique du club, `medium`), Saint-Sorlin-d'Arves et La Balme (pentes sud-est sous la Croix de Fer et aiguille Rousse, `low`), Soleil Rouge (combe Noire, `low`), Chalet du Mélèze (adret de Saint-Avre au-dessus du terrain de Sainte-Marie-de-Cuines, `low`).
- *Points chauds forts ≥ 90 %* : les neuf points de la liste sont décrits (Mollaret en `medium` avec la fiche FFVL et le forum ; les huit autres en `low`, avec « déduction » : Perrière, Chatermes, Frumezan, Petit Charnier et col de Claran, Grand By de Saint-Étienne-de-Cuines, plateau de Bellecombe à Saint-Michel-de-Maurienne, Rozet de la Lauzière). Chaque position est celle du point chaud, vérifiée sur le terrain IGN (altitude, pente, exposition).
- *Saint-François-Longchamp* : sept zones de décollage (Homme de Beure, dôme de la piste rouge, Marquis/Soleil Rouge sud, Grand Schuss nord et ouest, Lauzière sud), six atterrissages (col de la Madeleine, bas de la Lauzière, secours nord, Trois Sapins, bas des Marquis avec secours, bas Madeleine côté Valmorel), danger du câble repositionné sur le tracé du KMZ, brise de vallon ajoutée en `low` (déduction : aucune source ne la décrit).
- *La Toussuire* : décollages d'hiver Pierre du Turc et Grand Truc, dangers de la crête vers l'atterrissage et de la pointe de Comborcière.

**Introuvable ou non tranché**
- Aucun récit de thermique pour les Villards, l'Arvan, Jarrier hors décollages, Albiez ni La Toussuire en été autre que la phrase du club ; le forum de 2020 renonce lui-même à conseiller les « annexes » de la Maurienne. Pages de l'école Parapente Air Line, L'Env'Air et Envergure lues : commerciales, sans aérologie.
- La « pointe de Comborcière » n'est pas dans le géocodeur IGN : danger placé sur le vallon de Comborsière (`approx`).
- Page « Lauzière » du comité de Savoie toujours vide (le contenu n'est pas dans le HTML) ; Facebook « Vol de 2H10 dans du thermique bleu, crête de la Croix de Fer » non lu (connexion) ; domaine speedbellesair.net injoignable (archive seulement).

### Arves-Thabor-Galibier (`arves-thabor-galibier`), passe secteurs minces

Volumes avant → après : brises 3 → 3, convergences 0 → 0, hazards 4 → 4, thermiques 5 → 9, soarings 1 → 1, décollages 9 → 9, atterrissages 2 → 2, effets synoptiques 2 → 2, route 1 → 1 ; aucune source nouvelle (les fiches FFVL 5214 et 5232, le topo de Chocard, l'office de tourisme de La Grave, thermal.kk7.ch et l'IGN, déjà cités plus haut, suffisent). `npm run data:build -- --check` : aucune alerte nouvelle.

**Sources relues ou cherchées**
- Fiches FFVL 5214 (lac du Pontet), 5232 (Aplanes) et 5242 (Mont Thabor : « Beau vol, attention à la finesse », seul texte) ; page de l'office de tourisme de La Grave (« sites officiels » : lac du Pontet et pente école des Cours) ; topo de Chocard sur le Galibier.
- Recherches web sur le Thabor, le lac du Pontet, Valloire-Valmeinier et Albiez : uniquement des pages de randonnée, de baptême ou de station, aucun récit de vol.

**Ajouté ou corrigé**
- *Thermiques* (tous `low`, avec « déduction » : positions des points chauds mesurés, exposition et altitude relevées sur le terrain IGN) : pentes ouest du Clot des Chamois au nord du lac du Pontet (profil d'après-midi qui concorde avec les vents favorables SO et O du décollage), pentes est de la Grande Chible près du col d'Emy (secteur d'Albiez), pentes sud-est du crêt Fénère à Orelle (le point le plus marqué du secteur, 93 %), pentes sud de la tête de la Cassille au Monêtier-les-Bains.
- *Position corrigée* : le décollage du lac du Pontet (id `oisans-grandes-rousses/villar-darene-lac-du-pontet`, dans le même fichier) était à 2111 m sur le terrain IGN alors que la fiche donne 2013 m et SO/O ; recalé 200 m à l'ouest (2015 m, pente de 21° exposée à l'ouest), `approx`. La correction est faite dans le fichier de données, pas dans `positions/corrections.json`.
- Les décollages de Saint-Sorlin-d'Arves, La Balme et la Grande Verdette, déclarés dans ce massif mais classés par la couverture dans le secteur Maurienne, ont leurs thermiques dans `maurienne` (voir plus haut).

**Introuvable**
- Mont Thabor (FFVL 5242, 3178 m) : aucun point chaud mesuré à moins de 5 km, aucun texte d'aérologie ; aucun thermique ni brise n'a été créé (une description serait inventée). Reste ouvert dans COUVERTURE.
- Aucun récit de thermique à Albiez, Valloire, Valmeinier ni aux Karellis en dehors de ceux déjà décrits ; itinéraires des 300 km du Galibier toujours derrière XContest et la CFD.


## Audit des thermiques (octobre 2026)

Contexte et méthode : voir la section du même nom dans `chartreuse_gresivaudan_belledonne.md` et celle de `vercors_grenoble_trieves.md` (pente, exposition et altitude lues sur le terrain IGN à chaque point chaud ; toponymes IGN ; corpus CHVD, topos de clubs, fiches FFVL, arrêté du Parc national de la Vanoise). Les secteurs Maurienne et Arves – Thabor – Galibier, traités par la passe « secteurs minces », n'ont pas été repris. Les points chauds des crêtes sud de Belledonne (Chamrousse, Grand Colon), classés par la géométrie dans l'Oisans, sont traités ici.

### Oisans – Grandes Rousses (`oisans-grandes-rousses`)

**Thermiques créés (8)**
- `ffvl1243-deux-alpes-diable-thermique-apres-midi` (`medium`) : la fiche FFVL du Diable donne « brises thermiques, léger vent d'ouest ou léger nord ouest » et « Conditions Thermiques Fortes L'après midi » ; le texte n'avait donné que le décollage.
- `eclose-huez-pente-sud-ouest` (`low`) : le décollage de l'Éclose (« alimenté par la brise de pente montant d'Huez ») n'avait de thermique qu'à 1,4 km ; point chaud à 87 % à 208 m.
- `mais-pentes-sud-est-deux-alpes-ouest` (97 %), `huez-sardonne-pentes-ouest` (93 %, versant ouest de l'arête Huez – Oz, 1040 m), `saperan-mirebel-plateau-sud` (92 %) et `petit-van-chamrousse-oisans-est` (90 %), tous deux sur la crête sud de Belledonne au-dessus de Livet-et-Gavet, `dome-de-la-lauze-pente-sud-est` (91 %, 3326 m) et `roche-d-alvau-glaciers-sud` (93 %, 3528 m, cœur du Parc national des Écrins) en `low`, sans texte : positions et heures sont celles des points chauds.

**Positions corrigées**
- `grave-glacier-meije` (décollage) : l'ancien point (6.3075 E) tombait à 3085 m sur une face nord-ouest, 3 km à l'est du col des Ruillans (toponyme IGN, 3204 m, soit l'altitude de 3200 m du terminus du téléphérique des Glaciers de la Meije) ; ramené sur le col.
- `cheminee-vaujany` (décollage) : altitude 1600 m → 1817 m (terrain IGN) ; le topo CHVD de la Scia place la cheminée d'équilibre à 1706 m et le décollage 10 à 15 minutes plus haut.
- `huez-toits` : altitude 1500 m → 1394 m (terrain IGN à l'église Saint-Ferréol).
- `villar-darene-lac-du-pontet` : déjà recalé par la passe « secteurs minces » ; l'alerte de `POSITIONS.md` est périmée.

**Lacunes écartées**
- `soaring-pic-bayle-face-nord` : soaring d'automne en face nord du Pic Bayle (3200-3700 m), ascendance de pente et non thermique de cheminement ; reste en soaring.
- `bourg-oisans-atterrissages-brise`, `ecrins-coeur-survol` : le mot « thermique » décrit la brise de l'atterrissage ou la réglementation du cœur du Parc.
- Points chauds sous le seuil de 90 % (Croix de Chamrousse 88 %, Coche 89 %, Pyramide du Lauzon 89 %) et les deux points chauds à 88 % et 91 % de la falaise des Perrons, à 560 et 620 m du thermique déjà décrit : même thermique, laissés au rapport KK7.
- Thermiques de haute montagne (`herpie-pointe`, `rissiou-rochers`, `plat-de-la-selle-face-sud`, `meijette-la-grave`, `goleon-raccroche-lautaret`, `lautaret-plafond-4050`, `pic-col-ornon-rochail`) : positions de récits, sans point chaud à moins de 2 km parce que les traces GPS y sont rares ; conservés.

### Haute-Maurienne (`haute-maurienne`)

**Thermiques créés (8)**
- `turra-aussois-pentes-sud-est-matin` (`medium`, 99 % le matin seulement, pente de 47° au sud-est) et `loza-dent-parrachee-pentes-sud-est` (`medium`, 98 % toute l'année) : le fil « Aussois en automne » donne « 2350m, altitude minimale pour prendre le thermique dans cette vallée de la Pointe de Bellecôte ou sur la Turra plus à l'Est, puis on peut facilement glisser jusqu'au dessus de Termignon le long des pentes de la Dent Parrachée » ; le thermique d'Aussois n'était situé qu'à la Pointe de Bellecôte. Les secteurs « Turra » et « Dent Parrachée » (survol à moins de 1000 m autorisé) viennent de l'arrêté 2026-31 du Parc national de la Vanoise.
- `aussois-grand-jeu-pentes-sud` (`medium`, 96 %, 100 % en janvier) : la fiche FFVL parle d'« activité thermique forte en été à partir de 11h00 » ; le thermique documenté n'était qu'un point approximatif au décollage.
- `orgere-estive-pentes-sud` (`medium`, 95 % le matin et à midi, « vol du matin essentiellement » selon la fiche) et `aussois-plan-de-la-croix-thermique` (`medium`, « il faut prendre en compte que le thermique est bien présent, donc souvent pas simple de passer dessous », fil de discussion d'octobre).
- `termignon-adrets-sud-est-replat-des-canons` (94 %), `dent-parrachee-pente-sud-est-3177` (93 %, FFVL 5240), `barbier-moure-cobroute-pente-sud-est` (83 %, FFVL 5243) en `low`.

**Positions corrigées**
- `orgere-estive` (décollage FFVL 622) : les coordonnées de la fiche (45.2295 N) tombent à 2170 m pour 2421 m déclarés ; l'aire de décollage de l'Estive (POI IGN, 45.2513 N, 6.6630 E) est à 2426 m, 2,4 km plus au nord. Le point chaud d'Orgère est donc à 2,8 km au sud du décollage et non à 400 m.
- `valfrejus-punta-bagna` : altitude lue sur le terrain (2720 m ; la fiche donne 2368 m) ; laquelle des deux informations est fausse n'est pas résolu.
- `druges-grande-feiche-dernier-relief` : position approximative (le décollage) remplacée par le point chaud à 96 % à 620 m au sud-ouest (pente sud de 27°, 2045 m).

**Lacunes écartées**
- Mont-Cenis soaring (FFVL 14172, 14173) : site de soaring documenté comme tel (`soaring-mont-cenis`), aucun point chaud à moins de 5 km.
- Vallonbrun (FFVL 14175, « vol du matin, peu de vent ») : aucun texte d'ascendance, aucun point chaud à moins de 8 km.
- Valfréjus – Punta Bagna (FFVL 623) : « utilisé l'hiver essentiellement », aucun point chaud à moins de 3,7 km.

## Résolution des limites (octobre 2026)

Date : 7 octobre 2026. Les limites de données restantes après l'audit des thermiques (`docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`, `docs/COUVERTURE.md`) ont été reprises pour Oisans, Maurienne, Arves – Thabor. Aucun identifiant supprimé ni renommé ; chaque correction est notée dans la description de l'élément (« Résolution des limites (octobre 2026) : … »).

### 1. Points chauds forts à 600 m – 1 km d'un thermique documenté

Règle de tri appliquée à chaque cas : le thermique documenté est **recalé** sur le point chaud kk7 quand sa position n'était qu'approximative (ou celle du décollage), que le texte de sa source décrit un relief que le point chaud occupe (la crête, la pente, le relief « qui encadre le col ») et qu'il n'a pas déjà son propre point chaud à moins de 600 m ; sinon le point chaud est une **seconde ascendance**, créée à part, `medium` quand un texte la décrit (fiche FFVL, fil de pilotes, récit), `low` avec « déduction » quand seuls le point chaud et le relief l'indiquent. Les élément créés citent la source kk7 (`thermal.kk7.ch`) et la source du texte rapproché, dans l'ordre. Les points chauds forts à 600 m – 1 km passent de 27 à 0 dans `docs/KK7_CROISEMENT.md`.

- **Perrons, croupe sous le sommet** (`perrons-pentes-ouest-sous-le-sommet`, `low`) : second point chaud (91 %, midi et soir) à 624 m du décollage ; le thermique de la falaise (`deux-alpes-perrons-falaise`) a son propre point chaud à 560 m.

### 3. Thermiques documentés loin de tout point chaud

Examen des 119 thermiques à plus de 2 km de tout point chaud ≥ 70 % : position contrôlée contre le géocodeur IGN (toponyme à moins de 120 m pour 51 d'entre eux), l'altitude déclarée contre le terrain IGN exact (concordante à 35 m près pour 30 autres) et le relief (croupe, flanc ou creux, orientation). Très peu sont mal placés ; la plupart sont loin des points chauds parce que le site est peu volé, parce que l'ascendance est un plafond ou une relance de haute montagne, ou parce qu'elle vient d'une confluence ou d'une plaine que les traces ne distinguent pas. Le plus proche point chaud ≥ 70 % et la raison sont notés ci-dessous ; un point chaud plus faible (30 à 70 %) à moins de 1 km est mentionné quand il existe.

**Gardés à leur place, avec la raison :**

| Élément | Position vérifiée par | Point chaud ≥ 70 % le plus proche | Pourquoi loin des traces |
| --- | --- | --- | --- |
| `oisans-grandes-rousses/herpie-pointe` | altitude déclarée 3000 m concordante avec le terrain IGN (2974 m) | 3,1 km (78 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `oisans-grandes-rousses/alpe-huez-2700-pentes-ouest` | position sourcée (relief cité par le récit) | 3,3 km (78 %) (plus faible : 672 m (69 %)) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `oisans-grandes-rousses/rissiou-rochers` | toponyme IGN « Rocher Rissiou » à 4 m | 2,1 km (93 %) (plus faible : 473 m (65 %)) | site peu volé |
| `oisans-grandes-rousses/plat-de-la-selle-face-sud` | position sourcée (relief cité par le récit) | 3,4 km (70 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `oisans-grandes-rousses/meijette-la-grave` | position sourcée (relief cité par le récit) | 2,9 km (85 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `oisans-grandes-rousses/aiguille-de-venosc-matin` | toponyme IGN « Aiguille de Venosc » à 3 m | 2,0 km (81 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `oisans-grandes-rousses/goleon-raccroche-lautaret` | toponyme IGN « Aiguille du Goléon » à 2 m | 2,7 km (75 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `oisans-grandes-rousses/lautaret-plafond-4050` | position sourcée (relief cité par le récit) | 2,4 km (70 %) | ascendance de passage d'un cheminement de cross peu enregistré |
| `oisans-grandes-rousses/pic-col-ornon-rochail` | toponyme IGN « Pic du Col d'Ornon » à 5 m | 2,8 km (89 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `oisans-grandes-rousses/signal-de-lhomme-relance` | toponyme IGN « Signal de l'Homme » à 5 m | 2,1 km (83 %) | ascendance de passage d'un cheminement de cross peu enregistré |
| `maurienne/jarrier-balme-crete-cols` | altitude déclarée 1570 m concordante avec le terrain IGN (1569 m) | 6,0 km (81 %) | site peu volé |
| `haute-maurienne/sollieres-sardieres-relance` | position sourcée (relief cité par le récit) | 2,2 km (83 %) | ascendance de passage d'un cheminement de cross peu enregistré |
| `haute-maurienne/arcelle-val-cenis-relance` | altitude déclarée 2302 m concordante avec le terrain IGN (2321 m) | 3,7 km (78 %) | ascendance de passage d'un cheminement de cross peu enregistré |
| `arves-thabor-galibier/valmeinier-station-thermique` | toponyme IGN « Valmeinier 1800 » à 3 m | 7,7 km (93 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `arves-thabor-galibier/crey-du-quart-crete` | altitude déclarée 2534 m concordante avec le terrain IGN (2533 m) | 7,9 km (80 %) | site peu volé |

### 4. Mont Thabor et Les Souillets

Recherche de sources (fiches FFVL, clubs, forums, récits) ; rien n'est créé sans indice.

- **Mont Thabor** (FFVL 5242, 3178 m, Freney ; COUVERTURE le range sous le Briançonnais) : aucun thermique créé, faute d'indice. La fiche FFVL (reprise de C2C, 6 décollages et 0 atterrissage en 2024 sur Syride, sans orientation ni aérologie) dit seulement « beau vol, attention à la finesse ». Lus : le blog Les Pins Volants (novembre 2020, [lespinsvolants.fr](https://www.lespinsvolants.fr/2020/11/mont-thabor-les-copains-thabor.html)) : décollage du sommet vers 9 h, vol d'environ 10 km par le lac Peyron et le refuge jusqu'à 2360 m près du lac Marguerite, « quelques bonnes bulles au passage » et de « grosses dégueulantes », sud établi qui prend le pas sur la brise de pente à l'atterrissage, sans lieu pour les bulles ; le blog Les Pieds sur Terre (octobre 2022, [lespiedssurterre.blog](https://lespiedssurterre.blog/idees-combo-rando-vol-alpinisme-parapente/)) : départ du Lavoir (1925 m, 1400 m de dénivelé), décollage dans la pente sommitale SE à SO, atterrissage sur le plateau au-dessus du Lavoir, aucune aérologie. Ce sont des descentes de vol rando, pas des ascendances. Le site reste un décollage de vol rando sans thermique documenté.
