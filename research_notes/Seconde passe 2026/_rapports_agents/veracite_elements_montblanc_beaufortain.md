# Véracité et réécriture des éléments — lot montblanc_beaufortain

31 octobre 2026. Les 194 éléments du lot (Mont-Blanc–Chamonix 72, Val Montjoie–Saint-Gervais 39, Val d'Arly–Megève 40, Beaufortain 43) ont été vérifiés contre leurs sources, puis réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`. Seuls `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Chaque constat non confirmé est dans `veracite_elements_montblanc_beaufortain.json`, un objet par constat.

## Méthode

- Documents relus dans `.cache/research/docs/montblanc_beaufortain/` : brochure des clubs du Pays du Mont-Blanc (S2/S3, même texte de 2008), pages du club Gratte-Ciel (S35 à S50, menus retirés), CMBVL (S51), Chamoniarde (S9), AeroVFR (S11), chamonix.net (S7, S10, S12, S52, S53, S54), XC Mag (S13), Barbules (S15), fil de forum (S56), Joly Jumpers (S64), Volatiles (S60), Flyappi, Syride, récits (S28, S66, S67, S72, S73, S74), vidéos (descriptions S69, S70). Ailleurs dans le cache : récits du CHVD (`vercors_grenoble_trieves/chvd/all_text.json` : S55, S90, S129, S156 à S160, S163), L'Aile et la Cuisse (S149, cache Tarentaise), Bluesteam (S155, cache Oisans). Fiches fédérales dans `sources/ffvl_sites_alpes.json`, ParaglidingEarth dans `pge/bbox.json`.
- Les arrêtés scannés des Saisies et de Hauteluce (S61, S62) ont été lus par OCR (tesseract) : 50 m des obstacles et passage sous obstacle interdit, confirmés.
- En ligne, deux recherches et une page : le décret de reclassement de la réserve des Aiguilles Rouges (27 janvier 2010, article 19, via AIDA) et la date de l'interdiction du sommet. Aucune page bloquée n'a été contournée.
- Contrôles : `text_audit.py` 0 erreur ; `text_fidelity.py` 20 points relus, tous voulus ; `npm run data:build -- --check` réussi.

## Bilan

| Verdict | Chamonix | Saint-Gervais | Megève | Beaufortain | Total |
|---|---|---|---|---|---|
| DÉFORMÉ | 22 | 6 | 9 | 10 | 47 |
| NON SOURCÉ | 7 | 5 | 6 | 2 | 20 |
| CONTREDIT | 1 | 0 | 1 | 4 | 6 |
| INVRAISEMBLABLE | 1 | 0 | 0 | 1 | 2 |
| NON VÉRIFIABLE | 2 | 4 | 3 | 4 | 13 |
| **Constats** | 33 | 15 | 19 | 21 | **88** |

Les 88 constats portent sur 65 éléments. Les 129 autres sont CONFIRMÉS sur les points contrôlés. Tous les éléments ont été réécrits.

## Les constats les plus graves

1. **FL 115 inversé (zones du Mont-Blanc).** « Ne pas pénétrer sous 1000 m/sol ni au-dessus du FL 115 » : pour traverser, il faut être à la fois à plus de 1000 m/sol et au-dessus du FL 115. Corrigé.
2. **Zone 30 C.** Le texte laissait entrer les parapentes du 1er juin au 15 octobre. Ils n'y entrent qu'en juin et du 1er septembre au 15 octobre ; en juillet-août, on contourne (SUP AIP 120/21). La note qui voyait deux jeux de dates contradictoires est corrigée.
3. **Réserve des Aiguilles Rouges : un ancien règlement.** Le décret de 2010 (article 19) fixe 300 m/sol pour les aéronefs non motorisés. Les 1000 m/sol de la brochure de 2008 valent aujourd'hui pour les motorisés.
4. **Sommet du Mont-Blanc.** L'arrêté municipal des 600 m ne valait que jusqu'au 30 juin, sans doute en 2019, et non « probablement 2024 ». Il passe en note historique.
5. **Grands Montets.** Les « 10 minutes de marche » partaient de l'ancienne gare sommitale, dont l'accès est barré. La restriction aux « deltas souples repliables » visait les deltas seuls. « L'air porte mal à cette altitude » venait de la fiche de l'Aiguille du Midi.
6. **Bisanne → Albertville → Aravis (CONTREDIT).** Le vol cité (S27) part de Chartreuse et ne passe jamais à Bisanne. Le texte décrivait en fait le retour des Aravis vers la Combe de Savoie.
7. **Atterrissage à Arêches (CONTREDIT).** La brise de Doron était dite « forte à l'atterrissage de Beaufort comme à celui d'Arêches ». Il n'y a pas d'atterrissage à Arêches.
8. **Heures d'un vol érigées en règle.** « Décoller avant ≈11h50 » ou « vers midi » au Signal de Bisanne, alors que 11h49 est l'heure d'un seul vol. Même défaut pour la Pierra Menta (11h), le Mont Rosset (11h30-12h), Planpraz (« départs de cross dès 10h ») et le Brévent (« chauffée dès midi », contre 98 % le matin dans les traces).
9. **Directions et lieux.** Le col de la Seigne était placé « au sud-est » des Chapieux, alors qu'il est au nord-est. Au Chailloud, « entre la voie express et l'Arve » décrivait l'atterrissage de Cachat, pas la marche. Les 560 m de Roselend sont la hauteur de l'atterrissage, pas celle des falaises. La PTU « main gauche » était celle d'un atterrissage, pas d'un décollage.
10. **Hypothèses ou choix d'un pilote dits comme des faits.** Roche Pourrie « face à la brise d'Annecy » était une hypothèse : le nord dominait ce jour-là, et le pilote n'était pas passé par la Dent de Cons. « Thermiques de plus de 2 m/s » était sa règle de choix. Aux Chapieux, il a choisi de ne pas redécoller, par fatigue : il n'en était pas empêché faute de hauteur. Une question de forum sur la réserve était donnée comme observation.

Autres corrections : Dômes de Miage, décollage « dans la réserve » au lieu de « à cause de la réserve » ; Mont Joux, c'est le décollage qui est dans le parc de l'alpage ; Marlioz et Batistock sont deux terrains ; La Charme, distance calculée par un wiki prise pour un parcours ; Bisanne Nord-Ouest, divergence sur le fort vent du nord ; turbulence en sortie du Prarion due au petit foehn ; Savoy, fenêtre H+40/H+55 et accès réservé aux signataires de la charte ; deux vols fusionnés au Brévent ; « Chamonix–Annecy » ajouté au vol de 200 km.

## Avant / après

**Grands Montets — crevasses**
- Avant : « L'accès se fait par le téléphérique de Lognan, puis par 10 minutes de marche sur un glacier non balisé, où l'encordement est conseillé. Le site n'est plus accessible qu'aux deltas souples repliables, le tremplin a été démonté, et l'air porte mal à cette altitude. »
- Après : « Le téléphérique sommital ne sert plus d'accès : depuis Lognan, on rejoint le décollage par le glacier des Grands Montets, un itinéraire de haute montagne non balisé et très crevassé, de préférence encordé. Pour les deltas, seules les ailes souples repliables passent encore, et le tremplin a été démonté. »

**Bisanne → Albertville → Aravis**
- Avant : « La traversée de Bisanne vers les Aravis rentre par les faces ouest des Aravis, le col des Aravis, le col du Charvin, la Dent de Cons, la Belle Étoile, puis le Grand Arc et Chamoux. »
- Après : « Aucun vol relu ne relie Bisanne aux Aravis par Albertville. Le parcours décrit est le retour d'un triangle parti de Chartreuse : des Aravis, par les faces ouest, le col des Aravis, le col du Charvin, la Dent de Cons et la Belle Étoile, puis la combe sud du Grand Arc et Chamoux. »

**Roche Pourrie**
- Avant : « … après la transition depuis la Dent de Cons et le Mont Charvin, la Roche Pourrie, orientée à l'ouest-nord-ouest, peut récupérer la brise d'Annecy. »
- Après : « À l'entrée du Beaufortain, après la longue transition depuis le Mont Charvin, la Roche Pourrie permet de se refaire. On l'imagine bien orientée à l'ouest-nord-ouest pour la brise d'Annecy, mais le jour décrit, c'est le vent du nord qui dominait. »

## Contrôles

- `text_audit.py montblanc_beaufortain` : 0 erreur. Avertissements : chiffres repris des constats (2019, 2010, 27, 19, 2022, 9), tous dans des notes et justifiés par le JSON. Deux descriptions dépassent la visée : la zone réglementée (491 caractères, dates et règle de traversée indispensables) et le foehn (502 caractères, liste des signes de la brochure gardée entière). L'avertissement « année 2000 » de la visite de Megève n'est pas de ce travail.
- `text_fidelity.py` : 20 points, tous voulus (noms retirés à dessein : Arêches, Dent de Cons, Chamonix–Annecy, Chedde ; « sud-est » de la Pointe de Mya, sourcé).
- `npm run data:build -- --check` : réussi.

## Champs structurés à corriger (non modifiés)

| Élément | Champ | Problème |
|---|---|---|
| mont-blanc-chamonix/planpraz-relance-depuis-plan-de-l-aiguille | `best_hours` | « départs de cross dès 10h » : le site peut marcher dès 10 h un bon jour |
| mont-blanc-chamonix/grandes-jorasses-thermique-italien | `best_hours` | « avant 15h » : heure de l'arrivée sous le Mont-Blanc |
| mont-blanc-chamonix/brevent-faces-sud-est-plan-lachat | `best_hours`, `trigger` | « de midi à la fin d'après-midi », « chauffée dès midi » : les traces donnent 98 % le matin |
| mont-blanc-chamonix/chamonix-annecy, chamonix-valais | `distance_km` | 56 et 25 km calculés par l'atlas (source : aller-retour de 100 km) |
| val-montjoie-saint-gervais/tre-la-tete-ascendance-4300 | `best_hours` | « après-midi » non sourcé |
| val-montjoie-saint-gervais/porcherey-mont-joly-saisies | `distance_km` | 20 km calculés |
| val-arly-megeve/brise-matinale-descendante-arly et -arve-megeve | `speed_kmh`, `hours` | 5/10 km/h et 21h-9h inventés pour un vent déduit (mettre null) |
| val-arly-megeve/bisanne-aiguille-croche-praz-aravis-2020, bisanne-mont-joly-mont-blanc-2012 | `distance_km` | 33,2 et 17,1 km calculés |
| beaufortain/roche-pourrie-brise-d-annecy | `trigger` | « face à la brise d'Annecy » : hypothèse du pilote |
| beaufortain/bisanne-albertville-aravis-transition | `name`, tracé | le vol cité ne passe pas à Bisanne |

## Hors périmètre (textes d'autres agents qui portent la même erreur)

- Megève, conseil 7 : « décollez avant que la brise ne s'installe, vers midi ; en été, avant 11h50 » (heure d'un seul vol).
- Mont-Blanc, visite étape 13 : arrêté municipal des 600 m présenté comme en vigueur (il valait jusqu'au 30 juin).
- Mont-Blanc, visite étape 12 : « des thermiques à plus de +2 m/s en Italie » (règle de choix d'un pilote) ; étape 11 : « faites le plein, jusqu'à plus de 3400 m » à Varan (plafond d'un vol).
- Mont-Blanc, conseil 7 et visite étape 10 : « des documents plus anciens donnent encore 1000 m/sol » (exact, mais le décret de 2010 tranche à 300 m/sol).
- Val Montjoie, visite étape 6 : Dômes de Miage, décollage « dans la réserve ».
- Beaufortain, visite étape 3 : « À Beaufort et à Arêches, le vent de vallée est souvent fort » (pas d'atterrissage à Arêches) ; étape 5 : falaises du Biolley « 560 m plus bas » ; étape 7 et conseil 2 : PTU main droite vers Albertville présentée comme la règle (un seul posé ; le conseil 2 la rattache à S131, qui ne la donne pas) ; étape 14 : Roche Pourrie « face à la brise d'Annecy » et « depuis Bisanne, on peut rejoindre les Aravis par Albertville ».

## Ce qui n'a pas pu être vérifié

- S16 (biplace Saint-Gervais), S153 (Aiguillette des Houches, 2026) et S31 ne sont pas archivés. La cible « terrain de foot » de la piscine et le vol thermique de l'Aiguillette sont gardés sans relecture.
- Fiches fédérales absentes de la récolte : S116, S117 (Ban Rouge : « pas d'ascendances particulières »), S133, S136. Il manque aussi le texte complet de S125 (Marthod).
- Durées de marche non retrouvées : Petite Berge (30 min à 1 h), Roche Parstire (40 min), Grand Mont (2h30 à 3 h) ; vache de secours du col du Joly « à 50 m », atterrissage « 4 km plus bas » ; « fiche officielle 1030 m » du Plancert.
- Statut actuel : le Prarion Nord-Est n'est pas dans la liste des décollages autorisés de la Chamoniarde, et le club le dit en cours de conventionnement. L'accès routier de Bisanne diverge selon les sources (fermeture estivale, ou fin de l'accès en voiture depuis le 9 juillet 2022). L'état actuel du téléphérique sommital des Grands Montets reste à confirmer.
- Les dates de la LF-R 30 B et de la ZRT 30 C viennent du SUP AIP 120/21 et du club. L'AIP en vigueur en 2026 n'a pas été relue : à vérifier chaque saison.
- Les pourcentages kk7 (S164) n'ont pas été recalculés.
