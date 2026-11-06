# Véracité et réécriture des éléments — lot provence_maritimes

6 novembre 2026. Les 325 éléments du lot (Saint-André–Verdon 38, Haut-Verdon 33, Digne–Lure 73, Grasse–Castellane 68, Nice–Var 48, Mercantour 65) ont été comparés à leurs sources. Ceux qui portaient un défaut ont été réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`. Seuls `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Les constats sont dans `veracite_elements_provence_maritimes.json`, un objet par constat.

## Méthode

- Sources relues dans `.cache/research/docs/provence_maritimes/` : fiches fédérales (`ffvl_area_details.txt`, avec le texte de `ffvl_sites_alpes.json`), pages Ozone, Aérogliss, FlyStAndre, XC Mag, catalogue du vol libre, club de Sospel, récits du club Au gré de l'air, récits myniceflights, fils de forum.
- Chaque chiffre du lot a été recherché dans les sources citées, par script. Les passages ont ensuite été lus pour les affirmations de numéros, d'heures, de directions, de lieux et de règles. Les affirmations qualitatives courantes n'ont été relues que si elles semblaient suspectes.
- Les 42 éléments chiffrés en pourcentages ont été recalculés sur `sources/kk7/`. Tous sont conformes. Les valeurs « 70 % » sont des seuils (« sous 70 % »).
- Deux pages ont été relues en ligne, faute de cache : XC Mag S120 (301 km) et Fréquence Mistral S21. S21 confirme 280 jours de vol et 25 planeurs, que l'audit 7-12 disait introuvables. Aucune page bloquée n'a été contournée.

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 82 |
| NON SOURCÉ | 20 |
| CONTREDIT | 17 |
| NON VÉRIFIABLE | 17 |
| INVRAISEMBLABLE | 3 |
| **Total** | **139**, sur 119 éléments |

Les 206 autres éléments n'ont pas de constat : leurs chiffres sont dans les sources citées, et leur lecture n'a rien révélé. Par massif : Grasse–Castellane 29, Saint-André 25, Digne–Lure 25, Mercantour 23, Haut-Verdon 20, Nice–Var 17.

## Les constats les plus graves

1. **Atterrissage de Thorenc (Bleine).** Le texte le disait praticable d'avril à début juillet. La fiche parle d'un régime de convention par période. Surtout, le club écrit que le nouveau propriétaire a dénoncé la convention, et qu'il faut éviter de s'y poser. C'était tourné en simple hypothèse.
2. **Deux spots de kitesurf comptés comme atterrissages** : plage de Nice et Saint-Laurent-du-Var. La première fiche était présentée comme « ouverte à la pratique du parapente ». Texte requalifié, élément à retirer.
3. **Oraison : « restitution vers Moustiers »**. La source dit « une petite route », donc un trajet en voiture. Le texte en faisait un vol.
4. **Crête de Cadun et Caduc inversés.** La source dit que le retour est plus facile par le Caduc. Le texte faisait du Caduc la route difficile.
5. **Courradour–Annot.** Le conseil « il faut faire le plafond avant de sauter derrière Annot » renverse le récit : le pilote y renonce, et on lui dit le soir qu'avec ce plafond il pouvait boucler.
6. **Valettes.** La PTU « obligatoire » est la procédure des deltas, et « ultra facile » déforme une comparaison, sur un terrain classé confirmé, en zone urbanisée. Sainte-Luce : le terrain très court et la chapelle manquaient.
7. **Peille – Lai Barrai.** Horaires d'ouverture, zones de vol interdit (La Turbie, Monaco, LF-R83) et « dangereux hors brise thermique » manquaient.
8. **Terres Noires.** « Déconseillées entre 11h et 17h » est la supposition de celui qui pose la question sur le forum.
9. **Chiffres déplacés.**
   - Le départ à 11h15 « à 2285 m » depuis un sommet à 1416 m : c'est le premier plafond.
   - Las Donnas « à 874 m » : c'est un dénivelé.
   - Les 8 m/s du Montdenier joints aux 4050 m pris après la montagne de Coupe.
   - La turbulence de la montagne de Chamatte (Thorame) attribuée au Pic de Chamatte.
   - Les 3850 m dits « d'une autre journée » sont de ce vol même.
10. **Plafonds et heures d'un vol devenus règles.** Reynière 2100 m, Mouchon 3400 m, Allier 2100 m, Cheval Blanc 2600 m, Estrop 3680 m, plages horaires de Bleine à Saint-André (Lattes, Teillon, Vauplane, bois brûlé). Crête des Serres : le plein part vers le nord, pas « au retour ».

Autres erreurs notables : « parcs nationaux » Auron, Tende et Sospel ; Pic de Chamatte à 20 km de Saint-André (environ 8 km) ; kk7 lu comme une force (« le plus fort ») alors qu'il donne une probabilité ; Campé Giordano dit « en projet » alors qu'il est ouvert et conventionné ; ligne électrique de Moriez absente.

