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


### Queyras (`queyras`)

Volumes avant → après : brises 7 → 7, convergences 1 → 1, hazards 7 → 7, thermiques 2 → 19, soarings 0 → 0, décollages 11 → 12, atterrissages 2 → 3, effets synoptiques 6 → 6, route 1 → 1, conseils 6 → 8 ; 8 sources nouvelles (S105 à S112). `npm run data:build -- --check` : aucune alerte nouvelle ; `npm run model:check` : 0 paire de brises opposées.

**Sources nouvelles ou relues**
- Site du club italien *VentoRelativo* (Pinerolo, quatorze sites de la Val Chisone, de la Val Pellice et de la Val Germanasca) : fiches de Sarsenà (Bobbio Pellice, décollage à 1416 m exposé S/SE, atterrissage sur la route provinciale) et de Prali (décollage du Bric Rond à 2464 m, « bonnes possibilités de se connecter avec la chaîne française qui mène au col de l'Izoard »). Le point chaud à 100 % de la haute Val Pellice est exactement au décollage de Sarsenà (150 m). Le contour du secteur Queyras englobait déjà la haute Val Pellice jusqu'à 7,105 °E : le décollage et l'atterrissage de Sarsenà sont ajoutés. Prali (décollage du Bric Rond, hors du contour au nord) n'est cité que dans un conseil, et les autres sites du club ne sont pas repris, pour ne pas étendre encore le contour (voir plus bas).
- Cross Country Magazine (déjà lus pour les routes de l'Izoard) : récit du record junior de Hans Petit (7 août 2025 : décollage à 9h11, 2900 m au-dessus du Clôt la Cime, cap vers la frontière italienne), triangle d'Edouard Potel (18 août 2025 : aller-retour vers l'est au départ) et triangle de 306 km d'Honorin Hamard depuis le col Agnel (9 juillet 2016).
- Topo Chocard (Izoard, Ceillac, Brunet) relu ; points chauds de thermal.kk7.ch, IGN (altitude, pente, exposition) et OpenStreetMap/Nominatim (noms italiens).

**Ajouté**
- *Izoard* (`medium` pour Clot la Cime et Coste Belle, `low` pour le Tronchet) : trois points chauds à 91-97 % au droit des deux décollages classiques ; l'automne de Coste Belle (« thermiques généreux ») est confirmé par le profil mesuré.
- *Ceillac* : thermique du vol rando de Brunet (`medium`, texte de Chocard : « placé haut pour un départ en thermique ») au sommet, avec le point chaud à 100 % des ravins de Rabinoux et de la Charpenelle, 2 km plus à l'est ; col Fromage et crête de la Selle (`low`). Le texte de Brunet n'avait pas de thermique : il en a maintenant un à moins de 1 km.
- *Col Agnel et limite de l'Ubaye* (`low`, tous cinq issus des traces GPS) : deux pentes à 98 % au sud du col Agnel, deux points à 90-91 % dans le vallon des Hugues (Saint-Paul-sur-Ubaye).
- *Haute Val Pellice (Italie)* : Sarsenà (`medium`) et six points à 92-95 % (La Roussa, Crosetta, Meisuns, pentes de 2365 et 2520 m), `low`.
- Deux conseils sur la liaison Queyras – Italie par la crête frontalière (Prali) et sur Brunet.

**Introuvable**
- Aucun récit de pilote ne décrit les ascendances d'Abriès, de Saint-Véran, d'Aiguilles, de Molines ni de Château-Queyras (forum de 2013 sans réponse), ni la haute Val Pellice en vol ; les sept points italiens autres que Sarsenà ne reposent que sur les traces GPS.
- Les pages Chocard « grands cross au départ du Col de l'Izoard » et « Puy Aillaud » ne contiennent que des liens vers des traces non lisibles ; les traces de Potel et de Petit (XContest, connexion) ne donnent pas les points de passage de l'est.
- Effet de bord à connaître : les contours de secteur sont construits sur les éléments étudiés (enveloppe convexe tamponnée de 2,5 km). Documenter Sarsenà (7,114 °E) a repoussé le contour du Queyras de 0,06° vers l'est, d'où quatre nouveaux points chauds à 90-96 % dans le secteur (7,14 à 7,19 °E, autour de Villanova Pellice et du Giuic, 44.821 à 44.835 °N) que le rapport KK7 liste maintenant et que je n'ai pas traités : le club VentoRelativo décrit le Giuic (décollage de Sea di Torre, 1257 m, S/SO, 44.839933 N 7.197992 E, atterrissage au Blancio) mais l'ajouter étendrait encore le contour vers Pinerolo. À trancher par le propriétaire : documenter la Val Pellice complète ou la laisser hors atlas.


## Audit des thermiques (octobre 2026)

Contexte et méthode : voir la section du même nom dans `chartreuse_gresivaudan_belledonne.md` et celle de `vercors_grenoble_trieves.md` (pente, exposition et altitude lues sur le terrain IGN à chaque point chaud ; toponymes IGN ; topos de Chocard Airlines et carte du club en KML, fiches FFVL, récits CHVD). Secteurs repris : Briançonnais – Guisane, Vallouise – haute Durance, Serre-Ponçon – Embrunais, Ubaye. Le Queyras, traité par la passe « secteurs minces », n'a pas été repris ; ses points chauds de la Val Pellice italienne restent hors atlas.

### Briançonnais – Guisane (`brianconnais-guisane`)

**Thermiques créés (2)**
- `granon-petit-area-pente-sud` (`medium`) : le Petit Aréa est « la zone qui s'active en premier dans la journée » (fiche FFVL 14077, topo Chocard) ; point chaud à 92 % à 140 m, sur la pente sud à 2139 m. Les crêtes du Granon n'avaient qu'une position lue sur le topo, à 1,8 km.
- `granon-tronchets-pentes-sud-est` (`low`) : le topo écrit des Tronchets qu'il « permet quand même de beaux vols thermiques si l'instabilité est suffisante » ; point chaud à 88 % à 1 km à l'est et 200 m plus haut.

**Positions corrigées**
- `atterro-pontillas` (1684 m → 1388 m) et `atterro-hiver-casse-du-boeuf` (1690 m → 1399 m) : altitudes lues sur le terrain IGN (les positions, pré du plan d'eau et front de neige de Villeneuve, ne sont pas en cause).

**Non résolu** : `serre-chevalier-foret` (2195 m déclarés, 2371 m au terrain) et `serre-chevalier-vallons` (2234 m, 2506 m ; vents favorables NE/E/SE alors que la pente du point est au sud-ouest) : décollages d'hiver à ski dont ni le topo Chocard ni la carte du club ne donnent la position ; aucune pente à l'altitude déclarée et à la bonne exposition à moins de 700 m pour Vallons. Notes ajoutées aux descriptions.

**Lacunes écartées** : Montgenèvre – Le Chalvet (décollage d'hiver à ski, 5,9 km du thermique le plus proche, aucun point chaud à moins de 11 km) ; Serre Chevalier – Vallons (hiver, voir plus haut) ; Prorel (87 % à 1 km de la Croix de la Nore, qui a déjà les barres de Notre-Dame-des-Neiges à 615 m) ; Puy Chalvin (83 %) ; points chauds de haute montagne à 80-89 % (Paillon, Chamoissière) sans texte.

### Vallouise – haute Durance (`ecrins-vallouise-haute-durance`)

**Thermiques créés (15)**
- `alpages-pelvoux-pente-sud-est` (`medium`) : 98 % à 550 m du décollage des Alpages. Le topo de Vallouise (Chocard) : alpage « vol plus long, extraction en thermique plus facile, souvent au dessus de la couche d'inversion » et secteur où « les thermiques peuvent se mettre en place assez tôt (à partir de 9h00 parfois !) à toutes les saisons » ; la carte du club le donne « souvent la meilleure option à l'automne ». Le mot « bulle » du danger des Alpages est ainsi traité.
- La ligne des faces sud du cross « Promenade dans les Écrins » (Chocard, plafond 4170 m le 21 juillet 2021 : « le cheminement au dessus des crètes entre le Blanche et les Bans est idéal avec des faces exposées Sud ») : `blanche-faces-sud-pente` (`medium`, 94 %), `clapouse-faces-sud-est-pente` (94 %), `entrayques-faces-sud-pente` (93 %), `aguyes-pied-sud-ouest` (99 %), `aguyes-crete-sud` (92 %), `boeufs-rouges-gersa-pente` (93 %), `sialouze-faces-sud-pente` (94 %), `malamort-clausis-pente-sud-est` (90 %). Le thermique documenté « crête entre la Blanche et les Bans » n'avait qu'une position de milieu de route (2 à 3 km au nord des points chauds) ; il est conservé et renvoie à ces éléments.
- `serre-buzard-crete-roche-aigue` (97 %, crête qui prolonge Serre Buzard vers la Roche Aiguë), `puy-saint-vincent-pentes-est-lauzes` (96 %), `la-pendine-sommet-pente-est` (89 %, FFVL « La Pendine » sans thermique à moins de 5,7 km), `clocher-saint-clement-pentes-ouest` (96 %), `fressinieres-testa-moute-pente-est` (81 %, Testa Moute et Aujards sans thermique à moins de 4,8 km), `ponteil-falaises-sud` (81 %, Le Ponteil et Roche Charnière) en `low`.

**Lacunes écartées**
- La Condamine (3,3 km du thermique le plus proche, hotspot à 4,3 km) et Les Têtes de L'Argentière (3,2 km ; zone « souvent très turbulente » sous la Lombarde) : décollages de marche et vol sans texte d'aérologie.
- Dangers `coeur-parc-ecrins`, `lombarde-sous-le-vent-tete-aval`, `rentree-ouest-entraigues`, `sous-le-vent-tete-du-puy`, `les-alpages` : les mots « thermique » et « bulle » y désignent la zone sous le vent, la « bulle de protection » des hauts sommets ou la réglementation du cœur ; les thermiques de la Tête d'Aval et de la Tête du Puy sont déjà décrits (positions à 560 m et 580 m des sommets IGN, vérifiées).

### Serre-Ponçon – Embrunais (`serre-poncon-embrunais`)

**Thermiques créés (3, `medium`)**
- `saint-vincent-falaise-sous-le-deco` : point chaud à 98 % (97 à 99 % à toutes les saisons) à 360 m au nord du décollage, c'est-à-dire la falaise ; invisible dans le rapport KK7 parce qu'à 880 m du thermique approximatif de la plaine. Fiche FFVL : « conditions fortes l'après midi (juin juillet août) […] seul site utilisable par mistral ».
- `chorges-clot-rond-pente-sud-ouest` : 100 % le matin, 99 % à midi, rien le soir, 860 m à l'ouest du Clot Rond ; les fiches de Clot Rond, des Ballons et des Jambons disent « à utiliser plutôt le matin pour des départs en cross ».
- `mont-guillaume-deco-pente-sud-ouest` : la fiche FFVL dit « régime de brise thermique dominante (secteur SW) » ; point chaud à 85 % à 195 m du décollage.

**Positions corrigées** : `atterro-reallon-courtier` (1500 m → 1598 m, terrain IGN).

**Lacunes écartées** : Chorges – Champ Froid (FFVL 13381, « déco orienté plein sud ») : aucun texte d'ascendance, point chaud à 75 % à 2,2 km (vers le lac) et à 100 % à 3,0 km (le Clot Rond, créé ci-dessus) ; points chauds à 80-87 % (Chabrières, Les Orres, Morgon) déjà couverts à moins de 3 km par des thermiques décrits.

### Ubaye (`ubaye`)

**Thermiques créés (2, `low`)** : `faucon-barcelonnette-pente-sud-est` (88 % à 263 m du décollage de Faucon, 94 % le matin) et `decollage-de-la-croix-pente-sud-est` (83 % à 790 m du point « Décollage de la Croix » de la carte Chocard).

**Lacunes écartées** : les sept décollages « sommet de vol rando » (Aiguille Grande, Aiguille Pierre André, La Meyna, Parrias Coupa, Pointe des Cirques, Tête de Moïse, Tête de Parassac) : sommets cités par un topo de vol rando sans orientation ni heure, aucun point chaud à moins de 5,8 km ; rien n'a été créé (une description serait inventée).

**Non résolu** : `pointe-des-cirques-ubaye` (3234 m déclarés, 3099 m au point) et `aiguille-pierre-andre-ubaye` (2812 m, 2688 m) : positions de géocodeur décalées de quelques centaines de mètres du sommet ; le point exact du sommet n'a pas pu être établi sans ambiguïté sur le MNT.

## Résolution des limites (octobre 2026)

Date : 7 octobre 2026. Les limites de données restantes après l'audit des thermiques (`docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`, `docs/COUVERTURE.md`) ont été reprises pour Briançonnais, Écrins, Queyras, Ubaye. Aucun identifiant supprimé ni renommé ; chaque correction est notée dans la description de l'élément (« Résolution des limites (octobre 2026) : … »).

### 2. Écarts d'altitude (`docs/POSITIONS.md`)

Constat préalable : le relevé d'altitudes IGN demandait les points par lots de 100, or le service d'altimétrie (`data.geopf.fr/altimetrie`) n'est exact que jusqu'à une trentaine de points par requête (testé : lots de 25 et 30 identiques aux requêtes unitaires, lots de 33 et plus décalés de 10 à 110 m, parfois bien plus). 1159 des 1349 valeurs du cache `positions/altitudes_ign.json` étaient décalées ; le cache a été régénéré par lots de 25. Sur les altitudes exactes la liste n'était plus de 16 mais de 17 écarts : quatre faux positifs disparaissaient (Plaines de Poët 878 m pour 880 m, Méruz – Char Marin, Roche Veyrand, Aiguille Grande 76 m), cinq écarts apparaissaient (Manival, Mont Julioz, L'Écureuil et le versant de Peisey-Vallandry, Cuchon). Tous sont tranchés : 0 écart. La règle suivie : on garde la position quand elle est confirmée par un repère indépendant (gare d'arrivée de télésiège OSM, point de ParaglidingEarth, nœud OSM d'un sommet, coordonnées du guide papier) et l'on corrige l'altitude ; on déplace la position quand c'est elle que le repère indépendant contredit.

- **Serre Chevalier – Vallons** (`serre-chevalier-vallons`) : position conservée (fiche FFVL 13668 ; la gare d'arrivée du télésiège des Vallons, OSM, est à 40 m, 2502 m ; la fiche dit « accès remontées mécaniques, 5 minutes de marche »), altitude 2234 → 2506 m (terrain IGN).
- **Serre Chevalier – Forêt** (`serre-chevalier-foret`) : position conservée (la gare d'arrivée du télésiège de la Forêt, OSM, 2392 m, est à 110 m), altitude 2195 → 2371 m (terrain IGN). Le seul relief à 2195 m alentour est le bas du téléski de l'Alpage, à 470 m, que rien ne désigne comme décollage.
- **Pointe des Cirques** (`pointe-des-cirques-ubaye`) : position du géocodeur IGN décalée de 140 m (3100 m de terrain pour 3234 m) ; remplacée par le nœud OSM du sommet (ele 3234 m) qui tombe sur le point culminant du relief (3213 m). **Aiguille Pierre André** (`aiguille-pierre-andre-ubaye`) : le géocodeur IGN et OSM tombent sur une pointe de 2717 m, 95 m sous l'altitude cartographiée (2812 m) ; position déplacée de 282 m à l'ouest sur le sommet du relief qui concorde (2841 m), `approx`. **Aiguille Grande** : son terrain exact est à 2988 m pour 3064 m (écart 76 m, sous le seuil), le sommet du MNT (3013 m) est à 60 m du toponyme IGN : laissée en l'état.

### 3. Thermiques documentés loin de tout point chaud

Examen des 119 thermiques à plus de 2 km de tout point chaud ≥ 70 % : position contrôlée contre le géocodeur IGN (toponyme à moins de 120 m pour 51 d'entre eux), l'altitude déclarée contre le terrain IGN exact (concordante à 35 m près pour 30 autres) et le relief (croupe, flanc ou creux, orientation). Très peu sont mal placés ; la plupart sont loin des points chauds parce que le site est peu volé, parce que l'ascendance est un plafond ou une relance de haute montagne, ou parce qu'elle vient d'une confluence ou d'une plaine que les traces ne distinguent pas. Le plus proche point chaud ≥ 70 % et la raison sont notés ci-dessous ; un point chaud plus faible (30 à 70 %) à moins de 1 km est mentionné quand il existe.

- **Fort de la Croix de Bretagne** (`thermiques-fort-croix-bretagne`), **Tête d'Aval** (`thermiques-tete-aval`) et **Tête du Puy** (`thermiques-tete-du-puy`) : leur position, jusque-là `approx`, est le centre du polygone du même nom dans le KML « Zones à éviter » du Chocard Airlines (S15, géoréférencé : écart de 1 à 3 m) ; elle passe en `source` (position de la zone, non d'un déclencheur précis). Le polygone du Fort est à 620 m du fort lui-même (IGN) : c'est la zone de pentes rocheuses, non le fort.

**Gardés à leur place, avec la raison :**

| Élément | Position vérifiée par | Point chaud ≥ 70 % le plus proche | Pourquoi loin des traces |
| --- | --- | --- | --- |
| `brianconnais-guisane/thermiques-fort-croix-bretagne` | centre du polygone KML du Chocard (S15) | 5,7 km (82 %) (plus faible : 787 m (68 %)) | site peu volé |
| `brianconnais-guisane/therm-conf-fontenil-janus` | toponyme IGN « le Fontenil » à 5 m | 5,2 km (75 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `brianconnais-guisane/therm-conf-briancon-sud` | position sourcée (relief cité par le récit) | 3,1 km (83 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `brianconnais-guisane/therm-conf-saint-chaffrey` | position déduite du texte (approximative) | 2,7 km (88 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `ecrins-vallouise-haute-durance/thermiques-tete-aval` | centre du polygone KML du Chocard (S15) | 2,5 km (76 %) | site peu volé |
| `ecrins-vallouise-haute-durance/thermiques-tete-du-puy` | centre du polygone KML du Chocard (S15) | 2,6 km (78 %) (plus faible : 307 m (61 %)) | site peu volé |
| `ecrins-vallouise-haute-durance/thermiques-confluences-durance` | position déduite du texte (approximative) | 4,1 km (83 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `ecrins-vallouise-haute-durance/therm-zone-bruleee-argentiere` | position déduite du texte (approximative) | 2,6 km (77 %) | site peu volé |
| `ecrins-vallouise-haute-durance/therm-mont-dauphin-cumulus` | toponyme IGN « Mont-Dauphin » à 2 m | 2,5 km (73 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `ecrins-vallouise-haute-durance/therm-arete-clement-risoul` | position déduite du texte (approximative) | 3,6 km (96 %) | ascendance de passage d'un cheminement de cross peu enregistré |
| `ecrins-vallouise-haute-durance/therm-crete-blanche-bans` | position déduite du texte (approximative) | 2,2 km (76 %) | site peu volé |
| `ecrins-vallouise-haute-durance/therm-conf-verrou-argentiere` | position déduite du texte (approximative) | 2,4 km (89 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `serre-poncon-embrunais/therm-chabrieres-conflue` | toponyme IGN « Crête de Chabrières » à 5 m | 2,3 km (75 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `serre-poncon-embrunais/therm-conf-embrun-clement` | position déduite du texte (approximative) | 4,5 km (81 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
