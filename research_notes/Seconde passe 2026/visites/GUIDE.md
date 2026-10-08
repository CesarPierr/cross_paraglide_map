# Rédiger la visite guidée d'un massif

Une visite est un petit cours d'aérologie, pas une liste de mots-clés. Elle est lue par
un pilote débutant comme par un crossman : elle explique **pourquoi** l'air fait ce
qu'il fait, dans un ordre qui va du général au particulier. Le modèle de qualité est
`chartreuse.json` : le relire avant d'écrire.

## Format

Un fichier par massif : `visites/<massif-id>.json`.

```json
{
  "massif": "<id du massif>",
  "auteur": "rédigée à partir de l'atlas (seconde passe 2026) ; …",
  "steps": [
    {
      "chapter": "La journée de l'air",
      "title": "Le matin, la façade est s'éveille",
      "text": "2 à 5 phrases explicatives.",
      "focus": ["id-brut", "autre-massif/id-brut"],
      "phase": "morning | midday | afternoon | evening",
      "wind": { "from": "N | NE | E | SE | S | SO | O | NO", "kmh": 20 },
      "view": "massif"
    }
  ]
}
```

- `focus` : ids **bruts** des éléments de la recherche (ceux qu'affiche
  `python3 scripts/research/dump_massif.py <massif>`). Un élément d'un massif voisin
  s'écrit `massif-voisin/id`. Chaque étape montre et met en évidence ces éléments sur la
  carte, et ses sources s'affichent automatiquement : **le texte ne doit rien affirmer
  qu'aucun élément cité ne documente.**
- `phase` règle l'heure de la simulation pendant l'étape ; `wind` impose un vent météo
  (à réserver au chapitre « Selon le vent météo ») ; sinon la simulation est en air calme.
- `view: "massif"` cadre tout le secteur (vue d'ensemble, pièges dispersés) ; sans
  `view`, la caméra cadre les éléments de `focus`. Une étape sans `focus` doit avoir
  `view: "massif"`.
- Vérifier : `npm run data:build -- --check` ne doit afficher aucun
  « visite … élément introuvable ».

## Plan type (à adapter au massif)

1. **Le massif** — une étape, `focus: []`, `view: "massif"` : où il est, sa forme
   (vallées, faces, sommets), et l'idée simple qui le résume (« massif du matin à l'est
   et du soir à l'ouest », « grande vallée qui aspire tout l'après-midi »…).
2. **La journée de l'air** — 3 à 4 étapes dans l'ordre du temps (matin, fin de matinée,
   après-midi, soir) : brises de pente, brises de vallée, transferts par les cols,
   convergences, restitutions du soir. Expliquer le mécanisme à chaque fois.
3. **Où ça monte** — les faces et déclencheurs principaux, regroupés par secteur, avec la
   raison (orientation, heure de soleil, confluence…).
4. **Les sites** — les principaux décollages et atterrissages : lequel à quelle heure,
   par quel vent, avec quel piège.
5. **Le parcours classique** — un ou deux itinéraires documentés, raconté étape par étape
   (points de relance, hauteur à assurer, coupures).
6. **Les pièges** — les dangers documentés, chaque fois avec leur cause.
7. **Selon le vent météo** — une étape par régime documenté (nord, sud, ouest…), avec
   `wind`.
8. **Les transitions** — comment on sort vers les massifs voisins.

8 à 16 étapes. Un petit massif peu documenté peut n'en avoir que 5 ou 6 : mieux vaut une
visite courte et juste qu'une visite gonflée.

## Écriture

- Français clair, phrases complètes, ton d'un moniteur qui montre la carte.
  Pas de listes de noms, pas de style télégraphique, pas de parenthèses en cascade.
- Une idée par étape, et un titre qui la dit (« Le soir, l'ouest prend le relais »,
  pas « Brises 3 »).
- Expliquer les termes la première fois (brise de pente, convergence, restitution,
  sous le vent…) en une demi-phrase.
- Chiffres seulement s'ils sont documentés (heures, km/h, altitudes, plafonds).
- Ce qui vient de récits concordants s'écrit « les récits disent », ce qui est déduit
  du terrain s'écrit « probablement » ou « on peut s'attendre à » ; ne jamais présenter
  une déduction comme un fait.
- Citer les contraintes réglementaires et environnementales documentées (TMA, ZIT,
  zones de quiétude, dates de nidification) au moment où le parcours les rencontre.
- Pas de focus fourre-tout : 1 à 6 éléments par étape, ceux dont parle le texte.

## Lieux cités

Les noms de lieux du texte sont surlignés et épinglés sur la carte ; un massif ou une région
couverte par des secteurs (« Belledonne », « le Dévoluy », « le Vercors ») est dessiné comme
une zone en pointillés. Après avoir écrit ou modifié une visite :

1. `python3 scripts/research/visit_places.py <massif>` localise les nouveaux noms (répertoire
   IGN ; une commune est placée sur son village, jamais au centre de son territoire) ;
2. `python3 scripts/research/place_review.py <massif>` affiche chaque étape avec ses lieux,
   leur commune et leur position : vérifier les homonymes, le type (col, lac, sommet ou
   hameau) et les directions écrites dans le texte ;
3. reporter les corrections dans `_lieux_corrections.json` (massif → nom tel qu'écrit → lieu,
   `{"massifs": [...]}` pour une zone, ou `null` pour retirer un faux lieu), puis relancer
   l'étape 1. Ces corrections ont le dernier mot et survivent aux relances.

Toutes les visites ont été relues ainsi en octobre 2026 : 736 corrections de lieux, et 12 erreurs
de direction ou de distance corrigées dans les textes.
