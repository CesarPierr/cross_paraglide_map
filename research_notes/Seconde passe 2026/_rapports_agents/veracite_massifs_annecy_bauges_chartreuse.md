# Véracité des textes de massif et des visites — Annecy, Bauges, Chartreuse

6 novembre 2026. Périmètre : résumés, conseils, effets du vent météo et étapes de visite de neuf massifs (lots `annecy_bornes_aravis`, `bauges_bourget_combe`, `chartreuse_gresivaudan_belledonne`). Détail, un objet par correction : `veracite_massifs_annecy_bauges_chartreuse.json`.

## Méthode

Chaque texte a été relu contre les fiches des lieux corrigées, prises pour référence, contre les sections « Hors périmètre » de `veracite_elements_*.md` et contre les constats de `veracite_lots_1-6`. Une comparaison automatique a listé les chiffres absents des fiches. Les points douteux ont été cherchés dans les documents de `.cache/research/`. Aucune page n'a été lue en ligne. Les champs structurés n'ont pas changé.

## Bilan

| Massif | Corrections |
|---|---|
| Belledonne | 32 |
| Bauges | 23 |
| Lac d'Annecy | 23 |
| Combe de Savoie | 18 |
| Aravis | 16 |
| Bourget-Chambéry | 13 |
| Chartreuse | 12 |
| Grésivaudan | 9 |
| Bornes | 9 |
| **Total** | **155** |

Verdicts : 133 DÉFORMÉ, 12 CONTREDIT, 9 NON SOURCÉ, 1 INVRAISEMBLABLE.

## Les plus graves

1. **Chartreuse, vent d'est.** Le texte disait les décollages de Saint-Hilaire, orientés est, « sous le vent » par vent d'est. C'est l'inverse, et la seule source citée ne parle que de l'Épine.
2. **Belledonne, vent d'est.** « On se pose… au Versoud » présentait comme un atterrissage une zone où aucun atterrissage en campagne n'est autorisé.
3. **Aravis, Lachat.** Le conseil invitait à décoller de l'autre côté, puis à poser au Bouchet. L'arrêté limite le décollage à la zone matérialisée, et l'atterrissage aux Potais.
4. **Aravis, décollages anciens.** L'Étale (téléphérique disparu) et la patinoire (atterrissage interdit) étaient dits actuels. Crêt du Loup « 560 m » : c'est environ 700 m.
5. **Bauges, Galoppaz.** « Décollage et atterrissage interdits, Puygros aussi » : seul le décollage est interdit.
6. **Lac d'Annecy.** 13h30 est l'heure où la Forclaz se met à marcher, pas celle de la brise. Verthier était donné comme repli alors que son statut n'est pas vérifié. Le « reste souvent volable » par nord-est traduisait mal « may still be possible ».
7. **Combe de Savoie.** « Sans vous attarder au décollage » : c'est la repose qui est déconseillée. Le sous-le-vent de Montmélian n'est traversé « forcément » que sur l'option sud-est. Balises de triangles retirées, car non lues.
8. **Bornes, quadrilatère de 81 km.** L'arrivée à 18h20 est à l'Étale, pas à Sulens, qui n'est qu'un passage.
9. **Belledonne.** Vitesse sol d'un vol énoncée comme une règle (15-20 km/h, 55-60 km/h, 8 km/h). Distance de 18,6 km calculée par l'atlas. Conseil de 12 h qui ne vise que les peu expérimentés. Condition « par vent de sud » perdue pour la lame d'Orionde. Les Plagnes « se décollent » par les versants nord, alors que c'est le vent qui y arrive.
10. **Chartreuse, Antennes.** « Après 15h30, ne vous y aventurez plus » : un seul après-midi. L'ordre Manival – Château Nardent était inversé.

## Champs structurés à corriger (non modifiés)

- `combe-de-savoie/xc_routes/retour-combe-colombier-montlambert-bramefarine` : le champ `possible` dit encore « quitté le Colombier à 2700 m », alors que `tours-de-montmayeur-brise` et le rapport du lot en font le dernier thermique. Texte de fiche à harmoniser.
- `combe-de-savoie/xc_routes/triangle-montlambert-parmelan` : texte de fiche qui cite encore les balises Tamié, Planfait et Roche Pourrie, non confirmées.
- Les listes de champs à corriger des rapports `veracite_elements_*.md` de ces trois lots restent valables : aucun n'a été modifié.
- Balise `[S33]` du conseil 8 des Bauges : S33 ne parle pas de la Galoppaz, mais `text_audit.py` interdit de retirer une balise. Source réelle : fiche FFVL 14121.

## Non vérifié

- S30 (FFVL Chartreuse, 403) : Écoutoux, « laisse de chien », bulle du circaète.
- « vers 18-19h » à Aiguebelette (S36, non relu, heure absente de la fiche) : gardé.
- « à 28 km/h » au-dessus des Bauges : le récit n'est connu que par les notes de collecte ; vitesse sol ou moyenne, non tranché.
- S77 (Cotagne, 12 h-13 h) : fil de forum, écrit en possibilité sans relecture complète.
- Altitudes des TMA et CTR de Chambéry : reprises sans contrôle sur une carte aérienne à jour.
- Conseils non relus au mot à mot contre leur source quand la fiche corrigée concorde : ils s'appuient sur la vérification des fiches.

## Points de `text_fidelity.py`, relus

Tous justifiés : Bouchet retiré (atterrissage interdit), Étale et Marais retirés de phrases fausses, Saint-Ismier remplacé par Bernin, Planfait, Tamié et Roche Pourrie retirés (balises non lues), Lauzière retirée du titre (absente de l'étape), Chamrousse remplacée par Saint-Martin-d'Uriage, directions venues des fiches.
