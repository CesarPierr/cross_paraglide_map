# Véracité des éléments — lot annecy_bornes_aravis

Contrôle du 30 octobre 2026, avec réécriture des textes dans la « Voix » de `_methode/STYLE_TEXTES.md`. Périmètre : les 195 éléments du lot (lac d'Annecy 95, Bornes 34, Aravis 66), champs `description`, `possible`, `note`, `mechanism`, `usage`. Les résumés, conseils, effets de vent et visites n'ont pas été touchés. Constats détaillés : `veracite_elements_annecy_bornes_aravis.json` (un objet par constat non confirmé).

## Méthode

- Pour chaque élément, les affirmations précises (chiffres, heures, directions, lieux, règles, mécanismes) ont été recherchées dans les documents archivés du lot (`.cache/research/docs/annecy_bornes_aravis/`, convertis en texte), dans la récolte FFVL (`sources/ffvl_sites_alpes.json`) et, pour les pages du CHVD et du club St Hil'Air, dans les archives des lots voisins. Aucune page n'a été relue en ligne.
- La carte de brises de 2009 (S30/S31) a été lue sur l'image (`img/avl_brise.jpg`, `img/crop_ne.png`) et sur son texte en colonnes (`pdftotext -layout`), ce qui a permis de rattacher chaque remarque à la bonne fiche.
- Les altitudes et positions ont été confrontées à l'atlas (`altDelta`) et aux sommets OSM du lot.

## Décompte

| Verdict | lac-annecy | bornes | aravis | Total |
|---|---|---|---|---|
| DÉFORMÉ | 34 | 13 | 24 | 71 |
| NON SOURCÉ | 12 | 2 | 1 | 15 |
| CONTREDIT | 6 | 1 | 3 | 10 |
| INVRAISEMBLABLE | 0 | 0 | 4 | 4 |
| NON VÉRIFIABLE | 1 | 0 | 0 | 1 |
| **Constats** | 53 | 16 | 32 | **101** |

82 éléments portent au moins un constat ; les 113 autres n'ont montré aucun écart sur les affirmations contrôlées (CONFIRMÉ). Tous les constats ont été corrigés dans le texte ; les champs structurés fautifs sont listés plus bas, sans avoir été modifiés.

## Les dix écarts les plus graves

1. **Réserve du bout du lac : 300 m au lieu de 200 m (CONTREDIT).** Verthier (danger et atterrissage) et la fiche de la réserve reprenaient une fiche ancienne (« moins de 300 m, toléré pour l'approche finale »). L'arrêté de Talloires et la FFVL disent 200 m. Corrigé à 200 m ; la valeur ancienne passe en note.
2. **Semnoz, combe sous le décollage : direction inversée.** « Les manches à air … voire viennent de face » ; la source : « un flux venant de l'arrière ». Corrigé.
3. **Semnoz, zone d'aéromodélisme : consigne inversée.** « Les planeurs de grande envergure doivent s'écarter » ; la source demande au parapentiste de s'éloigner immédiatement. Le « virage de chien de berger » était une « laisse de chien ». Corrigé.
4. **Dénivelés de La Clusaz invraisemblables.** Crêt du Merle « 200 m », Crêt du Loup « 560 m », Aiguille des Calvaires « 800 m » sur Cortibot : chiffres d'une fiche qui place Cortibot à 1 300 m, alors qu'il est à 1 122 m (conforme au relief). Corrigé en environ 350, 700 et 900 m ; les finesses anciennes passent en note.
5. **Décollage de l'Étale présenté comme actuel (CONTREDIT).** Le téléphérique a disparu vers 2007. Le décollage est décrit comme ancien.
6. **Atterrissage du village du Grand-Bornand (CONTREDIT).** « À utiliser le matin ou le soir » : seul l'atterrissage des Potais est aujourd'hui autorisé sur la commune. Dit au passé.
7. **Doussard : thermiques « qui font perdre de l'altitude ».** Contresens sur « in the altitude-losing zone » (la zone où l'on perd son altitude). La fiche des thermiques de Doussard ajoutait un mécanisme (« plaine chauffée par la brise ») et une consigne absents de la source. Corrigé.
8. **Brise du lac « vers 13h30 un bon jour ».** C'est l'heure où le décollage principal se met à marcher. « Plus forte au printemps » visait le site. Corrigé, et les champs `hours` et `speed_kmh` sont signalés.
9. **Quadrilatère de 81 km : Sulens donné pour balise.** La quatrième balise est la pointe sud des Aravis, au-dessus du col du Fer ; Sulens n'est qu'un passage. Le champ `name` est à corriger.
10. **Brises de Seythenex (lieu transposé).** « Atterrissage sujet aux brises de vallée en milieu de journée » appartient, sur la carte, à la colonne de la Patinoire du Grand-Bornand, pas à Seythenex. Corrigé : c'est Faverges qui a des « brises fortes en milieu de journée ».

Autres écarts notables : la ZSM de l'Arclosan placée « au nord-ouest de Serraval » (elle est à l'ouest, à 4 ou 5 km) ; les pilotes de Planfait montent à la Tournette « pour décoller au-dessus de l'inversion », et non parce qu'ils ne le peuvent pas ; « beaucoup de gaz » (de la hauteur) lu comme de l'air portant au col du Varo ; la montée du Petit Sulens part du col du Marais, au lieu d'y mener ; au Veyrier, 1 800 m sont nécessaires avec du vent, et 1 650 m ont suffi un autre jour (le sens était inversé) ; plusieurs questions ou projets de forum énoncés comme des faits (Croix-Fry, plan Lanfonnet–Cotagne–Étale, Mont Veyrier par sud-ouest) ; le câble du Parmelan, dit « non documenté », est celui du ravitaillement du refuge du CAF.

