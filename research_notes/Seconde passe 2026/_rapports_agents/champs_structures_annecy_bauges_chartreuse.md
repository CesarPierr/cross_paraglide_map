# Champs structurés corrigés : Annecy, Bauges, Chartreuse

6 novembre 2026. Lots `annecy_bornes_aravis`, `bauges_bourget_combe`, `chartreuse_gresivaudan_belledonne`. Détail, une ligne par changement, avec avant, après, source et raison : `champs_structures_annecy_bauges_chartreuse.json`. Aucune coordonnée n'a bougé.

## Bilan

97 lignes : 72 champs structurés, 24 notes et 1 phrase de `possible` qui suivent ces champs.

| Champ | Changements |
|---|---|
| `distance_km` | 25, dont 15 par généralisation |
| `best_hours` | 13 |
| `conditions` | 6 |
| `speed_kmh` | 5 |
| `trigger` | 5 |
| `sources` (élément) | 4, plus 1 source ajoutée au lot (S114, fiche FFVL 14121) |
| `name` | 5 |
| `hours` | 2 |
| `when` | 2 |
| `season`, `kind`, `orientations`, `id` | 1 chacun |

## Qui lit quoi

- `hours`, `speed_kmh`, `condition` : le vent du modèle (`curated`). Sans vitesse, le modèle prend `DEFAULT_SPEED` du type de brise et la fiche affiche « non documentée ». Sans heure lisible, la brise suit le cycle générique de vallée.
- `conditions`, `kind` : la couche des dangers (`curatedHazardsOf`). Un danger sans vent ni heure lisibles sort de la simulation.
- `when` : la fenêtre d'affichage et le contrôle des convergences.
- `best_hours` : l'affichage et le contrôle du modèle. Vide, le contrôle suppose le milieu de journée et ne teste pas le déclenchement.
- `trigger` : l'affichage seul.
- `distance_km` : l'affichage et le filtre de longueur. Vide, le filtre retombe sur la longueur du tracé, et aucune distance n'est affichée.
- `orientations` : l'affichage, le jeu et le contrôle des décollages (première valeur).

## Contrôle du modèle

`npm run model:check` lit l'atlas compilé, que `data:build -- --check` n'écrit pas : il rend le même résultat avant et après. Les chiffres ci-dessous viennent donc d'une copie de l'atlas, sur laquelle les champs des trois lots ont été reportés avec les fonctions de `build-data.ts`. Témoin : reportés depuis HEAD, ces champs donnent 0 écart avec l'atlas et le même 1203/1329.

| Secteur | Avant | Après |
|---|---|---|
| Lac d'Annecy | 44/47 | 44/47 |
| Bornes | 16/18 | 17/18 |
| Aravis | 33/35 | 33/35 |
| Bourget – Chambéry | 24/27 | 24/27 |
| Combe de Savoie | 21/25 | 21/25 |
| Bauges | 30/32 | 30/32 |
| Chartreuse | 55/60 | 55/60 |
| Grésivaudan | 10/11 | 10/11 |
| Belledonne | 43/44 | 43/44 |

Aucune baisse. La seule hausse : `bornes/tournette-col-du-varo-thermique`, qui ne porte plus l'heure tirée d'un casse-croûte. Toujours 0 paire opposée. Un défaut de données de plus, attendu : `bourget-chambery/brise-lac-bourget` n'a plus d'horaire lisible.

Ce qui change dans la simulation :

- Lac d'Annecy : 15 → 12 km/h, fenêtre 13h30-19h → 12h30-18h30.
- Lac du Bourget : 8 → 12 km/h, cycle générique au lieu d'une fenêtre.
- Avant-Pays vers l'Épine : 15 → 10 km/h.
- Jalouvre et Pointe Percée : ces dangers ne s'activent plus par nord-ouest ni par ouest, faute de direction dans la source.

## Valeurs gardées comme estimations

- `gresivaudan/brise-voreppe.speed_kmh.typical` = 20 : déduit de « souvent forte ». Le contrôle ne bouge pas avec la valeur vide (essai à 10 km/h), mais le défaut serait bas pour une brise que les sources disent forte, et 20 km/h est le seuil de « fort » du modèle. La note le dit.
- `bourget-chambery/epine-novalaise-brise-forte.conditions` : 14h-17h, sans quoi le danger sort du modèle. L'heure vient de la fiche du décollage de l'Épine (S48), pas du schéma. Le champ et la note le disent.

## Corrections de rapports antérieurs

- `triangle-montlambert-parmelan` : les balises sont confirmées. Les pages 44 et 45 de S15, relues en image, donnent Tamié, Parmelan et Chignin pour le triangle de 107,26 km, puis Planfait, Roche Pourrie et La Table pour celui de 108,27 km. Le nom et le texte restent, et la note les cite. La visite de la Combe de Savoie avait retiré ces balises « car non lues ».
- `retour-combe-colombier-montlambert-bramefarine` : S23 dit « re 2700 m » au Colombier, puis « parti de 2700 m du dernier thermique » pour 8 km de glissade, sans nommer ce thermique. Les Tours sont à 17 km environ du Colombier et à 7 km de Montlambert. La phrase ne dit plus que le vol a quitté le Colombier à 2700 m.
- `ebaudia-albertville` : la position n'est pas sans origine. C'est le point d'atterrissage de la fiche ParaglidingEarth 2984, sans description.
- `montbonnot-epae`, `belledonne-crete-sud-fort-transitions` et le maximum de `brise-voreppe` : déjà corrigés par le commit 0bf4839.

## Pour la décision du lead

- `combe-de-savoie/ebaudia-albertville` : garder ou retirer. S77 dit « Pas d'attérrissage sur ce site », seule ParaglidingEarth donne le point, et la fiche `ffvl_id` 173 n'est pas dans la récolte. Il est signalé dans son nom. L'école du jeu le propose toujours.
- `bourget-chambery/sapenay-belvedere` : décollage de delta, signalé dans son nom, toujours proposé dans la liste des décollages du jeu.
- `aravis/la-patinoire` (ancien atterrissage, seul Les Potais est autorisé) et `lac-annecy/verthier` (statut non confirmé) : restent parmi les atterrissages. Le schéma n'a pas de champ de statut.
- Id renommé : `bauges/saint-offenge-dessous` → `saint-offenge-dessus`. Seul l'atlas compilé le référençait.

## `text_audit.py`

62 erreurs, toutes lues et rapprochées du JSON par une comparaison automatique avec HEAD : aucun champ modifié hors de la liste, aucun chiffre inventé. Elles sont attendues : champs structurés, `sources` du lot, id renommé. Avertissements nouveaux : aucun, sauf « 35 » au petit tour du lac (S93). `text_fidelity.py` : deux points relus, justifiés (« nord-est » de la fiche à Montlambert, « face nord » du Colombier).

## Non vérifié

- « environ 40 km » pour le petit tour du lac : introuvable dans le cache. Gardé en note, dit comme une note de collecte.
- Fiche FFVL 173 et statuts de Verthier et de la Patinoire : non relus en ligne.
- Vitesse et horaires réels de la brise du lac du Bourget : aucune source, la valeur du modèle est un défaut.
- Heures laissées dans les champs quand elles se disent tirées d'un vol ou d'un récit (« vers 13h30-15h dans les récits », « juillet 2014 ») : non réexaminées une à une, car le champ annonce leur origine.
- L'atlas réel n'a pas été recompilé : à recontrôler après le `data:build` du lead.
