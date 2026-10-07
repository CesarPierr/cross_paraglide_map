# Seconde passe 2026 : provence_maritimes

Massifs : `saint-andre-verdon`, `haut-verdon-allos`, `prealpes-digne-lure`, `prealpes-grasse-castellane`, `prealpes-nice-var`, `mercantour`.
Fichier de données : `data/provence_maritimes.json` (97 sources, 4 figures). `npm run data:build -- --check` : aucune alerte sur ces massifs.

## Volumes avant / après (6 massifs cumulés)

| Catégorie | Avant | Après |
|---|---|---|
| brises | 10 | 24 |
| convergences | 1 | 11 |
| pièges (hazards) | 2 | 44 |
| thermiques | 1 | 18 |
| soaring / restitution | 1 | 13 |
| décollages | 3 | 54 |
| atterrissages | 2 | 38 |
| effets du vent météo | 3 | 36 |
| routes de cross | 0 | 20 |
| conseils | 9 | 44 |
| sources | 21 | 97 |
| figures | 0 | 4 |

## Sources lues (avec ce qu'on y a trouvé)

**Saint-André / Chalvet**
- Aérogliss, pages « site », « atterrissages », « infos pilotes », « tutoriels » (curl, lues en entier) : déco principal 1540 m dès 11 h, brise 25-30 km/h en conditions établies ; déco N sur le même dôme face à l'Issole ; atterro du lac 880 m (brise « classique » du lac vers Saint-André, marquée en fin d'après-midi, turbulent par N/NO, 3 manches) ; Moriez (brise canalisée de Moriez vers Saint-André) ; La Mure-Argens réservée aux planeurs ; navettes ASAVL ; réserve de coqs de bruyère.
- CHVD, topo « Le Chalvet » (2024) : déco S 1547 m, brise du lac renforcée dès midi, col des Robines et falaises turbulents, atterros Saint-André / La Mure (planeurs, interdit) / Moriez.
- FlyStAndre (site hors ligne, lu via archive.org) : « Tips for safe flying », « XC tips », « Le Chalvet : site intro », « XC inspiration ». C'est la source qui lève l'ambiguïté du « vent de lac » : un **vent de sud remonte de Castellane par le lac** dès ~10h30, un **vent d'ouest de Barrême franchit le col des Robines** et les deux se rencontrent presque au-dessus du terrain d'atterrissage (convergence modélisée), avec seuils de vent (N/NNO/S/SSO/SO > 15 km/h, NNE/E/ESE > 10 km/h).
- XC Mag (guide Saint-André : vent de vallée du bassin de Digne au SO, déco SO soufflé dès ~13h30 ; guide Gréolières), APPI (fiche du site), Ozone InfoZone (copies Wayback 2019), ParaglidingEarth (API).
- Forum parapentiste.info : fil « Cross Saint-Vincent – Saint-André » (confluence dans la vallée de Thorame et entre Cordeil et Maurel).

