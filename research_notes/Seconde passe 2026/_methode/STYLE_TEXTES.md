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
  protégées). 1 800 caractères au plus.
- **Conseils** (`tips`) : une phrase d'action chacun, 260 caractères au plus ; garder le
  même nombre de conseils et **exactement les mêmes balises** `[S1]`, `[S2, S3]`.
- **Vent météo** (`synoptic_effects[].effect`) : l'effet puis la conséquence pratique, en 1
  à 3 phrases (420 caractères au plus) ; un cas isolé s'écrit en possibilité dans la phrase.
- **Visites** (`visites/<massif>.json`) : chaque étape en 2 à 5 phrases (620 caractères au
  plus), un titre qui dit l'idée ; les faits d'abord, puis une seule phrase de réserve pour
  un cas isolé. On écrit `title` et `text` ; le cœur d'une étape (`chapter`, `focus`,
  `phase`, `wind`, `view`) ne se modifie jamais, mais il voyage avec son contenu : une
  visite peut être restructurée (accueil, conclusion, fusion, scission, nouvel ordre) selon
  les règles de « Une visite qui enseigne », plus bas.

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

## Voix

Les règles de fidélité ci-dessus ne se négocient pas : rien d'inventé, rien de perdu, pas
d'attribution, champs structurés intacts. La voix vient par-dessus. Un premier jet fidèle
peut encore sonner comme une machine : des propositions enchaînées par des virgules, des
« peut », « parfois », « il arrive que » empilés, des noms abstraits (« activité
thermique », « transition », « conditionnent »), des énumérations au lieu d'une idée, et
rien qui distingue ce qui compte du détail. Le pilote décroche avant la fin de la phrase.

**La voix juste : un pilote local expérimenté qui briefe un ami au décollage.** Il sait ce
qui compte, il le dit d'abord, il montre du doigt les lieux, il donne l'heure.

1. **Une idée par étape, l'essentiel d'abord.** La première phrase dit ce que l'on va
   sentir en l'air, ce qu'il faut faire ou ce qu'il faut éviter. Les détails suivent, du
   plus utile au moins utile.
2. **Des phrases courtes.** Une idée par phrase, une subordonnée au plus. Pas de chaînes de
   virgules : quand une phrase aligne trois virgules, on la coupe. Les deux-points
   annoncent une conséquence ou une liste, pas une phrase de plus.
3. **Du concret.** Des lieux, des heures, des hauteurs, des faces. « Vers 13h30, la brise
   se lève sur le lac » plutôt que « l'établissement de la brise intervient en début
   d'après-midi ».
4. **Des verbes d'action.** Le sujet est le pilote, la brise, la face, le thermique :
   « on raccroche », « la brise rentre », « la face décroche ». Pas de noms
   bureaucratiques (« l'exploitation de », « la réalisation de », « en termes de »,
   « au niveau de »).
5. **Une seule réserve, honnête.** On ne nuance que si la source nuance, et alors en une
   phrase : « Ça ne marche pas tous les jours. » ou « Possibilité de… ». Pas de litanie de
   « il peut arriver que… » : on fond plusieurs observations isolées en une phrase vivante,
   ou on les range dans `possible`.
6. **La langue du pilote, sans jargon gratuit.** « raccrocher », « enrouler », « faire le
   plafond », « vent arrière », « se faire scotcher », « transiter » sont bienvenus quand
   ils disent la chose plus vite ; ils ne remplacent pas une explication.