## Défauts systématiques

- **Un vol devient une règle**, surtout via les champs horaires : Charvin « dès 10 h 30 », Jalouvre « 16 h à 17 h », Buclon « avant 17 h », Tardevant « 13h30 », Lachat « 16h-16h30 », Planfait « 14h-16h ». Ce sont des heures de décollage ou de balise d'un seul récit.
- **Des conditions de vent ajoutées** à une observation qui n'en donne pas : Jalouvre « par nord-ouest à ouest », Pointe Percée « par vent d'ouest », Lachat « par sud ».
- **Des distances calculées par l'atlas** dans `distance_km` : petit tour 25 km (sources : 35 à 40 km), grand tour 46 km (aucune source), triangle 124 km (« plus de 100 km »), Semnoz–Revard 18 km (50 km aller-retour).
- **Des traductions fautives** des pages anglaises : « airspace » devenu « terrain » (Chambéry), « 200 meters from the parking » devenu « 200 m sous le parking » (rampe delta), « may still be possible » devenu « reste souvent volable » (Forclaz par nord-est).
- **Des déductions de carte dites comme des faits** (confluences de Veyrier, Menthon, Bluffy, col des Aravis) : elles portent désormais « probablement » ou « sans doute ».

## Correction d'un rapport antérieur

`veracite_lots_1-6.md` jugeait non sourcée la cause du venturi du pilier sud du Parmelan (« la brise de vallée file vers Thônes »). S86 la donne bien (réponse 12 : « une forte brise latérale qui fuit le "bol" créé par cette falaise pour tourner le pilier et filer vers Thônes »). Le texte de l'élément la garde.

## Champs structurés à corriger (non modifiés)

