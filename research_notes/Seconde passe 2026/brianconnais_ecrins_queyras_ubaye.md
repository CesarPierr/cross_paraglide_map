# Seconde passe : Briançonnais, Écrins (Vallouise, haute Durance), Serre-Ponçon/Embrunais, Queyras, Ubaye

Lot `brianconnais_ecrins_queyras_ubaye` — fichier de données : `data/brianconnais_ecrins_queyras_ubaye.json`.
Massifs refaits en entier : `brianconnais-guisane`, `ecrins-vallouise-haute-durance`, `serre-poncon-embrunais`, `queyras`, `ubaye`.
Identifiants de sources : `MS…` et `HS…` conservés (notes mises à jour quand la page a été relue en entier), nouveaux `S1…`.

## 1. Sources lues (et ce qu'on y a trouvé)

### Chocard Airlines (club de Briançon) — source majeure
Site Google Sites lu intégralement avec curl (toutes les pages du topo : phénomènes locaux, sites, topo cross, parc, réglementation aérienne, remontées mécaniques, gonflage, règles de bonne conduite).
- **Brise de la Durance** : axe SW, pointes > 40 km/h à Briançon, éviter les fonds de vallée dès la mi-journée l'été, sensible jusqu'aux Têtes de L'Argentière (2044 m) et aux crêtes de Peyrolles (2645 m), tendances S à O qui la font entrer tôt et brusquement.
- **Brise de la Romanche / Guisane** : franchit le Lautaret, descend la Guisane le matin avant la Durance, confluence puissante entre Lautaret et Briançon, reprise brusque de la Romanche en fin de journée (surtout NO).
- **Lombarde** : « tube qui serpente », 10 → 40 km/h en 10 min, couche de 300-500 m invisible au sol, trois origines (brise d'Italie fin de journée, différentiel de pression, foehn d'est), Vallouise abritée, Saint-Blaise extrêmement risqué.
- **Rentrées d'Ouest et de Nord à Vallouise**, **dust devils**, topos de Vallouise (Puy Aillaud, Alpages, Pelvoux, Bouchier), Granon (5 décos, confluence, vol du soir), Prorel, Serre Chevalier, Izoard, Lautaret, Galibier, Ceillac ; cross facile / moyen / difficile avec traces FlyXC (polylignes décodées : waypoints lus) ; réglementation du Parc des Écrins et zones R221/R222/R196.
- **Quatre cartes Google My Maps lues en KML** (`google.com/maps/d/kml?mid=…&forcekml=1`) : zones à éviter (polygones de posé impossible, sous le vent, thermiques très forts, cœur du Parc, DZ hélico), flèches de Lombarde et zones sous le vent, carte du secteur (~170 repères décollages/atterros/espaces aériens avec descriptions), Parc national. Ce sont les seules géométries réelles de pièges et de Lombarde de tout le lot.
- Images de pages : 3D annotée de la page « topo cross » (brises, thermiques, zone sous le vent), vue 3D de la Guisane (étiquettes seules), cartes de la page Durance (carte routière + vue 3D). Les URL d'images Google Sites sont tokenisées (403 en curl) : vues avec le navigateur intégré.

