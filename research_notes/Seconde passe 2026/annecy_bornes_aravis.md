# Seconde passe 2026 : lac d'Annecy, Bornes, Aravis (lot `annecy_bornes_aravis`)

Massifs : `lac-annecy`, `bornes`, `aravis`. Fichier de données : `data/annecy_bornes_aravis.json` (81 sources, 12 figures). Recherche faite le 7 octobre 2026, curl + API ouvertes (Overpass/OSM, Biodiv'Sports, KML Google My Maps) ; WebSearch utilisé pour trouver des fils de forum (quota épuisé puis rétabli) ; le navigateur intégré n'a pas pu être utilisé (plafond d'onglets atteint par d'autres agents).

## Volumes avant / après

| Catégorie | Première passe | Seconde passe |
|---|---|---|
| Brises | 6 | 20 |
| Convergences | 1 | 10 |
| Pièges (hazards) | 9 | 39 |
| Thermiques | 4 | 20 |
| Soaring | 4 | 7 |
| Décollages | 10 | 25 |
| Atterrissages | 6 | 15 |
| Effets du vent météo | 10 | 21 |
| Routes de cross | 5 | 12 |
| Conseils | 13 | 37 |
| Sources / figures | 28 / 0 | 81 / 12 |

Alertes `npm run data:build -- --check` sur les trois massifs : **0** (les 8 alertes d'altitude de départ sont corrigées).

## Sources lues, avec ce qu'on y a trouvé

**Cartes et schémas (premier ordre)**
- Carte « Destination Vol Libre / Free Flight Map 2009 », Lac d'Annecy – Massif des Aravis (PDF 2 pages ; copie sur `infos-parapente.com/wp-content/uploads/2021/11/Carte_vol-libre_Bauges_.pdf`, nom de fichier trompeur). Page 1 : flèches de brises de vallée, confluences (flèches bleues), thermiques, dynamiques, CTR, réserves, câbles. Page 2 : 20 fiches avec GPS en degrés-minutes et observations. Quelques coquilles de coordonnées (Sambuy 5b, Crêt du Merle 7a, Faverges F, Cortibot J) : valeurs recoupées avec la FFVL/OSM.
- Même carte en version 2026 sur la page « Cross » des Ailes du Grand-Bornand (image 1920 px), et extraits publiés par Annecy Vol Libre (`brise.jpg`, plan de Doussard, box SIV, CTR, plan de Perroix).
- Google My Maps « Brises des Alpes » de Franck Largeault (KML récupéré) : les polylignes de flèches ont servi aux waypoints (sens = pointe de flèche). Certaines lignes (Faverges → Serraval, Flumet → col des Aravis) ne figurent pas sur la carte 2009 : confiance faible.
- Chamois Volants : plan de l'atterrissage de Perroix.

**Clubs, écoles, fédération, communes**
- FFVL (base `ffvl_sites_alpes.json` fournie par le coordinateur, 61 fiches de l'emprise) : coordonnées, orientations favorables/défavorables, niveaux, dangers, restrictions ; les champs « aérologie » sont tronqués à ~600 caractères (voir « à débloquer »).
- Annecy Vol Libre (règles de trafic de Doussard, atterrissage SIV et box, réserve 200 m, CTR), Annecy Mini Voiles (confluences : principe), Grands Espaces (Forclaz, Planfait, blog), Chamois Volants (sites, arrêté de Talloires 97-2020, espaces aériens : R185, CTR 4000 ft, ZRT, réserve des Bauges, ZSM de l'Arclosan), Annecy Vol de Pente (coordonnées du Semnoz), Bauges Parapente (guide du Semnoz 2026), Les Ailes du Grand-Bornand (Sites, Cross, Faune, Hike & Fly, Météo), Fluide Parapente (La Clusaz), Office de tourisme du Grand-Bornand, lacannecy.com (article d'un moniteur Passagers du Vent).
- Barbules (Site:Annecy, Site:LA CLUSAZ, Site:Le Grand Bornand).

**Presse et récits**
- XC Mag : guide d'Annecy et trois « secret sites » (Entrevernes, Semnoz, Talamarche) ; page du grand tour du lac : payante.
- Infos-Parapente (EN) : sites, aérologie, petit tour, hike & fly.
- Récits : Pays de Gex (202 km, 200 km, 199 km), Thermique Francilien (grand tour du lac), Trace Ta Route (Sulens).

**Forums parapentiste.info** (lus en entier) : cartographie des brises (t35042), régime de vent du lac (t41129), Organisation des brises Bornes–Aravis (t1985, 2006-2009), Vol rando Tournette (t51245), Décollage Bornes (t53318), Sortie à Sulens (t16476), La Clusaz–Aravis (t2599), Grand-Bornand (t15280, t24720, t56767), orage du 13 août 2024 (t64318), fréquentation (t25131), vent de nord (t47738), récit du 5 sept. 2018 (t51881).

**Données ouvertes** : OpenStreetMap/Overpass (import FFVL des décos et atterros avec n° de fiche, sommets, cols, villages, réserves), Biodiv'Sports (polygones des réserves du Bout du Lac, du Roc de Chère, de la RNCFS des Bauges, arrêté du Semnoz).

## Changements par rapport à la première passe

**Corrigé**
- Les 8 alertes d'altitude : Dents de Lanfon (sommet OSM 6.2416, 45.8612), Semnoz Ouest (coordonnées du gestionnaire AVP 6.0911, 45.805 ; 1480 m), Verthier (hameau OSM 6.2329, 45.7877 ; le lien Géoportail de Barbules tombait sur la pente), Pointe de Talamarche ×2 (sommet OSM 6.2569, 45.8596), Le Lachat du Grand-Bornand (6.4765, 45.9586 ; l'ancienne position était à ~6 km), Beauregard (gare de la télécabine 6.4064, 45.8937, hiver), Petit Sulens (OSM 6.3677, 45.823).
- Forclaz : coordonnées FFVL/OSM/carte 2009 (6.2469, 45.8142) au lieu des valeurs arrondies de Barbules (~1,1 km au nord-est) ; Coche Cabane, Planfait, Perroix, Doussard, Marlens (atterrissage 6.341, 45.7625, à ~1,3 km de l'ancienne position), Crêt du Merle (6.4406, 45.8966), Potais (FFVL 6.4624, 45.9357 ; les coordonnées publiées par le club sous « Potais » sont celles du sommet du Lachat).
- **Doussard** : la première passe appliquait au terrain principal « technique, turbulent par NE » ; Annecy Vol Libre le dit de l'atterrissage SIV. Grands Espaces décrit le terrain principal comme assez facile, aligné sur la brise, peu de gradient ; Annecy Vol Libre dit la brise « souvent soutenue » ; Delta Évasion « douce et stable » : trois versions gardées, confiance moyenne. Ajouts : effet du Roc des Bœufs par NE fort (vent de NO à l'atterrissage), grue et chantier, branche vent arrière côté Entrevernes.
- **Entrevernes** : la FFVL indique le terrain fermé par arrêté municipal, alors que les sources touristiques et XC Mag le citent encore : conservé avec l'avertissement.
- Bise : le texte « Coche Cabane/Forclaz forts rouleaux » est attribué à Coche Cabane (FFVL 1259 et carte 2009), ambiguïté levée ; le désaccord sur la face du Roc des Bœufs (ouest éclairée / face est raide) est signalé et le point de passage utilisé est la crête face au lac.
- Grand tour : distances recalculées sur les points ; R185, CTR à 1220 m, TMA de Chambéry en hiver ajoutés.

**Ajouté**
- Brises : bras du lac (Saint-Eustache, Duingt, Chevaline), vallée de Faverges jusqu'à Ugine, Tamié, Albertville → Ugine, pente du Semnoz, Fier (Annecy → Thônes), Borne (Entremont), Thônes → Saint-Jean-de-Sixt → La Clusaz → col des Aravis, Saint-Jean → Grand-Bornand, Bouchet, Manigod, col du Marais/Serraval, Faverges → Serraval, Flumet → col des Aravis.
- Convergences : Veyrier/Menthon, Menthon/Talloires, Duingt, Ugine (carte 2009), col de la Forclaz (principe), Bluffy (forum), Mont Lachat de Thônes (récit), Serraval, col des Aravis (hypothèses, confiance faible).
- Pièges : CTR d'Annecy, R185, réserves du Bout du Lac et du Roc de Chère, RNCFS des Bauges, ZRT Faverges–Albertville, ZSM de l'Arclosan, aéromodélisme du Semnoz, box SIV, câbles de la Tournette et du Parmelan, orage du 13 août 2024, venturi Sulens–La Tulle, brise du col des Aravis, foehn de La Clusaz, Jalouvre sous le vent, Pointe Percée, Tête à Turpin, patinoire du Grand-Bornand.
- Décollages : Semnoz (officiel + delta), col des Frêtes, Tournette (col du Varo, NE), Crêt des Mouches, Sambuy, Marlens, Anglettaz, Lachat de Naves, Crêt du Loup, Aiguille des Calvaires, Étale, Balme (hiver), Méruz. Atterrissages : SIV, Lathuile, Gruffy, Pré Bollay, Villaz, Cortibot, patinoire, col du Marais, etc.
- Routes : petit et grand tour refaits, Semnoz–Revard, Bauges–Lanfon–Parmelan, triangle Tournette–Pointe Percée, Talamarche–Tournette, Annecy–Aravis, Méruz–Charvin–Dent de Cons, 202 km côté Aravis, tour de la vallée du Grand-Bornand, Lanfonnet–Cotagne–Croix-Fry–Étale (plan évoqué, confiance faible), Planfait–Sulens–Jalouvre (récit 2018).

**Retiré** : rien n'a été retiré. Les anciennes positions fausses sont corrigées sur place ; les ids existants sont conservés.

## Figures déclarées (12)

F1 (carte 2026 du club du Grand-Bornand : brises, confluences, thermiques, CTR, réserves), F2 et F3 (carte 2009 pages 1 et 2), F4 (brises locales, Annecy Vol Libre), F5 (plan de l'atterrissage de Doussard), F6 (CTR et réserve), F7 (plan de Perroix), F8 (Google My Maps de Largeault), F9 et F10 (mêmes cartes pour les Bornes et les Aravis), F11 (box SIV), F12 (fiches du Grand-Bornand et de La Clusaz).

## Ce qui reste à vérifier

- Heures et vitesses des brises : aucune source ne donne de mesure ; les valeurs 15/25 km/h du lac et de Faverges sont des interprétations (« soutenue »).
- Brises Faverges → Serraval, Flumet → col des Aravis, Parmelan → Dingy, Entremont : géométrie seulement (carte/KML), sans texte de club.
- Glières, Sous-Dine : aucune fiche de décollage ni description trouvée ; seuls des spirales de thermiques sur la carte 2009 et des points de virage de triangles.
- Salève : traité par le lot `chablais_giffre_arve` (massif `saleve-genevois`).
- Plan de vol : il n'existe pas de « plan de vol » réglementaire sur le lac d'Annecy dans les sources lues ; les règles de trafic sont celles de l'arrêté de Talloires 97-2020, de la fiche de Doussard et du panneau FFVL (circuits d'approche, couloirs de décollage, régulateur, box SIV, réserve à 200 m/sol).
- Contours exacts des ZSM gypaète (Arclosan, Bargy/Jallouvre) : l'API Biodiv'Sports n'en renvoie pas ; positions indicatives.
- Forum 2006-2007 (Organisation des brises Bornes–Aravis, La Clusaz) : anciens, conseils de pilotes ; à recouper (le déco du Crêt du Loup / combe de Borderan a pu évoluer).
- Atterrissage de Lathuile et de l'Étale (Barbules/carte 2009) : statuts actuels non vérifiés.

## URL bloquées ou échecs (aussi dans `.cache/research/blocked_urls.txt`)

- FFVL `federation.ffvl.fr/terrain/NNNN` et `sites_pratique/voir/NNNN` : 403 Cloudflare en curl ; champs « aérologie » complets de 1447, 1260, 1186, 5078, 2251, 1259, 1154 à lire.
- toutleparapente.fr : images des cartes d'Annecy en 404 (hotlink) ; `lac-annecy.com/.../carte-vol-libre.pdf` en 404.
- XC Mag « Le Grand Tour du Lac » : payant. ParaglidingEarth (pages de site) : réponse vide.
- Règlement complet des sites de Talloires-Montmin et Doussard : seul le titre de l'image a été récupéré.

## Thermiques et points de relance (passe complémentaire)

Passe du 7 octobre 2026 (brief « thermiques et points de relance »). Thermiques avant / après : lac-annecy 6 → 17, bornes 5 → 9, aravis 9 → 17 (+ 11 descriptions complétées sur des thermiques existants, 2 routes ajoutées côté Bornes, points de passage ajoutés aux routes du petit tour, du grand tour, Annecy–Aravis et tour de la vallée du Grand-Bornand, 2 pièges, 2 figures F13 et F14). `npm run data:build -- --check` : aucune alerte.

**Documents relus** : tous les textes de `.cache/research/docs/annecy_bornes_aravis/` (forums t1985, t2599, t15280, t24720, t2225, t64318 ; récits Pays de Gex ; Thermique Francilien ; Trace Ta Route ; Bauges Parapente ; Grands Espaces ; XC Mag ; Infos-Parapente ; cartes 2009 en image), plus les sources récupérées ce jour (S82 à S95) : topos du forum sur la traversée Veyrier–Semnoz, le raccrochage de la Forclaz, le Roc des Bœufs, Aravis–Parmelan, Charvin–Tournette ; carnets de vol de F. Largeault ; Absolu Parapente ; cartes thermiques des Ailes des Aravis (images lues).

**Ajoutés**
- Petit tour : pointe de la Rochette (thermique de service du déco), Lanfonnet face ouest, épaule de Planfait vers les Dents, Bluffy (remonte-pente nord-ouest des Dents), première ligne THT du Roc des Bœufs, combe de Coche Cabane (relance basse sous la Forclaz), Entrevernes nord. Rocher du Roux, Dents, Roc des Bœufs, Tournette complétés (rôle, plafonds, pièges).
- Grand tour : thermique du téléphérique du Veyrier (confiance moyenne), Quintal / ligne électrique (Semnoz nord), face ouest du Semnoz devant l'aéromodélisme, Mont Baret (confiance basse).
- Bornes : col du Pertuis / falaise ouest du Parmelan, pente nord du Lachat de Thônes, pointe de la Buffaz ; routes « Dents → Parmelan » et quadrilatère de 81 km de 2005.
- Aravis : Vierge du Châtelard (position corrigée, OSM), combe de Borderan, pente du Crêt du Loup, Merdassier, Tardevant, Danay, Jalouvre, Buclon ; piège des Quatre-Têtes tard.

**Confiance** : plusieurs récits concordants ou récit précis → medium ; point cité une fois, sans lieu net → low. Deux points sont des hypothèses d'exposition (confiance low, « déduction ») : face ouest du col de la Croix-Fry, relances de crête du Danay non précisées ; les autres reposent sur au moins un récit. Bois du Mont (dynamique par brise de nord) ajouté d'après le forum t1985.

**Positions approximatives** (`coord_quality: approx`) : épaule de Planfait, Bluffy, téléphérique du Veyrier, Quintal (la ligne n'est pas localisée), aéromodélisme du Semnoz, première ligne THT du Roc, combe de Coche Cabane, combe de Borderan, face nord et pointe du Lachat de Thônes, Danay.

**Introuvable ou hors lot** : Roc de Lancrenaz (cité par le forum t54898, absent d'OSM/Nominatim) ; « l'Aiguille » à l'est de la Tournette (forum t1985) ; Julioz, Colombier, Dent de Rossanaz, Chabert, Margériaz et Bange (relances du passage Semnoz → Roc des Bœufs → Bauges, décrites dans le forum t52861 et le carnet de Largeault) : à traiter par le lot Bauges. Les récits les plus détaillés du cheminement Étale–La Clusaz datent de 2005-2007.

**URL bloquées** : fiches CFD `parapente.ffvl.fr/cfd/liste/vol/20350010` et `.../20212016` (Cloudflare, traces et commentaires du Semnoz → Revard → Roc des Bœufs) ; pages YouTube (descriptions des vidéos de petit tour, grand tour, Annecy–Aravis) illisibles par curl.

## Audit des thermiques (octobre 2026)

Les listes de lacunes (`docs/COUVERTURE.md`, `docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`) ont été reprises pour Lac d'Annecy, Bornes et Aravis. Règle de confiance : `medium` quand un texte nomme le lieu, `low` avec « déduction » quand seul un point chaud kk7 (traces GPS, `thermal.kk7.ch`) et le relief l'indiquent. Les toponymes proches de chaque point chaud viennent d'OSM, les altitudes du terrain IGN (RGE ALTI).

### Lac d'Annecy (`lac-annecy`)

**Thermiques créés (7)**
- `marlens-col-de-lepine-thermique` (`medium`) : le décollage de Marlens (FFVL 1730) décrit « vol thermique le matin, départ de cross vers les faces est des Bauges » ; point chaud kk7 à 90 % à 250 m (94 % le matin), qui correspond.
- `doussard-thermiques-bout-du-lac` (`low`) : le piège de l'atterrissage de Doussard cite « de larges thermiques entre l'atterrissage et le lac » par NE fort ; position déduite, aucun point chaud mesuré.
- `annecy-ville-vieille-ville-gare` (`medium`) : topo cité sur parapentiste.info t2807 (« le meilleur se situe entre la vieille ville et la gare », « nouvelles galeries » en second) + point chaud kk7 à 83 %. C'est le relais urbain de la traversée Veyrier → Semnoz, qui n'était décrit qu'en texte.
- `seynod-vieugy-zone-industrielle` (`low`), `quintal-la-platiere` (`low`) : trois points chauds ≥ 90 % de Seynod et de Quintal (95 à 90 %, de midi au soir) sur le trajet « derrière la Visitation au-dessus de la zone industrielle » puis « jusqu'à la ligne de Quintal » du même topo, qui juge qu'« avant la ligne il n'y a rien de bien flagrant » : mesurés, non décrits.
- `mont-durant-semnoz-sud-ouest` (`low`) : point chaud 95 % au sud du Semnoz, aucun texte.
- `marlens-les-devants-rosset` (`low`) : point chaud 92 % à 1,7 km à l'est du décollage de Marlens, aucun texte.
- (Dans `bornes`, voir plus bas : `tournette-col-du-varo-thermique` et `serraval-aiguille-chappet`.)

**Positions corrigées** : `semnoz-combe-thermique` (altitude 1450 m = celle du décollage ; combe 185 m plus bas, position ramenée sur le point chaud kk7 de la combe, 94 %, terrain 1305 m). Les deux autres écarts ne demandent rien : `roc-des-boeufs-ouest` (sommet OSM) et `roc-des-boeufs-premiere-ligne-ht` (lignes THT non localisées dans le dossier ; position sur la crête, `approx`) sont loin d'un point chaud parce que ces crêtes sont surtout volées en dynamique.

**Lacunes écartées** : aucune ; le point chaud de la Tournette – col du Varo et celui de Serraval, comptés par la couverture dans ce secteur, sont traités dans `bornes`.

### Bornes (`bornes`)

- Créés : `tournette-col-du-varo-thermique` (`low`, 96 % de midi au soir, pierriers sous les Rochers du Varo ; rattaché au décollage de rando-vol « La Tournette – col du Varo » déjà dans le massif) et `serraval-aiguille-chappet` (`low`, 94 % sous l'Aiguille de Serraval).
- Écarté : `bois-du-mont-thones-dynamique` (loin d'un point chaud) : le forum décrit une reprise en dynamique, pas un thermique ; position approximative conservée, pas de point chaud kk7 à moins de 2 km.

### Aravis (`aravis`)

**Thermiques créés (4)** : `meruz-char-marin` (`low`, 96 %, le matin, au pied du Charvin ; le récit du 199 km dit « l'extraction est difficile à Méruz » et attend les barbules du Charvin à 10h30), `praz-vechin-aiguille-du-bouchet` (`low`, 84 %, 600 m du décollage de Méruz : c'est le point chaud que COUVERTURE signalait derrière le mot « bulle »), `col-du-passet-tardevant` (`low`, 95 %, dans « les combes » du récit de 2018 vers la Pointe de Tardevant), `le-treu-nant-pareux` (`low`, 92 %).

**Position corrigée** : décollage `etale-telepherique` : la position de Barbules (1782 m au terrain pour 2000 m déclarés) est ramenée sur la station « Belvédère » (OSM), au sommet du téléphérique (1979 m).

**Lacunes écartées** (textes qui parlent d'un thermique) :
- `aravis-confluences-no` : localisation générale de la chaîne, « thermique » n'y désigne qu'une journée forte ; aucun lieu.
- `col-des-aravis-brise-col` et `col-des-aravis-choix-versant` : pièges du col des Aravis ; le thermique de la Vierge du Châtelard, décrit dans `col-des-aravis-vierge` à 1,2 km, porte déjà ce même fil de 2007.
- `aravis-quatre-tetes-trop-tard` : zone sous le vent (« thermiques poussifs et petteux sous le vent ») donnée comme piège, pas comme relance.
- `sulens-la-tulle-venturi` : venturi ; le thermique de Sulens est décrit à 1,9 km.