## Champs structurés à corriger (non modifiés)

- `landings/plage-de-nice`, `landings/saint-laurent-du-var-plage` : à retirer ou reclasser (kitesurf).
- `prealpes-digne-lure/takeoffs/archail-fontaine.alt_m` : 1048 m, sous l'atterrissage à 1201 m ; le catalogue donne 1720 m.
- `sources[]` : le récit `luc_armant_luc31.pdf` manque au lot. Il porte les 3680 m de l'Estrop, les 3300 m du Mourre de Chanier et les 2985 m de Coupe. `luc_armant_luc28.pdf` manque aussi pour Coupe.
- Noms tirés d'un seul vol ou d'un seul avis :
  - `crete-des-serres-angle` (4200 m), `mouchon-plein-3400`, `sapee-sapet-lee-vautour` (3000 m) ;
  - `tete-de-l-estrop` (3680 m), `coste-longue-pointe-sud` (2800 m), `mourre-de-chanier-plafond`, `mounier-thermique-3200` ;
  - `montagne-de-gache` (« toujours de très bons thermiques ») ;
  - `venturi-les-lattes` (« aucun atterrissage », contredit par S31) ;
  - `lombarde-sospel` (« vent de nord »), `baou-des-noirs` (« gros plafond »).
- `best_hours` tirés d'un vol ou sans source :
  - `mouchon-plein-3400`, `montagne-de-l-allier`, `tete-du-bau`, `mounier-thermique-3200`, `valberg-col-des-huerris` ;
  - `pic-de-l-aigle-bleine`, `bleine-bois-brule`, `pente-se-des-lattes`, `sommet-du-teillon`, `vauplane-bernarde`, `greolieres-col-antenne-coursegoules` ;
  - `courmettes-antennes`, `baou-des-noirs` et les autres baous (« après-midi »).
- `conditions` de `aup-eperon-deux-flux` (« ≈ 16h ») ; `trigger` de `coste-longue-pointe-sud` (« boulet de canon », qui vient de la Chaux).

## Hors périmètre (mêmes erreurs, non modifiées)

- `visites/saint-andre-verdon` : étape 5 (plafond vers 2100 m aux antennes ; crête des Serres « au retour »), étape 8 (3400 m au Mouchon). Conseil 7 : planeurs « de Saint-Auban ».
- `visites/haut-verdon-allos` étape 5 : Caduc présenté comme la route difficile ; « 3680 m » comme plafond de la Blanche.
- `visites/prealpes-digne-lure` : étape 3 (restitution jusqu'au lac de Sainte-Croix), étape 15 (Terres Noires « elles secouent »).
- `visites/prealpes-grasse-castellane` : étape 4 (Le Puet « idéal en soaring »), étape 6 (Valettes « très facile », « PTU obligatoire »), étape 7 (Thorenc : « pourrait changer de propriétaire »).
- `visites/prealpes-nice-var` étape 1 : « souvent vent de cul vers 11 h ». Effet synoptique 2 et étape 12 : Saint-Laurent-du-Var, repris de la fiche de kitesurf.

## Ce qui n'a pas pu être vérifié

- Les 17 constats NON VÉRIFIABLE, notamment : cartes images de FlyStAndre (S26), R196C, TMA de Nice et TMA 9 (à recouper sur la carte aérienne en vigueur), texte en vigueur du parc du Mercantour, état actuel des vaches de 2016 (S58), « brise de Puget-Théniers » au Dôme de Barrot.
- La fin tronquée de plusieurs fiches fédérales (précaution sur l'érodium au Puet, Kennedy, Roquebrune).
- La nature de la mention « Pas encore fait ! » au Campé Giordano, lue comme visant le support du panneau.
- Les éléments sans constat n'ont pas tous reçu une lecture mot à mot : les fiches de zones de faune ont été prises dans la note de S95, sans rouvrir chaque polygone.

## Contrôles

- `text_audit.py provence_maritimes` : 0 erreur, aucune attribution, aucun texte au-delà des longueurs cibles. Avertissements relus : années 2024 de La Mure et altitudes de 2000 m ; chiffres repris de passages consignés ici (Lai Barrai, Cadun, Chalvet, Archail, Mont Chauve).
- `text_fidelity.py` : 23 points, tous relus et justifiés. Ce sont des noms retirés avec une erreur (Saint-Auban, Jausiers, Chabre, Sainte-Croix, Valettes, Caussols, Le Puet), déplacés (Izoard, Col des Huerris, Roquebrune) ou tirés d'une source (directions de l'Estrop, de Sainte-Luce, du Mont Chauve).
- `npm run data:build -- --check` : réussi (code 0). Les avertissements de ce contrôle portent sur la position d'un demi-tour d'itinéraire, déjà présente.
