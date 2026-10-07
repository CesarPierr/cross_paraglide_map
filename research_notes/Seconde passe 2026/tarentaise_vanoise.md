# Seconde passe 2026 : lot `tarentaise_vanoise` (Tarentaise, Vanoise)

Fichier de données : `data/tarentaise_vanoise.json` (massifs `tarentaise` et `vanoise`). Sources : 34 d'origine conservées (S1-S34, dont beaucoup ne concernent que le Mont-Blanc et ne sont plus citées par ce lot) et 105 nouvelles. La plupart des nouvelles sont des fiches FFVL, une source par fiche.

## 1. Sources lues et ce qu'on y a trouvé

**Club de Haute Tarentaise (PCHT)**
- Page « Météo et Aérologie » du nouveau site Google Sites (`pcht.org/voler-en-haute-tarentaise/météo-et-aérologie`). L'ancienne URL demandée (`pcht.org/articles.php?pg=977`) renvoie 404. La page décrit l'effet de foehn (vent S, SE à SO, écart ≥ 4 hPa sur le « diagramme du foehn », barre de foehn au Petit-Saint-Bernard = vol interdit, flux NE au Cottier = vol interdit, rafales 80 km/h pouvant atteindre Moûtiers). Elle décrit aussi la confluence des Chapieux, la difluence de Landry, la chaîne des Arcs et la bise.
- Ancienne page « Aérologie Hte Tarentaise » (copie Internet Archive du 21/04/2025) et `Aerologie-de-la-Tarentaise.pdf` (2 pages, copie 2023, lu avec pdftotext) : même contenu, plus détaillé (« Vent du Saint-Bernard » d'axe NE-SO, atterrissage de La Bergerie le plus sensible, brise de Beaufort forte à Roselend). **Le PDF ne contient aucun schéma** (texte seul). Le diagramme du foehn est un lien externe (meteocentrale.ch) et la page actuelle en intègre une copie non récupérable.
- **Carte des sites** (Google My Maps intégrée à « Sites de pratique ») : export KML récupéré (`/maps/d/kml?mid=1GrklRGudDWqFksChShqxGoZpjB85KRk&forcekml=1`). C'est la meilleure source du lot : ~40 décollages et atterrissages avec coordonnées et règles saisonnières, le contour du cœur du Parc national (« Survol <1000 m/sol INTERDIT »), les zones R 331 et R 332 A avec horaires d'activation, les zones de sensibilité majeure (ZSM) gypaète et bulles de quiétude gypaète/aigle (champ « actif »). Déclarée comme figure F1.
- Pages Navette, Rapaces, ancien topo `pcht.free.fr/page_topos.html` (Aiguille Grive, Dôme de Vaugelaz, Cachette, Chapelles), ancienne page « Parc de la Vanoise ».

**Parc national de la Vanoise**
- **Arrêté « parapentes » n°2026-31 du 5 juin 2026** (PDF scanné, 10 pages, lu par OCR). Résumé : parapentes et deltas autorisés à moins de 1000 m/sol dans le cœur seulement dans des secteurs listés, **tous en Maurienne** (Dent Parrachée, Loza, Barbier Est toute l'année ; Barbier du 1/11 au 15/5 ; Orgère, Turra-Adrets-Bessans, Grande Feiche du 16/5 au 31/10 ; ZSM Loza avec calendrier propre). Décollage uniquement sur les sites de l'annexe cartographique, base-jump interdit, atterrissage en cœur interdit. Dérogations individuelles pour des vols de parapente de montagne depuis la Grande Casse, le Mont Pourri, le Grand Bec, la Dent Parrachée (demande par e-mail une semaine avant au secteur concerné). Compétitions interdites sous 1000 m, manifestations non compétitives soumises à autorisation. Expérimentation jusqu'au 31/12/2028. Sanctions R.331-63, R.331-65, R.331-68 (survol illégal : contravention de 5e classe).
- Décret 2009-447, art. 15 (AIDA) : cadre légal (survol non motorisé < 1000 m/sol réglementé par le directeur). Arrêté 2024-24 (drones, speed-riding, voiles de saut, snowkite : interdits toute l'année en cœur). Pages « La réglementation du cœur » (limite matérialisée par panneaux et balises bleu-blanc-rouge ; hors cœur, aucune réglementation particulière) et annonce de la Ligue AURA du 27/07/2026.
- Conséquence : le texte du PCHT (archive) sur la « dérogation par dossier de club » est **dépassé**. En Tarentaise comme à Pralognan, aucun secteur n'est autorisé ; seule reste la dérogation individuelle pour quatre sommets.

**Écoles et clubs**
- École de parapente des Arcs, page « Faire du parapente à Bourg Saint Maurice » : atterrissages, décollages, section « aérologie et pièges » (brise de Bourg 30-40 km/h et plus dès 14h ; foehn ; balises Petit-Saint-Bernard et Cottier). Page biplace d'été (rythme matin/après-midi). Arcs en Ciel (vols de restitution à Peisey-Vallandry, plafonds > 3000 m). Darentasia, Air Tarentaise, Aéroplagne : peu d'aérologie.
- Tarent'Air Tour (règlement 2024, balises .cup/.kml, airspace) : disqualification pour survol du Parc sous 1000 m/sol.
- Blog L'Aile et la Cuisse (récit d'un triangle FAI de 114 km depuis Bourg, copie Internet Archive) ; Rock The Outdoor (triangle de 223 km, copie Internet Archive).

**Bases de données de sites**
- **FFVL** : 124 fiches de l'export `ffvl_sites_alpes.json` dans la zone (coordonnées, vents favorables, dangers, aérologie). Les pages `federation.ffvl.fr` restent bloquées par Cloudflare pour curl et WebFetch.
- **ParaglidingEarth** : API bounding box, style détaillé : commentaires précieux (en anglais) sur Montgirod-Arcachat, Mont Jovet, Bouc Blanc, Loze, Méribel, Caron, Deux Lacs, Prariond, Centron.
- **Catalogue ancien** `cataloguevollibre.free.fr` (Dept-73) : Courchevel, Pralognan, Peisey, Val d'Isère, Belleville, Valmorel, Champagny, La Bâthie. Fiches anciennes, GPS de plusieurs fiches décalés (non utilisés).
- Wikipédia : Lombarde (vent) ; coordonnées de communes via l'API.
- Autres : Syride (Pralognan), La Plagne (Champagny), L'Officiel (Bozel), parapentiste.info (Le Mont de Séez), Guides de Pralognan.

## 2. Changements par rapport à la première passe

**Corrigé**
- **Solaise** : le point de première passe (6,9956 E ; 45,4396 N, alt. 2500 m) était décalé de ~680 m (alerte `--check` : MNT 2223 m). Coordonnées et altitude remplacées par celles de la fiche FFVL 610 (6,9906 ; 45,4347 ; 2495 m, `ffvl_id` renseigné), confirmées par ParaglidingEarth 3012 (2499 m). L'alerte a disparu. La fiche FFVL ajoute la consigne essentielle : pas de vol par vent SE ou SO (foehn et lombarde), brise et thermiques soutenus dès 11h.
- **Altiport (Arc 1600)** : cité comme décollage officiel par une source touristique ; la fiche FFVL 14142 et la carte PCHT le déclarent **strictement interdit** (« merci d'utiliser le décollage de l'Arpette »). Entrée remplacée (id `altiport-arc-1600-interdit`) et Arpette ajoutée.
- **Brise de Haute-Tarentaise** : Séez avait été placé par erreur sur l'axe de l'Isère ; retiré (Séez est sur la route du Petit-Saint-Bernard). Le tracé suit désormais Bourg, Sainte-Foy, Tignes, Val d'Isère. Les confiances et horaires sont documentés (sources FFVL) ; vitesses toujours non chiffrées.
- **Brise du Doron de Bozel, de Belleville, des Allues** : de « déduction, aucune source » à des horaires et forces issus des fiches FFVL, de ParaglidingEarth, de Syride et du catalogue (Allues reste de confiance faible).
- **Hazard « brise forte »** : déplacé d'Albertville à Bourg-Saint-Maurice (où les sources la situent) avec valeurs de l'école des Arcs.
- **Col de la Loze** : coordonnées et altitude de la première passe (approximatives) remplacées par la fiche FFVL ; Le Praz de même.
- **La Tranchée (Cevins)** : altitude FFVL (871 m) incohérente avec le MNT (1282 m) : valeur du MNT retenue.
- **Orientations** : pour Fort de la Platte, Fort du Truc et Chapelles, les « vents favorables » FFVL (SO/O/NO) ne correspondent pas à l'exposition du versant (E à SE selon catalogue, école, ParaglidingEarth) : exposition retenue, divergence notée.

**Ajouté** (de 14 éléments à 148, hors conseils)
- Brises : basse Tarentaise (La Bâthie, Aigueblanche, Moûtiers, Centron), difluence de Landry et vallon du Ponthurin, basculement par le col de la Chal, flux descendant des Chapieux, flux de Cormet d'Arêches, vallée de Saint-Bon, Allues.
- Convergences : Chapieux/Tarentaise à Bourg, col de la Chal, Cormet d'Arêches/Aime, Moûtiers (déduction, faible), Boismint.
- Risques : foehn du Saint-Bernard, venturis (Chapieux, Centron, 2 Têtes, Moraine), atterrissages Ilettes/Gare/Versoyen, zones de tir R 331/R 332 A (horaires d'activation), cœur du Parc national autour du Mont Pourri, de Tignes/Val d'Isère et de Pralognan avec règle exacte et sanctions, ZSM gypaète et bulles d'aigle actives, lignes HT, rafales du Jovet, altiport de Méribel, foehn de Belleville.
- 72 décollages et atterrissages (52 décollages, 20 atterrissages) avec coordonnées FFVL/PCHT/ParaglidingEarth et `ffvl_id`/`pge_id`.
- Effets du vent synoptique par direction pour les deux massifs (foehn, vent du sud, lombarde, bise, N, NO, O, SO, E).
- Trois routes : triangle FAI 223 km (Fort du Truc, Parmelan, Crolles, Sainte-Foy, 23/04/2015), triangle FAI 114 km via Mont-Blanc/Aravis/Beaufortain (récit détaillé), parcours de marche et vol du Tarent'Air Tour.

**Retiré** : rien d'avéré faux n'a été supprimé ; les remplacements ci-dessus (Altiport, Séez, Solaise) sont expliqués. Le point de « Fond de vallée de Bourg-Saint-Maurice » devient Les Ilettes (même id).

## 3. Figures

- **F1** : carte PCHT (Google My Maps). Carte interactive sans flèches de brise, donc pas de schéma annoté de type « brises de Tarentaise » ; les données (sites, R 331/R 332, ZSM, cœur du parc) sont extraites du KML.
- **Aucun schéma annoté de brises ou de la lombarde n'a été trouvé** pour la Tarentaise : le PDF du PCHT est du texte, les panoramas de l'ancien site (faces ouest et nord de Bourg) sont des photos sans flèches, le diagramme du foehn est un lien externe, les cartes en annexe de l'arrêté 2026-31 ne couvrent que la Maurienne.

## 4. Échecs, divergences et points à vérifier

- Lombarde : aucune description locale en Tarentaise ; seules les fiches FFVL de Solaise et de Tovière (« vents d'est à sud frontaliers, foehn et lombarde : très mauvais ») et une définition de Wikipédia. Le PCHT décrit le foehn de sud avec un axe NE-SO à Bourg, qui est la forme locale la plus documentée.
- Divergences conservées : La Sévolière (FFVL : décollage d'été ; PCHT : d'hiver) et Roches Noires (inverse) ; vent de nord = foehn au Mont de la Chambre (catalogue ancien) contre vent de sud = foehn à Belleville (FFVL, ParaglidingEarth) ; altitudes de Bouc Blanc (FFVL 1563 m, ParaglidingEarth 2187 m : 2187 retenue), des Tovets (FFVL 1083 m, catalogue 1800 m : 1800 retenue).
- Moûtiers et Trois Vallées : très peu de textes de clubs trouvés (club de Courchevel/Bozel « Natur'ailes » et club Belleville Air Force sans site accessible). Les brises des Dorons reposent sur des mentions de fiches, avec des vitesses interprétées (marquées comme telles).
- Pralognan : le catalogue ancien liste des sites (Bochor, Chaberne, Crête des Glières, Col de Leschaux, Petit Mont Blanc) non localisés et pour la plupart en cœur de parc ; non cartographiés. Seul Le Pachut (FFVL 5223) est placé.
- Valmorel (décollages du catalogue, GPS absents) : seuls Montagne de Tête et l'atterrissage des Avanchers sont placés. Pas de site trouvé pour Notre-Dame-de-Briançon ni Aigueblanche (la brise y est décrite sans site).
- Tignes et Val d'Isère : pas de club (Chim'Air Tignes, sans site accessible) ; foehn et lombarde sont les seuls thèmes documentés. Tignes - Val d'Isère : la brise de vallée n'a pas de vitesse chiffrée.
- Transitions : Beaufortain par le Cormet de Roselend / Cormet d'Arêches et Combe Bénite (récit L'Aile et la Cuisse, PCHT) ; Maurienne (La Lauzière, Madeleine, Saint-François-Longchamp) relève du lot Maurienne : aucun récit de cross Tarentaise-Maurienne ni de traversée vers le Val d'Aoste n'a été trouvé. Pas de trace XContest lue.
- Cartes de brises Largeault/toutleparapente non consultées ici (autre lot).
- Réserves naturelles nationales autour de Tignes (Grande Sassière, Tignes-Champagny, Hauts de Villaroger, Bailletaz) : décrets non lus, seule la mention FFVL de la Grande Sassière (< 1000 m/sol, face S-SO) est reprise.
- Les ZSM et bulles de quiétude sont celles de la carte PCHT à une date inconnue (l'état actif/inactif change chaque saison).

## 5. URL bloquées ou non récupérables

Notées dans `.cache/research/blocked_urls.txt` : fiches FFVL (Cloudflare), pages de compétition `parapente.ffvl.fr/compet/...` (tracés des manches du championnat de France 2023 à Bourg), récit Rock The Outdoor d'origine (410, copie archive lue), diagramme du foehn et balises SpotAir du PCHT. L'onglet du navigateur intégré n'a pas pu être ouvert (limite d'onglets atteinte par d'autres agents) : les ressources JavaScript n'ont pas été lues.

## Thermiques et points de relance (passe complémentaire)

Constat de départ : la seconde passe ne retenait que les endroits appelés « thermique » ; les pilotes parlent de points de raccroche et de relance le long des cheminements. Cette passe relit les documents du lot (récit L'Aile et la Cuisse S72, topos PCHT et catalogue ancien, PDF PCHT, fiches FFVL, commentaires ParaglidingEarth S52, pages d'écoles) et cherche des récits complémentaires par site. Convention de confiance : plusieurs récits concordants ou un récit au lieu précis = `medium` ; déduction du relief = `low` (« déduction » dans la description).

**Avant → après (thermiques)** : tarentaise 7 → 14, vanoise 4 → 6. Sources ajoutées : S140, S141. `npm run data:build -- --check` : aucune alerte.

**Ajoutés (Tarentaise)** : extraction au-dessus du Fort de la Platte par basses couches stables (S72, topo PCHT S71 : « le décollage entre 11h30 et 13h30 permet souvent de beaux plafonds »), plafond de 3500 m à la Pointe de Combe Neuve, thermique de confluence au-dessus d'Aime (+300 m, relance vers Bourg), relance du Crêt du Rey, perchoir faible de la Pointe de la Combe Bénite (avant le flux du Cormet d'Arêches), Tête de Solaise (thermique et brise dès 11h, S78), Pointe du Lavachet (low, déduction). **Complétés** : `arcs-10-de-face` (bouclage du soir jusqu'à 2600 m) et `fort-du-truc-chapelle-st-michel`. **Vanoise** : relance du soir sur la Dent du Villard (ParaglidingEarth, Bouc Blanc), déclencheur des terrains de foot de Bozel (FFVL 708). Route `triangle-114-beaufortain-mont-blanc` : waypoints ajoutés dans l'ordre volé (Combe Neuve, Terrasse, Mya, Tré-la-Tête, Lapaz, Varan, Charvin, Pas de l'Âne, Légette du Grand Mont) ; les sommets de Mya et de Lapaz, notés non localisés dans la version précédente, sont maintenant placés (IGN).

**Divergence** : le point `dent-du-villard-soir` (première version) est placé sur un lieu-dit à 875 m, 2,9 km au nord du sommet IGN de la Dent du Villard (2282 m) ; non modifié, le nouveau point est sur le sommet.

**Introuvable ou non traité** : La Plagne (Roche de Mio, Prariond, Mont Saint-Jacques déjà décrits ; aucun récit de cheminement entre la Plagne et Bourg ou Aime), Méribel et Courchevel (hors Bouc Blanc, Loze, Jovet : pas de récit de cross lisible ; les pages d'écoles sont commerciales), Val d'Isère et Tignes (pas de récit de cross ; la fiche FFVL de Solaise et la Tovière sont les seules sources), arête de Tricot et Roche de Mya (récit S72, non localisées). Grande Rochette : fiche FFVL lue (décollage d'hiver, pas d'aérologie) ; les « thermiques impressionnants » d'un blog touristique ne sont pas retenus. Pages inaccessibles notées dans `blocked_urls.txt` (Varioclub, ffvl.fr par curl).