### Forum « Parapente dans le Briançonnais » (parabriancon.forumactif.org)
- `t228` « Aérologie du Briançonnais » (fiches de Sennequier et Huet, 2009) lu en entier : topographie (3 vallées + Cerveyrette + Orceyrette), régime des brises (inversion de la Guisane vers 16 h, Lombarde thermique 16-18 h dans la basse Clarée), Lombarde, « cloutage » du vent d'altitude, cisaillements de brise (Vigneaux, Vallouise), « pétard » de Bouchier, **six confluences** (verrou de L'Argentière, Saint-Crépin, Embrun, Saint-Chaffrey, La Vachette, Briançon Sud), orages (tempête avant l'orage).
- `t146` « attention confluence » : carte annotée (conflu10.jpg, téléchargée et regardée), récit de 2005, confluence du soir à Puy Aillaud.
- `t436` « compliqué!!!!! » : cross du 26/03/2010 Prorel → Embrun avec la confluence Lombarde / brise à Mont-Dauphin ; `t424` Serre Buzard ; `t647` atterros ; `t645` question Queyras sans réponse.

### FFVL (base fiches)
Fiches lues en entier avec le navigateur intégré (curl bloqué par Cloudflare), puis la nouvelle référence `.cache/research/ffvl_sites_alps.tsv` / `ffvl_sites_alpes.json` fournie par le coordinateur (857 fiches) : coordonnées, altitudes et secteurs de vent de tous les décos/atterros avec fiche. **Correction capitale** : la fiche du Prorel (2359) donne 44.9015 N, 6.5847 E, 2383 m.

### Autres
- infos-parapente.com « Faire du parapente à Serre-Ponçon » lu en entier : Chorges (brise de Gap vers 11 h, N sous le vent, E mauvais), Serre Buzard, Pierre-Arnoux, Montclar, Orres, Mont Guillaume, Saint-Vincent.
- Différen'Ciel (Saint-Vincent), Ultimate France (Ubaye), CVVU (vol à voile), Parc national des Écrins (survols non motorisés), Ozone (record 350,53 km depuis l'Izoard), Serre-Ponçon Vol Libre, Curl'Air, Emotion'Air, parapentiste.info (« Nouveau à Briançon »), Pollen Parapente.
- Coordonnées des villages : API Wikipédia (Nominatim limité par 429).

## 2. Changements par rapport à la première passe

Volumes (avant → après) : brises 10 → 27, convergences 3 → 8, dangers 9 → 62, points thermiques 1 → 14, soaring 1 → 7, décollages 9 → 65, atterrissages 5 → 37, effets synoptiques 9 → 33, routes de cross 0 → 7, conseils 15 → 46, sources 72 → 158, figures 0 → 20.

### Corrigé
- **Prorel** : position et altitude du déco étaient estimées (altitude 2400 m / 44.893, 6.600 : alerte MNT « recalé de 1387 m »). Remplacées par la fiche FFVL (44.9015, 6.5847, 2383 m, `ffvl_id` 2359). Plus aucune alerte `--check` sur le lot.
- **Prorel, secteurs de vent** : la première passe avait lu « favorables N et S, défavorables NE et E » : ce sont les secteurs de la fiche d'**atterrissage de Saint-Blaise (13227)**. La fiche du déco dit favorables N, NE, E, SE, S, SO (« idéal par flux de S ou d'E »), et Chocard dit défavorable par NO, très exposé à la Lombarde. Les deux lectures sont expliquées dans le déco, l'atterro et les effets synoptiques.
- **« Site du lac déconseillé de juin à septembre »** (première passe, infos-parapente) : c'est **Serre Buzard** (Châteauroux-les-Alpes), pas un site du lac.
- Positions estimées remplacées par des positions de source : Granon, Serre Chevalier, Chalvet/Montgenèvre, Puy-Saint-Vincent, Saint-Chaffrey, Saint-Blaise, Vallouise, atterros du lac, etc.
- Tracé de la brise de Durance dans Serre-Ponçon recentré sur Tallard → barrage → Savines → Embrun (Sisteron appartient à un autre lot).
- Brises de la Clarée et du Guil, jusque-là purement déduites : la Clarée est désormais sourcée (forum 2009), le Guil reste partiellement déduit (confiance basse).
- Les trois convergences briançonnaises ont été complétées avec le texte du forum (verticale du Fontenil/Janus, « Monsieur Meuble », Le Monêtier–Saint-Chaffrey).

### Ajouté
- Briançonnais : brise de pente Granon et Prorel, Lombarde de la haute Clarée, 14 dangers (Lautaret, zones sous le vent de la Lombarde, DZ PGHM, R221 A/B, dust devils, « cloutage », orages, câbles…), 4 points thermiques, soaring Petit Aréa/Lautaret, tous les décos du Granon et de Serre Chevalier, 9 atterros, effets synoptiques pour 8 régimes.
- Écrins/Vallouise : brises de vallée/pente/descendante, Fournel, Freissinières, 3 convergences, rentrées de N et d'O, gorges sans posé, Cb du Pelvoux, cœur du Parc (dates), 22 décos, 4 routes de cross (3 Chocard + Prorel → Embrun).
- Serre-Ponçon : brise de Gap/Chorges (SE le matin → O), brise de lac (confiance basse), confluence d'Embrun, Chorges (7 décos FFVL), Les Orres, Réallon, Gardette, Montclar, Pierre-Arnoux, soaring.
- Queyras : Ceillac (3 décos, brise, atterro, Lombarde), Izoard (vent arrière O-N, record FAI), gorges, 4 flèches de Lombarde de la carte Chocard, confluence de Mont-Dauphin.
- Ubaye : brise de vallée (FFVL Jausiers/Halte 2000/Saint-Ours), vent de la Bonnette-Restefond, Lombarde/Larche, gorge sans posé, Pra-Loup, Soleil Bœuf, atterros.

