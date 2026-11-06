# Véracité et réécriture des éléments — lot synoptic_convergences_xc

6 novembre 2026. Le lot n'a qu'un massif, `alpes-francaises`, avec 63 éléments : 26 brises, 13 convergences, 10 dangers, 2 décollages, 12 itinéraires. Tous ont été comparés à leurs sources. 62 ont été réécrits dans la « Voix » ; `verdon-castellane-thorame`, déjà fidèle, n'a pas changé. Seuls `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Les constats sont dans `veracite_elements_synoptic_convergences_xc.json`.

## Méthode

- Sources relues dans `.cache/research/docs/synoptic_convergences_xc/` : récits (`gex185`, `gex202`, `bluehouse201`, `tich.html`), articles sur les records (`ozone`, `xc_*`, `fai_pinot2`, `xcfinder_records`), `amv`, `chocard`, `cmbvl`, `mb_ffvl_raw`, `foehn360`, `stprep`, `airbuech`, `aerogliss`, `bauges_meteo`, `toiles`, `gap`, `pi_cartog`, `pi_nord`, `rto_s1`, tracés KML.
- Images lues à l'œil : `stcross.pdf` p. 9, 22, 37-42, 46 ; diapositives du schéma de référence 25-27, 47, 49, 54, 59-63, 66, 70, 71, 74. Ce sont elles qui ont donné les erreurs de sens les plus graves.
- Aucune page en ligne n'a été ouverte, aucune page bloquée contournée.

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 45 |
| NON SOURCÉ | 16 |
| CONTREDIT | 15 |
| NON VÉRIFIABLE | 10 |
| INVRAISEMBLABLE | 1 |
| **Total** | **87**, sur 47 éléments |

## Les constats les plus graves

1. **Brise de mer, sens faux.** Les flèches du schéma pointent vers le nord-ouest et le nord, pas vers le nord-est (`brise-mer-var-verdon`, `brise-mer-var-mercantour`).
2. **Confluence de Briançon, mauvais côté.** Écrite « au nord de Briançon », elle est au sud, et ce qu'elle rencontre est du mistral qui contourne les Écrins, pas la brise de la Durance.
3. **Mistral du Buëch, flux inversé.** La flèche descend le Buëch vers Sisteron ; le texte faisait remonter l'air.
4. **Mistral de Gap et de Valensole.** Flux de la Durance et « air provençal » absents du schéma : ce sont deux branches du mistral qui se font face.
5. **Crête frontalière.** « Sans crête franche » et le vent d'est viennent de diapos qui montrent la Provence. Déplacé au front de brise de mer. Le conseil « restez côté français » n'a pas de source.
6. **Parc du Vercors.** « Au-dessus de 300 m/sol » : le vol est tombé à 200 m/sol, sous la limite.
7. **Izoard.** « Tous les records en partent » est faux (Saint-Hilaire, col Agnel). « Pas de nord de plus de 20 km/h au col » prend un vent de face en vol pour un seuil au sol. Les « pièges » n'ont pas de source.
8. **Question de forum devenue un fait.** Le partage de l'air au débouché de la cluse de Chambéry est une question sans réponse ferme.
9. **Vols fusionnés.** Brise d'Embrun du 350 km prêtée au 301 km ; col à 2 m et posé dans la vallée du 185 km ; P14 et ZIT de deux vols différents.
10. **Altitudes mal attachées.** « La Dent de Cons est à 2900 m » et le pierrier « (3500 m) » sont des plafonds. « Brise forte sur le Granier » : le repère est au milieu de la cluse.

## Champs structurés à corriger (non modifiés)

- `figures[F3].shows` : « vers le nord-est », à remplacer par nord-ouest et nord.
- `mistral-confluence-briancon-izoard.name` : « de nord » se lit comme une position. La fiche est au sud de Briançon.
- `cretes-frontalieres-franco-italiennes.when` : le décalage selon le vent vient des diapos de la Provence.
- `when` « après-midi » des quatre confluences de mistral, de `confluence-obiou-taillefer` et d'`arc-diois-col-de-cabre` : aucune heure sur les diapos.
- `mistral-confluence-gap-tallard.sources` : le document d'aérodrome (`gap.txt`) n'est pas listé.
- `ligne-prealpes-annecy-grenoble.distance_km` : 100, valeur de l'atlas et non un vol.
- `ctr-chambery-tma-lyon-chartreuse.conditions` : TMA de Chambéry 1 (2900 m) absente sur les Bornes-Aravis.
- `brise-forte-tarentaise.conditions` et `brise-forte-maurienne.conditions` : « Été, 13h-18h » non sourcé.
- `speed_kmh` et `hours` des brises : valeurs génériques ou déduites, déjà signalées par les notes (`cluse-chambery`, `romanche-oisans`, `tarentaise-haute`…).
- Note de `sources[S41]` : « Pages 38-48 » et les pages citées suivent une autre numérotation que le PDF (transitions en p. 19 à 31, exemples en p. 33 à 46).