7. **Le tutoiement non, l'adresse directe oui.** Dans les conseils et les visites, on peut
   parler au pilote (« visez l'épaule », « méfiez-vous des cycles ») ou dire « on ».
8. **Des titres qui disent l'idée.** Quelques mots, l'idée de l'étape : « Le Nord le matin,
   le Sud l'après-midi », pas « Trois décollages, un plateau ».
9. **Pas de remplissage.** Ni « Retenez une idée simple : » en tête d'étape (le « À retenir » final de la visite est autre chose), ni « Regardez sur la carte »,
   ni « il convient de noter ». Ni « en effet », ni « par ailleurs ».

### Du lieu au détail : un texte qu'on comprend en le lisant

La règle la plus importante pour le lecteur. On ne comprend pas un détail quand on ne
comprend pas encore le lieu : **d'abord la structure, ensuite l'essentiel, enfin les
détails**. Un texte juste mais lu comme un inventaire ne sert à rien.

**L'ordre, pour tout texte :**

1. **Ce qu'est le lieu et où il se trouve.** La première phrase situe : par rapport à une
   vallée, un sommet, un village que le lecteur connaît déjà ou vient de lire. Son rôle dans
   le massif : le décollage du matin, la relance avant la traversée, le terrain de repli.
2. **À quoi il sert et son risque principal.** Quand on y va, ce qu'on y vient chercher, et
   surtout ce qui peut faire mal. **Un danger, une interdiction ou une règle ne finissent
   jamais un texte comme un détail** : ils viennent ici, dits clairement.
3. **Comment ça marche.** Le mécanisme, ce qu'on va sentir, à quelle heure, pour quelle
   raison, chaque phrase s'appuyant sur la précédente.
4. **Les détails.** Accès, marche, niveau, câbles secondaires, du plus utile au moins utile.
   Ce qui n'aide pas à comprendre ni à décider va dans `possible` ou `note`.

**Par catégorie, la première phrase répond à :**

| Élément | La première phrase dit |
|---|---|
| Décollage | où il est, vers où il regarde, à quel moment de la journée on y va |
| Atterrissage | où il est, depuis quels vols on s'y pose, s'il est ouvert ou non |
| Thermique | où on le trouve, sur quel relief, à quel moment du vol il sert |
| Soaring | quelle pente, par quel vent, sur quelle longueur |
| Brise | d'où elle vient, où elle va, à quelle heure |
| Convergence | quels flux se rencontrent, où, et ce qu'on en fait |
| Danger | où, quand, et ce qu'on fait pour l'éviter, dès la première phrase |
| Itinéraire | d'où à où, par quel chemin, ce qui décide de la réussite |

**Un récit, pas une fiche.** Des phrases complètes qui s'enchaînent, chacune donnant envie
de lire la suivante. On bannit la suite de notes (« Décollage d'été, raide, avec des câbles,
des arbres et des rochers. ») et la phrase de fin isolée (« Il y a des câbles. »). On garde
les lieux vivants : ce qu'on voit, ce qu'on sent, où l'on va ensuite. Mais rien d'inventé :
le récit vient de l'ordre et des liens entre les faits sourcés, jamais d'un fait ajouté. Si
la source ne donne qu'une ligne, le texte fait une ou deux phrases, et c'est bien ainsi.

**La voix d'un moniteur qui fait découvrir son massif.** Il a le pilote à côté de lui et veut
lui donner envie de voler là : il montre, il explique pourquoi, il annonce ce qui vient, il
partage ce qui l'a marqué dans les sources. Le lecteur doit vouloir lire la phrase suivante.
Cela vient du fil du propos (« Le problème, c'est… », « C'est pour ça que… », « Reste à
rentrer »), d'une raison donnée au bon moment, d'une attente créée puis résolue.

**Le rythme, ni l'un ni l'autre.** Pas de phrase à rallonge qui enchaîne les virgules, mais pas
non plus une suite de phrases hachées, sujet-verbe-point : couper une phrase en cinq ne la rend
pas plus lisible. On varie, comme à l'oral : une phrase moyenne qui se déroule, une courte qui
frappe, un lien logique entre les deux. La règle « des phrases courtes » de la Voix se lit ainsi.

**Une étape de visite peut renvoyer.** Une visite raconte, elle n'a pas à tout dire : un détail
peut renvoyer à la fiche du lieu, à un massif voisin ou à une ressource, tant que le fait reste
sur le site (dans la fiche, le plus souvent). C'est la règle « aucun fait perdu » à l'échelle du
massif, pas de l'étape.

**Pas de contradiction dans un texte.** Quand deux sources, ou deux phrases d'une même source, se
contredisent, on s'aligne sur la plus fiable ou la plus récente, et une interdiction prime sur un
conseil ; l'écart va en `note`. Le lecteur n'a pas à trancher.

**Le massif entier suit la même pente.** Le résumé et l'accueil de la visite donnent la carte
mentale (les vallées, les crêtes, les grandes orientations) avant de nommer le moindre site.
Une visite ne cite un lieu qu'après avoir dit où il se situe.

**Aucun fait perdu.** Réordonner n'autorise pas à retirer : chaque fait de l'ancien texte se
retrouve dans le nouveau, dans `possible` ou dans `note`.

### Une visite qui enseigne

Une visite n'est pas un assemblage de faits : c'est un exposé, engageant et didactique, qui
mène le pilote du relief à la décision. Chaque étape a **un point et sa raison** : quoi, où,
quand, pourquoi ça se passe, et ce qu'on en fait. Une courte phrase de liaison ouvre l'étape
quand elle prolonge la précédente (« Le soleil tourne : … », « Reste à rentrer : … »).

La progression est toujours la même, et l'ordre des chapitres des fichiers la suit déjà :

1. **Accueil** (étape 0, chapitre « Le massif ») : « Bienvenue dans … », le relief en une
   idée, puis ce que la visite va montrer, en une phrase.
2. **La journée de l'air** : le matin, la brise de vallée, l'après-midi, le soir, dans
   l'ordre des heures, chaque fois avec le mécanisme (le soleil, l'aspiration, la pente).
