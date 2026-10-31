# Véracité des éléments — lot chablais_giffre_arve

Contrôle du 31 octobre 2026, avec réécriture des textes dans la « Voix » de `_methode/STYLE_TEXTES.md`. Périmètre : les 228 éléments du lot (Salève et Genevois 33, Arve et Faucigny 78, Haut-Giffre 50, Chablais 67), champs `description`, `possible` et `note`. Les résumés, conseils, effets de vent et visites n'ont pas été touchés. Constats détaillés : `veracite_elements_chablais_giffre_arve.json`, un objet par constat non confirmé.

## Méthode

- Chaque source citée a été relue dans les documents archivés du lot (`.cache/research/docs/chablais_giffre_arve/`, convertis en texte) : fiches fédérales complètes (`ffvl_crawl.json`, `ffvl_digest.txt`, `ffvl_sites_alpes.json`), pages des clubs (CVLS, CVLG/Paradelta, CMBVL, Choucas, CHOTO, CLAM), topos Randovol et Marche et Vol, fils de forum, guide « Vol libre au Pays du Mont-Blanc » (S9), MétéoSuisse (S116, S117), SISL (S33), page nautique (S32), récits Liberiste et Parapente Montagne.
- Les sources Camptocamp (S103 à S115) ne sont archivées qu'en résumé : leurs détails (pentes, cotations) reposent sur les notes de collecte.
- Les points chauds kk7 (S220) ont été recalculés sur `sources/kk7/hotspots_all_*.json` : toutes les valeurs du lot sont exactes à quelques centaines de mètres près.
- Aucune page n'a été relue en ligne ; aucune page bloquée n'a été contournée.
- Contrôles : `text_audit.py` (0 erreur, 4 avertissements de chiffres repris d'une source, justifiés), `text_fidelity.py` (15 points relus, tous justifiés), `npm run data:build -- --check` (réussi).

## Décompte

| Verdict | Salève | Arve | Haut-Giffre | Chablais | Total |
|---|---|---|---|---|---|
| DÉFORMÉ | 11 | 24 | 5 | 15 | 55 |
| NON SOURCÉ | 5 | 4 | 3 | 3 | 15 |
| CONTREDIT | 0 | 2 | 1 | 2 | 5 |
| INVRAISEMBLABLE | 1 | 0 | 0 | 1 | 2 |
| NON VÉRIFIABLE | 0 | 0 | 0 | 1 | 1 |
| **Constats** | 17 | 30 | 9 | 22 | **78** |

72 éléments portent au moins un constat ; les 156 autres n'ont montré aucun écart sur les affirmations contrôlées (CONFIRMÉ). Tous les constats sont corrigés dans le texte ; les champs structurés fautifs sont listés plus bas, sans avoir été modifiés.

## Les dix écarts les plus graves

1. **Bornan et môlan « jusqu'à 120 km/h » (CONTREDIT).** Le chiffre vient d'un site nautique, et pour le seul bornan. MétéoSuisse donne 30 à 40 nœuds au bornan, 8 à 15 au môlan. La prose dit le danger sans chiffre ; les valeurs discordantes passent en note.
2. **Plaine-Joux : « repose au décollage, réservée aux confirmés » (CONTREDIT).** La repose sur la moquette est interdite. Il s'agit de l'atterrissage le long du tunnel, possible seulement station fermée.
3. **Pertuiset : « l'accès en 4x4 est déconseillé » (CONTREDIT).** La source déconseille la piste aux véhicules qui ne sont pas des 4x4.
4. **Plaine-Joux : « ne pas voler au-dessus de 20 km/h à 2000 m » (DÉFORMÉ).** La règle vaut pour toute la région du Mont-Blanc, et le guide désigne justement Plaine-Joux comme refuge ces jours-là.
5. **Chedde : « des vaches s'y trouvent, et le terrain sert alors de secours » (DÉFORMÉ, sens inversé).** Quand les vaches prennent trop de place, on pose sur le terrain de secours. La brise descendante d'est à nord-est, qui met le terrain sous le vent de la crête de Joux, est ajoutée.
6. **Abondance : « posé à midi avec un vent de 5 km/h » (DÉFORMÉ).** C'était une vitesse sol : la brise était très forte.
7. **Barmerousse et Frioland (DÉFORMÉ).** Le plein ouest était placé au-dessus de la combe d'Embovi, où se trouve le décollage est. Frioland est le décollage « le plus vite alimenté » des trois, pas « le plus rapide à rejoindre ».
8. **Lieux transposés.** Le vent de vallée violent de la fiche du lac de Passy était prêté au décollage de Varan, et une page touristique le prêtait à Plaine-Joux. Les thermiques hachés d'Agy et les vols « même en automne » du Môle étaient prêtés à Mieussy et au Marcelly. Le « calme le matin, thermiques forts » de Varan figurait dans les champs horaires de Plaine-Joux.
9. **TMA mal lues (DÉFORMÉ).** « La TMA 6 monte jusqu'à FL85 » ou « reste sous FL85 » : c'est le pilote qui doit rester sous ce niveau (Salève, Morzine). La réserve de Passy était placée au nord de la pointe de Platé, d'après le guide de 2008 ; les fiches actuelles la situent au sud et à l'est.
10. **Directions et orientations prises pour des positions.** La « trilogie » de Bonneville (Sur Cou en NO, Andey en SE, le Môle en ouest) donne les vents de chaque site, pas leur place autour de la ville. Le Petit Môle est un décollage orienté sud-est, situé à l'ouest du sommet. Avoriaz n'est pas « au-dessus du Mont Chéry » (INVRAISEMBLABLE).

Autres écarts corrigés : Sous-Dine a « donné 2000 m en 20 minutes » (c'était l'altitude atteinte) ; « 1000 m de gaz » lu comme un gain ; le Môle « depuis le Téléphérique » (le décollage n'est pas précisé, c'était en fin de saison) ; un record de tronçon du challenge inexact ; les « reposes déco » lues comme des décollages ; « 830 m de marche » (c'est un dénivelé) ; Couteau à « 5 min » (10 min) ; le rebat et le morget situés sur la rive française (la météo suisse les place côté suisse ; devant Évian, ce sont les albrans) ; Morclan, où « départ de cross » et « effet de foehn » étaient fusionnés en une causalité ; Pleine Bise orienté nord à nord-est ; un « point chaud mesuré » rebaptisé partout en probabilité tirée des traces GPS ; des causes de thermiques et des heures ajoutées (carrière « claire, l'après-midi », Coin, Troinex, Quatre Têtes « dès la fin de matinée », Avoriaz « début d'après-midi ») ; une consigne de franchissement de ligne THT inventée à Abondance.

## Corrections de rapports antérieurs

- `veracite_lots_1-6.md` jugeait NON SOURCÉES la date et les sanctions de Troinex. S37 (message du club du 29 septembre 2026) donne la décision, son application immédiate et les risques : « Amende ; Saisie du matériel ; Poursuites pénales ». CONFIRMÉ.
- Les 120 km/h du bornan figurent bien dans S32 ; le constat CONTREDIT reste juste, car MétéoSuisse, plus autorisée, donne 30 à 40 nœuds.

## Champs structurés à corriger (non modifiés)

| Élément | Champ | Problème |
|---|---|---|
| saleve-genevois/saleve-venturi-col-monnetier | `conditions` | « surtout par brise renforcée » : non sourcé |
| saleve-genevois/saleve-carriere-etrembieres | `best_hours`, `trigger` | « après-midi (été) », « carrière claire » : non sourcés |
| saleve-genevois/saleve-coin-thermique, saleve-troinex-thermique | `trigger` | déclencheurs non sourcés |
| saleve-genevois/saleve-teleferique-thermique-statique | `trigger` | « falaise plein sud/est » devant un décollage orienté nord |
| arve-faucigny/arve-basse-vallee-montante | `speed_kmh` | 20/35 tirés d'une plage générale : null |
| arve-faucigny/brise-pente-plaine-joux (`hours`), plaine-joux-plateau (`best_hours`) | horaires | « calme le matin, thermiques forts » décrit Varan dans le guide |
| arve-faucigny/quatre-tetes-falaise-est | `best_hours`, `sources` | « dès la fin de matinée » non sourcé ; la remarque sur les faces est vient d'un fil Charvin–Tournette |
| arve-faucigny/mole-face-sud | `trigger` | « plein sud-ouest » : la source dit sud |
| arve-faucigny/pointe-de-plate-falaise | `best_hours` | « plafond ≈ 3000 m » est une condition |
| arve-faucigny/plateau-des-benes, quatre-tetes-aravis | `sources` | S91 ne décrit pas le vol des Bénés ; c'est la vidéo archivée yt_t3T3sEAOxcE |
| haut-giffre/brise-montante-giffre | `speed_kmh` | 20/35 tirés de « modérée à forte » |
| haut-giffre/marcelly-mieussy-relance | `best_hours` | « même en automne » vaut pour le Môle |
| chablais/brise-vallee-aulps, brise-vallee-abondance | `speed_kmh` | vitesses interprétées d'adjectifs |
| chablais/rebat-evian, rebat-thonon | `name` | le rebat est la brise de la côte suisse |
| chablais/morget-evian | `name`, `sources` | morget suisse ; ajouter S117 |
| chablais/chatel-morclan-foehn | `name`, `conditions` | « départ de cross par effet de foehn » : deux remarques fusionnées |
| chablais/leman-bornan-molan | `conditions`, `sources` | « jusqu'à 120 km/h » ; ajouter S117 |
| chablais/leman-bise-rafales | `conditions` | « 3, 6 ou 9 jours d'affilée » contredit par MétéoSuisse |
| chablais/avoriaz-premier-thermique | `best_hours` | « début d'après-midi » non sourcé |
| chablais/ressachaux-dynamique-thermique | `trigger`, `best_hours` | arête nord-ouest et régime de brise non sourcés |

## Hors périmètre, à reprendre par qui de droit

- Visite Arve, étape 13 : « Sur la repose au décollage, on est sous le vent des arbres » (c'est l'atterrissage station fermée ; la repose est interdite) ; « Règle générale : ne volez pas au-dessus de 20 km/h » placé comme règle de Plaine-Joux. Étape 1 : « à Plaine-Joux, les thermiques forts ne viennent que l'après-midi » (ligne de Varan). Étape 12 : réserve « au nord de la pointe de Platé ».
- Visite Haut-Giffre, étape 4 : faces sud du Marcelly « même en automne » (vaut pour le Môle). Étape 12 : « avec un vent fort à très fort » (traduction anglaise fautive). Étape 8 : Couennasse « plus difficile » (non sourcé).
- Visite Chablais, étape 1 : « c'est le morget » et le rebat sur la rive française. Étape 5 : Zore « départ classique vers Avoriaz » (c'est Super Morzine), arête de Ressachaux face à la brise (non sourcé), thermique d'Avoriaz « du début d'après-midi ». Étape 11 : « À Châtel-Morclan, le foehn de sud sert à partir en cross ».
- Visite Salève, étape 3 : carrière « claire » qui « chauffe vite » ; étape 7 : butte « boisée » de l'Arve.

## Ce qui n'a pas pu être vérifié

- Camptocamp (S103 à S115) : seuls les résumés sont archivés ; pentes, cotations et longueurs reposent sur les notes de collecte.
- S3 (Haute-Savoie Tourisme, page générale) non archivée : la phrase sur Plaine-Joux (« vent de vallée très fort, conditions parfois violentes ») est laissée en note comme douteuse.
- Abondance : « atterrissage officiel » pour le topo, sans convention fédérale identifiée (NON VÉRIFIABLE).
- Jules Ferry : « sous le vent de la butte qui borde l'Arve en ouest » peut se lire « par vent d'ouest » ; l'ambiguïté est signalée en note.
- Agy : l'antenne-relais du plateau et le statut actuel du Noiret (atterrissage technique d'après S10, point de traces DHV pour la fédération) ne sont pas confirmés par une fiche officielle.
- Criou : les autres décollages « jusqu'à la pointe Rousse » et le passage « par la combe après les hauts de Montriond » (Putheys) ne figurent pas dans les extraits archivés.
