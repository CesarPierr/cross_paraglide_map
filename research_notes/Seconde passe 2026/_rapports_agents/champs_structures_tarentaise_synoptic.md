# Champs structurés corrigés — lots Tarentaise-Vanoise et transverse

6 novembre 2026. Détail ligne à ligne, avec avant, après, source et raison : `champs_structures_tarentaise_synoptic.json` (115 lignes : 73 champs structurés, 42 textes qui les suivent ou faits restitués). La comparaison avec HEAD donne 115 champs modifiés, tous consignés, aucun autre.

## Lecture du code

- `speed_kmh` : sans valeur, le modèle prend son défaut (vallée 15, lac 12, régionale et plaine 10, descendante 8 km/h) et l'affiche « non documentée » ; le contrôle de vitesse ne s'applique plus.
- `hours` : sans fenêtre, une brise de vallée suit le cycle générique, mais une brise descendante soufflerait le jour. Gardé partout, dit comme une estimation.
- `when` : sans heure, la convergence devient non testable et perd son créneau d'activité. « Après-midi » gardé avec « (déduction) ».
- `conditions` d'une brise forte : sans heure ni vent, le danger sort de la couche du modèle. Les 13h-18h sans source deviennent 14h-17h (référence générale, S58) ; le milieu de fenêtre reste 15h30.
- `best_hours`, `trigger`, `season`, `wind_dirs`, `distance_km` : facultatifs. Sans `best_hours`, le contrôle suppose le milieu de journée. Sans `distance_km`, la liste calcule la longueur du tracé.

## Choix à relire

- Vitesses gardées comme estimations : Bozel 20, Saint-Bon 25, Isère 25, basse Durance 15, aspiration 8 km/h, plus les valeurs génériques (Grésivaudan, Combe de Savoie, Tarentaise, Maurienne, Romanche, Durance, Ubaye). Sans valeur, une brise que les fiches disent forte tomberait à 15 km/h.
- Belleville : vitesse retirée, 25 km/h passe à 15. « Très forte » vise la face sud de Caron, pas la vallée.
- Corrections non listées par les rapports, même défaut : `brise-forte-arve.conditions` (13h-18h), `la-poudreuse-thermique.trigger` (point 2 m au-dessus du décollage), les noms de `la-tranchee-cevins` et `la-plagne-3007-pentes`.
- Aucun id renommé : `confluence-col-de-la-chal`, `aime-confluence-thermique` et `pointe-de-combe-neuve-plafond-3500` sont référencés par la visite de la Tarentaise.

## Faits restitués

- Foehn (`alpes-francaises`, effet 9) : Zurich-Milan 5 hPa, Zurich-Lugano 4 hPa, environ 20 km/h à 4000 m sans nuage, écharpes, petits cumulus déchiquetés. Relus dans S11 et dans la p. 10 de S55 (et non S56). La source dit écharpes « d'Italie ou de Suisse », et non d'Italie seule.
- Faces sud du Beaufortain (`tarentaise`, effet N) : relu dans S72, écrit comme le fait d'un seul vol.

## Contrôles

`npm run model:check` lit `apps/web/public/data/atlas.json`, que `--check` ne réécrit pas : il ne voit pas ces corrections. La mesure vient d'un atlas compilé hors du dépôt, sans `--check` mais avec un autre répertoire de travail : rien n'est écrit dans le dépôt.

| Secteur | Brises | Convergences | Thermiques | Pièges |
|---|---|---|---|---|
| Tarentaise, avant et après | 8/8 | 4/4 | 27/32 | 5/5 |
| Vanoise, avant et après | 4/4 | 0/0 | 12/12 | 3/3 |
| Alpes françaises, avant et après | 25/25 | 13/13 | | 6/6 |

- Aucune chute dans ces secteurs. Les cinq thermiques en échec de la Tarentaise sont les mêmes qu'avant.
- Autres lots à HEAD : 1203/1329 devient 1202/1329. Seule chute : `bourget-chambery/brise-lac-bourget`, cause vérifiée : `cluse-chambery` passe de 12 à 15 km/h et ce tronçon donne 13 km/h pour 8 documentés.
- Autres lots dans leur état courant : 1203/1327, `brise-lac-bourget` réussit, car le lot Bauges a retiré sa vitesse sans source. Cette chute dépend donc de l'intégration de ce lot.
- Scénarios déplacés, statut égal : `arcs-10-de-face`, `fort-de-la-platte-extraction`, `pointe-de-combe-neuve-plafond-3500`, `versant-peisey-vallandry`, `montagne-de-tete-valmorel-thermiques`. Sans heure, le test est moins exigeant.
- `npm run data:build -- --check` : code 0.
- `text_audit.py` : 24 et 31 erreurs, toutes sur des champs corrigés ici, plus le chiffre 4000 du foehn restitué.
- `text_fidelity.py synoptic_convergences_xc` : un seul point, « sud » à `ligne-est-ecrins-durance`, voulu : la confluence est au sud de Briançon.

## Pour décision

- `tarentaise/confluence-col-de-la-chal` : un basculement rangé en convergence, qui double `brise-col-de-la-chal-arc`. Le schéma n'a pas de catégorie adaptée.
- `vanoise/brise-allues-meribel` : aucune source ne décrit cette brise. Le nom le dit, à garder ou à retirer.
- `tarentaise/montagne-de-tete-valmorel-thermiques` : le texte parle des Bachals et du Gollet, mais le point reste au décollage 3033, non déplacé.
- `tarentaise/col-du-petit-saint-bernard-soaring` : les seuls vents connus viennent d'une fiche de snowkite.

## Non vérifié

- Flèches de `F3` : reprises du rapport des éléments, non relues à l'œil.
- S2, S13, S14, S24 : non relues ici.
- L'effet en vol des nouvelles vitesses : seul le contrôle du modèle l'a mesuré.
