# Seconde passe 2026 : lot `montblanc_beaufortain`

Massifs : `mont-blanc-chamonix`, `val-montjoie-saint-gervais`, `val-arly-megeve`, `beaufortain`.
Fichier de données : `data/montblanc_beaufortain.json` (version complète, remplace la première passe).
Les ids des massifs et des éléments de la première passe sont conservés quand l'élément a été corrigé.

> État : passe terminée ; JSON validé et `npm run data:build -- --check` sans alerte sur les quatre massifs.

## Sources lues (ce qu'on y a trouvé)

| Source | Contenu utile |
|---|---|
| Brochure « Vol libre au Pays du Mont-Blanc » (PDF FFVL, 2008, 32 doubles pages) | Page 10-11 : brises thermiques 20-25 km/h (jusqu'à 30), sensibles jusqu'à 2500-3000 m ; règle des 20 km/h à 2000 m ; foehn (Chamonix et Contamines les plus exposés, indices, peut rester entre 1400 et 1800 m) ; p. 8-9 zones LF-R 30 A/B et schéma 1000 m/sol–FL 115 ; fiches de tous les décollages/atterrissages de Chamonix, Les Houches, Saint-Gervais, Passy, Megève, Praz-sur-Arly, Les Contamines ; carte p. 28-29 (réserves, zones) ; haute montagne p. 38-41 ; terrain delta du Bouchet p. 42. Texte relu intégralement, deux pages rendues en image (carte, zones). |
| Site du club des Gratte-Ciel (gratte-ciel.club) : conditions, réglementation, fiches de 14 décollages et 3 atterrissages | Coordonnées GPS à jour (Planpraz, Plan de l'Aiguille, Grands Montets, Prarion Nord, Grand Prarion, Merlet, Aiguille du Midi, Mont-Blanc, Dômes de Miage, Chavants, Bouchet), horaires (Planpraz H+30 à H+10, Flégère sous le vent dès ~11h), réserve des Aiguilles-Rouges à 300 m/sol, LF-R 30 A/B/C, Beaux Mollets, Savoy. |
| CMBVL (Passy), page « Météo & aérologie locale » (FR et EN) | Brise de l'Arve entrant par Sallanches, scission au Mont d'Arbois puis à l'entrée de la vallée de Saint-Gervais, retour parfois E/SE côté Varan ; foehn : seuil −4 hPa Aoste–Annecy, indicateurs (Prarion, Requin, ENSA, rafales d'est à la sortie de la Mer de Glace). Pages sites CMBVL (Plaine-Joux, Varan, Frioland, Platé, Pormenaz, Chedde, Marlioz, lac de Passy) lues : elles relèvent du lot Arve (Passy), non reprises ici sauf indications utiles. |
| Fiches FFVL (via `ffvl_sites_alps.tsv` / `ffvl_sites_alpes.json`) | Coordonnées, orientations et aérologie : Rochebrune, Praz-sur-Arly, Ban Rouge, Cordon (Tête du Planet, Benets, Rochefort, Lépigny), Bisanne Sud/NO, Beaufort, Marthod, Roselend, Grand Mont, Roche Parstire, Contamines (Kouzna, col du Joly, Pontet, golf), Saint-Gervais (Mont d'Arbois, Mottey, Paccard, La Charme, piscine), Houches (Merlet, Aiguillette, Chailloud, Chavants), Chamonix (Planpraz, Bouchet, Savoy, Grands Montets, Beaux Mollets, Mont-Blanc). |
| ParaglidingEarth (API bbox + pages) | Commentaires aérologiques : Le Méruz (brise d'Ugine), Bisanne Sud/Nord, Cordon Tête du Planet (après 13h brise > thermique), Cormet de Roselend, Grand Mont, Fenêtre 7. |
| Barbules (fiche Chamonix–Vallée du Mont-Blanc) | Remarques de clubs : Planpraz calme avant 11h / turbulent après 15h, Rochebrune « confluence permettant de longs vols paisibles », La Charme (restitution du soir), Mont Paccard (forêt, thermique dès mars), Mont Joux, Porcherey, Mont Joly, Chailloud (14h-16h difficile). |
| AeroVFR, SUP AIP 120/21 (2021) | LF-R 30 C (ZRT) H24 du 1er juin au 15 octobre, 30 B relevée, 30 A désactivée pendant 30 B, règles PUL (pénétration autorisée en juin et du 1er sept. au 15 oct., atterrissage interdit). |
| La Chamoniarde ; Chamonix.net (Plan de l'Aiguille, Flégère, Grands Montets, Les Houches, Mont-Blanc, 2012-08-20, node 7544) | Rappel de l'arrêté du 13 octobre 2008 ; réouverture du Savoy le 22 juillet 2026 (essai, charte) ; arrêté municipal de Chamonix/Saint-Gervais (600 m autour du sommet). |
| XC Mag « Guide to Chamonix » ; vidéos YouTube (200 km juillet 2020 ; Chamonix→Annecy mars 2026) | Rythme de la journée, Planpraz dès 10h, Plan de l'Aiguille NO soarable après 15h, Annecy A/R 100 km, 200 km avec plafonds > 4000 m par les Aravis. |
| Trace Ta Route (5 jours rando-vol, 2023) ; Expérience Outdoor (3 jours, 2018) ; blog Speedetrando (2025) ; Syride (Bisanne) ; flyappi | Régime de brise du Doron, Bisanne, Roche Plane, Pas d'Outray, Petite Berge, Arpire, Grand Mont ; brise d'Ugine « sous le vent à midi » ; forte brise descendante au crépuscule ; thermique à 2500 m et traversée du col des Saisies. |
| Volatiles des Saisies (page sites + 3 pièces Drive : arrêtés de Hauteluce 2022-134-P, de Villard-sur-Doron 2022-141, plan Hauteluce 2022) | Réglementation hivernale des domaines skiables ; route de Bisanne fermée juillet-août ; navette. |
| Joly Jumpers (Les Contamines) ; Club des Sports de Megève ; Megève Aventure Parapente ; Praz-sur-Arly OT | Kouzna, Gorge/Pontet/golf, col du Joly ; balise Pioupiou 517 ; atterrissage alternatif au-dessus de la gare de Rochebrune par vent de sud ; Crêt du Midi / Ban Rouge. |
| Carnet Expemag « Vol bivouac – Tour du Mont Blanc » (août 2023, 342 km en 2 jours) | Itinéraire réel Aravis → Chamonix → Suisse → Italie → Mont-Blanc → Les Chapieux, « cocktail de brises » (col de la Seigne, Cormet de Roselend), puis Pierra Menta → Pointe de la Terrasse → Roselend → Bisanne → Mont Charvin ; plafonds 3100-4200 m. |
| Rock The Outdoor : tours du Mont-Blanc de S. Boulenger (2017, triangle 75 km) et R. Beaugey (2021) | Fenêtre d'Arpette (2700 m), Grand Col Ferret (2537 m), col de Miage (3367 m) ; premier TMB depuis le Plan de l'Aiguille en 2002 ; thermique d'Helbronner. |
| Alpes Guides (Mont Joly) ; Summits.fr (Megève) ; Air Sports Chamonix (météo, stages, sites) ; AirChamonix | Épaule du Mont Joly 2330 m, Champs du Planay ; Jaillet (SE, matin, non retenu faute de coordonnées) ; seuil de 30 km/h à 2000 m de l'école ; saisons des décollages de biplace. |
| Parapente Pays de Gex (triangle 202 km) | Retour par Aravis, col du Charvin, Dent de Cons, Grand Arc, Chamoux ; brises à composante sud. |

(Détail des URL dans le tableau `sources` du JSON.)

## Changements par rapport à la première passe

### Corrigé

- **Coordonnées** : Prarion NE déplacé de 1,2 km (la brochure donne un GPS invalide, le club donne 45°53'06.7"N 6°45'10.4"E) ; Grands Montets (déco 6.96, 45.9478, 3240 m FFVL) à la place d'un point approximatif à 1,5 km (l'alerte d'altitude 3100 m / MNT 2609 m disparaît) ; Rochebrune (6.6133, 45.8333, brochure/FFVL) au lieu d'un point à 1,2 km qui déclenchait l'alerte MNT ; Plan de l'Aiguille (45.9023, 6.8837, club) à la place d'un point à 1,2 km ; Bois du Bouchet, Savoy, Chavants, piscine de Saint-Gervais, Praz-sur-Arly, Mont Joux repositionnés sur les fiches FFVL/club. Les coordonnées de Ban Rouge de la brochure pointent en fait Praz-sur-Arly et ont été écartées au profit de la fiche FFVL 394.
- **Réglementation** : zones LF-R 30 A/B/C complétées (30 C : 1-30 juin et 1er sept.-15 oct. côté club, H24 du 1er juin au 15 oct. selon le SUP AIP ; divergence sur la 30 A permanente ou désactivée pendant la 30 B) ; réserve des Aiguilles Rouges : 300 m/sol selon le club, 1000 m/sol selon la brochure (les deux gardées) ; réouverture du Savoy en 2026 ; posé au sommet du Mont-Blanc interdit (30 C et arrêté municipal des 600 m).
- **Règle « régime de NE »** (attribution incertaine en première passe) : retrouvée nulle part dans les textes lus, rattachée à aucun site, marquée non vérifiée (effet `NE` de Chamonix).
- **Rochebrune** : la brochure dit rouleaux par vent de SO, la fiche FFVL et le club listent le SO comme orientation possible : divergence conservée, confiance abaissée.
- **Brise de Chamonix** : sens et alimentation précisés avec le CMBVL (entrée par Sallanches, scission au Mont d'Arbois et à l'entrée de la vallée de Saint-Gervais) ; installation vers 11h (Flégère) ; sensible jusqu'à 2500-3000 m ; ordre des points inchangé.
- Éléments de la première passe marqués « déduction » et sans source (brises du Bon Nant, de l'Arly, du Doron, convergences de Megève et des Saisies) : sources trouvées pour l'Arly, le Doron, Megève (confluence de col) ; Hauteluce → Saisies et col de Voza restent « déduction » à confiance basse.

### Ajouté

Volumes avant → après (4 massifs) : brises 8 → 13, convergences 3 → 5, pièges 9 → 38, thermiques 2 → 11, soaring 2 → 8, décollages 7 → 34, atterrissages 5 → 19, effets synoptiques 4 → 21, routes de cross 2 → 12, conseils 9 → 33, sources 34 → 144, figures 0 → 3.

- Chamonix : brises Grands Montets et Merlet–Aiguillette, 12 nouveaux sites (Aiguille du Midi, Mont-Blanc, Grand Prarion, Merlet, Aiguillette, Chailloud, Beaux Mollets, Mont Lachat…), foehn, LF-R 30 A, câbles de la combe Lachenal, Savoy, Argentière ; routes : tour du Mont-Blanc (triangle de 75 km, jour 1 du carnet de 2023), Planpraz–Flégère–Argentière, restitution du Plan de l'Aiguille, Grand Prarion–Chedde.
- Saint-Gervais / Montjoie : Mont Joux, Porcherey, Mont Paccard, La Charme, Plancert, Kouzna, col du Joly, Mont Joly, Dômes de Miage, Pontet, golf, restitution du soir, réserve des Contamines, foehn, lignes HT.
- Megève / Val d'Arly : Rochebrune réécrit, Cordon (Tête du Planet, Benets, Rochefort, Lépigny), Méruz, Marthod, Ban Rouge/Crêt du Midi, altiport, brise de l'Arly sourcée (Méruz, Bisanne, Marthod).
- Beaufortain : Bisanne Sud/NO, Roche Parstire, Petite Berge, Cormet, Grand Mont, Fenêtre 7, atterrissages de Beaufort/La Tour/Saisies, brise descendante, arrêtés de Hauteluce et Villard-sur-Doron, traversée Pierra Menta → Bisanne → Charvin, « cocktail de brises » des Chapieux.

### Retiré

Rien n'a été retiré. Quelques positions approximatives de la première passe ont été remplacées (voir « Corrigé »).

## Figures

- F1 : carte p. 28-29 de la brochure (sites, réserves, zones d'interdiction) : éléments tirés : zones LF-R 30 A/B, réserve des Aiguilles Rouges.
- F2 : schéma p. 8 (1000 m/sol et FL 115).
- F3 : plan « Vol libre Hauteluce 2022 » (non géolocalisé ; seule la réglementation est extraite).
- Aucun schéma annoté de brises (flèches, glacier, confluences) n'a été trouvé pour la vallée de Chamonix ni pour le Beaufortain.

## Transitions

- Vers les Aravis : Pointe Percée / col des Aravis depuis Chamonix, portail de Cordon (Tête du Planet), Bisanne → Mont Charvin (récits Expemag 2023 et Pays de Gex 2019).
- Vers Albertville : brise d'Ugine (Arly) et du Doron ; retour par Charvin, Dent de Cons, Grand Arc « compliqué dans les brises » (S27) ; Fenêtre 7 et Fort du Mont (fiches FFVL).
- Vers la Tarentaise : seule observation, aux Chapieux (col de la Seigne, Cormet de Roselend), voir `convergence-chapieux-seigne-cormet` (confiance basse). Pas de route Saisies → Tarentaise documentée.

## Échecs et points à vérifier

- Règle « en régime de NE, les brises diurnes priment sur le vent météo » : introuvable dans la brochure et sur les sites de clubs lus ; marquée non vérifiée.
- Brise de glacier / katabatique de Chamonix : aucune source.
- Parapente.ffvl.fr (CFD, traces de cross) : Cloudflare ; routes de cross réelles non reconstituées (voir `blocked_urls.txt`).
- Date du carnet Expemag : l'en-tête indique 22/07/2023 mais les étapes sont datées des 22 et 23 août 2023 ; seule la seconde est retenue.
- Convergences de Chamonix : aucune source ; liste laissée vide plutôt que d'inventer.
- Altiport de Megève et Roche Plane, Pas d'Outray, Arpire : positions non trouvées (altiport placé « approx » ; les trois autres seulement cités en texte).
- Pages `parapente-mont-blanc.info` (domaine abandonné, lues via Wayback) : texte identique à la brochure.
- toutleparapente (cartes de brises) : PDF et images renvoient l'accueil / un pixel ; rien pour le Mont-Blanc de toute façon.

## Thermiques et points de relance (passe complémentaire)

Constat de départ : la seconde passe ne retenait que les endroits appelés « thermique » ; les pilotes parlent de points de raccroche et de relance le long des cheminements. Cette passe relit tous les documents du lot (brochure FFVL/OT, fiches des Gratte-Ciel, wiki Barbules, fiches FFVL et ParaglidingEarth, récits Expemag, Trace Ta Route, Speedetrando, Pays de Gex, XC Mag, descriptions de vidéos) et ajoute le récit de L'Aile et la Cuisse (triangle de 114 km, déjà lu pour le lot tarentaise_vanoise), une description de vidéo (cross Plan de l'Aiguille → Planpraz → Brévent → Aiguillette) et la fiche CMBVL de Varan. Convention de confiance : plusieurs récits concordants ou un récit au lieu précis = `medium` ; lieu imprécis ou déduction du relief = `low` (« déduction » dans la description).

**Avant → après (thermiques)** : mont-blanc-chamonix 5 → 14, val-montjoie-saint-gervais 2 → 5, val-arly-megeve 2 → 3, beaufortain 2 → 9 ; un piège ajouté (hazards du Beaufortain 7 → 8). Sources ajoutées : S149 à S154. `npm run data:build -- --check` : aucune alerte.

**Chamonix** : Planpraz comme relance depuis le Plan de l'Aiguille (« je raccroche sur planpraz », S150), Brévent plafond 3000 m, Aiguillette des Houches (relais vers les Houches, S150 et Alpes Guides S153), Pointe de Lapaz (« bon déclencheur de thermique », S149), Varan (falaises et pied de Barmerousse : récit S149, CMBVL S151, FFVL S152 ; le site relève du lot Arve, ajouté ici car il sert de relance vers les Aravis), plafond de 3600 m au nord des Aiguilles Rouges (low, position approx), thermique « teigneux » sous les Grandes Jorasses (approx), plafond de 4200 m sous le Mont Blanc (approx), crête des Aiguilles Rouges au nord de l'Index (low, déduction). Routes : nouvelle `plan-aiguille-planpraz-brevent-aiguillette` ; waypoints ajoutés à `chamonix-annecy` (Varan, Pointe Percée, col des Aravis) et `tmb-aravis-chamonix-mont-blanc-chapieux` (nord des Aiguilles Rouges, Grandes Jorasses).

**Saint-Gervais / Montjoie** : falaise de La Charme (« une petite falaise à la sortie du déco permet aux thermiques de se mettre en place en début d'après-midi », Barbules S15), ascendances larges du soir au-dessus du village, ascendance à 4300 m sur la crête vers le glacier de Tré-la-Tête (position approx, S149). Route `porcherey-mont-joly-saisies` : Mont Joly ajouté.

**Megève / Val d'Arly** : `thermique-de-l-alpette` complété (basculement au-dessus du sommet vers l'Arly, confluence ; S76, S114), Christomet (low, déduction : la brochure envoie le cross « vers le Christom et les Aravis »). Route `rochebrune-cordon-aravis` : Christomet ajouté.

**Beaufortain (Saisies, Hauteluce)** : Mont Rosset (35 min d'extraction, S72), Pointe de la Terrasse (plafond 3100 m, mou sous 2400 m), Pointe de Mya (3800 m), La Légette (relance difficile avant le Mont Clocher, Speedetrando S67), Légette du Grand Mont (3200 m), Roche Pourrie (brise d'Annecy, entrée du massif), parois de Roselend (fin de journée, position approx) ; piège du Pas de l'Âne (sous le vent du Mirantin). Nouvelle route `bisanne-saisies-legette-mont-clocher`. **Les « Barbules » du récit de Bisanne ne sont pas un lieu** : le mot désigne les petits cumulus (même emploi dans le récit Expemag) ; aucun point n'a donc été créé.

**Méthode de positionnement** : sommets, cols et lieux-dits par le géocodeur IGN et OSM (`coord_quality: source`) ; points « sous le sommet » ou « à mi-chemin » en `approx`. Altitudes comparées au MNT IGN.

**Introuvable ou non traité** : arête de Tricot (ascendance difficile, non localisée), Roche de Mya, falaises du Biolley, Roche Plane et Pas d'Outray (Trace Ta Route, non placés ; Roche Plane est distinct de Roche Parstire). La Pointe Percée (raccroche à 2400 puis 3400 m) relève du lot Annecy–Aravis, uniquement en waypoint ici. Pas de récit exploitable trouvé pour Combloux (hors Rochebrune et Cordon) ni pour une relance précise entre Hauteluce et le Cormet. Aucune image annotée de thermiques trouvée (brochure p. 19 vue : photos sans flèches). Pages inaccessibles ajoutées à `blocked_urls.txt` (forum parapente.aix.free.fr, Wikiloc, fil parapentiste.info de Combloux, accès direct à laileetlacuisse.fr). Nombreux sites commerciaux (écoles, offices) lus sans information de relance. L'onglet du navigateur intégré a été fermé.

## Passe secteurs minces

Date : 7 octobre 2026. Même convention de confiance : récit précis ou plusieurs récits = `medium`, extrapolation du relief = `low` avec « déduction ». Identifiants existants conservés, rien supprimé. `npm run data:build -- --check` : aucune alerte nouvelle.

### Megève – Val d'Arly (`val-arly-megeve`)

Volumes avant → après : brises 2 → 4, convergences 1 → 2, hazards 7 → 8, thermiques 3 → 7, soarings 1 → 1, décollages 4 → 4, atterrissages 5 → 5, effets synoptiques 5 → 5 (deux complétés), routes 2 → 5, conseils 6 → 10 ; 9 sources (S155 à S163).

**Sources nouvelles**
- Récits du CHVD lus en entier : triangle FAI de 108 km depuis le Signal de Bisanne (8 août 2020 selon le titre ; l'adresse et les légendes de photos portent 8 juillet, date du titre retenue), vol de canicule de Bisanne vers le Mont Blanc (18-19 août 2012), « Premier avec les crosseux » (22 avril 2007, Bisanne → Praz-sur-Arly → Aravis), compétitions des Saisies (avril 2022 et avril 2024, traversée du Val d'Arly, forte brise sur Megève).
- Récit *Blues Team* (mai 2015), fin du vol du col de Bleine à Passy : Saisies, Crest-Voland, Flumet, Notre-Dame-de-Bellecombe, Praz-sur-Arly, confluence au-dessus de Megève, verrou de Combloux.
- Fil de discussion parapentiste.info « Cross au départ de Megève » (2008) : confluence des brises de SO et de N à Megève, Rochebrune site d'après-midi. Les dernières réponses du fil sont une description humoristique en patois d'un parcours, non retenue.
- Vol bivouac du CHVD de février 2011 (col des Aravis → Tête du Torraz → Flumet par vent de sud).
- Positions : géocodeur IGN.

**Ajouté ou corrigé**
- *Thermiques et relances* : sous la Tête du Torraz (thermique violent de février 2011, par vent de sud), au-dessus de Praz-sur-Arly (3100 m en 2020, 3000 m en 2007), Aiguille Croche (3135 m, plafond du jour), Mont Joly (derniers thermiques côté Megève avant le Mont Blanc, 3200 m en 2012).
- *Convergence* : nouvelle fiche au-dessus de Megève (habituellement vers Praz-sur-Arly), avec plus de 7 km de glisse sans enrouler vers Combloux (une première rédaction plaçait la confluence au-dessus de Praz-sur-Arly ; corrigée avec le texte « au-dessus de la station ») ; la convergence du col de Megève est complétée par le forum de 2008 et la compétition de 2024.
- *Brises* : horaires et observations ajoutés à la brise de l'Arly (Signal de Bisanne à décoller avant midi, très forte brise le 14 avril 2024, appui sous le vent entre Notre-Dame-de-Bellecombe et Praz-sur-Arly) et à celle du bassin de Sallanches ; deux écoulements descendants matinaux (Arly et Arve vers Sallanches) en `low`, avec « déduction » et horaires 21h-9h distincts.
- *Danger* : très forte brise face au verrou de Megève (balise B6 de la compétition 2024).
- *Routes* : `bisanne-aiguille-croche-praz-aravis-2020`, `bisanne-mont-joly-mont-blanc-2012`, `saisies-flumet-praz-megeve-combloux-2015` (extraits de vols plus longs ; points nommés et localisés seulement).
- *Effets synoptiques* : sud (2015 et février 2011, posé entre Flumet et Saint-Nicolas-la-Chapelle) et nord (brise de l'Arve) complétés.

**Introuvable ou non fait**
- Aucune brise documentée pour Flumet, Crest-Voland et Notre-Dame-de-Bellecombe en dehors des récits de cross ci-dessus ; aucun horaire chiffré de la brise de l'Arly ; les écoulements matinaux restent des déductions.
- Pas de récit local sur Rochebrune plus précis que la brochure et les fiches FFVL déjà utilisées ; le site du club de Megève ne contient pas de description (voir `pages_bloquees.txt`) ; traces CFD et XContest inaccessibles.
- Les vols de la Plaine Joux, de Varan et du Mont Joly côté Saint-Gervais appartiennent à d'autres secteurs et n'ont pas été traités.


## Audit des thermiques (octobre 2026)

Les listes de lacunes (`docs/COUVERTURE.md`, `docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`) ont été reprises pour Chamonix – Mont-Blanc, Val Montjoie, Megève – Val d'Arly et Beaufortain. Règle de confiance : `medium` quand un texte (fiche FFVL, brochure, récit) décrit une ascendance au lieu, `low` avec « déduction » quand seuls un point chaud kk7 (traces GPS, `thermal.kk7.ch`) et le relief l'indiquent. Les toponymes autour des points chauds viennent d'OSM, les altitudes du terrain IGN (RGE ALTI). Plusieurs points chauds sont en haute montagne (2600 à 3300 m, versants glaciaires) : ils reflètent les grandes traversées du Mont-Blanc, pas des sites de décollage.

### Chamonix – Mont-Blanc (`mont-blanc-chamonix`)
- Créés : `prarion-thermiques-du-matin` (`medium` : « site du matin : thermiques d'est » au Prarion Nord-Est et « brises thermiques… » au Grand Prarion ; point chaud 92 % à 420 et 720 m, qui sert les deux décollages), `plan-de-l-aiguille-thermique-deco` (`low`, « brises thermiques/thermodynamiques », point chaud faible), `pormenaz-pointe-noire` (`low`, FFVL 5115, point chaud 87 % à 1,8 km), `beaux-mollets-signal-forbes` (`low`, FFVL 14105 ; c'est le point chaud ≥ 90 % de la liste), `chamonix-aiguilles-rouges-brouillard` et `chamonix-charlanon-aiguille-pourrie` (`low`, les deux autres points chauds ≥ 90 %).
- Écartés : `foehn-vallee-chamonix` (foehn, « déclench » ne désigne qu'un déclenchement du phénomène) ; `drus-verte-chardonnet` (position approximative en haute montagne, loin de tout point chaud). Position de `merlet` et `merlet-thermiques-matin` laissée : la fiche FFVL (1691 m) et le club (1600 m) donnent des altitudes supérieures de 130 à 220 m au terrain IGN à leurs coordonnées (parc animalier à 1468 m) ; l'écart peut venir de la pente raide ou d'un décollage plus haut que le point indiqué, sans source pour trancher.

### Val Montjoie (`val-montjoie-saint-gervais`)
- Créés : `kouzna-signal-thermique` (`medium` : la brochure dit que « les thermiques ne sont pas loin des lignes » ; point chaud 98 % à 490 m du décollage), `mont-lachat-chavants` (`low`, point chaud faible 73 %), `bionnassay-tricot-pointe-inferieure`, `rochers-du-mont-blanc-aiguilles-grises`, `tricot-bionnassay-3300` (`low`, points chauds d'altitude ≥ 90 % de la liste). Le point chaud du Prarion est dans `mont-blanc-chamonix` ; celui de Chedde (92 %) est dans `arve-faucigny` (`chedde-praz-coutant`, fichier `chablais_giffre_arve.json`).
- Position corrigée : atterrissage `notre-dame-de-la-gorge` (position approximative à 1338 m de terrain pour 1210 m déclarés) ramené sur la chapelle Notre-Dame de la Gorge (toponyme IGN, 1206 m).
- Écarté : `face-est-mont-joly` (position source, loin d'un point chaud). `domes-de-miage` (écart de 84 m, sommet glaciaire) laissé.

### Megève – Val d'Arly (`val-arly-megeve`)
- Créés : `megeve-thermique-couche-b6` (`low` : le thermique « très couché par la brise » de la balise de Megève de la compétition des Saisies, 14 avril 2024 ; position de Megève), `ban-rouge-sans-ascendance` (`low` : la brochure dit « sans ascendances particulières » alors que le point chaud est à 81 % à 116 m ; texte et mesure divergent, signalé tel quel), `megeve-tete-noire-les-sions` et `flumet-balavarde` (`low`, les deux points chauds ≥ 90 %).
- Écarté : `mont-joly-derniers-thermiques-megeve` (position source, loin d'un point chaud).

### Beaufortain (`beaufortain`)
- Créés : `pas-de-l-ane-thermique-sain` (`medium`, récit : « j'exploite le premier thermique que je trouve pour réussir à me dégager », sain jusqu'à 2900 m ; point chaud 94-95 % à 720 m), `beaufortain-la-chapelle-nord-ouest`, `beaufortain-crete-est-6333`, `beaufortain-dunand-lavachay` (`low`, points chauds ≥ 90 %).
- Écartés : Roche Parstire (FFVL 392) et Fenêtre 7 (FFVL 491) : la fiche ne mentionne que la brise de vallée, et le point chaud le plus proche est à 3,6 et 3,4 km.

## Résolution des limites (octobre 2026)

Date : 7 octobre 2026. Les limites de données restantes après l'audit des thermiques (`docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`, `docs/COUVERTURE.md`) ont été reprises pour Mont-Blanc, Val Montjoie, Val d’Arly, Beaufortain. Aucun identifiant supprimé ni renommé ; chaque correction est notée dans la description de l'élément (« Résolution des limites (octobre 2026) : … »).

### 1. Points chauds forts à 600 m – 1 km d'un thermique documenté

Règle de tri appliquée à chaque cas : le thermique documenté est **recalé** sur le point chaud kk7 quand sa position n'était qu'approximative (ou celle du décollage), que le texte de sa source décrit un relief que le point chaud occupe (la crête, la pente, le relief « qui encadre le col ») et qu'il n'a pas déjà son propre point chaud à moins de 600 m ; sinon le point chaud est une **seconde ascendance**, créée à part, `medium` quand un texte la décrit (fiche FFVL, fil de pilotes, récit), `low` avec « déduction » quand seuls le point chaud et le relief l'indiquent. Les élément créés citent la source kk7 (`thermal.kk7.ch`) et la source du texte rapproché, dans l'ordre. Les points chauds forts à 600 m – 1 km passent de 27 à 0 dans `docs/KK7_CROISEMENT.md`.

- **Brévent, faces sud-est** (`brevent-faces-sud-est-plan-lachat`, `low`) : point chaud à 96 % à 831 m du sommet, 560 m plus bas, sur une pente de 35° exposée au sud-est ; ascendance basse probable sous le plafond de 3000 m du récit. Le sommet garde le plafond.

### 2. Écarts d'altitude (`docs/POSITIONS.md`)

Constat préalable : le relevé d'altitudes IGN demandait les points par lots de 100, or le service d'altimétrie (`data.geopf.fr/altimetrie`) n'est exact que jusqu'à une trentaine de points par requête (testé : lots de 25 et 30 identiques aux requêtes unitaires, lots de 33 et plus décalés de 10 à 110 m, parfois bien plus). 1159 des 1349 valeurs du cache `positions/altitudes_ign.json` étaient décalées ; le cache a été régénéré par lots de 25. Sur les altitudes exactes la liste n'était plus de 16 mais de 17 écarts : quatre faux positifs disparaissaient (Plaines de Poët 878 m pour 880 m, Méruz – Char Marin, Roche Veyrand, Aiguille Grande 76 m), cinq écarts apparaissaient (Manival, Mont Julioz, L'Écureuil et le versant de Peisey-Vallandry, Cuchon). Tous sont tranchés : 0 écart. La règle suivie : on garde la position quand elle est confirmée par un repère indépendant (gare d'arrivée de télésiège OSM, point de ParaglidingEarth, nœud OSM d'un sommet, coordonnées du guide papier) et l'on corrige l'altitude ; on déplace la position quand c'est elle que le repère indépendant contredit.

- **Merlet** (`merlet`) : la fiche FFVL 1115 (recopiée sur les coordonnées du site du club Gratte-Ciel) place le décollage à 1452 m de terrain pour 1600-1691 m annoncés. Le guide « Vol libre au Pays du Mont-Blanc » (2008) donne 45°54'41" N, 6°49'09" E, 1600 m, 10 min à pied du parking du parc animalier : ce point, à 340 m au nord du parc, est à 1710 m de terrain. Position déplacée (800 m), altitude 1650 → 1710 m. `merlet-thermiques-matin` : le texte parle du parc, non du décollage ; position ramenée sur le parc animalier de Merlet (IGN, 1539 m).
- **Dômes de Miage** (`domes-de-miage`) : la position (45°48'54.9" N, 6°47'45.9" E) est le col des Dômes (IGN, 5 m, 3520 m) ; les 3600 m sont l'altitude de la voie vers les dômes. Altitude 3600 → 3520 m.

### 3. Thermiques documentés loin de tout point chaud

Examen des 119 thermiques à plus de 2 km de tout point chaud ≥ 70 % : position contrôlée contre le géocodeur IGN (toponyme à moins de 120 m pour 51 d'entre eux), l'altitude déclarée contre le terrain IGN exact (concordante à 35 m près pour 30 autres) et le relief (croupe, flanc ou creux, orientation). Très peu sont mal placés ; la plupart sont loin des points chauds parce que le site est peu volé, parce que l'ascendance est un plafond ou une relance de haute montagne, ou parce qu'elle vient d'une confluence ou d'une plaine que les traces ne distinguent pas. Le plus proche point chaud ≥ 70 % et la raison sont notés ci-dessous ; un point chaud plus faible (30 à 70 %) à moins de 1 km est mentionné quand il existe.

**Gardés à leur place, avec la raison :**

| Élément | Position vérifiée par | Point chaud ≥ 70 % le plus proche | Pourquoi loin des traces |
| --- | --- | --- | --- |
| `mont-blanc-chamonix/drus-verte-chardonnet` | toponyme IGN « Aiguille Verte » à 62 m | 2,3 km (81 %) | haute montagne (au-dessus de 2600 m : peu de traces) |
| `val-montjoie-saint-gervais/face-est-mont-joly` | toponyme IGN « la Tête du Mottey » à 22 m | 4,0 km (78 %) | site peu volé |
| `val-arly-megeve/mont-joly-derniers-thermiques-megeve` | toponyme IGN « Mont Joly » à 5 m | 2,4 km (78 %) | site peu volé |
| `val-arly-megeve/megeve-thermique-couche-b6` | toponyme IGN « Megève » à 2 m ; la balise B6 n'est pas localisée plus précisément | 2,6 km (83 %) | site peu volé |
