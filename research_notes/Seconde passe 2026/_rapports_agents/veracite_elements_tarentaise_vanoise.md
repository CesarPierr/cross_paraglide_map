# Véracité et réécriture des éléments — lot tarentaise_vanoise

6 novembre 2026. Les 163 éléments du lot (Tarentaise 115, Vanoise 48) ont été comparés à leurs sources, et 160 ont été réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`. Trois fiches très courtes n'appelaient pas de changement (`granier-deco`, `la-tranchee-atterro`, `naves-atterro`). Seuls `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Les constats sont dans `veracite_elements_tarentaise_vanoise.json`, un objet par constat.

## Méthode

- Sources relues dans `.cache/research/docs/tarentaise_vanoise/` : page aérologie actuelle du club (S35), PDF ancien (S37), carte KML et contour du cœur (S38), navette (S41), rapaces (S42), arrêté 2026-31 par OCR (S43), école des Arcs (S49, S50), école Arcs en Ciel (S51), aéroplagne (S57), catalogue ancien (S58 à S67), topo ancien (S71), récits (S72, S73), règlement de course (S48), Syride, La Plagne, guides de Pralognan, forum du Mont (S54 à S56, S69).
- ParaglidingEarth (S52) lu dans `pge/bbox.json`, y compris `landing` et `flight_rules`.
- Fiches fédérales lues dans `.cache/research/ffvl_sites_alpes.json`, tronqué à 600 caractères.
- Les 21 points chauds kk7 ont été recalculés sur `sources/kk7/` : 19 conformes, 2 écarts d'arrondi.
- Distances au cœur du parc mesurées sur le contour de S38. Aucune page bloquée n'a été contournée, aucune page lue en ligne.

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 57 |
| NON SOURCÉ | 14 |
| CONTREDIT | 12 |
| INVRAISEMBLABLE | 4 |
| NON VÉRIFIABLE | 3 |
| **Total** | **90** (Tarentaise 63, Vanoise 27) |

Les autres affirmations relues sont confirmées et ne figurent pas dans le fichier.

## Les constats les plus graves

1. **Les Monts.** « Il se pratique surtout à pied » traduit « Marche bien surtout au printemps ». Corrigé.
2. **La Marquise Ouest.** L'après-midi sans catabatique était présenté comme un danger. La fiche en fait le moment à privilégier.
3. **Roches Noires.** « On y accède par deux télésièges » vient du champ des dangers : ce sont des obstacles.
4. **Méribel.** Le vent de sud de fin de journée était rattaché à la brise montante. La vallée monte vers le sud : ce vent descend.
5. **Petite Chal.** Un créneau d'été de 17h à 20h côtoyait une interdiction du 1er juin au 30 octobre. La règle passe d'abord, le créneau ancien en note.
6. **Le Mont, à Séez.** La consigne de ne pas décoller passe en tête, et La Gare, citée comme repli, n'ouvre pas à ces dates.
7. **Navette.** Le « retour des véhicules aux Ilettes à 17h » ne vise que la navette du club.
8. **Tarent'Air Tour.** Trois refuges sont à valider, pas « trois parmi quatre ». L'espace aérien entraîne une pénalité graduée.
9. **Vol de 114 km.**
   - Les lignes à haute tension sont sous le pilote, pas au-dessus.
   - La « brise d'Annecy » à la Roche Pourrie est démentie en vol.
   - La confluence d'Aime est une impression du pilote.
   - Les 2600 m et 3500 m sont des valeurs d'un seul vol.
10. **Chiffres déplacés.**
   - 13h45-18h30 est le créneau commercial d'un biplace, pas une heure du 10 de Face.
   - Les 2500 m concernent Peisey-Vallandry, pas Arc 1800.
   - 19h-20h à Peisey n'est pas sourcé.
   - Le Bochor ouvre à la mi-juin, pas à la mi-juillet.
   - Le Grand Mont : seul Le Villard est difficile, pas La Bâthie ni Cevins.

Une correction en sens inverse : les 15 km/h au col du Petit-Saint-Bernard sont bien sourcés (S49). L'audit du 30 octobre les croyait absents parce qu'il cherchait dans S35. Le seuil est « plus de 15 km/h », et vaut aussi pour le nord.

## Champs structurés à corriger (non modifiés)

