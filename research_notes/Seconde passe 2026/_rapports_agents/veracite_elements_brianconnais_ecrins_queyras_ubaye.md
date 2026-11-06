# Véracité et réécriture des éléments — lot brianconnais_ecrins_queyras_ubaye

6 novembre 2026. Les 314 éléments du lot (Briançonnais-Guisane 67, Écrins-Vallouise-Haute Durance 90, Serre-Ponçon-Embrunais 68, Queyras 50, Ubaye 39) ont été comparés à leurs sources, et 304 ont été réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`. Seuls `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Les constats sont dans `veracite_elements_brianconnais_ecrins_queyras_ubaye.json`, un objet par constat.

## Méthode

- Sources relues dans `.cache/research/docs/brianconnais_ecrins_queyras_ubaye/` : pages Chocard Airlines (`chocard/`), cartes KML (`kml/`, S9, S10, S15, S40), forum Briançonnais (`forum228`, t146, t436, t424, t647), fils `thermal/pi_*` (S87, S88), infos-parapente (HS16), Différen'Ciel (HS14), Ozone (S73), Sev et Mika (S94, S95), Ultimate France (S49), pages SPVL (S89).
- Fiches fédérales : `.cache/research/ffvl_sites_alpes.json`, tronqué à 600 caractères ; les HTML de `ffvl/` ne contiennent qu'une page Cloudflare. Certains faits de fiche n'ont donc pas pu être revérifiés.
- Une page lue en ligne : MS12 (Sev et Mika, Montgenèvre). Aucune page bloquée n'a été contournée.
- Probabilités globales kk7 recalculées sur `sources/kk7/hotspots_all_all.json` : 38 points chauds sur 38 à moins de 6 m du point du fichier, valeurs conformes. Les valeurs par heure et par saison n'ont pas été recalculées. Trois classements (« le plus fort de… ») ont été démentis par ce fichier.

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 63 |
| NON SOURCÉ | 26 |
| CONTREDIT | 13 |
| NON VÉRIFIABLE | 13 |
| INVRAISEMBLABLE | 1 |
| **Total** | **116**, sur 104 éléments |

Par massif : Briançonnais 32, Écrins 30, Serre-Ponçon 27, Ubaye 16, Queyras 11.

Un constat de l'audit du 30 octobre est levé : « sans vol thermique » de mai à juin dans le cœur des Écrins n'est pas inventé. Le topo du club (S39) dit « le vol en thermique dans le cœur du parc est totalement interdit ». Le texte le garde.

## Les constats les plus graves

1. **Décollage de La Bâtie-Neuve.** Le nord-ouest « redressé par le thermique » était présenté sans la suite de la fiche : « mais dangereux en vol ». Rétabli, avec la consigne d'éviter le site par nord et nord-ouest.
2. **Repose au décollage de Saint-Vincent.** « On peut presque toujours reposer » : le fil cité la dit « tout sauf tranquille », et rapporte un pilote paralysé. Réserve ajoutée.
3. **Les Orres.** La pente école, donnée comme atterrissage, est signalée interdite par le club local (S68). Alerte placée en tête.
4. **Izoard.** Le triangle de 350,53 km était dit « le record du monde » : il a été battu par 358,6 km, depuis le même col.
5. **Vol dans le nuage.** La rue de plafond « parfois dans le nuage, à la boussole » était proposée comme une possibilité, alors que le fil la critique. Retirée, signalée en note.
6. **Saint-Blaise.** La ligne haute tension côté nord figure sur la fiche, mais la carte du club la dit « démontée fin 2022 ». Passée en note.
7. **Lombarde à la Croix d'Aquila, à l'envers.** « Au-dessus de 2300 m, la Lombarde se plaque » : elle souffle sous 2300 m.
8. **Chiffres déplacés.**
   - L'atterrissage turbulent « après 14-15 h » ne vise que Serre Buzard, pas Embrun ni toute la Durance.
   - Les plafonds « banals » de 2700 à 3000 m viennent d'une réponse sur Laragne, pas sur la Blanche.
9. **Faits mal lus.**
   - La « traversée de la Durance sous le barrage » est la route d'accès au décollage, pas un itinéraire de vol.
   - Le col Saint-Jean n'est pas « derrière le décollage » de Saint-Vincent : il est 3 km au sud.
   - C'est le flux de sud, non la brise de Gap, qui renforce la brise d'ouest sur le lac.
   - Le Piolit n'est pas un « passage obligé » : une des deux variantes l'évite.
   - L'Hippodrome et La Chaup sont le même terrain.
10. **Lieux et vols fusionnés, déductions écrites comme des faits.**
    - Trois décollages du Galibier réunis en une pente.
    - Le plafond de 4170 m d'un seul vol « atteint ici » sur six points chauds.
    - Classements kk7 faux (Alpages, Aguyés, crête de Serre Buzard).
    - Morgon « volume protégé », Colombis « sous le vent », Clot la Cime « déclencheur des grands cross », brise « forte » du soir à Vallouise.
    - Conventionnement du Petit Aréa et du Haut : topo du club et fiche fédérale divergent, signalé en note.

## Champs structurés à corriger (non modifiés)