3. **Où ça monte, les sites** : ce que le pilote cherche en l'air et où il se pose.
4. **Le parcours classique** : l'itinéraire dans l'ordre du vol, avec les hauteurs clés.
5. **Les pièges** : le danger, pourquoi il existe, ce qu'on fait pour l'éviter.
6. **Selon le vent météo** : par vent, ce qui change et ce qu'on décide.
7. **Sortir du massif** : les portes vers les massifs voisins, avec les hauteurs de départ.
8. **À retenir** (dernière étape) : les trois idées-forces de la visite, une phrase chacune,
   dites comme un conseil.

Contraintes techniques (`text_audit.py`) : l'en-tête de la visite ne change pas ; le
« cœur » d'une étape (`chapter`, `focus`, `phase`, `wind`, `view`) est soit l'un des cœurs
d'origine, soit vide ; chaque cœur d'origine doit rester porté par au moins une étape (on
déplace un contenu, on ne le jette pas) ; aucun chiffre que la visite d'origine n'avait.
On peut donc ajouter, fusionner, scinder et réordonner les étapes, et on le fait dès que
l'ordre d'origine est un assemblage incohérent ; si l'ordre suit déjà la progression, on
réécrit en place et on ajoute seulement l'accueil et la conclusion. Comme `chapter` fait
partie du cœur et que l'interface range les étapes par chapitre, une étape ajoutée reprend
le cœur d'une étape voisine plutôt qu'un cœur vide : l'accueil reprend celui de l'étape
« Le massif » (`view: massif`), la conclusion « À retenir » celui de la dernière étape
« Les transitions ». Changer le nombre d'étapes n'est qu'un avertissement.
`text_edit.py visit-apply` ne réécrit que `title` et `text` par rang ; pour ajouter ou
déplacer une étape, on édite la liste `steps` avec `textjson` (`d = load(path)` ;
`d['steps'] = …` en recopiant le cœur des étapes d'origine ; `save(path, d)`), qui garde la
mise en page du fichier.

Squelette, pour un massif imaginaire :

- Étape 0 — « Bienvenue dans le Val Blanc » : « Bienvenue dans le Val Blanc, une vallée
  droite entre deux crêtes. Ici, tout tourne autour d'une brise qui remonte la vallée
  l'après-midi. Cette visite suit la journée de l'air, puis le grand classique, les pièges
  et les vents qui changent la donne. »
- Étape 1 — « Le matin, la face est chauffe la première » : le mécanisme, l'heure, le
  décollage qui marche.
- Étape 2 — « Midi : la brise se lève » : d'où elle vient, pourquoi, sa force, où elle gêne.
- … une étape, une idée …
- Avant-dernière étape — « Sortir du Val Blanc » : les portes et les hauteurs de départ.
- Dernière étape — « À retenir » : « Partez tôt de la face est, avant que la brise ne
  monte. À l'atterrissage, posez face à la brise, qui vient de l'aval. Par nord, restez au
  sol : la vallée devient un tuyau. »

### Avant / après

**Étape de visite — Saint-Hilaire**

Avant : « Trois décollages, un plateau » — « À Saint-Hilaire, on choisit son décollage
suivant l'heure. Le décollage Nord, alimenté le premier par la brise de pente, sert le
matin et par tendance nord. Le décollage Est prend le relais en milieu de matinée. Le
décollage Sud est à privilégier quand les thermiques sont établis ou par sud. Attention :
le thermique qui se déclenche sur la falaise devant les décollages fait parfois souffler le
vent dans le dos au Nord et au Sud, par cycles. On se pose sur le plateau, à l'office du
tourisme, ou en bas à Lumbin. »

Après : « Un décollage pour chaque heure » — « À Saint-Hilaire, c'est l'heure qui choisit
le décollage. Le Nord se remplit le premier avec la brise de pente : c'est celui du matin
et des jours de nord. L'Est prend le relais en milieu de matinée. Le Sud devient le bon
choix quand les thermiques sont établis, ou par sud. Méfiez-vous des cycles : le thermique
qui part de la falaise met parfois le Nord et le Sud vent arrière. On se pose sur le
plateau, à l'office du tourisme, ou en bas à Lumbin. »

**Conseil — Bauges**

Avant : « Si l'on ne connaît pas le secteur, il vaut mieux voler au début de l'après-midi
ou quand l'activité thermique décroît : les brises, à 30-35 km/h, peuvent clouer au sol
près d'École, d'Aillons, de Lescheraines ou d'Allèves [S26]. »

Après : « Si vous découvrez le secteur, volez en début d'après-midi ou quand les thermiques
faiblissent. Les brises montent à 30-35 km/h et peuvent vous clouer au sol vers École,
Aillons, Lescheraines ou Allèves [S26]. »

**Résumé — Chartreuse, l'intérieur du massif**

Avant : « À l'intérieur du massif (Chamechaude, Scia, Grand Som, Charmant Som), les plafonds
sont généralement meilleurs qu'en bordure, et les faces ouest ne marchent qu'après 15-16 h,
avec une tendance nord-ouest à ouest. Autour du massif, des brises de 20 à 30 km/h entrent
par la cluse de Voreppe, très forte dès 11 h, par la cluse de Chambéry (col du Granier, col
du Couz) et par le Grésivaudan. Elles conditionnent les sorties vers Belledonne (Saint-Genis),
les Bauges (Granier puis Montgelas) et le Vercors (Rachais-Néron). »

Après : « Au cœur du massif (Chamechaude, Scia, Grand Som, Charmant Som), les plafonds sont
en général meilleurs qu'en bordure. Les faces ouest ne s'allument qu'après 15-16 h, par
tendance nord-ouest à ouest. Autour, des brises de 20 à 30 km/h entrent par la cluse de
Voreppe, très forte dès 11 h, par la cluse de Chambéry (cols du Granier et du Couz) et par
le Grésivaudan. Ce sont elles qui décident des sorties : vers Belledonne par Saint-Genis,
vers les Bauges par le Granier puis le Montgelas, vers le Vercors par le Rachais et le
Néron. »
