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
