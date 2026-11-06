# Récit du lac d'Annecy, avant et après

Résumé et 19 étapes réécrits, 44 éléments retouchés (éléments structurants et fiches à situer). Conseils et effets du vent météo inchangés. Aucun champ structuré modifié, aucune source relue en ligne : positions vérifiées sur `atlas.json`.

## Constats corrigés

- **Étape 9, 2 100 m.** La visite plaçait ces 2 100 m sur la face ouest du Lanfonnet. Les fiches `montmin-lanfonnet-roux` et `grand-tour-du-lac` les placent en bout de crête, avant le Lanfonnet. Étape 11 alignée.
- **Mont Baret.** La fiche le disait « entre les Dents de Lanfon et le Roc des Bœufs ». L'atlas le met au nord-ouest des Dents (6.197, 45.887 contre 6.242, 45.861), loin de la ligne vers le Roc (6.166, 45.755). La fiche dit « au nord-ouest ».
- **Étape 17, Bauges.** « Vers l'ouest » devient « côté Bauges » : la ligne Galopaz – Roc des Bœufs est au sud-ouest.
- **Étape 15, Verthier.** « L'ancien terrain de Verthier », comme l'effet du vent de nord. « Une carte » la déconseille par nord fort, comme la fiche, au lieu de « les cartes de brises ».
- **Statuts dits d'abord.** Entrevernes, Semnoz delta, Verthier (danger et atterrissage), Lathuile.

## Faits déplacés

- `planfait`, `semnoz-ouest` : « géré par un club local » passe en `note`, pour tenir la limite de 480 caractères.
- Étape 8 : « ancien repli depuis la Forclaz » reste dans `verthier` (finesse depuis la Forclaz, note), « l'après-midi » pour la brise de Doussard reste dans sa note.
- Étape 13 : la pointe de Chauriande reste dans `arclosan-zsm`.

## Doutes

1. **Roc des Bœufs : corrigé.** « Barre le fond du lac » était faux : il est sur la rive ouest, à environ 5 km au sud-ouest de Doussard, hors de l'axe. Résumé, étapes 0 et 5, `brise-lac-annecy`, `roc-des-boeufs-ouest` et `roc-des-boeufs-dynamique` disent qu'il domine le bout du lac et que la brise l'atteint. Le `trigger` de `roc-des-boeufs-ouest` est changé à la demande du responsable : `text_audit.py` le signale, c'est attendu.
2. **CTR.** « Limite à environ 200 m de Viuz » et « au nord du lac » cohabitent, comme dans l'ancienne fiche. Non relu sur une carte aérienne.
3. **Liens ajoutés, à juger.** « Les deux départs se rejoignent aux Dents » (les deux itinéraires y passent), « deux couches d'air se superposent » (brise de nord au-dessus de la brise descendante), « Surveillez aussi le lac » devant l'orage (conseil de la fiche des cumulonimbus).
4. **« Au petit matin, le lac est calme ».** Repris de l'ancienne visite, sans fiche qui le porte.

## À corriger (champs structurés, non modifiés)

- `mont-baret-confluence-bluffy.trigger` : « entre Dents de Lanfon et Roc des Bœufs », contraire à sa position.
- `verthier`, `lathuile` : statut non confirmé, le schéma n'a pas de champ pour le dire.

## Étapes qui n'étaient plus des listes

Étapes 7, 9, 10, 11, 12, 17 réécrites. Faits retirés, tous présents dans les fiches : moquette et 400 m (`planfait`), niveau vert (`forclaz`), niveau bleu (`coche-cabane`), 1 900 et 2 100 m (`montmin-lanfonnet-roux`), 2 400 m (`epaule-planfait-dents-de-lanfon`, `veyrier-col-thermique`), détroit de Duingt (`confluence-duingt`), première ligne (`roc-des-boeufs-premiere-ligne-ht`), rafales et heures (`combe-coche-cabane-forclaz`), 1 650 m (`veyrier-teleferique`), passage du Lanfonnet, 1,5 km et 1 100 m (`grand-tour-du-lac`), classe D (`ctr-annecy`), jours et 1 830 m (`r185-sacconges`), Parmelan et Bauges (fiches `bornes/`), crête de 35 km et Bange (`semnoz-revard`, `semnoz-crete-ouest`).

## Extraits

**Étape 9.** Avant : « Faites-y le plein avant de transiter vers la face ouest du Lanfonnet, qui remonte vite, jusqu'à 2 100 m en bout de crête. » Après : le 2 100 m ne figure plus dans l'étape, il reste dans `montmin-lanfonnet-roux`, en bout de crête : « faites-y le plein avant de transiter vers la face ouest du Lanfonnet ».

**`entrevernes`.** Avant : « Un petit décollage étroit et technique, orienté est, à 850 m, 360 m au-dessus de Lathuile. Il est fermé par arrêté municipal : on n'a plus le droit d'y voler. » Après : « Ce décollage est fermé par arrêté municipal : on n'a plus le droit d'y voler. C'était, sur la rive ouest, un petit décollage étroit et technique, orienté est, à 850 m, 360 m au-dessus de Lathuile. »

**`confluence-doussard-soir`, usage.** Avant : « La rencontre des deux flux crée une large zone d'ascendance entre l'atterrissage et le lac, et même au-dessus du terrain. Le vent s'inverse à l'atterrissage : on pose alors face au sud… » Après : « Au sol, le vent s'inverse : on pose alors face au sud, en PT8, au lieu de la PTU main droite face au nord, et l'on surveille les manches à air. En l'air, la rencontre des deux flux crée une large zone d'ascendance entre l'atterrissage et le lac, et même au-dessus du terrain. »