- `hours` : `brise-durance-basse-guisane` (10h30-16h30), `transfert-lautaret-guisane` (8h-10h30), `brise-descendante-vallouise` (19h30-9h), `brise-durance` de Serre-Ponçon (12h-18h, 14h-17h), `brise-fournel`, `brise-freissinieres`, `brise-guil` (après-midi d'été), `brise-matinale-descendante-ubaye`, `brise-pente-puy-aillaud` (« dès 9h-9h30 » sans « parfois »).
- `speed_kmh` : `brise-descendante-vallouise` (20/30), `brise-matinale-descendante-ubaye` (5/10).
- `best_hours` : `pentes-se-puy-aillaud`, `therm-conf-saint-chaffrey`, `therm-arete-clement-risoul` et `clocher-saint-clement-pentes-ouest` (fin d'après-midi), `therm-aquila-rocher-sud` (date et heure d'un vol), `thermiques-mont-guillaume` (midi), `therm-blanche-pic-des-tetes` (plafonds de Laragne).
- `trigger` : `therm-serre-chevalier-est-matin`, `therm-galibier-pente-herbeuse`, `therm-aquila-rocher-sud`, `therm-serre-buzard-falaises`, `therm-colombis-relance`, `therm-piolit-passage`.
- `conditions` : `tempete-avant-orage-durance`, `cb-pelvoux`, `embrun-atterro-brise`, `chabrieres-degueulante-brise-gap`.
- `wind_dirs` : `soaring-seolanes` (aucune direction dans la source).
- `alt_m` : `sarsena-bobbio-pellice` (1418, contre 1416 m dans S108).
- `distance_km`, calculés par l'atlas : `claree-printemps`, `granon-lautaret-aller-retour`, les trois cross de Vallouise, `prorel-embrun-2010`, `st-vincent-dormillouse-morgon`, `dormillouse-vers-drac`, `piolit-chabrieres-morgon`, `barcelonnette-champsaur-dormillouse-pra-loup-138km-2022` (68,5 km pour un vol de 138 km).
- Doublon à fusionner : `atterro-hippodrome` et `atterro-la-chaup`, même point.
- Statut à trancher : `atterro-orres-pente-ecole`, signalé interdit et toujours listé comme atterrissage.

## Hors périmètre

Même erreur dans les textes de massif, non modifiés.

| Massif | Place | Affirmation fausse | Fait de la source |
|---|---|---|---|
| brianconnais-guisane | `summary`, 3e paragraphe | Les cross partent « jusqu'à Névache » | Une phrase sur une seule journée (S28) |
| brianconnais-guisane | visite, étape 8 | « les plafonds peuvent atteindre 4000 m » | Un seul vol, en biplace (MS15) |
| brianconnais-guisane | visite, étape 9 | « Tous luttent contre la Lombarde thermique » | Absent de S28 |
| ecrins-vallouise-haute-durance | `tips[5]`, visite, étape 4 | « forte brise descendante du soir » | MS16 relue ne le dit pas ; S32 dit « brise descendante », sans force |
| ecrins-vallouise-haute-durance | visite, étape 3 | Entraigues, « passage obligé vers les Bans » | Absent ; S15 : « Pas d'attéro possible et souvent fort en brise » |
| ecrins-vallouise-haute-durance | visite, étape 5 | « un bon repère pour monter avant une transition » | Absent de MS14 |
| serre-poncon-embrunais | `summary` ; visite, étapes 0, 3 et 14 | Atterrissage turbulent après 14-15 h au Guillaume, à Pierre-Arnoux, partout | HS16 ne le dit que de Serre Buzard |
| serre-poncon-embrunais | `tips[0]` ; visite, étapes 3 et 7 | « à partir de midi », « à cause de la brise » | Lien causal absent ; S10 : « Joli site du matin » ; HS18 hors cache |
| serre-poncon-embrunais | `tips[3]` | « le volume protégé du Morgon » | Absent ; HS14 : « Site protégé du Mistral » |
| serre-poncon-embrunais | visite, étape 5 | « Le Morgon donne des plafonds à 3000 m », « les plus forts du secteur » | Un vol à 3000 m parmi d'autres (S88) ; S15 ne classe pas |
| serre-poncon-embrunais | visite, étape 13 | confluences « au-dessus du lac » | S88 : « en plaine vers le Barrage » |
| ubaye | visite, étape 4 | Plafonds « banals » de 2700 à 3000 m sur la Blanche ; plus de 3000 m par jour de nord | La réponse de S87 parle de Laragne ; le second chiffre n'a pas été retrouvé |

## Ce qui n'a pas pu être vérifié

- Le texte complet des fiches fédérales au-delà de 600 caractères, notamment le fauchage et les 150 m de Jausiers et Halte 2000, et l'ancien terrain des Chamousses.
- MS12 : la page relue ne contient ni l'obélisque, ni la Lombarde au Chalvet, relevés en première passe.
- HS18 et MS17, absents du cache.
- S68 (Curl'Air), derrière Cloudflare : seule la note de collecte a été lue.
- Les relevés XContest, CFD et Syride, ainsi que les vitesses de brise, sans source chiffrée.
- Les valeurs kk7 par heure et par saison.