### Retiré
Rien de démontré faux n'a été retiré. Les formulations erronées ci-dessus ont été corrigées sur place ; les identifiants d'éléments existants sont conservés (`brise-durance`, `prorel-croix-de-la-nore`, `col-du-granon`, etc.). L'atterro « parking des Chambonettes » (Paraglidream) est remplacé par l'atterro officiel de Vallouise (FFVL 1125) : le repère de la première passe n'a pas pu être confirmé ailleurs.

## 3. Figures déclarées (20 entrées, 8 figures sources)
- F1 : vue 3D annotée de Chocard (page topo cross) — brises orange (Durance et branches), violettes (Queyras/Guil), points rouges (thermiques), « sous le vent » ; lecture visuelle, légende non donnée.
- F2 (une entrée par massif) : carte « Zones à éviter » → dangers et points thermiques.
- F3 (par massif) : carte « Lombarde » → flèches (breezes pass-transfer) et zones sous le vent.
- F4 (par massif) : carte du forum (conflu10.jpg) → confluences Briançon/Guisane, Briançon–Mont-Dauphin, Embrun.
- F5 : vue 3D de la Guisane (étiquettes). F6 : cartes de la page Durance. F7 : carte du cœur du Parc. F8 (par massif) : carte interactive du secteur → décos/atterros.