## Hors périmètre

Massif `alpes-francaises`, textes non modifiés.

- `summary`, paragraphe 3 : « Au débouché de la cluse de Chambéry, l'air part à la fois vers Albertville et vers Grenoble » : question de forum (S15). Fait établi : le sens de chaque brise (S31).
- `summary`, paragraphe 3 : records « par nord de 15-20 km/h ou nord-ouest » : un seul vol à 15 km/h au décollage (S22), 20 km/h de face sur une branche ; le 301 km a eu est, sud-ouest, puis ouest-nord-ouest (S50).
- `tips[2]` : même partage de l'air que le résumé.
- `tips[9]` : « partez avant 10h » et « un nord de 15-20 km/h est bon » : heures de trois vols et vent d'un seul. « En fin de journée, la vallée d'Embrun renvoie une brise » : un vol (S22, S48).
- `tips[11]` : « où deux vols sont entrés » : un dans la P14 (S46), l'autre dans la ZIT (S47).
- `tips[12]` : « Les records se volent en août ou en avril, aux jours les plus longs » : avril n'a pas les jours les plus longs. La source donne l'instabilité précoce à Saint-Hilaire (S52).
- `synoptic_effects[1]` (N) : « un nord de 15-20 km/h toute la journée fait les plus gros triangles » : un seul vol ; « a fait renoncer au Cheval Blanc » est le même jour.
- `synoptic_effects[3]` (NW) : « il rend le Champsaur et le Valbonnais difficiles » : vrai pour un vol, la brise toujours forte ne vise que le Valbonnais (S52).
- `synoptic_effects[4]` (W) : les Têtes de l'Argentière et les crêtes de Peyrolles sont des altitudes atteintes par la brise, pas un trajet (S57).
- `synoptic_effects[8]` (E) : « l'air italien entre par les cols frontaliers : des vols ont passé le Vieux Chaillol » : déduction ; S50 dit seulement qu'un vol a profité du vent d'est.
- `synoptic_effects[11]` (Mistral) : « au nord de Briançon » : la ligne est au sud (S45 diapo 66). Le Buëch, Gap et Valensole sont à relire avec les fiches.
- `synoptic_effects[12]` (Brise de mer) : « vers le nord-est » : vers le nord-ouest et le nord (S45 diapos 47, 49).
- `visites/alpes-francaises.json` :
  - étape 4 : partage de l'air, et Montlambert pris de plein fouet (S46 vise les Tours de Montmayeur) ;
  - étape 5 : brise de mer « de Marseille et d'Aix » (Aix seulement) ;
  - étape 8 : « Sans crête franche » placé sur la crête frontalière ;
  - étape 10 : « Les records du monde partent du col », « un nord de 15 à 20 km/h est favorable » ;
  - étape 11 : deux itinéraires donnés depuis Saint-Hilaire alors que le 185 km part du Vercors, « sans trajet détaillé » pour le 174 km alors que ses balises sont lisibles ;
  - étape 12 : « deux vols de 200 km y sont entrés » placé sur la P14 ;
  - étape 13 : « Un nord de 15 à 20 km/h fait les plus gros triangles ».
  - étape 16 : « L'est fait aussi entrer l'air italien par les cols ».

## Non vérifié

- Pages absentes ou vides en cache, lues seulement dans les notes de `sources[]` : S4-S7, S10, S13, S14, S16, S17, S24, S26, S33, S37, S65 (schémas).
- Zones aériennes (S41, support de 2018) : aucune carte en vigueur en cache. Chaque fiche renvoie à la carte aérienne.
- 352,2 km : XCFinder seul, écart annoncé ailleurs de 10 km, divergence dite en note.
- Lecture des flèches sur diapositives : à l'œil, et les diapos 25 à 27 n'ont été vues que par leur fond de carte et leur texte.
