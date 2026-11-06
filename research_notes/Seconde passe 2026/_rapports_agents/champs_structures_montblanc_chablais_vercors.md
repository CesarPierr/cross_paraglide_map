# Champs structurés corrigés — lots Mont-Blanc, Chablais, Vercors

6 novembre 2026. Détail ligne à ligne, avec avant, après, source et raison : `champs_structures_montblanc_chablais_vercors.json`.

## Lecture du code

- `best_hours`, `trigger`, `distance_km`, `speed_kmh` sont facultatifs. Sans `best_hours`, le contrôle du modèle suppose le milieu de journée. Sans `distance_km`, la liste des itinéraires calcule la longueur du tracé, et la fiche n'affiche plus de « Distance ». Sans vitesse, le modèle prend sa valeur par défaut et l'affiche comme « non documentée ».
- `hours` d'une brise descendante est indispensable : sans fenêtre, elle suit le cycle de jour de la brise de vallée. `conditions` d'un piège pilote le modèle par le vent cité : celui-ci reste le même sur toutes les fiches corrigées.

## Choix à relire

- Distances : toutes les distances calculées des trois lots sont retirées, y compris celles que les rapports ne listaient pas (31). Deux sont remplacées par la valeur de la source : Salève–Planfait 39 km, triangle du Salève 143 km. Restent celles que donne une source : 75, 85, 50, 204 et 45 km.
- Vitesses gardées comme estimations : Giffre 20, Aulps 20, Abondance 25, cluse de Voreppe 20 km/h. Les sources disent « modérée à forte », « soutenue à forte », « très forte », « forte » : le défaut de 15 km/h les affaiblirait. Le `max` est retiré, et la note dit l'estimation.
- Écoulements descendants de Megève : heures chiffrées et vitesse retirées. `hours` reste sous forme de mots, car le modèle en a besoin ; la note dit l'estimation.
- Carrière d'Étrembières : l'« après-midi » inventé est remplacé par ce que mesurent les traces GPS (midi et soir, S220). La simple suppression faisait échouer le contrôle à 13h30.
- R196B : FL125 retenu (club du Diois et `airspace.json`), FL195 de la fiche du Serpaton signalé.
- Sources ajoutées : S221 et S222 (Chablais), S270 (Vercors). Aucun identifiant n'est renommé.

## Contrôles

`npm run model:check` lit `apps/web/public/data/atlas.json`, que `--check` ne réécrit pas : il ne voit donc pas ces corrections (1203/1329 avant comme après). La mesure utile vient d'un atlas compilé hors du dépôt, sur une copie figée des autres lots :

| | Avant | Après |
|---|---|---|
| Total | 1203/1329 | 1204/1329 |
| Brises | 258/275 | 258/275 |
| Convergences | 64/72 | 64/72 |
| Thermiques | 726/823 | 727/823 |
| Pièges | 155/159 | 155/159 |
| Paires opposées | 0 | 0 |
| Défauts de données | 16 | 16 |

Seul changement de statut : `quatre-tetes-falaise-est` passe d'échec à réussi, le « dès la fin de matinée » non sourcé ayant disparu. Ce test sans heure est donc moins exigeant : il ne prouve pas que le modèle déclenche au bon moment.

`npm run data:build -- --check` : code 0. `text_audit.py` : 74 erreurs, toutes sur des champs corrigés ici. La comparaison complète avec HEAD donne 118 champs modifiés, tous consignés, aucun autre.

## Pour décision

- `beaufortain/bisanne-albertville-aravis-transition` : aucun vol ne l'atteste. Renommé en tracé indicatif, à garder ou à retirer.
- `vercors-nord/ffvl2227-autrans-la-plaine-thermique-fevrier` : spot de snowkite classé en thermique. Le schéma n'a pas de catégorie adaptée. Nom et champs le disent, à garder ou à retirer.
- `val-arly-megeve/brise-matinale-descendante-arly` et `-arve-megeve` : vents sans source, à garder ou à retirer.
- Ids conservés bien qu'ils portent l'ancienne idée : `rebat-evian`, `rebat-thonon`, `morget-evian`, `roche-pourrie-brise-d-annecy` (ce dernier est cité par des visites).
- `Routes.tsx` affiche toujours la longueur du tracé dans la liste des itinéraires : c'est une longueur calculée, sans mention de cette origine.

## Non vérifié

- S13 : le passage « as early as 10 am » est repris du rapport de véracité, sans nouvelle relecture.
- S162, S163 (fermeture de Saint-Jean), S85, S73 et S74 : repris des constats, sans nouvelle relecture.
- R196B : ni l'AIP ni le SIA n'ont été relus.
- Sources non archivées ou non relues pour les autres champs des mêmes fiches, non signalés par les rapports (par exemple `best_hours` du Coin, « heures chaudes »).