## 4. Limites et points à vérifier
- **Queyras hors Ceillac/Izoard** (Abriès, Saint-Véran, Aiguilles, Molines, Château-Queyras) : aucune source aérologique trouvée (une école à Ceillac, offres hivernales). Brise du Guil : confiance basse.
- **Flèches de Lombarde dans le Queyras** : polygones lus sur la carte Chocard, nom des cols déduit des coordonnées (marqué « déduction »), axes recalculés (approx).
- **Brise du lac de Serre-Ponçon** : très peu documentée (fiche FFVL Saint-Vincent lac, Ultimate France, Différen'Ciel) ; sens déduit.
- **Ubaye** : pas de convergence documentée, pas de route de cross, Dôme de l'Alpe sans coordonnées ; pas de vitesse chiffrée de la brise de l'Ubaye.
- **Soleil Bœuf** : la fiche FFVL donne 1030 m d'altitude, incohérente avec 2190-2214 m (PGE, Ultimate France) : 2190 m retenu, contrôle MNT sans alerte.
- **Record de l'Izoard** : seuls départ et arrivée sont certains ; points de virage non publiés dans l'article Ozone, traces XContest inaccessibles (401).
- Quelques cumuls issus d'un seul témoignage (confluence du soir à Puy Aillaud, confluence de Mont-Dauphin) sont en confiance basse.
- Les listes de « grands cross » XContest, le site Curl'Air (vide), la page « Les sites » d'Ubaye Parapente (images seules) n'ont rien donné.

## 5. URL bloquées (consignées dans `.cache/research/blocked_urls.txt`)
XContest (401), fiches FFVL en curl (Cloudflare, lues au navigateur), Curl'Air (Cloudflare en curl), Ubaye Parapente (contenu JS/images), Nominatim (429).


## 6. Thermiques et points de relance (passe complémentaire)

Passe demandée par `BRIEF_THERMIQUES.md` : la seconde passe n'avait gardé comme `thermal_spots` que les endroits explicitement appelés « thermique ». Cette passe y ajoute les ascendances de relance, de déclenchement et de plafond que les pilotes nomment le long des cheminements. Convention de confiance : plusieurs récits concordants ou un récit précis = `medium` ; récit isolé ou lieu imprécis = `low` ; extrapolation par le relief et l'exposition, sans récit = `low` avec « déduction » dans la description.

Volumes de `thermal_spots` (avant → après) : Briançonnais–Guisane 4 → 10, Écrins–Vallouise–haute Durance 6 → 14, Serre-Ponçon–Embrunais 2 → 14, Queyras 2 → 2 (description de l'Izoard complétée), Ubaye 0 → 4. Au total 14 → 44. Quatre descriptions existantes ont été complétées (Bouchier, Morgon, Mont Guillaume, Izoard) sans changer d'identifiant.

### Ajouté, avec sources
- **Saint-Vincent-les-Forts** (fil parapentiste.info « Cross au départ de Saint-Vincent les Forts », 2016 et 2018) : ravin de la Séouve et Saint-Jean-Montclar (sortie vers Dormillouse), Dormillouse comme point de relance clé, crête de la Blanche (jusqu'à la tête de l'Estrop, plafonds 2700-3000 m), plateau de la Chau (Montclar), plaine de restitution devant Saint-Vincent ; piège du Pic de Bernardez. La route `st-vincent-dormillouse-morgon` est reconstruite dans l'ordre volé (8 points).
- **Dormillouse → Drac** (fil t24405) : Morgon, Mont Guillaume (« brise de cul », appui dynamique), Chabrières et Chanteloube (conflue), Colombis, Bâtie-Neuve, Piolit ; danger de la dégueulante de Chabrières ; deux routes nouvelles (`dormillouse-vers-drac`, `piolit-chabrieres-morgon`).
- **Chorges** (fiches SPVL, FFVL) : déclencheurs du matin aux Jambons / Pra-Gasta, Colombis, Bâtie-Neuve (confiance basse pour les deux derniers, aucune ascendance décrite).
- **Prorel → Embrun** (récit du 26/03/2010) : rocher sud de la Croix d'Aquila, zone brûlée de L'Argentière, cumulus de confluence de Mont-Dauphin, arête Saint-Clément – Risoul ; la route porte maintenant l'ordre des relances.
- **Vallouise** (Chocard, cross difficile) : thermique entre les Agneaux et la Barre (plafond 4170 m en 2021), crête Blanche – Bans ; waypoints correspondants insérés.
- **Confluences de la Durance** (forum t228, fiches de 2009) : Fontenil / Janus, Briançon Sud (« Monsieur Meuble »), Saint-Chaffrey, verrou de L'Argentière, Embrun, repères d'ascendance stable.
- **Briançonnais** : Combeynot (plafond 4000 m depuis le Granon), Galibier (« bon potentiel thermique »), Serre Chevalier face est (déduction), route Granon → Lautaret.
- **Ubaye** : Dôme de l'Alp (thermiques du soir, Ultimate France), Soleil Bœuf et Pra-Loup (déductions, confiance basse).
- Serre Buzard : falaises à gauche du déco (récit du 2 mars 2010). Les Orres : thermique du télésiège (récit isolé, position approximative).

### Non localisé ou non lu
- Position exacte des conflues de Chanteloube et des falaises de Serre Buzard (approx). Aucune coordonnée pour le Dôme de l'Alp (téléski OSM utilisé).
- Facebook de Parapente Embrun (« thermique de la Fourche ») et blog Curl'Air (403 Cloudflare) : non lus, rien n'a été repris.
- Vidéo YouTube « Triangle de 138 km depuis Barcelonnette » : navigation refusée, route non ajoutée. Scribd « Le parapente dans le Briançonnais » : contenu non rendu.
- Images annotées de Chocard (liens Google Sites tokenisés, 403 en curl) : lues au navigateur, la carte « brises locales et thermiques (en rouge) » correspond aux polygones KML déjà extraits. Aucun thermique nommé trouvé pour Puy-Saint-Vincent, Abriès, Saint-Véran, Guillestre hors Mont-Dauphin.
- Points non extrapolés faute d'indice : Queyras (hors Izoard et Ceillac).

## Passe secteurs minces

Date : 7 octobre 2026. Secteurs les moins documentés, traités un par un. Convention de confiance : récit précis ou plusieurs récits = `medium` ; extrapolation du relief = `low` avec « déduction ». Identifiants existants conservés, rien supprimé. `npm run data:build -- --check` : aucune alerte nouvelle.

### Ubaye (`ubaye`)

Volumes avant → après : brises 3 → 4, convergences 0 → 0, hazards 7 → 8, thermiques 4 → 4 (descriptions complétées), soarings 1 → 1, décollages 4 → 11, atterrissages 7 → 8, effets synoptiques 5 → 6, routes 0 → 1, conseils 6 → 10 ; 11 sources (S94 à S104) ; bbox étendue à [6,4 ; 44,3 ; 6,95 ; 44,62] pour couvrir Maljasset et la haute vallée.

**Sources nouvelles**
- Deux récits de hike and fly du blog *Sev et Mika* : Soleil Bœuf (horaires de brise, côté est avant 10h puis ouest, brise très faible d'est en ouest à 11h à La Chaup, brise excessive dès 11h) et tête de Parassac / lac des Sagnes (haute vallée, brise forte dès 10h-11h, côté ouest uniquement, hexagones verts du Mercantour).
- Site de l'école *Ubaye Parapente* (baptêmes : horaires par site ; école et logistique : terrain d'atterrissage de 6 ha) ; descriptions des vidéos de cross de deux pilotes (252 km FAI du 24 juillet 2021, 138 km du 19 avril 2022, tour de Barcelonnette d'avril 2021 « en respectant le timing de la brise ») ; article de Rock The Outdoor sur le topo « Vols randonnée en Ubaye » (huit sommets).
- Réglementation : arrêté n° 2016-02 du Parc national du Mercantour (texte intégral lu, AIDA) et diaporama FFVL « Réglementation et survols » du 29 mai 2026 (pages Mercantour lues en image).
- Fiches FFVL (Jausiers, Restefond, Halte 2000, Larche plage, Saint-Ours) relues : « vols-randonnées le matin avant la brise ou le soir », « matinée, fin de journée par brises faibles ».

**Ajouté ou corrigé**
- *Brise montante* : horaire précisé (forte dès 11h, jusqu'à 20h au sol au printemps et en été) ; *brise matinale descendante* ajoutée (`medium`, un seul récit précis, avec la phrase de la fiche de Larche plage) avec horaires distincts de la brise montante.
- *Soleil Bœuf* : séquence horaire (est avant 10h, ouest vers 10h20), accès à pied, école à 8h00 ; *Dôme de l'Alpe* : rendez-vous 13h30 et retour 17h ; La Chaup : terrain de 6 ha, brise de 12h à 20h parfois critique.
- *Cœur du Mercantour* : texte réglementaire ajouté (interdiction à moins de 1000 m/sol, dérogations du 1er août au 15 octobre dans trois zones de vol rando et un couloir de vol distance, tous dans les Alpes-Maritimes d'après le géocodeur IGN, donc pas dans l'Ubaye ; vol à voile interdit toute l'année).
- *Nouveaux sites* : décollage de la tête de Parassac et atterrissage du lac des Sagnes (positions approximatives du col et du terrain), six sommets de vol rando cités par le film de l'auteur du topo (positions IGN, orientation inconnue, description volontairement prudente : décollage non précisé).
- *Route* : triangle de 138 km vers le Champsaur et Dormillouse (points nommés et localisés seulement ; Dormillouse prise à la position de la fiche FFVL 5211) ; le 252 km FAI et le tour de Barcelonnette sont cités sans points de passage.
- *Mistral* : effet synoptique ajouté, avec avis divergents sur Saint-Vincent-les-Forts.
- Une première version de la route plaçait Dormillouse à une position non sourcée ; elle a été corrigée avant enregistrement avec la fiche FFVL.

**Introuvable**
- Aucun récit de cross avec points de passage dans l'Ubaye (traces XContest/CFD inaccessibles), aucune convergence documentée, aucune vitesse chiffrée de la brise (les km/h restent des interprétations).
- Pain de Sucre (2560 m, l'un des huit sommets) non localisé par le géocodeur ; Le Peouvou (3230 m) est à Ceillac (Queyras) et n'a pas été ajouté ici.
- Page « Les sites » de l'école (noms seuls), site du club Lame in Air (pas de site), PDF FFVL du Mercantour en images seules : voir `pages_bloquees.txt`.