**Haut-Verdon, Digne, Sisteron, Lure**
- Fiches FFVL (extraction locale `ffvl_sites_alpes.json`) : Digne (Andran, Cousson, Villevieille, Courbons, Champourcin), Sisteron / Gâche / Sumiou / Saint-Geniez, Oraison / Malijai, Banon (Grou de Bane) / Contras, Moustiers / Aiguines, Foux d'Allos.
- Catalogue du vol libre (pages Dept-04) : Cousson (onde-rotor du soir), La Baume (sous l'onde par Mistral), plan d'eau de Sisteron (confluences), Archail.
- Forum : Gâche (brise brassée Sisteron → Motte-du-Caire et débord de Saint-Geniez), Sumiou (sous le vent de Lure), Banon / Rustrel, Oraison, Allos / Haut-Verdon.

**Préalpes de Castellane et de Grasse, Nice**
- **Au gré de l'air** : page « Les vols de distance » lue en entier (Gréolières – Coursegoules, Col de Bleine – Saint-André A/R 70 km, Col de Bleine – Morgon A/R 175 km, venturi des Lattes et du col de Saint-Barnabé, confluence col de Vence × gorges du Loup) ; page « Les sites de vol » ; PDF Armant « Gourdon – Saint-Jeannet » (2006) et Dijols (2017, sept vaches avec GPS) ; récits PDF de Jacqueline (9 avril 2011, 28 mars 2012) et de Salvi (2009, 2011, 2012).
- Ozone InfoZone : Gourdon (convergence « souvent au-dessus du site »), Col de Bleyne (convergence mobile E/O au champ), Gréolières, Lachens, Éze, Roquebrune, Moustiers.
- myniceflights.com (P. Salvi) : guide Roquebrune et récits (Esteron, Var, Mercantour, Sospel).

**Mercantour**
- Ozone (Auron, La Colmiane, Tende, Sospel), fiches FFVL (Roya, Sospel, Colmiane), Sospel Vol Libre (brise SE de Vintimille, entrées maritimes, TMA 9, Lombarde, repli sous Mistral), catalogue (Auron, Beuil, Colmiane, Tende).
- **Biodiv-Sports** (API) : polygone du cœur du Parc national du Mercantour avec la règle « survol non motorisé interdit à moins de 1000 m du sol », zones de nidification du vautour fauve / aigle royal (PNR du Verdon, 1er janvier – 31 août) autour de Moustiers, Aiguines et des gorges du Verdon, zones de quiétude du lagopède alpin à la Cayolle.

## Changements par rapport à la première passe

**Corrigé (coordonnées, 5 éléments signalés)**

| Élément | Avant | Après |
|---|---|---|
| `chalvet-sud-ouest` | sans coordonnées | 6.4799, 43.9786 (FFVL 5072 = PGE 21277 = OSM way 27001810 « Décollage Chalvet Ouest ») |
| `chalvet-sud-est` | sans coordonnées | 6.4914, 43.9766 (FFVL 5168, 1515 m) |
| `brise-forte-deco-so` | sans coordonnées | 6.4799, 43.9786 |
| `chalvet-restitution-soir` | sans coordonnées | 6.4799, 43.9786 |
| `greolieres-cretes` | sans coordonnées | 6.9852, 43.8165 (FFVL 914 « 1000 Cheiron » = « Jérusalem » d'Ozone / OSM 6.9849, 43.8168), orientations SE/S/SO |

Autres corrections : `atterro-lac-saint-andre`, `atterro-lac-turbulent`, `atterro-lac-thermique` passent du centroïde du village à 6.5098/43.9588 (FFVL 5073 = PGE = Ozone, 880 m) ; `atterro-moriez` du centroïde communal à 6.4773/43.9616 (FFVL 5169) ; les villages des brises deviennent des nœuds OSM / GeoNames. L'altitude du Chalvet (1540 / 1547 / 1555 / 1568 m selon Aérogliss / CHVD / PGE / FFVL) est notée dans la description ; la valeur retenue est 1555 m (PGE) pour le déco SO. Le conflit de la première passe « sommet 1613 m vs 1500 m » est tranché : sommet OSM 1609 m (déco O = 1540-1568 m).

**Clarifié** : le vent « de mer » de Saint-André décrit par les agrégateurs n'est pas de l'air marin : c'est le vent de vallée du Verdon (sud, de Castellane par le lac) et la brise du bassin de Digne par Barrême. La brise de mer est localisée dans les Préalpes de Grasse (convergence de Gourdon), à Bleine (« peu soumise aux influences maritimes ») et dans le Var / Roya / Bévéra. Le front de brise de mer indicatif reste de confiance basse et est recoupé par la convergence documentée de Gourdon.

**Ajouté** : 3 breezes à Saint-André (brise d'ouest de Barrême, deux brises de pente du Chalvet), convergence du terrain, pièges (col des Robines, Mistral aux décos, La Mure-Argens interdit depuis le 1er mai 2024, zone R196C, venturi des Lattes / Saint-Barnabé, TMA de Nice, camp du Lachens, parc national, zones faune), 54 décos et 38 atterros (FFVL / PGE / OSM / Ozone / vaches de Dijols), 20 routes de cross, effets du vent météo par direction (dont Mistral et Lombarde).

**Retiré** : rien de faux n'est retiré ; les 9 conseils de la première passe (altitude contradictoire, « convergence majeure non localisée »…) sont remplacés par des conseils sourcés. L'élément `thermal_spots` « Rochecline » et « Maisons Bulles », sans coordonnées retrouvées, est décrit dans une route / un conseil au lieu d'un point.

## Figures

- **F1** (FlyStAndre, copie Wayback) : carte des points chauds thermiques d'octobre autour du Chalvet (axe Chalvet – Reynière – Charvet – Cheval Blanc – Dormillouse, Chamatte, Coupe, Mouchon) ; extraction : relais thermiques et routes (pas de flèches de brise dessinées).
- **F2** (FlyStAndre) : cinq exemples de circuits de 31 à 110 km sur la même carte ; pas de mise en correspondance certaine titre/image.
- **F3** (PDF Armant, p.1 et 3) : carte annotée Gourdon – Saint-Jeannet (atterros numérotés, zones d'ascendance A-P, transitions) ; extraction : baous, Courmettes, route Gourdon – Saint-Jeannet.
- **F4** (Au gré de l'air) : carte de densité de traces Gréolières – Bleine – Teillon – Saint-André – Dormillouse – Savines.
Aucun schéma annoté de flèches de brise de mer (type PDF de formation) n'a été trouvé pour ce lot ; les formulations de convergence viennent des textes (FlyStAndre, Au gré de l'air, Ozone, myniceflights).

## Ce qui reste à vérifier / lacunes

- **Valberg, Isola, Péone, Vésubie, Haut-Verdon (Beauvezer, Colmars, Thorame)** : aucun site FFVL ni topo retrouvé ; seuls des renvois de forum (déco à Beauvezer et Thorame, non localisés) ; Rochecline non localisé ; Chalvet Nord et Courmettes (antennes) approximatifs.
- Positions des convergences : tracés indicatifs (mention dans `usage`) ; la position réelle du front de brise de mer vers Bleine / Saint-André n'est pas documentée.
- Divergences d'altitude entre sources notées dans les descriptions (Chalvet, Gréolières 300, Bleine 1501-1525, Archail 1048 vs 1720).
- Vitesses de brise : peu de valeurs chiffrées dans les sources ; les valeurs données sont des interprétations signalées.
- Mistral à Lure / Digne : seulement des indices (La Baume sous l'onde, Cousson onde-rotor du soir, Sumiou).

## URL bloquées ou non lisibles

Voir `.cache/research/blocked_urls.txt` (lignes `provence_maritimes`) : fiches FFVL et actualité PNM (Cloudflare), compte rendu CDVL06 (vide), sites de la ligue PACA et des CD 04/06, `flystandre.com` (hors ligne, copies Wayback utilisées), page Ozone actuelle (vide), Parapente Mag hors-série (payant), articles XC Mag réservés aux abonnés.
Contraintes de l'outillage : WebSearch et WebFetch ont atteint leur quota en cours de travail ; le navigateur intégré n'a pas pu ouvrir d'onglet (limite d'onglets atteinte) ; recherches faites par curl, archive.org, API publiques (ParaglidingEarth, Overpass, Biodiv-Sports).

## Thermiques et points de relance (passe complémentaire)

Brief : `.cache/research/BRIEF_THERMIQUES.md`, avec la consigne d'extrapoler à partir des récits de pilotes. La seconde passe n'avait retenu que les lieux appelés « thermique ». Cette passe ajoute les points de **déclenchement, de relance et de plafond** que les pilotes citent le long des cheminements classiques. Convention de confiance : plusieurs récits concordants = `medium` ; récit isolé = `medium` si le lieu est précis, sinon `low` ; extrapolation sans récit explicite = `low` avec « déduction » dans la description.

### Volumes (thermal_spots, avant → après)

| Massif | Avant | Après |
|---|---|---|
| saint-andre-verdon | 6 | 12 |
| haut-verdon-allos | 1 | 18 |
| prealpes-digne-lure | 3 | 8 |
| prealpes-grasse-castellane | 3 | 13 |
| prealpes-nice-var | 3 | 10 |
| mercantour | 2 | 18 |
| **Total** | **18** | **79** |

Sources ajoutées : S99 à S124 (récits PDF d'Au gré de l'air, XC Mag, summits.fr, ro2g.com). 11 anciens thermiques ont été complétés (description, sources, confiance) sans changer leur `id` : `antenne-reyniere`, `crete-des-serres-angle`, `crete-de-cadun`, `moustiers-montdenier-thermiques`, `montagne-de-gache`, `bleine-combe-et-pic-aigle`, `cheiron-jerusalem-miroirs`, `courmettes-antennes`, `baou-des-blancs`, `baou-de-saint-jeannet` et `colmiane-balme-petoumier`. Leurs positions d'origine sont conservées.

### Ce qui a été ajouté, d'où

**Saint-André / Chalvet (cheminement Dormillouse).** Source principale : les récits d'Au gré de l'air (Berchet 13 et 23 juin 2006, Jacqueline 25 mars 2011 et 9 avril 2011, Fernandez 24 mai 2010, Armant 22 avril 2006 et 30 juin 2006, Briois 2006 et 2008, Salvi 2011), la page « Vols de distance » du club, la carte des points chauds de FlyStAndre (F1) et la fiche XC Mag de Petit (2025). Dans l'ordre volé : face S/SE du Chalvet dès 10h30 (`chalvet-deco-sud-matin`) → carrière avant les antennes (zone où l'on zérote) → antennes de la Reynière (plafond ~2100 m ; « à l'ombre » le matin) → bout de la montagne de l'Allier → sommet du Meunier → crête de Lambruisse → Séoune (escarpement ouest avant le col) → montagne de Tournon → pointe nord du Cheval Blanc (2600 m) → col de Talon (plein) → Côte Longue (2800 m sur la pointe sud) → Boules ou Carton (pointe ouest, col de la Baisse) → crête de la Chau → Tromas → tête du Bau → tête de l'Estrop (3680 m) ; retour : Cadun, Vachière, **montagne de Chamatte de Thorame** (à ne pas confondre avec le Pic de Chamatte), Cordeil, Maurel, crête des Serres. Les routes `saint-andre-dormillouse-ar` et `saint-andre-coste-longue-carton` reçoivent ces points comme `waypoints`.

**Bleine → Saint-André.** Combe SE à gauche du déco, Pic de l'Aigle (« Pic de l'Aiglo » IGN), bois brûlé, pente SE des Lattes (« le plus beau nuage du secteur » le matin), Col des Portes, Teillon, Crémon, Bernarde (Vauplane), Fourneuby. Sources : page « Vols de distance » d'Au gré de l'air, Ozone, Armant 2006, Berchet 2005 et 2006, Jacqueline 2011 et 2012.

**Gréolières et Gourdon → Saint-Jeannet.** Gréolières : « carrière » à gauche du 300 (brise des gorges du Loup + thermique du rond-point), col de l'antenne avant Coursegoules (confluence col de Vence × gorges du Loup), Jérusalem / miroirs. Gourdon : village (zone A, faible et encombrée), antennes de Courmettes, maisons bulles de Tourrettes, deuxième rideau des crêtes de Tourrettes, buttes des vaches du Moustachu / des chevaux, butte avant le baou des Blancs, baou des Blancs, des Noirs, de Saint-Jeannet, de la Gaude. Source : PDF Armant (2006) p. 1 (carte annotée A à P, lue en image) et p. 3 (photos), récit de Briois du 16 janvier 2009 (S107).

**Digne, Moustiers, Sisteron.** Montdenier (8 m/s, 4050 m), Mourre de Chanier (3300 m), Montagne de Coupe / Couard (3500 m), thermique avant le Cousson, Mouchon, Gâche, falaise thermodynamique de Sumiou le soir, Rocher de la Baume (source touristique, `low`).

**Mercantour.** Roquebrune : Mont Gros, falaises de Gorbio, crêtes de Sainte-Agnès, « thermique du retour », Castellar / « thermique de la Taupe », Razet, Agaisen (deux sources divergentes). Haut Var / Colmiane : Rochecline (localisé : sommet « Roche Cline » 2415 m, OSM), La Colletta, Mounier, Lauvet d'Ilonse, Mont Saint-Honorat (divergent), La Balme, Mont Giraud, Cime de Suorcas, Peïra Cava, Férion. Valberg : Mont des Moulinés et Col des Huerris (un seul récit, `low`).

Autres ajouts : un danger `aup-eperon-deux-flux` (montagne de l'Aup, où le sud se divise en deux flux), `waypoints` ajoutés à `col-de-bleine-saint-andre`, `greolieres-coursegoules-ar`, `gourdon-saint-jeannet`, `bleyne-moustiers-digne-saint-andre`, `saint-andre-allos-tinee`, `mont-vial-menton`, `roquebrune-sospel-col-de-castillon`. Les `bbox` de `haut-verdon-allos`, `prealpes-grasse-castellane`, `mercantour` et `saint-andre-verdon` ont été légèrement élargies pour que les nouveaux points restent dans leur massif. Les `extracted_to` des figures F1 et F3 sont complétés ; la figure F5 (même carte FlyStAndre que F1) est ajoutée pour `haut-verdon-allos`, car ses relais sont dans ce massif.

### Extrapolations et réserves (confiance `low`)

- Maisons bulles, butte du Moustachu, butte avant le baou des Blancs, deuxième rideau de Tourrettes : positions **déduites de la carte annotée d'Armant** (ajustement sur Tourrettes, baou des Blancs, Saint-Jeannet ; erreur de l'ordre de 0,5 à 1 km), donc `approx`.
- `sapee-sapet-lee-vautour` : identification du « Sapet » de Petit avec le sommet de la Sapée (déduction).
- `rocher-de-la-baume-sisteron`, `valberg-*` : une seule source non pilote ou un récit isolé.
- `roquebrune-thermique-du-retour`, `roquebrune-castellar-butte-taupe` : lieux décrits mais non cartographiés, positions estimées.

### Ce que je n'ai pas pu localiser ou trouver

- Antennes exactes du Chalvet (Reynière) et de Courmettes ; bois brûlé de Bleine ; col de l'antenne avant Coursegoules ; « carrière » avant les antennes du Chalvet : points `approx`.
- Caduc (sommet à 3200 m cité par Armant) et le petit Cordeil ne sont pas retrouvés comme thermiques distincts.
- **Montagne de Lure** (Contras, Lure nord) : aucun récit de cross ni thermique nommé. Banon, Oraison, Aiguines : rien au-delà des fiches FFVL déjà exploitées. Digne (Andran, Cousson) : pas de récit de relance local, seulement le thermique de la route Mont Denier – Coupe.
- Valberg, Péone, Isola 2000 : aucun site FFVL, un seul récit local (ro2g). WebSearch n'a rien donné sur Valberg, Sisteron et Lure.
- XContest et la CFD (Cloudflare / connexion) restent fermés ; les traces ne sont pas lues. Les fiches FFVL de ces sites restent bloquées (voir `.cache/research/blocked_urls.txt`).
- Les autres images annotées du lot ont été regardées (FlyStAndre, PDF Armant p. 1 et 3) ; la carte de traces d'Au gré de l'air n'a pas été utilisée pour de nouveaux points.


## Audit des thermiques (octobre 2026)

Contexte : le propriétaire, pilote local, a relevé des thermiques oubliés dans d'autres massifs (Antennes et Château Nardent à Saint-Hilaire, Grand Ratz). Les listes de lacunes (`docs/COUVERTURE.md`, `docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`) ont été reprises une à une pour les six massifs du lot, puis les textes des dangers, soarings, décollages et atterrissages ont été relus à la recherche d'une ascendance rangée ailleurs que dans les thermiques (le cas du Grand Ratz). Chaque position a été vérifiée sur le terrain IGN (RGE ALTI) et les toponymes IGN ; chaque point chaud kk7 (`thermal.kk7.ch`) de 90 % et plus a été rapproché des textes du lot, du corpus de récits d'Au gré de l'air, des pages Ozone, du catalogue du vol libre (CVL) et des fils parapentiste.info déjà téléchargés. Convention de confiance : `medium` quand un texte donne le lieu, l'heure ou la nature de l'ascendance et qu'une mesure ou un deuxième texte concorde ; `low` avec « déduction » quand seul un point chaud mesuré s'appuie sur le relief. Les points chauds ne disent pas pourquoi cela monte : la position est celle du point chaud (ou du décollage quand il est à moins de 600 m), le déclencheur est lu sur l'exposition et la pente du terrain, et sur les sites-écoles de brise (Puet, Grou de Bane) la mesure ne sépare pas le thermique de la dynamique.

Au total 38 thermiques créés (Saint-André 1, Haut-Verdon 6, Digne – Lure 7, Grasse – Castellane 9, Nice – Var 8, Mercantour 7) et 2 éléments corrigés. `npm run data:build -- --check` : aucune alerte nouvelle. Les points chauds forts du secteur de Nice situés en Italie (Passo della Croce, Monte Comune, Monte Lega, Monte Altomoro) ne sont pas repris : l'atlas ne sort pas de France.

### Saint-André-les-Alpes (`saint-andre-verdon`)

- Créé : `col-du-sauvage-pente-sud-ouest` (`low`, 97 %, 1,7 km de la Montagne de Tournon et de Séoune, entre deux relais décrits du cheminement vers le Cheval Blanc).
- Courchon, Aiguines Le Puits, Aiguines Les Vernis et Montdenier, rangés par la couverture dans ce secteur, sont traités avec leurs éléments dans Digne – Lure (voir ci-dessous) ; Montdenier n'a que le manque de brise (le thermique `moustiers-montdenier-thermiques` est à 300 m).
- Écarté : l'atterrissage de Moriez (« plus calme que le lac aux heures thermiques » : pas de thermique).

### Haut-Verdon et Allos (`haut-verdon-allos`)

**Thermiques créés (6)**
- `le-carton-lieu-dit-pre-reliefs` (`medium`) : point chaud 94 % sur le lieu-dit IGN « le Carton », 1,9 km au nord-ouest de la montagne du Carton. Plusieurs récits placent les ascendances sur le relief en avant du sommet : « une pompe organisée sur la forêt en avant du relief » (Berchet 2006), « les prérelief de Carton sont baignés de soleil… c'est un boulet de canon » (Armant), « je rejoins Carton très bas… ça repart bien » (Fernandez 2010) ; l'élément du sommet est conservé.
- `tete-de-la-reyniere-pente-sud` (96 %), `costes-de-sangraure-pente-sud-ouest` (94 %), `le-moure-pente-sud-ouest` (91 %, cirque entre le Cheval Blanc et le Carton), `pompe-pellet-barre-de-pompe` (91 %), `sommet-de-triey-pente-ouest` (91 %) : `low`, points chauds seuls.

### Digne – Lure et Moustiers (`prealpes-digne-lure`)

**Thermiques créés (7)**
- `moustiers-courchon-pente-sud-ouest` (`medium`) : Ozone (« pleasant evening soaring on the westerly-facing cliffs of Mont Denier and Courchon, which work until dark in the summer »), forum 2016 (« plafonds à plus de 2000 m à 20h »), CVL (Mont Denier : « déclenchement thermique vers 10h »), point chaud 94 % à 240 m du décollage.
- `oraison-pente-ouest-midi` (`medium`) : FFVL 938 écrit « en été, milieu de journée : activité thermique pouvant être violente » ; le forum (2009) « vol thermique le midi assez technique, plusieurs vols dont un au plafond » ; point chaud 99 % toute l'année. L'élément n'avait que le thermique du terrain d'atterrissage (cas du Grand Ratz : le texte classé en danger).
- `saint-geniez-rayes-pente-sud-ouest` (`medium`) : fil de Gâche (2017) « c'est plutôt le Trainon que je vise », brise « bien brassée de thermiques hachés » ; ParaglidingEarth thermiques/soaring/cross ; point chaud 96 %, 99 % le matin.
- `grou-de-bane-croix-pente-sud-est` (`medium`) : FFVL 199 « le déco Est donne un bon rendement même par vent modéré » ; point chaud 100 % (dynamique et thermique non séparés).
- `andran-clapiere-pente-sud-ouest` (`low`, 99 %), `plat-de-la-main-sud-cousson` (`low`, 91 %, peut-être le « thermique avant le Cousson » du récit de Jacqueline), `aiguines-le-puits-pente-sud-ouest` (`low`, 94 % ; ParaglidingEarth ne coche pas les thermiques ; les coordonnées de la fiche du Puits ne collent pas à son altitude).

**Lacunes écartées** : Malijai – Blanchon (site en test, aucune aérologie, aucun point chaud), Gamby – Charex, Crau Chétive, Chabrier (fiches sans description, aucune mesure), Sumiou (seul le manque de brise), `gache-dynamique-nord` (le thermique de la Montagne de Gâche est à 1,2 km).

### Gréolières, Gourdon, Lachens et Castellane (`prealpes-grasse-castellane`)

**Thermiques créés (9)**
- `lachens-pente-sud-est` (`medium`, 90 %), `lachens-ouest-pente-sud-ouest` (`medium`, 85 %) : Ozone (site « sujet à souffler trop fort dans la chaleur d'une journée thermique », bon potentiel de cross) et le récit de N. Fabre du 26 juin 2005 (déco ouest « en plein début de cycle », plafond 1900 m, cycles courts, brise d'ouest dès 10h). Aucun thermique à moins de 10 km n'était décrit pour les trois décollages.
- `bauroux-pente-sud` (`medium`, 90 %) : le même récit de Fabre, « vers Bauroux, beau thermique… montée à 2400 m ».
- `kennedy-pente-sud` (`medium`, 99 %) et `embarnier-pente-sud-est` (`medium`, 95 %) : CVL (Kennedy « favorables en thermiques et toute l'année », Embarnier « en thermiques »), ParaglidingEarth, repérages d'Armant (Embarnier plate-forme du « bocal »).
- `valettes-atterro-thermique` (`medium`) : CVL « activités thermiques importantes » sur le terrain d'atterrissage des Valettes (pas de point chaud).
- `le-puet-pente-sud` (`low`, 97 % ; site-école, mesure en partie dynamique), `la-grangasse-pente-sud` (`low`, 91 %), `vallon-de-clare-pente-sud` (`low`, 91 %).

**Position corrigée** : `castellane-colle-bernaiche` (le GPS de l'ancienne fiche donnait 1343 m pour 1450 m déclarés ; ramené sur le toponyme IGN « Crête de Colle Bernaiche », 1398 m ; site non officiel).

**Lacunes écartées** : Colle du Macon (FFVL 3002) et Antennes de Grasse (FFVL 5054) : fiches sans description et aucun point chaud ; Bargemon et le Lachens ne manquent que de brise ; `cheiron-crete-soaring` et `gourdon-atterros-gradient` : les thermiques du Cheiron (Jérusalem, 1,3 km) et de Gourdon sont décrits.

### Préalpes de Nice, Sospel, Roquebrune (`prealpes-nice-var`)

**Thermiques créés (8)**
- `lavina-pente-nord-est-matin` (`medium`) : Ozone (« later in the morning, as the thermals get stronger, it becomes a good XC site ») et Sospel Vol Libre (décollage du matin avant la brise de sud) ; point chaud 83 % uniquement le matin.
- `lai-barrai-pente-sud-sous-le-decollage` (`medium`) : la fiche FFVL 1576 écrit « brises thermiques » ; l'atlas ne comptait que le point chaud kk7 à 380 m (85 %, 92 % le matin).
- `monte-grosso-pente-sud` (97 %), `beoulet-pente-sud` (91 %), `tete-dalpe-pente-sud-est` (96 %, été), `peille-pente-sud-est-bocal` (92 %), `la-cime-gattieres-pente-sud-est` (97 %) : `low`, points chauds seuls (Sospel Vol Libre : « les jours de purs thermiques peuvent être puissants dans les pompes de service »).
- `mont-macaron-zone-calcaire` (`low`) : le récit « God Bless the Macaroni » (2015) décrit un site au « rendement minable » mais un thermique « sur la plus grande zone calcaire » en transit : thermique exceptionnel, pas un site thermique.

### Mercantour (`mercantour`)

**Thermiques créés (7)**
- `mont-court-pente-sud` (`medium`, 96 %) : Ozone donne le parcours « de Cagnorina au col de Tende via le Mont Court » ; point chaud à 250 m du sommet.
- `rochers-de-gata-pente-sud` (100 %), `mont-deveille-pente-sud` (92 %), `creppe-de-la-marguerie-giaure` (97 %, au-dessus du fort de Giaure, col de Tende), `coture-baisse-de-la-crouseta` (91 %), `cros-de-la-tune-pente-sud` (97 %, sous le Mont Giraud de La Colmiane), `colmiane-pic-pente-ouest` (78 %, sous le seuil de 80 % : seul le décollage du Pic, FFVL 905, motive l'élément) : `low`.

**Position corrigée** : `auron-atterro` (altitude 1600 m, celle de la station, ramenée à 1456 m, terrain IGN à la position de l'atterrissage ParaglidingEarth).

### Reste ouvert

- Les positions de `crete-des-serres-angle`, `cheval-blanc-pointe-nord`, `greolieres-col-antenne-coursegoules` et `ferion-antennes-lignes` restent approximatives : les récits ne donnent pas de repère plus précis que le toponyme.
- Les thermiques de Lure et de Banon (Contras, Lure nord) restent sans récit.
- Le Valberg, Péone et Isola 2000 n'ont toujours aucune fiche FFVL ni récit au-delà de ro2g.
