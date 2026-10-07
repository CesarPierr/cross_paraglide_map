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
