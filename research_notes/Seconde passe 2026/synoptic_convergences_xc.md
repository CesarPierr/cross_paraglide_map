# Seconde passe : lot synoptic_convergences_xc (Alpes françaises, échelle régionale)

Fichier de données : `data/synoptic_convergences_xc.json` (massif `alpes-francaises`). Documents lus sauvegardés dans
`.cache/research/docs/synoptic_convergences_xc/` (dont `work/` : scripts de construction, KML, tracés géoréférencés).

## Volumes avant / après

| Catégorie | 1re passe | 2e passe |
|---|---|---|
| brises | 17 | 26 |
| convergences | 6 | 13 |
| dangers | 6 | 10 |
| décollages | 0 | 2 |
| effets du vent synoptique | 8 | 13 |
| itinéraires de cross | 4 | 12 |
| conseils | 10 | 13 |
| sources | 43 | 69 |
| figures | 0 | 6 |
| règles du modèle (`model_rules`) | 14 | 17 |

`npm run data:build -- --check` : aucune alerte sur `alpes-francaises` (les alertes restantes concernent d'autres lots).

## Sources lues (ce qu'on y a trouvé)

- **Carte Largeault « Brises des Alpes »** (S44, S32) : page Rock The Outdoor + export KML public du Google My Maps
  (`mid=1LZ-3QtkG48alQEQfushGC6d_bAS9Y7o`), ~300 tracés orientés dans le sens du flux. Exploitée pour les brises principales
  (Combe de Savoie, Grésivaudan, Maurienne, Tarentaise, Arve, Durance, Ubaye, Bléone, Bès, Verdon, Argens, Var). Les « confluences »
  ne sont pas tracées par l'auteur. Note de l'auteur sur La Javie - Montclar : la confluence dépend de la force de la brise du lac.
- **G. Briffe, « Brises et confluences classiques des Alpes du Sud »** (S45) : PPTX de 80 diapositives (lien Drive de
  l'article Annecy Mini Voiles et de toutleparapente). Théorie de la confluence (bassins aérologiques, deux phases, confluence
  de contournement, brise de mer), puis schémas : régime de brises (diapos 45-63), mistral (64-72), sud-est (73-79). Les flèches sont des
  formes vectorielles sur des captures Google Earth/Maps : j'ai reconstruit les diapositives (script `work/`), géoréférencé les cartes
  routières (ajustement Mercator sur 7 à 12 villes, résidu 1-3 km) et extrait les lignes (crête frontalière, arcs du Diois et d'Obiou - Taillefer,
  front de brise de mer, quatre confluences de mistral). Les vues obliques (59-63, 70-74) ne sont pas géoréférençables avec précision.
- **Club St Hil'Air** (S40, S41) : « Préparation cross » (seuils de vent, gradient, foehn 2-4 hPa) et « Cross avancé : massifs et transitions »
  (14 transitions avec distance et altitudes minimales, brises fortes, zones aériennes, 12 exemples CFD).
- **Récits** : Pays de Gex 202 km et 185 km (S28, S27), Bluehouse 201 km (S46), Tichodromes (copie Wayback partielle, S47), Ozone et XC Mag :
  Lambert 350 km (S22, S48), Potel 358,6 km (S49), Petit 301 km (S50, le seul récit détaillé de la route de l'Izoard), Hamard 306 km (S53) et
  342 km (S54), Puthod/Cabiac 393 km (S51) ; FAI, Pinot 309 km (S52) ; XCFinder, records par département (S23).
- **Aérologie régionale** : plaquette FFVL du Pays du Mont-Blanc p. 10 (S55), CMBVL (S56), Chocard Airlines (S57), Bauges Parapente (S42),
  Air Buëch (S62), Aérogliss (S63), Rock The Outdoor, brises (S1 = S2), Parapente 360 (foehn S11, brises S58), Annecy Mini Voiles (S9), Wikipédia
  (bise S59, mistral S60, lombarde S12), Monin 1962 (S61, résumé seulement), Zardi & Whiteman (S3), forum parapentiste.info (S15, S65, S66),
  Toiles du Sud (S67), XC Mag Goldsmith sur la convergence de brise de mer (S64).

## Changements par rapport à la première passe

### Corrigé
- **Sens de la brise du Grésivaudan** : la première passe avait lu « la brise remonte vers le nord-est ». Lecture corrigée : elle va de la cluse de
  Chambéry vers Grenoble (« brise de nord » = venant du nord), tandis que la Combe de Savoie va de Montmélian vers Albertville (S31 : « ce qui est faux
  dans la Combe de Savoie, mais vrai dans le Grésivaudan » ; tracés Largeault S44 ; question du fil S15 ; récit de la traversée Granier - Savoyarde, S46).
  Le sens des waypoints de la première passe (Montmélian vers Grenoble) était déjà bon ; seul le texte et les conséquences (effets de la bise) étaient faux.
- **Record de l'Izoard** : la page Ozone (S22) ne cite ni le Vieux Chaillol, ni le Drac, ni le Dévoluy, contrairement à ce que laissait croire la première passe.
  La route classique Clôt la Cime - Freissinières - Vieux Chaillol - Pic de Bure - Aspres - Céüse - Cheval Blanc vient du récit de Hans Petit (S50) ; les
  points exacts des records de Lambert et Potel restent sur XContest (connexion).
- **Seuil « 20 km/h = fort »** : attribué à tort à Finesse Plus (S8), dont la page traite du soaring de pente. Il provient du club St Hil'Air (S40) et du
  Pays du Mont-Blanc (S55, « à proscrire au-delà de 20 km/h à 2000 m »). Seuils ajoutés : 10 km/h aux cimes = turbulences, gradient > 10 km/h/1000 m, foehn -4 hPa Aoste - Annecy.
- **Épaisseur de la brise de vallée** : 200-500 m (S1) mais sensible jusqu'à 2500-3000 m d'altitude (S55) et aux crêtes de Peyrolles 2645 m (S57) : règle `epaisseur-couches` réécrite.
- **Roc des Bœufs / brise du lac d'Annecy** : la phrase attribuée à S9 n'est pas sur la page Annecy Mini Voiles ; retirée (tracés Largeault à la place).
- **Front de brise de mer** : la ligne Forcalquier - Valensole - Riez - Castellane (déduction) est remplacée par la ligne du schéma de Briffe (Argens - Gréolières - Mercantour), géoréférencée.
- Sources non relisibles : S13, S14 (copies RTO sans le contenu du spot, affirmations non revérifiées), S26 et S29 (HTTP 410), S39 (ATA 404), S10 (PCHT 404 en curl) : confiances maintenues basses.

### Ajouté
- Brises : haute Tarentaise, Verdon (Castellane - Thorame), Bléone, Bès, brise de mer niçoise, flux Rhône - Diois, prolongement Durance - Maurienne, flux piémontais (Val de Suse, Val d'Aoste).
- Convergences : crête frontalière franco-italienne, Obiou - Taillefer, arc du Diois, quatre confluences de mistral (Buëch, Valensole - Verdon, Gap - Tallard, Briançon).
- Dangers : brise de la Durance à Briançon (> 40 km/h), ZIT de Grenoble / zone P14 du CEA, CTR Chambéry et TMA Lyon, zone R196 Gap et parcs.
- Itinéraires : triangle plat 202 km (Saint-Hilaire - Aravis), 201 km 2024, 185 km 2019 (réécrit avec les points du récit), Col Vert vers le nord 233 km, triangle FAI de Pinot 309 km,
  Hamard 306 km (Agnel) et 342 km (Gourdon - Léman), triangle Aravis - Rachais 204 km, cross Moucherotte - Chartreuse (Tichodromes), Richards - Chamonix 174 km, chaîne des transitions des Préalpes du Nord.
- Décollages : col de l'Izoard et col Agnel (PGE 23667 et 21233).
- Règles du modèle : seuils de foehn, inclinaison d'une confluence (côté le plus faible), altitudes minimales de transition.

### Retiré
- Anciens conseils reposant sur S8 (seuil 20 km/h) et sur la phrase du Roc des Bœufs ; anciens textes « déduction » des effets W, SW, Mistral, Foehn remplacés par des textes sourcés (les déductions restantes sont marquées).

## Figures déclarées

F1 (carte Largeault), F2 (Briffe diapos 47/54), F3 (diapo 49), F4 (diapos 65-66), F5 (diapos 59-63 et 70-74), F6 (St Hil'Air, transitions et exemples CFD).
Pour les diapositives Briffe il n'existe pas d'URL d'image : le lien est celui du PPTX, `pdf_page` donne le numéro de diapositive.

## Échecs et points à vérifier

- Supports pédagogiques : ATA « Les brises » (lesBrises.pdf) introuvable (404) ; schémas de « Dans l'Y grenoblois » (parapentiste.info) réservés aux membres ; images toutleparapente « flux de brise autour des massifs » inaccessibles sans navigateur
  (le navigateur intégré était saturé d'onglets d'autres agents) ; carte suisse du pompage alpin retirée.
- Récits : XContest (« You are not approved to see the flight ») et CFD (Cloudflare) fermés : les points de virage des records et des triangles 185/202 km sont reconstitués d'après les textes (positions `approx` signalées).
- FAI Pinot : les toponymes « Chalencon » et « Estrop » ne sont pas localisés avec certitude (les homonymes OSM donnent ~400 km au lieu de 309) ; Potel : « Tête du Sapet » a deux homonymes (Drôme, Alpes-Maritimes) et aucun ne rend un triangle de 358 km.
- Récits RTO (224 km Saint-André, 336 km Beaugey) supprimés (410) ; topo « 40 itinéraires » : livre, aucun extrait public.
- À vérifier : horaires et vitesses de la brise de mer, force des brises de la cluse de Chambéry, et toute la partie « Briffe » (positions lues sur diapositive, confiance moyenne à faible).
- Partage du scratchpad : un autre agent a écrit dans mes scripts temporaires ; les copies de travail propres sont dans `.cache/research/docs/synoptic_convergences_xc/work/`.

## Thermiques et points de relance (passe complémentaire)

Brief : `.cache/research/BRIEF_THERMIQUES.md`. Le lot n'a qu'un massif régional (`alpes-francaises`) et aucun massif local : conformément à la consigne du propriétaire, **les points de relance et plafonds des grands itinéraires inter-massifs ne sont pas mis dans ce fichier** quand leur massif local appartient à un autre lot. `thermal_spots` reste donc vide (0 avant, 0 après). Ce qui a changé dans le JSON :

- `triangle-201-vercors-chartreuse-bauges-bornes-2024` : trois `waypoints` ajoutés dans l'ordre volé (col de Marcieu, Grand Manti, cirque de Saint-Même) et la description donne les relais du récit ;
- `triangle-fai-izoard-record` : waypoint « Sommet de la Sapet / Sapée (identification probable) » (`approx`) et relais / plafonds du récit de Petit (S50 ajouté aux sources de la route) ;
- `triangle-plat-202-chartreuse-aravis` : description complétée (relais et plafonds du récit). Aucun identifiant, aucune coordonnée existante modifiés. `--check` : aucune alerte.

Le triangle de Saint-André et ses relais (Reynière, Séoune, Cheval Blanc, Sapet, Tromas, etc.) sont traités dans mon autre lot : voir `provence_maritimes.md`, section du même titre.

### Points à répartir dans les autres lots

Positions : IGN (géocodeur data.geopf.fr, toponymes de sommets et de cols) ou waypoints `source` déjà présents dans ce JSON ; « approx » si déduit du récit. Plafonds en mètres. Rôle : **D** déclencheur, **R** point de relance, **P** plafond.

**Lot `chartreuse_gresivaudan_belledonne`**

| Point | lon, lat | Rôle et citation courte | Source |
|---|---|---|---|
| Saint-Eynard | 5.7626, 45.2352 | R : « thermique à +7 » en venant du Rachais ; relance vers la Dent de Crolles, qu'on longe sous 1800 m | S46 (https://www.bluehouse.fr/JB6/carnet-de-vol/2024/04/26/201-km/) |
| Mont Jalla | 5.7242, 45.2040 | R de transition basse sur Grenoble (arrivée à ~1000 m), remontée le long du Rachais | S46 |
| Rachais / Bastille | 5.7185, 45.2150 (approx) | R : raccrochage « dans la brise » à 800 m (ZIT à éviter) | S47 (Tichodromes, copie Wayback), S46 |
| Dent de Crolles | 5.8556, 45.3082 | R / P : cheminement Saint-Eynard → Dent (faces ouest, nuage bas sur l'est) | S46, S47 |
| Dôme de Bellefont | 5.8810, 45.3420 | R : crêtes où l'on « laisse monter » avant l'Aulp du Seuil | S46 |
| Aulp du Seuil | 5.8969, 45.3581 | P : 2500 m, l'ouest repousse (« se faufiler dans les avant-reliefs ») | S46 |
| Col de Marcieu, Grand Manti | 5.9187, 45.3558 ; 5.9090, 45.3844 | R : avants-reliefs (au vent) | S46 |
| Cirque de Saint-Même | 5.8913, 45.3928 | D : « la pompe du cirque de Saint-Même donne à plein régime » (faces est du Granier) | S46 |
| Mont Granier | 5.9251, 45.4648 | P : 2300-2350 m « avant que les brises ne rentrent » ; départ pour la Savoyarde | S28, S46 |
| Faces est de la Chartreuse | 5.89, 45.31 (approx) | D : confluence sur les faces est, slalom de barbules, dès 11h30 | S28 |

**Lot `bauges_bourget_combe`**

| Point | lon, lat | Rôle | Source |
|---|---|---|---|
| Savoyarde / Galoppaz | 6.0666, 45.5659 | R : raccrochage à ~1200 m ; « laisse de chien » face ouest pour compenser la brise de Chambéry | S28, S46 |
| Margériaz (sommet) | 6.0213, 45.6350 (approx) | D : confluence des deux brises de part et d'autre du col de Plainpalais, souvent un cumulus | Bauges Parapente (S42, https://www.bauges-parapente.com/stage-cross-parapente/) |
| Mont Julioz | 6.1600, 45.7058 | P : 2700 m | S46 |
| Roc des Bœufs | 6.1662, 45.7551 | passage du retour (« pas une partie de plaisir »), zone sous le vent par brise ; aucun thermique décrit | S46, S41 |
| Colombier, Montlambert | 6.1195, 45.6445 ; 6.1048, 45.5529 | R sur le retour (cumulus au-dessus de la falaise) | S46 |
| Tours de Montmayeur | 6.1240, 45.4898 | R : arrivée à 860 m depuis 2700 m ; brise de Chambéry de plein fouet | S46, S28 |
| Chamoux / entrée de la Maurienne | 6.2151, 45.5336 | R : plein de 2500 m sous des barbules, décisif pour le bouclage du 202 km | S28 |
| Combe sud du Grand Arc | 6.3647, 45.5664 | P : 2900 m | S28 |

**Lot `annecy_bornes_aravis`**

| Point | lon, lat | Rôle | Source |
|---|---|---|---|
| Dents de Lanfon | 6.2416, 45.8612 | R : départ de la traversée du lac (8,4 km) ; sud à 18 km/h au retour | S46 |
| Lanfonnet (pilier sud) | 6.2555, 45.8450 | D : « pilier sud du Lanfonnet et celui des dents » = zones thermiques de la carte des brises | pi_cartog (https://www.parapentiste.info/forum/techniques-de-cross/cartographie-des-brises-dans-les-alpes-du-nord-t35042.0.html, S15) |
| Bluffy | 6.2150, 45.8701 | D : confluence signalée sur la carte des brises | S15 |
| Tête à Turpin | 6.2620, 45.9072 | piège : plein vent, rafaleux, pas de cumulus | S28 |
| Lachat de Thônes | 6.3507, 45.9276 | D : confluence de brises « dansante », thermiques « missiles » ; 3000 m une fois sorti | S28 |
| Col des Aravis, faces ouest | 6.4649, 45.8723 | R : décision « de confort » ; remonter au vent car les brises donnent une composante sud | S28 |
| Dent de Cons | 6.3509, 45.7292 | P : cumulus à 2900 m (la Belle Étoile voisine ne donne rien) | S28 |

**Lot `vercors_grenoble_trieves`**

| Point | lon, lat | Rôle | Source |
|---|---|---|---|
| Moucherotte | 5.6373, 45.1502 | D : versant est de 10h30 à 14h30 ; départ des grands cross vers le sud et le nord | S41 (p. massifs), S47 |
| Pic Saint-Michel | 5.6200, 45.0902 | demi-tour par vent d'ouest (le Vercors « ne veut pas de nous ») | S46 |
| Deux Sœurs | 5.5803, 45.0043 | D : « thermique des 2 Sœurs », zone sous le vent | S41 |
| Grand Veymont, Petit Veymont | 5.5267, 44.8697 ; 5.5306, 44.8640 | P : 2500 m « au vent du nuage » ; demi-tour du cross | S27, S47 |

**Lot `devoluy_gap_buech_diois`**

| Point | lon, lat | Rôle | Source |
|---|---|---|---|
| Die (faces sud) | 5.3689, 44.7534 | R : 30 vautours au raccrochage exceptionnel | S27 |
| Col de Pré Pinel (Lus-la-Croix-Haute) | 5.7062, 44.6656 | R : point bas ; sortie sous deux vautours ; thermiques couchés par les brises | S27 (https://www.parapentepaysdegex.fr/post/vercors-diois-d%C3%A9voluy-les-richards-chamrousse-le-triangle-fai-185-km-du-19-07-2019) |
| Pic de Bure | 5.9351, 44.6267 | D / P : attaqué bas par un pierrier, « bouchon de champagne » ; 3500 m ; thermiques +3 m/s par sud-ouest | S27, S50 |
| Céüse | 5.9478, 44.4980 | R du triangle de l'Izoard (erreur de Petit à Céüse) | S50 |

**Lot `oisans_maurienne` (Valbonnais, Champsaur) et `brianconnais_ecrins_queyras_ubaye`**

| Point | lon, lat | Rôle | Source |
|---|---|---|---|
| Petite Autane / Ancelle | 6.2871, 44.6489 | plaine d'Ancelle sans thermique de brise (16h30) | S27 |
| La Prouveyrat, Le Chaperon, Grun de Saint-Maurice | 6.2188, 44.7059 ; 6.0938, 44.7641 ; 6.0560, 44.8156 | P : 3300, 3200 et 3300 m (« plus t'es haut, plus t'es poussé par le météo ») | S27 |
| Notre-Dame de la Salette | 5.9786, 44.8589 | P : 2800 m (base 2600 m pour Hamard en 2016) | S27, S53 |
| Valbonnais / Coiro | 5.9047, 44.9000 | piège : sous le vent, brise toujours forte | S27, S52 |
| Clôt la Cime (Izoard) | 6.7197, 44.8165 | D / P : premier plafond 2900 m, départ 9h11 | S50 |
| Freissinières | 6.5546, 44.7551 | R : vent d'est qui pousse, thermique insuffisant | S50 |
| Vieux Chaillol | 6.1899, 44.7358 | R classique du triangle de l'Izoard | S50 |
| Piolit | 6.2672, 44.6034 | P : 3730 m, thermique pur +5 (Armant 22 avril 2006) | récit Armant, ADLA (S103 du lot Provence) |
| Morgon | 6.3974, 44.4919 | R : « thermique académique » 3000 m (Jacqueline 2011) ; cafouillage au Morgon (Armant) | ADLA (S101 du lot Provence) |
| Fort de Dormillouse | 6.3865, 44.4095 | P : planeurs à 4200 m, 3500 m puis retour | ADLA (S59 du lot Provence) |
| Blanche (crête, « autoroute à planeurs ») | 6.4443, 44.3418 (Montagne de la Blanche, IGN) | R : thermiques larges, aucun besoin d'enrouler | page « Vols de distance » d'Au gré de l'air (S55 du lot Provence) |

Pour les lots autres que les miens, les numéros S… renvoient à ce fichier (ou, si précisé, au lot Provence) ; les URL complètes sont dans les tableaux `sources` des JSON. Les altitudes de départ et d'arrivée des transitions du club St Hil'Air (S41) restent dans la règle `transitions-entre-massifs`.

### Versants et horaires donnés par le support St Hil'Air (S41, texte extrait du PDF, pages massifs)

À reprendre dans les fiches de chaque massif : Moucherotte versant est 10h30-14h30 (tendance S à SO), Cornafion versant ouest après 15h ; Granier versant est ; Grand Som versant ouest après 15h-16h ; Dent du Chat versant ouest après 15h ; Belledonne sud et nord versant ouest à partir de 14h ; Bauges versant est de 11h à 15h (Roc des Bœufs), Margériaz versant ouest après 15h30 ; Aravis versant est de 10h à 13h et versant ouest après 14h ; Champsaur versant sud, plafonds minimaux 2500-2600 m ; Taillefer versant ouest (tendance S) ; Dévoluy ouest (Courtet) après 15h. Seul le texte du PDF a été exploité : les schémas des pages massifs (p. 2-21) n'ont pas été examinés image par image.

### Non trouvé, limites

- Les traces des records de l'Izoard (Lambert, Potel) restent sur XContest (connexion) : aucun point de relance supplémentaire au-delà du récit de Petit ; « Le Sapet » et « Catina » n'ont pas de position confirmée (Sapet = Sapée par déduction ; Catina introuvable).
- Les coordonnées « approx » de ce tableau viennent des noms du récit (pas de trace GPS).
- Les relais du triangle de 185 km (Vercors – Diois) et de Pinot (309 km) ne dépassent pas ce que le texte du récit permet de localiser.
