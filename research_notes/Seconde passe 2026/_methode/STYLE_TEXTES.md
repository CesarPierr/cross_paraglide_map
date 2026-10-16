# Écrire les textes des lieux

Ce guide vaut pour tout ce que lit le pilote : fiches des éléments (brises, convergences,
dangers, thermiques, sites de vol dynamique, décollages, atterrissages, itinéraires),
résumés et conseils des massifs, effets du vent météo, étapes des visites guidées.

**Le but : rien perdre, tout ranger.** Chaque information de l'original doit se retrouver
quelque part, mais à sa place, dite clairement, dans un français soigné. On gagne en clarté
en organisant, pas en supprimant.

## Ranger l'information

Chaque élément a trois champs de texte, chacun avec son rôle :

| Champ | Ce qu'il contient | Forme |
|---|---|---|
| `description` | **L'essentiel établi** : ce qui se passe, où, quand, pourquoi (le mécanisme), et ce que le pilote doit en faire. Seulement ce qui est recoupé (plusieurs sources, fiche officielle, ou conséquence directe du relief et du soleil). | 1 à 3 phrases, 480 caractères au plus en visée (un décollage complexe peut aller un peu au-delà). |
| `possible` | **Les observations isolées** : un seul récit, une expérience de vol, un cas particulier. Reformulées en possibilités, sans nom ni date. | Liste de 0 à 3 phrases courtes (220 caractères au plus chacune). |
| `note` | **La note de collecte** : position estimée, tracé schématique, source incertaine ou contradictoire, remplacement d'un point de la première passe. | Une phrase neutre ; elle s'affiche discrètement avec les faits. |

Pour une convergence, l'essentiel est réparti entre `mechanism` (le mécanisme) et `usage`
(comment s'en servir, ce qu'il faut craindre) ; `possible` et `note` s'y ajoutent de la même façon.

Les faits structurés restent dans leurs champs (`hours`, `conditions`, `best_hours`,
`trigger`, `orientations`, `alt_m`…) **et ne se modifient pas** : le modèle de vent les lit.
La prose peut les reprendre pour expliquer, jamais les contredire.

## Les règles

1. **Pas d'attribution dans la prose.** Ni personne, ni club, ni magasin, ni magazine, ni
   forum, ni vidéo, ni date de vol : pas de « d'après », « selon », « un pilote raconte »,
   « Vol Libre n°298 », « XC Mag », « fiche FFVL », « forum 2008 ». Les sources restent
   dans le champ `sources`, et l'interface les affiche sous le texte.
2. **Les faits d'abord, les possibilités ensuite.** Ce qui est établi va dans
   `description` ; ce qu'un seul témoignage rapporte va dans `possible`, formulé comme une
   possibilité : « Il arrive que… », « Possibilité de… », « On peut… », « Par … , le … peut… ».
3. **Pas de citation de personnes.** On reformule le contenu (« une turbulence violente »
   plutôt que « une "baffe monstrueuse" »). Les guillemets restent pour les noms de lieux
   locaux (« crêtes à mouettes », le « bocal »).
4. **Rien d'inventé.** Aucun chiffre, aucun lieu, aucune affirmation qui ne soit dans
   l'original. On peut retirer un chiffre anecdotique (l'heure d'un vol raconté), jamais en
   ajouter un. Le contrôle `text_audit.py` refuse tout chiffre nouveau.
5. **Rien de perdu.** Une information qui sort de la `description` va dans `possible` ou
   dans `note`. La seule exception : une phrase qui répète mot pour mot un champ structuré
   affiché à côté (horaires, position « approximative »).
6. **Le français à l'honneur.** Phrases complètes, voix active, un sujet clair, une idée
   par phrase. Pas de style télégraphique, pas de suites de mots-clés, pas de parenthèses
   en cascade, pas de points-virgules en chaîne. Le ton d'un moniteur qui montre la carte.
7. **Des mots constants.** brise de pente, brise de vallée, brise descendante (catabatique),
   convergence, restitution, sous le vent, venturi, plafond, décollage, atterrissage. On dit
   « décollage » et « atterrissage » dans la prose (« déco » seulement dans un nom propre).
