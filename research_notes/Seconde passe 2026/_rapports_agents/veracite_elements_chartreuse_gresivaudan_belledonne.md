# Véracité et réécriture des éléments — lot chartreuse_gresivaudan_belledonne

30 octobre 2026. Les 218 éléments du lot (Chartreuse 99, Grésivaudan 33, Belledonne 86) ont été vérifiés contre leurs sources, puis réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`. Seuls les champs `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Les constats non confirmés sont dans `veracite_elements_chartreuse_gresivaudan_belledonne.json`, un objet par constat.

## Méthode

- Pour chaque source citée, le document archivé de `.cache/research/` a été relu : fiches fédérales complètes (`ffvl_sites_raw.json`, `ffvl_sites_alpes.json`), articles du club St Hil'Air (`club_post_*.txt`), base WordPress du CHVD (`vercors_grenoble_trieves/chvd/all_text.json`), fils de forum, PDF du club (texte et pages image `hi-19`, `hi-33` à `hi-35`), carte du parc (`vlcH-1.png`, OCR `col2_*`) et polylignes de la carte de brises (`largeault_paths.json`).
- L'article Kerkhove (S26) a été relu en image (`y_p1` à `y_p4`). Les légendes des figures 1a, 1b, 2a à 2d, 3 et 4 sont désormais vérifiées : l'audit des lots 1-6 ne les avait pas relues.
- Deux pages absentes du cache ont été lues en ligne : S20 (Là-Haut, page Belledonne) et S18 (Frontiers, inversions grenobloises). Les deux confirment le texte. Aucune page bloquée n'a été contournée : S30 (FFVL, Cloudflare) est restée illisible, S102 (fichier Word) n'a pas été téléchargé.
- Contrôles : `text_audit.py` (0 erreur), `text_fidelity.py` (11 points relus, tous justifiés), `npm run data:build -- --check` (réussi).

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 58 |
| NON SOURCÉ | 6 |
| CONTREDIT | 2 |
| NON VÉRIFIABLE | 7 |
| INVRAISEMBLABLE | 0 |
| **Total** | **73**, sur 57 éléments |

Les 161 autres éléments sont CONFIRMÉS : la source porte le texte, ou les données de traces GPS (kk7) qu'il décrit. Par massif : Grésivaudan 18 constats, Belledonne 32, Chartreuse 23.

## Les constats les plus graves

1. **Montbonnot EPAE (Grésivaudan), CONTREDIT.** L'élément était présenté comme un atterrissage, « sans statut d'usage ». La fiche S98 dit : « Terrain militaire, strictement interdit ». Le texte dit maintenant l'interdiction. Le champ structuré est à corriger : cet élément ne devrait pas être un atterrissage.
2. **Saint-Eynard par sud-ouest, CONTREDIT.** Le texte faisait de la zone de cisaillement vent/brise « le bon moment pour passer avant de se poser ». Dans S26, le « bon » est entre guillemets ironiques. Corrigé : c'est un moment délicat.
3. **« +2200 m » lu comme un gain (Grésivaudan, Chartreuse).** « prendre +2200m » (S27) était devenu « prendre 2200 m de plus ». C'est une altitude de départ : « partez avec plus de 2200 m ».
4. **Crête de Belledonne par sud.** Le seuil « 15 à 25 km/h » n'est dans aucune source (S123 : 18 puis 27 km/h). Les 15-20 km/h de S123 sont une vitesse sol, que deux autres fiches prenaient pour un vent (Crêt du Poulet, balcon).
5. **Brise d'Uriage.** Le « 10 h 30, 25 km/h au plus » de S66 vaut pour l'instabilité marquée. Il était donné comme le régime normal. Le conseil « le matin jusqu'à 12 h, puis le soir » vise les pilotes peu expérimentés.
6. **Canicule à Chamrousse.** Le seuil de 36 °C est celui du dôme de chaleur, pas celui du renforcement de la brise du soir (« au delà de 410 en plaine »).
7. **Distances calculées par l'atlas présentées comme des longueurs de vol.** Une boucle de 155 km était dite « de 57 km », un autre vol durait « 57,5 km » et un troisième « 18,6 km ». « Lumbin, à 30 km en aval » était aussi un calcul. Ces distances sont maintenant dites calculées, en note.
8. **Vols fusionnés et heures de récit devenues des règles.** Les Antennes passaient pour une « mauvaise option au-delà de 15h30 », alors qu'il s'agit d'un choix d'un seul après-midi. Le vol du soir de Chamrousse était devenu « un thermique à 20h30 ». Deux vols étaient fusionnés en une phrase (« ouest qui contre » et « bourrasques 25 minutes après »). Un vol entier était mal ordonné (le 154 km « partait des Bauges »).
9. **Convergences et rencontres de brises déduites de flèches, énoncées comme des faits** : Barioz, Cucheron, Granier (Entremont). Elles sont maintenant écrites « probablement », et la note dit la déduction.
10. **Écart 9 de l'audit des lots 1-6, erroné.** S36 donne bien « J'arrive à 1100 … remonte en thermo-dynamique à 1300 » à Bramefarine, puis une seconde fois au Connex. Les chiffres ont été rendus, au titre d'un seul vol. Les 1100 m prêtés au Saint-Genis venaient en revanche de ce passage de Bramefarine : corrigé.

