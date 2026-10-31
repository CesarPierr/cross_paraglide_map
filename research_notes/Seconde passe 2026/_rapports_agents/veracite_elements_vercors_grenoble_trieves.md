# Véracité et réécriture des éléments — lot vercors_grenoble_trieves

31 octobre 2026. Les 294 éléments du lot (cuvette grenobloise 30, Vercors nord 109, Vercors est et sud 69, Trièves 32, Matheysine 55) ont été vérifiés contre leurs sources. Ceux qui portaient un défaut ont été réécrits dans la « Voix » de `_methode/STYLE_TEXTES.md`, avec quelques autres dont la forme gênait. Seuls `description`, `possible`, `note`, `mechanism` et `usage` ont changé. Les constats non confirmés sont dans `veracite_elements_vercors_grenoble_trieves.json`, un objet par constat.

## Méthode

- Sources relues dans `.cache/research/docs/` :
  - les fiches fédérales (`ffvl_sites_alpes.json`, dont les champs sont tronqués à 600 caractères ; texte complet quand il existe dans `ffvl_sites_raw.json` ou `ffvl_full.json`) ;
  - les pages du club Lans en l'Air (`lel2_*`, idées de cross) et des Tichodromes (`tich/`) ;
  - les pages du Vol libre diois (`web2/vld_*`), les pages Serpaton (`web3/`) et infos-parapente ;
  - la base du CHVD (`chvd/all_text.json`) et le récit du 204 km (`ticho204.html`).
- L'article Kerkhove « Dans l'Y grenoblois » (S35) a été relu image par image (`img/y_p1` à `y_p4`). L'audit des lots 7 à 12 le disait inaccessible. Il confirme les 75 %, les 900 m, les 400-500 m et les 2-3 m/s.
- Trois pages ont été lues en ligne : Wikipédia « Climat de l'Isère » (S29) et deux pages Persée (S28, S30), lisibles seulement en introduction.
- Aucune page bloquée n'a été contournée. Les fiches fédérales derrière Cloudflare n'ont pas été rouvertes.
- Les pourcentages kk7 des 60 points chauds ont été recalculés sur les fichiers `sources/kk7/`. Ils sont tous conformes, à l'arrondi près.

## Bilan

| Verdict | Constats |
|---|---|
| DÉFORMÉ | 51 |
| NON SOURCÉ | 6 |
| CONTREDIT | 2 |
| NON VÉRIFIABLE | 15 |
| INVRAISEMBLABLE | 0 |
| **Total** | **74**, sur 67 éléments |

Les 227 autres éléments sont CONFIRMÉS. Par massif : Vercors nord 30 constats, cuvette 19, Vercors est et sud 12, Matheysine 7, Trièves 6.

## Les constats les plus graves

1. **Vol de 204 km, CONTREDIT.** Le texte disait la transition faite « en évitant la ZIT ». Le vol y est entré, et son score a été refusé. Partir plein nord est le conseil tiré après coup.
2. **Le terrain de secours de Saint-Martin pris pour l'atterrissage officiel.** C'est le terrain de secours, et lui seul, qui est sous le vent de la haie de peupliers.
3. **Une vitesse sol lue comme un vent.** Au Coiro, « plus de 90 km/h au sol » est une vitesse sol au GPS.
4. **Des chiffres déplacés.**
   - Les 2800 m du Gerbier étaient devenus le plafond du Moucherotte (« 2200-2800 m »). Les départs relevés vont de 2200 m à presque 2700 m.
   - Les 3280 m de 11h49, près du Col Vert, étaient devenus « 3200 m au Grand Veymont ». Les 3200 m sont au Jocou.
   - Le plafond de 2800 m était placé au Taillefer. La source le place avant La Salette.
   - Les plafonds de Courtet et de l'Obiou étaient attribués au Châtel.
5. **Des heures de récit devenues des règles.**
   - « 9h45 » à Chalais et « 11 h » au Peuil sont des heures d'arrivée au décollage.
   - « 13h20 » à Fluchaire est l'heure où le groupe a décollé.
   - « 18h15 » à Courtet est un décollage, pas la fin des thermiques.
   - « Après 14h » à Courtet vient de la légende d'une photo.
6. **Des vols fusionnés.**
   - Bastille : 935 m et 1000 m viennent de deux vols.
   - Écoutoux : quatre récits étaient fondus en deux phrases.
   - Mollard : un vol et un conseil de forum étaient mêlés.
   - Cornafion : la dalle rocheuse et les 25 minutes de bataille sont deux pilotes différents.
   - Circuit sud du Col Vert : le triangle de 131 km ne revient pas par Valbonnais. Un autre pilote s'y est posé.
7. **Un départ au Moucherotte « conseillé à 2300 m », chiffre qu'aucune source ne donne.** Le vol parti à 2250 m estime qu'il lui manquait au moins 150 m.
8. **Des règles erronées.**
   - Le seuil de 1220 m est celui de la zone interdite P14 du CEA.
   - La réduction du terrain de la Côte 2000 est un avis daté (19 au 31 août 2026), pas une règle d'estive.
   - « Ne pas poser pendant les foins » vise l'atterrissage de l'Aigle lui-même.
   - L'année 2025 des travaux de Saint-Jean-en-Royans n'est pas dans la fiche.
   - Le « 31 juin » des Écrins est écrit « fin juin ».