8. **Typographie** : apostrophe droite ('), guillemets français avec espaces (« … »), heures
   « 14 h » ou « 14h30 » comme dans l'original, nombres inchangés.

## Résumés, conseils, vent météo, visites

- **Résumé du massif** (`summary`) : 3 ou 4 paragraphes courts séparés par une ligne vide :
  le massif en une idée (forme, orientation) ; la journée de l'air (le mécanisme) ; autour
  du massif (entrées de brises, transitions) ; à respecter (espaces aériens, zones
  protégées). 1 600 caractères au plus.
- **Conseils** (`tips`) : une phrase d'action chacun, 260 caractères au plus ; garder le
  même nombre de conseils et **exactement les mêmes balises** `[S1]`, `[S2, S3]`.
- **Vent météo** (`synoptic_effects[].effect`) : l'effet puis la conséquence pratique, en 1
  à 3 phrases (420 caractères au plus) ; un cas isolé s'écrit en possibilité dans la phrase.
- **Visites** (`visites/<massif>.json`, champs `title` et `text` seulement) : 2 à 4 phrases
  (620 caractères au plus), un titre qui dit l'idée ; les faits d'abord, puis « il peut
  arriver que… » pour un cas isolé ; ne jamais toucher `focus`, `phase`, `wind`, `view`.

## Exemples

**Danger — col du Coq**

Avant : « Vol Libre n°298 : un pilote raconte une « baffe monstrueuse » au col du Coq alors
qu'il thermiquait tranquillement ; un faible écart de vitesse de nord suffit à transformer le
col en « machine à laver » car le nord « déborde par-dessus la Chartreuse ». Dans le schéma de
front froid, l'air froid emprunte les cols plus élevés (Vence, Coq, Ayes sous la Dent de
Crolles), qui deviennent turbulents et dangereux. Le Col du Coq est aussi dans un espace
naturel sensible (carte PNR). »

Après :
- `description` : « Par vent de nord, même faible, l'air qui déborde par-dessus la Chartreuse
  rend le col du Coq très turbulent : il suffit que le nord forcisse un peu. Au passage d'un
  front froid, l'air froid s'engouffre par les cols les plus élevés (Vence, Coq, Ayes sous la
  Dent de Crolles), qui deviennent dangereux. Le col est aussi dans un espace naturel
  sensible. »
- `possible` : [« La turbulence peut surprendre brutalement, alors qu'on enroule un thermique
  tranquille. »]

**Thermique — falaise est de Saint-Hilaire**

Avant : « Les décollages permettent de décoller tôt ; dès l'activité thermique, déclenchements
juste en sortie de déco (« soyez prêt à piloter dès le début »). La fiche FFVL du déco Est parle
de thermique canalisé par la combe du funiculaire, qui peut être fort. Position estimée devant
les décos. Récits : « on enroule tous un thermique au-dessus du déco nord » (15h30, septembre
2023, très fréquenté) ; en mars des « thermiques bien velus » passent le plateau ; XC Mag :
thermique de la maison en avant du déco, tailwind possible sur la grande moquette sud. »

Après :
- `description` : « La falaise et la combe du funiculaire, tournées vers l'est, prennent le
  soleil très tôt : les thermiques s'y déclenchent juste en sortie des décollages, et celui
  que canalise la combe peut être fort. Il faut être prêt à piloter dès le décollage. »
- `possible` : [« Un thermique se forme souvent au-dessus du décollage Nord, où l'on enroule
  à plusieurs en milieu d'après-midi. », « Dès le mois de mars, des thermiques vigoureux
  peuvent traverser le plateau. », « Ce thermique de la falaise peut mettre la grande
  moquette du décollage Sud en vent arrière. »]
- `note` : « Position estimée devant les décollages. »

**Convergence — col du Granier**

Avant : `mechanism` « Le flux de la cluse de Chambéry, qui passe le col vers le sud-ouest,
rencontre la brise qui remonte la vallée d'Entremont : les pointes des deux flèches de la carte
Largeault se font face de part et d'autre du col. » ; `usage` « Tracé schématique déduit des
pointes de flèches (aucune source ne décrit explicitement une ligne de convergence). Le col est
un passage turbulent ; la face N et E du Granier est sous le vent de la brise (PDF du club,
légende 1). »

Après :
- `mechanism` : « L'après-midi, le flux de la cluse de Chambéry franchit le col vers le
  sud-ouest et rencontre la brise qui remonte la vallée d'Entremont : les deux courants se
  font face de part et d'autre du col. »
- `usage` : « Le col est un passage turbulent, et les faces nord et est du Granier sont sous
  le vent de cette brise. »
- `note` : « Tracé schématique, déduit des flèches d'une carte de brises : aucune source ne
  décrit explicitement la ligne de convergence. »

## Contrôle avant de rendre

```
python3 scripts/research/text_edit.py list <lot> <massif>      # lire
python3 scripts/research/text_edit.py apply <lot> edits.json    # écrire
python3 scripts/research/text_audit.py <lot>                    # 0 erreur exigée
npm run data:build -- --check                                    # aucune visite cassée
```

L'audit compare à la version committée : aucun champ non textuel modifié, aucun élément
ajouté ou retiré, aucune balise de source perdue dans les conseils, aucun chiffre nouveau.
Les avertissements (attributions restantes, longueurs) doivent tendre vers zéro.