Autres corrections : la brise de Grésivaudan « aspirée » par Voreppe est le régime d'été de S26, pas un cas rare. La brise y est aussi la branche droite de la brise de Chambéry (S3). Les « 35 km/h » de la brise de Voreppe viennent de la fiche d'Uriage. Les 25-30 km/h de S3 valent pour les deux brises de la Savoyarde. Le terme « cool » (doux) avait été traduit par « frais ». Les règles de la digue d'Allevard, du Collet et du Molliet ont été rétablies. La légende d'une photo était présentée comme une observation (Merdaret). La crête de Belledonne fait 40 km, puis rejoint la Lauzière.

## Champs structurés à corriger (non modifiés)

- `gresivaudan/landings/montbonnot-epae` : terrain interdit. À retirer des atterrissages, ou à marquer comme interdit.
- `gresivaudan/breezes/brise-voreppe.speed_kmh` : 20 km/h est déduit d'un adjectif, et 35 km/h vient d'Uriage.
- `gresivaudan/hazards/chamrousse-brise-soir-canicule.conditions` : « > 40 °C ». La fiche écrit « 410 », sans doute 41 °C.
- `belledonne/hazards/belledonne-crete-sud-fort-transitions` : `name` (« 15-25 km/h ») et `conditions` (« SSO de 15 à 27 km/h ») sont à corriger.
- `distance_km` de trois itinéraires de Belledonne (57,0, 57,5 et 18,6) : ce sont des calculs de l'atlas sur les points, pas des longueurs de vol annoncées.

## Hors périmètre, à reprendre par qui de droit

- Conseil de Belledonne « Par sud établi de 15 à 25 km/h, chaque transition… » : même chiffre non sourcé que ci-dessus.
- Visite de Belledonne, « un thermique tient certains jours jusqu'à 20h30 » : la fiche parle du vol du soir, après la fin de la convection.
- Visite de Belledonne, Bramefarine : « ou 2400 m de la Sauge » vient d'un seul vol (S36). À l'inverse, les « 1100 → 1300 m » retirés sur la foi de l'écart 9 sont sourcés (voir plus haut).

## Ce qui n'a pas pu être vérifié

- S30 (page FFVL « Voler en Chartreuse », Cloudflare 403) : bulle du circaète « à plus de 300 m/sol », Versoud « au-dessus de 1400 m », « laisse de chien » de la traversée, « raccrochage souvent bas » vers Sassenage, « crêtes à mouettes ». Les dénivelés et temps de marche des vols rando (Charmant Som, Grand Som, Chamechaude, Grande Sûre, Dent) reposent aussi sur cette page. Ils sont gardés et signalés dans le JSON quand ils comptent pour la sécurité.
- S102 (récit de manche, fichier Word non archivé) : falaises de Lumbin, placement au Manival, gencives en course.
- S17 : la croix interdite et l'antécime du Granier ne figurent pas dans le texte archivé.
- Les flèches de la carte de brises (S28) n'ont pas de pointe dans le KML. Le sens de chaque tracé repose sur l'ordre des points, déjà signalé comme schématique dans les notes.
- Les pourcentages kk7 (S138) n'ont pas été recalculés.
