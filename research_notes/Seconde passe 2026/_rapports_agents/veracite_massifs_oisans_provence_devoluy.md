# Véracité des textes de massif et des visites — Oisans-Maurienne, Provence-Maritimes, Dévoluy-Diois

6 novembre 2026. Résumés, conseils, effets du vent météo et visites guidées des 16 massifs de ces trois lots, relus contre les fiches corrigées, les constats « Hors périmètre » de `veracite_elements_<lot>.md`, `veracite_lots_7-12.md` et le cache. Constats dans `veracite_massifs_oisans_provence_devoluy.json`, un objet par correction. Seuls `summary`, `tips`, `effect`, `title` et `text` ont changé.

## Méthode

- Un script a signalé chaque nombre absent des fiches du massif, ou de celles de l'étape. Les constats des fiches ont été rapprochés des étapes qui les citent.
- Les textes ont été lus en entier. Les passages douteux ont été confrontés au cache, sinon à la fiche corrigée.
- Une fiche sans constat n'a été rouverte que si le texte du massif paraissait suspect. Toutes les fiches n'ont donc pas été relues une à une.

## Les corrections les plus graves

1. **Thorenc** : convention dénoncée par le nouveau propriétaire. Évitez de vous y poser (Grasse, étapes 3, 7, 11).
2. **Saint-Laurent-du-Var** : fiche de kitesurf. Retiré, avec « la côte réservée aux confirmés » (Nice, effet 2, étape 12).
3. **Caduc / Cadun** : le Caduc est la route facile du retour (Haut-Verdon, étape 5 ; Digne, résumé et conseil 1 ; Saint-André, étape 7).
4. **Courradour-Annot** : consigne inversée (Haut-Verdon, étape 7).
5. **Oraison** : la « restitution » vers Moustiers est un trajet en voiture, et le lac de Sainte-Croix n'y est pas (Digne, étape 3).
6. **Rabou** : bascule au nord en fin de journée, dangereux même par nord faible, terrain toléré (Gapençais, résumé, conseil 1, effets 2 à 5, étapes 4 et 13).
7. **Les Guards** : terrain de secours à éviter, pas un atterrissage (Baronnies).
8. **Traversée du Glandasse** : un vol de 2017, antérieur à la zone du gypaète, donné en itinéraire (Diois, étape 10).
9. **La Turra** : zone de sensibilité placée à tort. L'arrêté la met à la Loza ; règle du 16 mai au 31 octobre (Haute-Maurienne).
10. **Vitesse sol prise pour un vent** : 55-60 km/h le long de Belledonne (Maurienne). **Sens faux** : crêtes de Belledonne suivies « vers le sud » (Maurienne, étape 8).
11. **Distances de l'atlas retirées** : 52 et 41 km de la WaterFly, 64 km Luc-Gap, 60 km de la Maurienne.
12. **Plan d'un groupe devenu « le classique »** : Aspres-Durbonas-Bure (Dévoluy, Gapençais, Buëch).
13. **Vols fusionnés ou plafonds en règle** : Meije, Reynière, Serres, Mouchon, Estrop, Chamatte de Thorame, Allier, Cheval Blanc, Grun, Galibier.

## Champs structurés à corriger (non modifiés)

- `prealpes-grasse-castellane` étape 7 et `thorenc-atterro` : l'atterrissage reste en catégorie `landings`, alors qu'il faut l'éviter.
- `landings/saint-laurent-du-var-plage` et `plage-de-nice` : à retirer ou reclasser. Le `focus` de `prealpes-nice-var` étape 12 cite encore `saint-laurent-du-var-plage`.
- `gapencais-ceuse/hazards/ceuse-no-sous-le-vent` et autres listés dans `veracite_elements_*` : inchangés.

## À relire

- `gapencais-ceuse/soaring_spots/soar-rabou` : « Par ouest ou sud-ouest, il est difficile de faire mieux », alors que le constat de l'élément dit « difficile de sortir ». Fiche S42 lue en ligne, pas en cache. Le texte de massif n'en dépend plus.
- `saint-andre-dormillouse-ar` (`possible`) écrit encore « par Cadun », contre `crete-de-cadun`, qui écrit « le Caduc ».

## Non vérifié

- Saint-André, seuils de vent du conseil 5 et 180° du lac : S23 (copie Wayback) absent du cache. Gardés.
- Céüse, priorité des bergers du 1er juin au 30 octobre : fiche 14273 derrière Cloudflare. Gardée.
- Vieux Chaillol, du 1er mai au 31 octobre : message de 2021. Le texte dit de revérifier auprès du Parc.
- R196C, TMA de Nice, TMA 9, FL65 : valeurs de fiches, à recouper sur la carte aérienne en vigueur.
- Sainte-Marie-de-Cuines, de 11 h à 17 h : fiche non retrouvée en cache, reprise de la fiche corrigée.
- Bleine-Saint-André, 30 km et 70 km aller-retour : non rouverts à la source.
- Plusieurs phrases non chiffrées des visites, sans constat de fiche et non suspectes, n'ont pas été rouvertes à la source.