9. **Une heure déplacée et une observation détournée.** Le « 10h-10h30 » de la Matinière était l'heure de Lumbin par flux de nord-nord-est. La « cascade de Saint-Hilaire » était le décor d'un autre régime : l'observation a été déplacée vers la confluence au sud de Grenoble.
10. **Des propositions et des déductions présentées comme des vols.**
    - Le « Tour du Vercors » des Tichodromes est un parcours proposé (« Je vous laisse imaginer »).
    - Le rôle du thermique de l'Alevoux est une déduction.
    - Le conseil « éviter le couloir de Monteynard en transition basse » est déduit de sources de kitesurf.
    - La Plaine d'Autrans est un spot de snowkite.

Une erreur de ma propre première lecture a aussi été corrigée. L'itinéraire Pic Saint-Michel → Moucherotte → Grand Veymont est bien dans la page des Tichodromes sur le col de l'Arc (S52), et le texte l'a retrouvé.

## Champs structurés à corriger (non modifiés)

- `grenoble-cuvette/breezes/isere-voreppe-brise-montante.speed_kmh` : 20 km/h est déduit de « forte », 35 km/h est le seuil d'Uriage.
- `trieves/thermal_spots/courtet-pompe-devant-deco.best_hours` : « après 14h » vient d'une légende. Ses `sources`, comme celles de `courtet-combe-droite-deco`, n'incluent pas S230 (kk7), que le texte cite.
- `trieves/thermal_spots/fluchaire-ratier-bouchon.best_hours` : « vers 13h20 » est l'heure du décollage du groupe.
- `vercors-est-sud/hazards/saint-jean-aerodrome-approche.conditions` : « 2025 » n'est pas dans la fiche.
- `vercors-est-sud/hazards/reserve-hauts-plateaux-sud.conditions` : FL195 (fiche du Serpaton) contre FL125 (club du Diois, S58).
- `vercors-nord/thermal_spots/bellecombe-antenne-emetteur.sources` : il manque le récit chvd.org/2020/08/12/bellecombe-10-08-2020, seule source de la phrase sur l'antenne.
- `vercors-nord/thermal_spots/ffvl2227-autrans-la-plaine-thermique-fevrier` : `name` et `trigger` parlent de pente école ; la fiche 2227 est un spot de snowkite.
- `sources[]`, note de S233 : elle écrit « plafond de 2800 m avant de basculer sur Chamrousse ». Le récit ne chiffre pas ce plafond.
- À vérifier : `distance_km` de « Barrière est du Vercors » (36) et du « tronçon La Salette → Chamrousse » (31,3). Aucune source ne les donne, ce sont probablement des calculs de l'atlas.

## Hors périmètre

- Les visites `vercors-nord` et `vercors-est-sud` et les cartes des itinéraires reprennent peut-être les chiffres corrigés ici : 2800 m au Moucherotte, 3200 m au Grand Veymont, retour par Valbonnais. À relire par qui de droit.
- Le résumé de la cuvette grenobloise était classé NON VÉRIFIÉ dans `veracite_lots_7-12.md`. L'article S35 est en fait lisible en images, et il confirme les 75 %, les 900 m, les 400-500 m et les 2-3 m/s.

## Ce qui n'a pas pu être vérifié

- Les parties tronquées ou non récoltées des fiches fédérales :
  - les accès de la Dent Percée, de la 7 et de Corrençon ;
  - les procédures chiffrées de l'aérodrome de Saint-Jean-en-Royans ;
  - les 50 m de Corrençon ;
  - les fiches absentes de la récolte : Montaud 14268, Châtel 959, Col de Rousset 5103, Garandons 5182, Laffrey 1646 ;
  - la partie basse du champ des Farlaix.
- Les sources lues seulement par un résumé : S28 (la Matinière), S29 et S30 (accélération du nord-ouest dans la cluse), S1 à S6 (Monteynard et Laffrey, que l'audit 7-12 avait relus en ligne). Le wiki Barbules de l'Aigle (S67) n'est pas archivé.
- L'identité de « Garandons » avec l'atterrissage de Chamaloc décrit par le club du Diois.

## Contrôles

- `text_audit.py vercors_grenoble_trieves` : 0 erreur. Les avertissements restants sont tous justifiés :
  - les « années 2000 » sont la Côte 2000 ou des altitudes de 2000 m ;
  - les chiffres 8, 14, 150, 2250, 2700 et 3280 sont repris des passages consignés ici ;
  - aucun texte ne dépasse les longueurs cibles.
- `text_fidelity.py` : 15 points, tous relus et justifiés :
  - des noms retirés avec une erreur (Cornafion, Mollard) ;
  - des noms déplacés (Saint-Hilaire) ;
  - des directions tirées de la source (itinéraire du col de l'Arc, vents défavorables de l'Aigle 100 m) ;
  - une majuscule (Tour du Vercors).
- `npm run data:build -- --check` : réussi.
