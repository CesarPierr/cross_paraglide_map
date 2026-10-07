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
