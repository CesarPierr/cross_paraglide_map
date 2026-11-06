# Véracité et réécriture des éléments — lot oisans_maurienne

6 novembre 2026. Les 233 éléments du lot (Oisans-Grandes Rousses 93, Maurienne 63, Haute-Maurienne 48, Arves-Thabor-Galibier 29) ont été comparés à leurs sources, et 219 ont été réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`. Les 14 autres, très courts, n'appelaient pas de changement. Seuls `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Les constats sont dans `veracite_elements_oisans_maurienne.json`, un objet par constat.

## Méthode

- Sources relues dans `.cache/research/docs/oisans_maurienne/` : guide des sites de l'Oisans (`tg/`), fils de forum (`pi_*`), pages Chocard (`choc_*`), Croix des Fleurs, cahier CDVL 73, arrêté Vanoise (OCR), cartes KML (`zones_eviter.kml`, `largeault_lines.json`), récits CHVD (`chvd_wp/all.json`), La Toussuire (`secteurs_minces/`).
- Fiches fédérales lues dans `.cache/research/ffvl_sites_alpes.json`. Ce fichier est plus complet que `ffvl_sites.txt` pour certains champs, mais tronqué à 600 caractères.
- Une page lue en ligne : parapentealpedhuez.com (S114). Aucune page bloquée n'a été contournée.
- Probabilités globales kk7 recalculées sur `sources/kk7/hotspots_all_all.json` : 26 points chauds sur 26 conformes. Les pourcentages par période n'ont pas été recalculés.
- Les 20 constats de l'agent précédent (Arves) ont été repris et appliqués. Les relevés Syride et XContest n'ont été lus que dans les notes de `sources[]`.

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 63 |
| NON SOURCÉ | 29 |
| CONTREDIT | 4 |
| INVRAISEMBLABLE | 3 |
| NON VÉRIFIABLE | 4 |
| **Total** | **103**, sur 90 éléments |

Par massif : Oisans 43, Arves 22, Maurienne 19, Haute-Maurienne 19. Certains constats couvrent plusieurs éléments.

## Les constats les plus graves

