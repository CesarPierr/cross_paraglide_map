# Véracité et réécriture des éléments — lot bauges_bourget_combe

31 octobre 2026. Les 171 éléments du lot (Bourget-Chambéry 59, Combe de Savoie 47, Bauges 65) ont été vérifiés contre leurs sources. Ceux qui portaient un écart, ou une phrase mal rangée, ont été réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`. Seuls les champs `description`, `possible`, `note` et `usage` ont changé. Les constats non confirmés sont dans `veracite_elements_bauges_bourget_combe.json`, un objet par constat.

## Méthode

- Sources archivées relues dans `.cache/research/docs/bauges_bourget_combe/` : pages des clubs (Z'éléphants Volants, Montlamb'air, Volants Bauges, Entre Ciel et Terre), CHVD « Le passage de la Savoyarde », Bauges Parapente, carnets Largeault (vols 162 et 186), récits Bluehouse (201 km) et Pays de Gex (202 km), PDF St Hil'Air « Cross, massifs et transitions », données ParaglidingEarth.
- Récits du club St Hil'Air (S96 à S103) relus dans le cache du lot Chartreuse (`club_post_*.txt`) ; compétition de Val Pelouse dans le cache CHVD du lot Vercors.
- Fiches FFVL : texte complet quand il est archivé (`ffvl_sites_raw.json`, 12 fiches), sinon les champs tronqués de `ffvl_sites_alpes.json` et les notes de collecte.
- Deux pages lues en ligne, absentes du cache et non bloquées : S36 (Les Ailes du Lac, site de Province) et S104 (fil « Aérologie et cheminement cross en Chartreuse »). Les deux confirment l'essentiel des textes.
- Contrôles : `text_audit.py` 0 erreur ; deux avertissements, tous deux des chiffres repris d'un constat (1000 m aux Tours de Montmayeur, 1200 m et 50 m au Roc des Bœufs). `text_fidelity.py` : 8 points relus, tous justifiés (voir plus bas). `npm run data:build -- --check` réussi.

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 69 |
| NON SOURCÉ | 13 |
| NON VÉRIFIABLE | 4 |
| CONTREDIT | 0 |
| INVRAISEMBLABLE | 0 |
| **Total** | **86**, sur 71 éléments |

Les 100 autres éléments sont CONFIRMÉS. Par massif : Bourget-Chambéry 36 constats, Bauges 30, Combe de Savoie 20.

## Les constats les plus graves

1. **Brise du lac du Bourget « qui alimente le décollage du Mont du Chat ».** Le décollage regarde l'ouest, de l'autre côté de la crête ; le lac est à l'est. La brise de la fiche du Chat n'est pas celle du lac. Le texte dit maintenant un flux tracé sur les cartes, sans force ni horaire connus.
2. **« Ne pas se reposer au décollage » devenu « ne pas s'attarder ».** Trois fois : Vérel (décollage et danger) et Montlambert. La repose au décollage est fortement déconseillée, et la repose sur le plateau de Pragondran est interdite : rétabli.
3. **Galoppaz et Puygros « interdits de décollage et d'atterrissage ».** Les sources citées n'en disent rien. La fiche fédérale 14121 interdit le seul décollage de la Galoppaz, sur la commune de Puygros. Corrigé dans le danger et dans la brise de Curienne.
4. **Atterrissage de l'Ébaudiaz.** Sa seule source dit « pas d'atterrissage sur ce site ». Le texte dit maintenant que ce point n'est pas un atterrissage documenté.
5. **Sous-le-vent de Montmélian traversé « nécessairement ».** C'est le cas seulement de l'option sud-est de la Savoyarde, vers Montlambert. Écrit ainsi, avec le conseil de l'éviter.
6. **Seuils de hauteur inventés ou déplacés.** « 1550 m » exigés au Roc des Bœufs fusionnaient deux vols, dont l'un était resté bloqué derrière la ligne électrique sous 1200 m. « 900 m au minimum » aux Tours de Montmayeur : le pilote voulait 1000 m et a zoné. « Raccroche à 1100 m » placée à la Galoppaz : elle a eu lieu à la Savoyarde.
7. **Banchet : « n'est ouvert que du 25 janvier au 31 août ».** La phrase contredisait la suivante : ouvert tous les jours jusqu'au 31 août, puis lundi, mardi, jeudi et vendredi.
8. **Conditions perdues.** Pas de l'Échelle « technique avec 10 à 15 km/h » : la fiche dit « à ne tenter que » avec ce vent de face. Atterrissage de Chamoux : forte à très forte « si vent météo de nord ». Sire Nord : c'est par brise que les sapins mettent le décollage sous le vent, pas par nord météo. Montlambert par sud : possible par sud faible.
9. **Vols fusionnés ou déplacés.** Grilles-pains : deux vols de sens opposés. Plein « sous des barbules » placé dans la vallée des Huiles, alors qu'il a été fait à l'entrée de la Maurienne faute de cumulus sur les Huiles. Traversée de 8,4 km « avec 18 km/h de sud de face » : le sud était au retour. « 3 h 10 à 3 h 16 » : deux tours.
10. **Heures et plafonds d'un vol érigés en règle.** « Midi à 15h » au relais du Chat, « 15h-16h » au Roc des Bœufs, « vers 16h » au Margériaz, « 13h-17h » sur les spirales PNR, « 14h-16h » au Grand Arc : aucune source. Plafonds de l'Arclusaz, de la Sauge, du Trélod et du Margériaz : passés en possibilités. Le « 2380 à 2500 m » du Margériaz est corrigé : 2500 m est le plafond du Roc des Bœufs.

Autres corrections : les « pylônes » des grilles-pains ne sont dans aucune source. Les transitions « de 5 min », « de 16 min » et « en 13 min » non plus. La confluence du Revard ne « renforce » rien sur la carte. La zone de brise forte de Novalaise n'a pas d'heure. La ligne du Banchet est une ligne haute tension, pas « une ligne à ne pas franchir ». Le Belvédère de Sapenay est un décollage de delta. Le terrain de secours est à Saint-Offenge-Dessus. Les Tours de Montmayeur sont une relance qui marche en général, pas un rabattant.

## Champs structurés à corriger (non modifiés)

- `bourget-chambery/breezes/brise-lac-bourget` : `hours` (« FFVL Chat : dès 14h00 »), `speed_kmh` (8/15 estimés), sources S46 et S47, qui concernent l'ouest de la crête.
- `bourget-chambery/breezes/brise-epine-avant-pays.speed_kmh` (15/25) : déduit de « brise forte ».
- `bourget-chambery/hazards/epine-novalaise-brise-forte.conditions` : « 14h-17h (été) » vient de la fiche du décollage, pas de la figure.
- `bourget-chambery/thermal_spots/pertuiset-revard.trigger` : « sous le vent du Revard » (c'est sous le vent du Pertuiset).
- `bourget-chambery/thermal_spots/relais-mont-du-chat.best_hours` : « midi à 15h » sans source.
- `bourget-chambery/takeoffs/sapenay-belvedere` : la fiche citée (1113) est un décollage de delta.
- `bourget-chambery/xc_routes/triangle-st-hilaire-dent-du-chat.distance_km` (80) : calcul de l'atlas, les triangles font 116 et 137 km.
- `combe-de-savoie/breezes/branche-albertville.speed_kmh.max` (35) : les sources citées donnent 25-30 km/h.
- `combe-de-savoie/hazards/tours-de-montmayeur-brise.kind` (« downdraft ») : la source décrit une relance dynamique.
- `combe-de-savoie/thermal_spots/grand-arc-plafond.best_hours` (« 14h-16h ») sans source.
- `combe-de-savoie/takeoffs/montlambert.orientations` : N et NE sont des vents favorables (site abrité) ; le décollage regarde le sud-est.
- `combe-de-savoie/landings/ebaudia-albertville` : aucune source n'en fait un atterrissage.
- `bauges/hazards/galoppaz-puygros-interdits` : `name` et `sources` (ajouter la fiche FFVL 14121).
- `bauges/thermal_spots/colombier-margeriaz-roc-des-boeufs.best_hours` (« 13h-17h ») sans source.
- `bauges/landings/saint-offenge-dessous.name` : Saint-Offenge-Dessus.
- `bauges/xc_routes/petit-tour-des-bauges.distance_km` (57) : calcul de l'atlas.

## Hors périmètre, à reprendre par qui de droit

- Bauges, résumé et conseil 7 : « la Galoppaz et Puygros sont interdits… ni y décoller ni s'y poser [S33] ». Seul le décollage de la Galoppaz (commune de Puygros) est interdit, et S33 n'en parle pas.
- Visite des Bauges, étape 9 : « en treize minutes » n'est dans aucune source. Étape 13 : « une traversée de 8,4 km depuis les Dents de Lanfon s'est faite avec 18 km/h de sud de face » ; les 8,4 km sont la traversée aller.
- Visite du Bourget, étape 5 : « les pylônes du Mont Grelle, les « grilles-pains », sont une relance délicate, sous le vent » ; ni « pylônes » ni « sous le vent » ne sont sourcés à cet endroit. Étape 9 : « Cinq minutes de transition » n'est pas sourcé.
- Visite de la Combe de Savoie, étape 6 : « sans vous attarder au décollage ». C'est la repose au décollage qui est déconseillée.
- Bourget, conseil 3 (Épine) : « restez près de l'atterrissage ». La source dit de ne pas traîner sous le décollage, à presque 3 km de l'atterrissage.

## Points de `text_fidelity.py`, relus

Huit points, tous justifiés. « ouest » au Pertuiset désigne la ligne des faces ouest. « sud » au Mont Beauvoir : il est au sud du Mont Grelle. « nord » à Chamoux est le vent météo de la fiche. « est » à l'Arclusaz désigne les faces est. « Colombier » a été retiré des Tours de Montmayeur, car c'était l'erreur. « Fées » est passé en note : c'est un terrain fermé. « Col du Frêne » et « Tour » restent présents, en minuscule.

## Ce qui n'a pas pu être vérifié

- Fiches FFVL dont le texte archivé est tronqué : amende de 300 à 1000 € aux Marais, stade interdit à Chindrieux, D921C à Saint-Paul, D25 et accès des personnes à mobilité réduite à Chamoux. Ces éléments ont été gardés, signalés NON VÉRIFIABLE.
- Pages en image du PDF St Hil'Air (p. 34-35 et 44-45) : balises et distances des triangles (116,31, 137,56, 107,26 et 108,27 km). Les titres lisibles (« Montlambert/Ugine/Parmelan », « Montlambert/Parmelan/Grd Arc ») ne confirment pas les balises Tamié, Planfait et Roche Pourrie.
- Carte PNR 2011 et tracés Largeault (S27, S28) : flèches et spirales non relues en image. Les textes qui en dépendent restent dits comme des lectures de carte.
- Pourcentages kk7 (S108) : non recalculés.
- Page Bauges Parapente du Semnoz (S105) : la combe sud-sud-ouest n'est pas dans le texte archivé, seule la cassure du relief l'est.