- `speed_kmh`, interprétés depuis des adjectifs : `brise-doron-bozel`, `brise-saint-bon-courchevel`, `brise-doron-belleville`. `brise-isere-tarentaise.max` : 50 km/h vient d'une référence générale.
- `brise-chapieux-roselend.season` : « toute l'année, surtout avec vent de nord » non sourcé.
- `brise-allues-meribel` : `name` et `hours`, le vent de sud n'est pas cette brise.
- `confluence-col-de-la-chal.name` : les sources décrivent un basculement.
- `rafales-descendantes-mont-jovet.conditions` : « ou de nord » mêle les Prés et le Jovet.
- `versant-peisey-vallandry.best_hours` : 19h-20h.
- `arcs-10-de-face` : `best_hours` (11h-18h) et `trigger`.
- `fort-de-la-platte-extraction.best_hours` : mêle 11h30-13h30 et un vol.
- `pointe-de-combe-neuve-plafond-3500` : `name`, `trigger`, `best_hours`.
- `aime-confluence-thermique` : `name`, `trigger`, confluence dite comme un fait.
- `montagne-de-tete-valmorel-thermiques` : `name`, `trigger`, `best_hours`.
- `plan-de-la-boutte-thermique` : `trigger` (dans la zone Charbonnet) et `best_hours` (« 65 % le soir, rien le soir »).
- `plan-du-col-doucy.best_hours` : 92 % au lieu de 93 %. `pralognan-le-pachut.best_hours` : 76 % au lieu de 77 %.
- `la-tranchee-cevins` : `trigger` (sous le décollage) et `best_hours` (« rien à midi » après « 69 % à midi »). `la-plagne-3007-pentes.trigger`.
- `col-du-petit-saint-bernard-soaring.wind_dirs` : vents d'une fiche de snowkite.
- `pointe-du-lavachet.name` : « Val d'Isère », le point est au-dessus de Tignes.
- `tarentair-tour-3-refuges.distance_km` : 55,4 km calculés par l'atlas.

## Hors périmètre

Tarentaise, conseils et vent météo :

- `tips[5]` : Le Mont cité comme départ de cross, « interdit dès la pose des clôtures ». Le terrain est marqué pratique strictement interdite, et le club demande de ne pas y décoller (S105, S56). « Du matin » n'est pas sourcé pour La Croix.
- `tips[6]` : « dès 11h-12h30 » fusionne Montgirod (11h) et le Mont Jovet (avant 12h30).
- `tips[7]` : les Arcs « offrent » jusqu'à 2600 m : un seul vol (S72).
- `tips[8]` : les grands triangles « passent par la cluse d'Albertville » : un seul récit, non lu (S27).
- `tips[10]` : « cherchez la confluence au-dessus d'Aime » : impression d'un seul vol (S72).
- `synoptic_effects[5]` (NW) : Roches Noires donné favorable par nord-ouest, sa fiche ne donne aucun vent (S112).
- `synoptic_effects[7]` (SW) : Pra Plan placé « sur le versant des Arcs » et favorable à un sud-ouest modéré. Il est à Macot, et sa fiche dit de se méfier du vent modéré à fort (S101).
- `summary` §3 : plafonds au-delà de 3000 m attribués aux Arcs. S51 parle des sites de Peisey-Vallandry.

Tarentaise, visite :

- Étape 5 : « jusqu'à 19h-20h » non sourcé ; « plafonds fréquents » au lieu de « pas rare » ; « on y vole en performance de 13h45 à 18h30 » est un créneau commercial (S50).
- Étape 7 : à Tignes, les brises « peuvent être » confluentes (S79).
- Étape 8 : Fort du Truc « 500 m plus bas » contre 1770 m IGN, soit environ 230 m ; navette au Fort : une rotation matinale par semaine (S41).
- Étape 11 : vent « de nord-nord-ouest » ; la source dit entre nord et nord-ouest (S72).
- Étape 12 : la confluence d'Aime dite comme un fait (S72).
- Étape 16 : « on peut monter à 3200 m » à la Légette : un seul vol (S72).

Vanoise :

- `summary` §2 : la brise « s'allume vers 13h sur les terrains bas, à Bozel et aux Monts ». 13h vaut pour le décollage des Monts ; à Bozel, c'est « dès le milieu de journée » (S87, S126).
- `tips[3]` et visite étape 13 : « partez avant 12h30 » vaut pour le Jovet, pas Montgirod ; « restez hors du Parc, au sud et au sud-est » se lit à l'envers : c'est le parc qui est au sud et au sud-est (S52).
- Visite étape 3 et étape 8 : Boismint « site d'initiation », alors que le niveau actuel est autonome (S63, S129).
- Visite étape 7 : à Pralognan, « la brise de vallée est forte l'après-midi » au Plateau, non sourcé ; « télécabine » du Bochor, S69 dit téléphérique.
- Visite étape 9 : les rafales de nord sont notées aux Prés ; au Mont Jovet, le vent descend parfois (S88, S125).

## Non vérifié

- S22 (Manawa) : page absente du cache, circuits des biplaces à la Loze rangés en possibilité.
- S24 (Wikipédia) et S53 : lus seulement dans les notes de `sources[]`.
- S44, S45, S46, S47, S70 : lus dans les notes de `sources[]`, sauf l'arrêté 2026-31 lui-même. Les annexes cartographiques de l'arrêté n'ont pas été relues.
- Identité de P7 Le Rey et de L'Écureuil : déduite des coordonnées.
- « Au pied difficile » au Lavachet : formule ambiguë, citée en note.
- Fiches fédérales tronquées à 600 caractères (La Marquise, Versoyen, col du Petit-Saint-Bernard).
- Le contour du cœur vient d'une carte de club, pas de l'annexe officielle : les distances restent indicatives.