| Élément | Champ | Problème |
|---|---|---|
| lac-annecy/brise-lac-annecy | `speed_kmh` | 15/25 km/h déduits de « soutenue » : mettre null |
| lac-annecy/brise-lac-annecy | `hours` | 13h30 est l'heure du décollage ; la borne de 19 h n'est pas sourcée |
| lac-annecy/brise-vallee-faverges | `speed_kmh` | 15/25 km/h déduits de « brises fortes » |
| lac-annecy/confluence-doussard-soir | `when` | « quand les faces est des Bauges passent à l'ombre » : cause non sourcée |
| lac-annecy/lac-cumulonimbus-nord | `conditions` | « surtout fin d'après-midi d'été » : un seul épisode |
| lac-annecy/veyrier-col-thermique | `best_hours` | « jour de plafond ≥2500 m » : prévision d'un seul jour |
| lac-annecy/rochette-thermique-de-service | `trigger` | croupe « éclairée dès que la brise s'installe » : non sourcé |
| lac-annecy/epaule-planfait-dents-de-lanfon | `best_hours` | 14h-16h tiré d'un décollage à 14h45 |
| lac-annecy/doussard-thermiques-bout-du-lac | `trigger` | « plaine chauffée en brise de nord-ouest » : non sourcé |
| lac-annecy/petit-tour-du-lac | `distance_km` | 25 (ligne droite) ; sources 35 et ~40 km |
| lac-annecy/grand-tour-du-lac | `distance_km` | 46 : aucune source |
| lac-annecy/semnoz-revard | `distance_km` | 18 (ligne droite) ; source 50 km aller-retour |
| bornes/confluence-mont-lachat-thones | `when` | « jour de NO marqué en altitude » : un seul vol |
| bornes/parmelan-tete-a-turpin | `conditions` | « ouest–nord-ouest, sans cumulus » : un seul vol |
| bornes/mont-lachat-thones | `trigger` | brises nommées (Fier, Saint-Jean-de-Sixt) : déduction |
| bornes/tournette-col-du-varo-thermique | `best_hours` | « milieu de journée en octobre » : un seul récit |
| bornes/triangle-tournette-percee-sousdine-arclusaz | `distance_km` | 124 : calcul ; source « 100+ km » |
| bornes/etale-tardevant-parmelan-rdb-81km | `name` | Sulens n'est pas une balise (B4 : pointe sud des Aravis, col du Fer) ; `distance_km` 79 contre 81 annoncés |
| aravis/jalouvre-sous-le-vent | `conditions` | direction de vent ajoutée |
| aravis/pointe-percee-descendance | `conditions` | « vent d'ouest » ajouté |
| aravis/mont-charvin | `best_hours` | 10h30 = heure d'un décollage à Praz Véchin |
| aravis/lachat-gb-thermique | `best_hours` | 16h-16h30 : un seul vol |
| aravis/combe-de-borderan | `best_hours` | relie deux passages distincts (départ matinal / brise de début d'après-midi) |
| aravis/pointe-de-tardevant | `best_hours` | 13h30 = passage d'une balise |
| aravis/jalouvre-falaise-soleil | `best_hours` | 16h-17h : un seul vol |
| aravis/buclon-lessy | `best_hours` | « avant 17h » : heure déduite, sens contraire à la source |
| aravis/roc-des-arces-col-de-chatillon | `trigger` | « déneigé » : condition d'un jour d'hiver |

## Ce qui n'a pas été vérifié

- **S1 et S14** ont été relus (page Grands Espaces archivée), mais la fiche Apidae de Doussard (S14) ne l'a été que par sa note de collecte.
- **Les polylignes de référence (S39)** des brises de Flumet, de Faverges–Serraval et du col des Aravis n'ont pas été recoupées sur le KML : NON VÉRIFIABLE, tracés laissés au conditionnel.
- **Les cartes annotées des Ailes des Aravis (S94)** sont des images non relues : zones du Crêt du Loup, déclencheurs de Merdassier et du Buclon.
- **Les pourcentages des points chauds (S96, kk7)** n'ont pas été recalculés ; ils restent en note.
- **Statuts actuels** : Verthier (absent de la liste FFVL, dit « ancien atterrissage », peut-être interdit), Lathuile, col du Marais et Coche Cabane ne sont pas confirmés par une fiche officielle.
- **Orientation de Cortibot** : la FFVL donne nord, ouest et nord-ouest, la carte de 2009 et Barbules est-ouest. L'écart est laissé en note.
