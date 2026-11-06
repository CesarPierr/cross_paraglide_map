# Passe narrative d'un massif

Le pilote `vercors-nord` a été validé par l'owner (avant/après :
`_rapports_agents/recit_pilote_vercors_nord.md`, texte en place dans `data/vercors_grenoble_trieves.json`
et `visites/vercors-nord.json`). Tu fais la même chose pour un massif, en une seule passe.

Lis d'abord, en entier : `_methode/STYLE_TEXTES.md` (« Du lieu au détail », « La voix d'un moniteur »,
« Le rythme », « Une étape de visite peut renvoyer », « Pas de contradiction », « Voix », « Une visite
qui enseigne ») et le récit pilote. Puis tout le massif (`python3 scripts/research/text_edit.py list <lot> <massif>`,
`visit-list <massif>`) avant d'écrire : on ne situe pas un lieu sans avoir sa carte en tête.
Lis les constats de ce massif dans `_rapports_agents/veracite_elements_<lot>.md`,
`veracite_massifs_*.md` et `champs_structures_*.md`, pour ne rien réintroduire de ce qui a été retiré.

## Le travail

1. **Résumé** (1 800 caractères au plus) et **visite entière** : vraiment réécrits, comme un moniteur qui
   fait découvrir son massif. La carte mentale d'abord, puis le fil d'une étape à l'autre, la raison au bon
   moment, ce qui vient ensuite. Une étape raconte une idée et renvoie le détail à sa fiche, à un autre massif
   ou à une ressource, pourvu que le fait reste sur le site : **vérifie qu'il est bien dans la fiche**, sinon
   ajoute-l'y. Le cœur des étapes (`chapter`, `focus`, `phase`, `wind`, `view`) ne bouge pas.
2. **Les 25 à 35 éléments qui structurent le massif** (grandes brises, convergences, dangers clés, décollages
   et atterrissages principaux, itinéraires classiques ; moins si le massif est petit) : vraiment réécrits, même
   voix. Le lieu et son rôle, puis l'usage et le risque, puis le mécanisme, puis les détails.
3. **Les autres fiches** : sobres et bien situées. Une source d'une ligne reste une ou deux phrases. Pas de
   formule répétée (« ce décollage regarde… », « ce terrain reçoit… »).
4. **Une étape de visite n'est jamais une liste.** Pas d'enchaînement de lieux chacun avec son altitude, ses
   heures, ses câbles : c'est le défaut le plus fréquent et l'owner le refuse. Une étape dit une idée, garde un ou
   deux lieux qui la portent, et renvoie le reste aux fiches ou à un autre massif. Contrôle en fin de massif : une
   étape qui contient plus de trois altitudes, heures ou distances se réécrit, sauf un itinéraire où ces hauteurs
   sont l'idée même, et là encore on n'en garde que les décisives. Avant de retirer un fait d'une étape, vérifie
   qu'il est dans une fiche, sinon ajoute-l'y.
5. **Le rythme** : ni phrases à rallonge pleines de virgules, ni suite de phrases hachées. Une phrase moyenne qui
   se déroule, une courte qui porte, un lien logique entre les deux.

## La fidélité ne se négocie pas

Ces textes viennent d'être vérifiés.
- Chaque fait de l'ancien texte reste sur le site. Réordonner n'autorise pas à retirer.
- **Rien d'ajouté** : ni fait, ni sensation, ni image, ni anecdote. Le récit vient de l'ordre et des liens entre
  faits sourcés. **Un lien de causalité (« donc », « c'est pour ça que », « le prix se paie ») doit être dit par
  la source ou évident d'après elle** ; aucun script ne le détecte, relis-les un par un. Pas de « on adore », pas
  de vue décrite sans source.
- Toute position relative que tu écris est vérifiée sur `apps/web/public/data/atlas.json` (direction, ordre le long
  de la vallée). Attention aux homonymes.
- Nombres, heures et directions inchangés. Une observation isolée reste une possibilité.
- Un lieu qui a un `status` le dit d'abord. Aucune contradiction dans un texte : la source la plus fiable ou la plus
  récente, une interdiction prime sur un conseil, l'écart en `note`.
- Une erreur trouvée en chemin : corrige-la si la source en cache le prouve, et note-la. Le fichier de constats doit
  précéder le texte : `text_audit.py` n'accepte un nouveau chiffre que si un constat du massif le nomme.
- Une image géographique (« barre », « ferme », « au fond ») est vérifiée sur la carte comme une position. L'ancienne
  visite n'en est pas la preuve : « le Roc des Bœufs barre le fond du lac » était faux.
- Évite les tics d'un massif à l'autre : « Le prix se paie », « Reste à », « C'est pour ça que », « Le relais passe »,
  « Voyons d'abord » ne peuvent pas devenir une signature.
- Longueurs : description ≤ 480, possible ≤ 220, conseil ≤ 260 avec les mêmes balises [S..], effet ≤ 420, étape ≤ 620.

## Cadre

Ne commite pas, pas de git add, reset, stash ou checkout : le responsable intègre. Pas de sous-agents. Tu ne touches
que les textes de TON massif et ses rapports : aucun champ structuré (liste-les comme « à corriger »), aucun autre
massif, même du même lot. Écris seulement via `text_edit.py apply <lot> edits.json` et `visit-apply <massif> edits.json`,
qui verrouillent le fichier : d'autres agents écrivent le même lot en même temps. Fichiers temporaires dans un dossier
à toi, au nom du massif, dans le scratchpad donné ; n'exécute ni n'écrase aucun script qui n'est pas de toi.
Sois économe : le quota de l'owner est compté. Pas de lecture en ligne, sauf fait décisif impossible à régler
autrement. Ne relis pas ce qui n'a pas besoin de l'être.

Contrôles : `python3 scripts/research/text_audit.py <lot>` (0 erreur sur ton massif ; une erreur sur un autre massif du
lot n'est pas de toi), `python3 scripts/research/text_fidelity.py <lot>` (lis chaque point de ton massif),
`npm run data:build -- --check` (jamais sans `--check`).

Livrable : `_rapports_agents/recit_<massif>.md`, très court : constats, faits déplacés, doutes, et 3 extraits
avant/après. Rapport final en français, bref : ce qui a changé, contrôles, doutes, champs à corriger.
