# Seconde passe : lot bauges_bourget_combe

Massifs : `bourget-chambery`, `combe-de-savoie`, `bauges`. Fichier de données : `data/bauges_bourget_combe.json` (version complète, remplace la première passe). Documents récupérés : `.cache/research/docs/bauges_bourget_combe/` (PDF, images CHVD, KML Largeault, scripts de génération dans `gen/`).

## Volumes avant / après

| Catégorie | Bourget | Combe | Bauges |
|---|---|---|---|
| brises | 2 → 5 | 1 → 4 | 1 → 8 |
| convergences | 0 → 1 | 0 → 0 | 1 → 5 |
| pièges | 1 → 14 | 1 → 7 | 1 → 17 |
| thermiques | 0 → 3 | 0 → 3 | 0 → 2 |
| soaring | 0 → 4 | 0 → 2 | 0 → 3 |
| décollages | 0 → 12 | 0 → 7 | 1 → 8 |
| atterrissages | 0 → 9 | 0 → 5 | 0 → 3 |
| effets synoptiques | 0 → 8 | 0 → 5 | 0 → 6 |
| routes de cross | 0 → 3 | 0 → 3 | 0 → 3 |

Sources : 25 → 95. Figures déclarées : 25 (chaque figure multi-secteurs est éclatée en une entrée par secteur, car le contrôle `--check` cherche les éléments dans le secteur de la figure).

## Sources lues (ce qu'on y a trouvé)