1. **Perrons, sens inversé.** « Le survol de la station et des câbles se fait à basse altitude » : la fiche écrit « à prescrire », évidemment « proscrire ». Corrigé, avec le parking à ne pas survoler (rouleaux).
2. **Aussois hiver, terrain fermé.** Présenté comme atterrissage d'hiver et d'été. La fiche dit « Fermé priorités pastorale » et n'accepte que le bord de route.
3. **Zone gypaète de la Loza.** La règle de nidification manquait : du 1er septembre au 31 octobre seulement si le couple niche.
4. **Dent Parrachée « qui culmine à 2800 m ».** C'est le maximum d'un vol ; le sommet fait 3697 m.
5. **Géographie.** Montgellafrey placé sur Belledonne (il est de l'autre côté de l'Arc), Sollières en rive gauche (rive droite), Meijette au sud-ouest de la Meije (au nord), Gorges du Chambon jusqu'à Villar-d'Arêne (le polygone s'arrête avant La Grave).
6. **Altiport de l'Alpe d'Huez.** Les « secours sur piste » sont sur les pistes de ski, pas sur la piste de l'altiport.
7. **Plafonds d'un vol devenus des règles.** 4050 m au Lautaret, « plafond le plus haut » à la brèche de la Meije (inventé), 3600 m au Plat de la Selle, Grande Ruine, Pic du col d'Ornon.
8. **Faits mal lus.**
   - À Poutran, la fonte des neiges conditionne l'accès, pas le soaring.
   - Au 2700, les rochers « qui chauffent » sont un obstacle au décollage.
   - « Meilleur en fin d'après-midi » vise Poutran.
   - « 3000 m au-dessus de l'Alpe d'Huez » est une altitude.
   - Le « col fermé » du Lautaret vient de « vigilance à la circulation ».
   - Les « annexes » de la Maurienne ne sont pas déconseillées : quelqu'un dit ne pas les connaître.
9. **Vols et lieux fusionnés.** Coche et Muzelle, plans de vol des Petites Rousses, ascenseur de la Cheminée placé à la clairière au lieu du décollage n° 2, relevés d'heures et de mois du Signal.
10. **Déductions écrites comme des faits.** Brise nocturne de Maurienne, Lauvitel « concerne les vols des Deux Alpes », rôles de « déclencheur et plafond » (Turra, Côte Belle, Rachas), vitesse sol de 55-60 km/h devenue vitesse sans précision.

## Champs structurés à corriger (non modifiés)

- `speed_kmh`, interprétés depuis « forte » : Romanche (2), Vénéon, Eau d'Olle, brises de pente de Vaujany et d'Aussois, brise montante de Maurienne (55) et de Haute-Maurienne, Villards, Montgellafrey, brise descendante, vallon de Saint-François, Valloirette, Arvan.
- `confluence-romanche-guisane-lautaret.when` : « Après-midi d'été », la source dit « durant la journée ».
- `grave-atterro-turbulence.conditions` : « en été » non écrit.
- `huez-toits.best_hours` et `bras-schistes-huez.best_hours` : 13h-14h vise le soaring de l'Éclose.
- `signal-huez-pentes.best_hours` : heures et mois croisés à tort.
- `alpe-huez-2700-pentes-ouest.trigger` et `best_hours` : rochers chauffants, phrase sur Poutran.
- `cheminee-vaujany-ascenseur.trigger` et `best_hours`.
- `meijette-la-grave.trigger` : « sud-ouest de la Meije ».
- `lautaret-plafond-4050` : `name` et `id`.
- `deux-alpes-vers-meije-face-sud.name` : passage par la Coche et la Muzelle non sourcé.
- `montgellafrey-crete-depart-cross` : `name` et `trigger` (Belledonne).
- `sollieres-sardieres-relance.trigger` : rive gauche.
- `arcelle-val-cenis-relance` : `name` et `trigger`.
- `brise-forte-aussois.conditions` : Fourneaux.
- `foehn-haute-maurienne.conditions` : foehn à Valfréjus.
- `turra-falaises-termignon.best_hours` : « toute l'année », contre l'arrêté (16 mai - 31 octobre sous 1000 m).
- `grande-verdette-sous-le-vent-comborciere.conditions` : « sud à ouest » non sourcé.
- Arves : `brise-valloirette`, `brise-arvan` (`speed_kmh`), `galibier-sud-thermique.best_hours`, `granges-du-galibier-depart-300.best_hours`.
- `sources` des points kk7 sans lien avec S1 (`huez-sardonne`, `saperan`, `petit-van`, `dome-de-la-lauze`, `roche-d-alvau`).
- `distance_km` calculés par l'atlas : les 3 traversées de Belledonne (84,4 ; 77,3 ; 42,7) et les itinéraires à vol d'oiseau.

## Hors périmètre (même erreur ailleurs)

- Oisans :
  - `tips[7]` : ascendances de 13h-14h « au-dessus des toits d'Huez » ;
  - `tips[10]` : « si vous pouvez revenir à La Bérarde », la source dit assez haut pour assurer le retour ;
  - `tips[11]` : 7 m/s attribués à la Meijette et à la brèche, rabattement généralisé ;
  - `visites` étape 12 : à revoir, Lauvitel « vers le Vénéon » ;
  - `visites` étape 16 : le plafond de 4050 m est bien dit comme un vol, mais la formule reste à relire.
- Haute-Maurienne :
  - `tips[7]` : 2350 m et plafonds de mars et d'août en règle ;
  - `tips[8]` : gypaètes et zone de sensibilité à la Turra ;
  - `visites` étape 5 : « thermique exceptionnel » ;
  - `visites` étape 8 : « le retour n'a jamais réussi ».
- Maurienne : `tips[7]` déjà corrigé en deux vols. Rien de nouveau.
- Arves :
  - `tips[4]` : le Galibier sud donné comme départ des 300 km ;
  - `visites` étape 7 : 2014 et 2017, FAI, à relire.

## Non vérifié

- Vol « Le Prestige » (S29) : absent du cache, retrouvé en ligne par l'agent précédent, non relu ici.
- Interdiction de vol « jusqu'au 15 août » et couple de gypaètes à la Turra (S113) : page non en cache. Retiré au profit de l'arrêté de 2026.
- « 3600 m » au Pic du Frêne (S122, S124) : introuvable dans le texte et sur la page 10 ; gardé sans le mot « record ».
- Accès de Plan Lachat : 5, 30 et 40 min, 200 et 250 m. La divergence est dite en note.
- Pages Syride et XContest : notes de `sources[]` seulement. S13 : tracés lus, sens non vérifiable au-delà des flèches.
- Fiches fédérales tronquées à 600 caractères (Aussois hiver notamment).
