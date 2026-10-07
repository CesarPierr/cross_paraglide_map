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