- **CHVD, « Le passage de la Savoyarde »** (22/06/2020), lu en entier, 6 images regardées. Deux brises distinctes, 25/30 km/h : la brise de la cluse de Chambéry (deux branches, Albertville et Grenoble ; la branche Albertville coupe le virage par-dessus la Savoyarde et déferle derrière Montmélian) et les langues d'Annecy qui redescendent les vallées intérieures des Bauges ; rencontre à la Savoyarde. Venturi maximal au rocher de la Savoyarde ; épaule NO du Montgelas au vent (dynamique) ; vallon Mont Saint-Michel/Montgelas = cisaillements ; bande de vignes ; zone sous le vent de Montmélian mortelle (années 1990) ; TMA (FL95 au Granier, week-ends de saison de ski). Figures F1 à F5.
- **Carte PNR Bauges 2011** (reproduction 1200 px sur bauges-parapente.com), lue par recadrages 3x : grandes flèches de brise (Aix → Chambéry le long de l'aéroport ; lac d'Annecy → col de Leschaux → Lescheraines → Le Châtelard → École/Sainte-Reine/Aillons ; Sonnaz/Chambéry → Saint-Jean-d'Arvey → Thoiry ; Curienne → La Thuile ; Montmélian → Combe), petites flèches bleues de confluence (Revard/Trévignin, Arith/Le Noyer, Thoiry et col des Prés, Mont Morbier/col du Frêne, Savoyarde/Montgelas), symboles « aérologie dangereuse » (Saint-Jean-d'Arvey, Savoyarde), spirales thermiques, encart « pas de vols en vallée au-dessus de Chambéry ». Figure F6.
- **Carte Google My Maps de F. Largeault** (EPIC Chambéry), KML de 293 tracés orientés (pointe de flèche en dernier) : fournit les coordonnées des flèches PNR. Lignes utilisées : Bauges `Line 5` à `Line 28`, `Roc des boeufs`, `Semnoz-Lescheraines`, `Chambé-Albé`, Lauzière `Line 2`. Les extrémités de `Line 10` (col de Plainpalais) et `Line 15` (col du Frêne) tombent exactement sur les cols de Wikipédia, ce qui valide la lecture. Figure F8. Ce n'est pas une source indépendante de la carte PNR (compilation).
- **Bauges Parapente, « les 7 outils météo »** (2026), lu en entier : brises 30-35 km/h, pièges « scotché » (École, Aillons, Lescheraines, Allèves), confluences prévisibles (sommet du Margériaz, col du Frêne, secteur d'École), vent N/S plus fort à l'ouest du massif, brise renforcée par vent de nord.
- **Carte Annecy-Aravis 2009** (le PDF « Carte_vol-libre_Bauges_ » d'infos-parapente.com) : ce n'est pas la carte du PNR des Bauges mais celle de l'office d'Annecy ; on y lit les flèches des Bauges nord (col de Leschaux, Lescheraines, Faverges-Tamié, Ugine). Figure F7. Un second PDF du CDVL (« Carte_depliant_Bauges_ ») est la carte de la Réserve (randonnée), sans brises.
- **PDF St Hil'Air « Cross, massifs et transitions »**, pages 8, 11, 21 à 24, 26, 27, 34, 35, 40, 44, 45 regardées : Épine (p. 8), Bauges (p. 11 : venturis aux cols du Frêne et de Tamié, sous le vent à la Savoyarde et au Roc des Bœufs), transitions Chambéry (p. 22), Cœur de Savoie (p. 23), Grand Arc (p. 26), triangles CFD. Figures F9 à F13.
- **Fiches FFVL** lues via le navigateur (Cloudflare bloque curl, mais l'origine federation.ffvl.fr répond en `fetch` interne) : 50 fiches environ (Le Chat, Épine, Vérel, Sire, Revard, Sapenay, Montlambert, Chamoux, Arclusaz, Margériaz, Colombier, Trélod, Croix d'Allant, École, Compôte, Aillons...). Coordonnées et orientations : `ffvl_sites_alps.tsv` ; textes complets : navigateur (le JSON local tronque à ~400 caractères).
- **Clubs** : Z'éléphants Volants (Vérel, Sire, atterros, zones aériennes, récit Vérel-La Mer), Montlamb'air (Montlambert, Chamoux), Ailes du Lac (Province/Épine, Banchet), Entre Ciel et Terre (Revard), Volants Bauges (bulles de quiétude, Réserve, sites), CDVL Savoie (Parc des Bauges).
- **Récits** : Bluehouse 201 km (2024), Pays de Gex 202 km (2019), carnets Largeault 162 et 186, Zeleph Vérel-La Mer.
- Autres : ParaglidingEarth (API bbox), Wikipédia (coordonnées par l'API), zones aériennes FFVL du dépôt (CTR/TMA Chambéry, polygone RNCFS), MNT du dépôt pour recaler les points de la Savoyarde.

## Changements par rapport à la première passe

**Corrigé**
- `reserve-bauges-300m` : le marqueur était vers (6.17, 45.68) ; le polygone FFVL de la RNCFS est centré à (6.226, 45.684). Ajout des exceptions Trélod et faces est (Arclusaz → falaise de la Charmette).
- `convergence-savoyarde` : le segment Challes–Montmélian servait de substitut ; remplacé par un segment sur l'épaule NO du Montgelas, positionné avec le MNT (crête ~1240 m). La carte PNR confirme que la confluence est sur le Montgelas.
- `venturi-pointe-so-bauges` : déplacé de Challes vers le rocher de la Savoyarde (6.04, 45.518, approximatif).
- `sous-le-vent-montmelian` : coordonnées de Montmélian (Wikipédia).
- `brise-cluse-chambery` : tracé réel (Aix → Chambéry → Challes → Les Marches, point de partage) au lieu de coordonnées de mémoire ; la divergence est aux Marches, pas à Montmélian.
- `branche-albertville` : géométrie 'Chambé-Albé' (elle passe au sud de Montmélian) ; vitesse maximale portée à 35 km/h (Chamoux « très forte »).
- `langues-annecy-vallees-bauges` : la première passe devinait les vallées ; le tracé suit col de Leschaux, Lescheraines, Le Châtelard, La Compôte, Jarsy (PNR + CHVD).
- `brise-lac-bourget` : les phrases de l'école de baptême (« couloir thermique naturel », « légère brise fraîche du lac ») ne sont plus sur la version 2026 de la page ; la brise de lac est maintenue en confiance moyenne sur le seul tracé Largeault/PNR (axe du lac vers Chambéry), avec la source commerciale retirée.
- Source S11 : le PDF infos-parapente.com est la carte Annecy-Aravis 2009, pas la carte PNR Bauges ; titre et notes corrigés.
- `revard` : déplacé de `bauges` vers `bourget-chambery` (« Revard côté lac »), même identifiant.

**Ajouté** : tout le reste (voir tableau) : décollages et atterrissages FFVL avec `ffvl_id`, brises de pente et de combe, confluences du Margériaz, du col du Frêne, d'École, de Lescheraines et du Revard, venturis, bulles de quiétude, espace aérien Chambéry, Galoppaz/Puygros interdits, atterro des Aillons, effets du vent météo par direction, routes de cross (transition Savoyarde, petit tour des Bauges, A/R Vérel-Semnoz, Épine-Dent du Chat, triangles St Hil'Air, retour par la Combe, transition Grand Arc, Bauges-Bornes).

**Retiré** : rien n'a été démontré faux. Les tips de la première passe sur « zone non documentée » (Vérel) ont été remplacés par des tips sourcés.

## Figures trouvées

F1 à F5 (CHVD, Savoyarde), F6 (PNR 2011), F7 (Annecy-Aravis 2009), F8 (Largeault), F9 à F13 (St Hil'Air p. 8, 11, 22, 26, 23). Chaque figure multi-secteurs apparaît une fois par secteur (suffixes `-bourget`, `-combe`, `-bauges`).

## Ce qui reste incertain ou à vérifier

- **Lac du Bourget** : aucune source de pilote ne décrit un front de brise de lac ; seules l'orientation de la flèche Largeault/PNR et la mention « régime de brise N/NO » de la fiche du Mont du Chat existent. Aucune information sur la Dent du Chat comme site (pas de fiche ; seul le décollage du Mont du Chat, FFVL 1452). Bange et la tour de l'angle est du Revard (tour des Ébats) ne sont pas localisés.
- **Positions approximatives** : toutes les flèches de confluence et les symboles « aérologie dangereux » viennent d'une carte illustrée non géoréférencée ; elles portent `coord_quality: approx` ou `confidence: low`. Montgelas, Savoyarde et Pic de la Sauge sont placés d'après le MNT (crête) sans coordonnée publiée. Le Pic de la Sauge, le Mont Charvet et Brâme-Farine n'ont pas de coordonnée sûre (non placés ou approximatifs).
- Le triangle p. 44-45 (Montlambert) : seules les balises Tamié et Parmelan sont lisibles ; distances de la source (107,26 km), pas recalculées.
- Colombier : l'altitude FFVL (1030 m) est incohérente avec le sommet (~1998 m) ; 1998 m retenu (PGE).
- Sous-estimation possible côté Combe : la carte toutleparapente de Belledonne (flèches de la Combe, erreur de sens signalée par l'auteur) n'a pas pu être lue.
- Brise du Grésivaudan : pas traitée ici (lot Chartreuse/Grésivaudan) ; seule la partition aux Marches l'est.
- Combe de Savoie : pas de confluence documentée dans la Combe elle-même (la confluence du col du Frêne est classée dans les Bauges) ; la branche vers la Maurienne (Aiguebelle, vallée des Huiles) vient du seul KML et recoupe le lot Maurienne.
- Le polygone RNCFS provient du fichier d'espaces aériens du dépôt (tracé FFVL 2019/2021), pas de la carte PNR 2011.

## URL bloquées ou échouées

Voir `.cache/research/blocked_urls.txt` : carte PNR 2011 d'origine (parcdesbauges.com, 403), téléchargements Jimdo de toutleparapente (renvoient du HTML), ancienne URL lac-annecy.com (404), récit tichodromes (DNS), FFVL en curl (Cloudflare ; navigateur OK). Nominatim a renvoyé 429 après huit requêtes ; Overpass a expiré : les coordonnées de villages viennent de Wikipédia.
