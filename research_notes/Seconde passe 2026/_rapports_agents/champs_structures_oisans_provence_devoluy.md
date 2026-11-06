# Champs structurés corrigés — oisans_maurienne, provence_maritimes, devoluy_gap_buech_diois

6 novembre 2026. Chaque changement est dans `champs_structures_oisans_provence_devoluy.json` (avant, après, source, raison). Aucune coordonnée n'a bougé (positions de l'atlas identiques avant et après) et aucun id n'a été renommé.

## Règles appliquées

- **`speed_kmh`** : le modèle sait s'en passer (vitesse par défaut selon le type de brise, fiche « non documentée »).
  - Aucun chiffre ni mot de force : champ à null (38 brises).
  - Brise dite forte, là où la valeur par défaut la sous-estimerait : typique gardée en estimation, dite en note, maximum retiré. Le modèle n'y change pas (14 brises, dont 2 avec une source chiffrée : Maurienne, max 50 km/h ; plus 2 typiques estimées sans changement de champ, Chalvet sud-ouest et Mison).
- **`best_hours`** : optionnel ; sans lui, le contrôle suppose 12h-15h. Retiré s'il vient d'un vol, d'une valeur par défaut ou de rien.
- **`distance_km`** : retiré quand l'atlas l'a calculé. La liste des itinéraires retombe sur la longueur du tracé. Deux valeurs viennent des sources : 100 km (Chamrousse 2024), 23 km (D'Tour d'Aussois).
- **Mauvaise catégorie** : `landings` passé en `hazards`, `kind: other`, nom explicite. L'élément quitte la liste des atterrissages et le simulateur.

## Estimations gardées

Vitesse typique sans mesure, dite en note : `romanche-brise-montante`, `romanche-haute-vers-lautaret`, `veneon-brise-venosc`, `eau-d-olle-brise`, `brise-montante-maurienne`, `brise-montante-haute-maurienne`, `brise-valloirette`, `brise-pente-chalvet-sud-ouest`, `brise-de-mer-prealpes-grasse`, `brise-tinee`, `brise-roya`, `brise-vallee-devoluy`, `brise-durance-tallard`, `flux-descendant-meouge-mison`, `brise-ouest-aucelon`, `brise-couspeau-bourdeaux`.

Heures gardées parce que le modèle a besoin d'une fenêtre : `brise-matinale-descendante-maurienne` (21h-9h, déduction), `brise-buech` et `brise-pente-ceuse-sud` (« après-midi (été), sans horaire dans les sources »).

## Contrôle du modèle

Deux atlas compilés hors du dépôt, mêmes autres lots, comparés avec `check-model.ts <atlas> --out … --json …` : voir la section suivante pour la raison.

| Secteur | Avant | Après | Cause |
|---|---|---|---|
| Arves – Galibier | 9/12 | 10/12 | `granges-du-galibier-depart-300` réussit (heure inventée retirée) |
| Dévoluy | 10/11 | 11/11 | `therm-faisses` réussit |
| Mercantour | 40/43 | 41/43 | `valberg-col-des-huerris` réussit |
| Oisans | 39/45 | 38/45 | `vaujany-brise-de-pente` échoue |
| Gapençais – Céüse | 14/16 | 12/15 | `brise-pente-ceuse-sud` échoue ; `ceuse-no-sous-le-vent` non testable |
| Maurienne | 24/27 | 23/26 | `grande-verdette-sous-le-vent-comborciere` non testable |

Total des 16 secteurs : 400/446 avant, 399/444 après. Les 10 autres secteurs ne bougent pas.

- `vaujany-brise-de-pente` et `brise-pente-ceuse-sud` : hors horaires, le modèle donne 4 et 3 km/h, le seuil vaut 30 % de la vitesse documentée. Avec 8 km/h par défaut (au lieu de 15 et 12, sans source), il tombe à environ 2 km/h. Le modèle n'a pas changé d'avis : le seuil a baissé. Aucune source ne chiffre ces brises (S1, S54 ; S54, S30, S52) : changement gardé.
- `ceuse-no-sous-le-vent` : S60 dit « brise », pas « vent de sud ». `grande-verdette-…` : S136 ne donne pas de direction. Sans vent cité, ces deux dangers sortent de la couche simulée ; ils restent sur la carte.
- Vitesse du modèle changée sur 17 brises (de 5→8 à 20→15 km/h), fenêtre sur 2 (`brise-buech`, `brise-pente-ceuse-sud`). Aucun autre résultat ne change de statut.

Trois valeurs essayées puis retirées parce que le modèle les contredisait sans source solide : `therm-chabre-crete` « dès midi », `therm-chauvet-festre` « matin tôt », `pente-se-des-lattes` « en matinée ». Ces champs sont vides ; le texte garde ce que disent les sources.

## Limite de `model:check` sans argument

`npm run model:check` lit `apps/web/public/data/atlas.json`, que `data:build -- --check` n'écrit pas : il ne voit donc aucune modification de lot. Le score 1203/1329 ne reflète pas ces données.

## À décider

- Retrait définitif : `plage-de-nice`, `saint-laurent-du-var-plage` (kitesurf), `la-montmaur`, `la-beauvoisin` (interdits), aujourd'hui en danger « autre ».
- `thorenc-atterro` : passé en danger. Bleine n'a plus d'atterrissage dans l'atlas. Id gardé, cité par la visite de Grasse.
- `sigoyer`, `veynes-vallee` : restés en atterrissage, nom « pas de terrain désigné ». Le simulateur peut les proposer.
- `les-gorges` (interdit du 1er juin au 15 novembre) et `la-nyons-intermediaire` (terrain de secours à éviter) : restés en atterrissage, le texte le dit.
- `archail-fontaine` : 1720 m (catalogue), mais la position de la fiche fédérale est à 1051 m sur le MNT. Une alerte de compilation apparaît. Coordonnées à vérifier sur le terrain.
- Ids qui gardent un chiffre : `lautaret-plafond-4050` (cité par deux visites, dont le Briançonnais), `mouchon-plein-3400`, `mounier-thermique-3200`, `mourre-de-chanier-plafond`.

## Non vérifié

- `best_hours` et `trigger` absents des rapports (ex. `crete-des-serres-angle` 13h-17h, `coste-longue-pointe-sud` 13h-15h30) : pas relus.
- `lombarde-sospel.conditions` (nord à nord-est) garde la seule version de Sospel.
- Fiches derrière Cloudflare, S183 (citation reprise du rapport de véracité, fil non relu ici), passage Caduc de S55 (idem).
- Interface non ouverte : l'affichage en danger des 5 éléments reclassés n'est vérifié que dans l'atlas compilé.
