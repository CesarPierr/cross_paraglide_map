# Véracité des textes de massif — lots Mont-Blanc, Chablais, Vercors

6 novembre 2026. Textes corrigés : résumés, conseils, effets du vent et visites des treize massifs des lots `montblanc_beaufortain`, `chablais_giffre_arve` et `vercors_grenoble_trieves`. Chaque correction est dans `veracite_massifs_montblanc_chablais_vercors.json`, avec son ancien passage, sa source et son nouveau texte. Quelques lignes sont de pures reprises de longueur liées à une correction.

## Méthode

- Sections « Hors périmètre » de `veracite_elements_<lot>.md`, constats de `veracite_lots_1-6` et `veracite_lots_7-12` pour ces lots, puis comparaison de chaque texte avec les fiches corrigées.
- Sources relues dans `.cache/research/docs/` : brochure du Pays du Mont-Blanc, Flyappi 3030 (Bisanne), récit Léman–Annecy, récit des 204 km. Aucune page en ligne n'a été consultée.

## Les corrections les plus graves

1. Chamonix, effet ouest : le Prarion NE « ferme, avec La Charme, le Plancert et le Grand Prarion », alors que ces trois sites sont le repli indiqué.
2. Chamonix, visite : arrêté municipal des 600 m présenté comme en vigueur ; accès des Grands Montets par l'ancienne gare ; terrain delta du Bouchet placé à Argentière ; règle de choix « +2 m/s » prise pour une force de thermique.
3. Beaufortain : traversée Pierra Menta et « cocktail » des Chapieux fusionnés ; vol de 300 km et plafond de 3100 m fusionnés ; Bisanne–Albertville–Aravis raconté alors qu'aucun vol relu ne le fait ; Bisanne Sud par fort nord, contresens ; boucle de « 17 km » calculée par l'atlas.
4. Plaine-Joux, visite : repose au décollage (interdite) confondue avec l'atterrissage station fermée ; « par sud-ouest et ouest forts, ils passent sous le vent » étendu à Varan, Frioland et Platé.
5. Chablais : le foehn qui « sert à partir en cross » à Châtel-Morclan ; vaudaire rattachée aux orages des Préalpes ; morget placé sur la rive française ; thermiques et relances d'Avoriaz et de Ressachaux sans source.
6. Vercors : 2800 m au Moucherotte, 3200 m au Grand Veymont et retour par Valbonnais corrigés ; col de l'Arc et Pic Saint-Michel inversés ; Montaud « site du soir » sans source ; 2300 m de plafond sans source à Grenoble.
7. Matheysine et Trièves : « 90 km/h au sol » (vitesse GPS) ; 13h20 et 14 h pris pour des heures de thermique ; route du Champsaur dite acquise.
8. Salève : « dériver de 25 km/h vers le nord-ouest », alors que NO est le vent et que le vol va vers le sud-est.

## Champs structurés à corriger (non modifiés)

Ils restent ceux des rapports `veracite_elements_*`. S'y ajoute un point vu ici :

| Élément | Champ | Problème |
|---|---|---|
| beaufortain/bisanne-saisies-legette-mont-clocher | `distance_km` | 17 km calculés par l'atlas (cumul des segments), à ne pas lire comme une longueur de vol |

## Ce qui n'a pas pu être vérifié

- Durées de marche, statut du Prarion Nord-Est et état du téléphérique des Grands Montets : voir `veracite_elements_montblanc_beaufortain.md`.
- Dates de la LF-R 30 B et de la ZRT 30 C : SUP AIP 120/21 et club ; l'AIP en vigueur en 2026 n'a pas été relue.
- Rouleaux de la Ferme par fort nord (Mieussy), « 13 h à 16 h » à Zore, « mi-décembre à mi-avril » de la TMA 15 à Voreppe : gardés sans relecture de la source.
- Fermeture temporaire du Col du Fau : donnée par la fiche, date inconnue.

## Contrôles

`text_audit.py` : 0 erreur sur les trois lots. Avertissements de chiffres, tous portés par un constat : 3520 (Dômes de Miage), 14, 150 et 2250 (Grenoble), 3280 et 2700 (Vercors). `text_fidelity.py` : 20 points relus, tous voulus (noms retirés avec l'erreur, directions tirées de la source). `npm run data:build -- --check` : réussi (code de sortie 0).
