# Positions à vérifier (altitude du terrain IGN)

Généré par `python3 scripts/research/check_altitudes.py`. 1042 points de la recherche déclarent une altitude ; le terrain IGN (RGE ALTI) à leur position en diffère de plus de 80 m pour **65** d’entre eux. Un écart fort signale un point mal placé (ou une altitude fausse). Quand la fiche FFVL du même site tombe à la bonne altitude, elle est proposée : à reporter dans `research_notes/Seconde passe 2026/positions/corrections.json` après contrôle.

| Écart | Élément | Déclaré | Terrain IGN | Position | Proposition |
| --- | --- | --- | --- | --- | --- |
| 337 m | `saleve-genevois/saleve-carriere-etrembieres` Carrière d'Étrembières - Monnetier (pied de la face nord-oue | 520 m | 857 m | approx |  |
| 323 m | `haute-maurienne/valfrejus-punta-bagna` Valfréjus – Punta Bagna (FFVL 623) | 2368 m | 2691 m | source |  |
| 296 m | `brianconnais-guisane/atterro-pontillas` Pontillas (La Salle-les-Alpes) | 1684 m | 1388 m | source |  |
| 292 m | `brianconnais-guisane/atterro-hiver-casse-du-boeuf` Villeneuve / Casse du Bœuf (atterro d'hiver) | 1690 m | 1398 m | source |  |
| 270 m | `brianconnais-guisane/serre-chevalier-vallons` Serre Chevalier – Vallons (hiver) | 2234 m | 2504 m | source |  |
| 265 m | `tarentaise/fort-du-truc` Fort du Truc (« Fort 1500 ») | 1500 m | 1765 m | source |  |
| 249 m | `chartreuse/antennes-st-hilaire` Les Antennes (Saint-Hilaire) – « frontière sud du bocal » | 720 m | 969 m | approx |  |
| 239 m | `vanoise/mont-jovet-thermique` Mont Jovet : thermiques de fin de matinée | 2515 m | 2276 m | source |  |
| 239 m | `vanoise/mont-jovet` Mont Jovet (Bozel) | 2515 m | 2276 m | source |  |
| 232 m | `devoluy/la-superdevoluy-village` Superdévoluy – grand terrain du village | 1500 m | 1268 m | approx |  |
| 230 m | `chartreuse/manival-bec-charvet` Manival et pointe du Bec Charvet | 1400 m | 1630 m | source |  |
| 223 m | `mont-blanc-chamonix/merlet-thermiques-matin` Parc de Merlet : thermiques du matin | 1691 m | 1468 m | source |  |
| 222 m | `lac-annecy/semnoz-combe-thermique` Combe SSO sous le décollage du Semnoz | 1450 m | 1228 m | approx |  |
| 222 m | `haute-maurienne/orgere-estive` Villarodin-Bourget – L'Estive (FFVL 622) | 2421 m | 2199 m | source |  |
| 217 m | `oisans-grandes-rousses/cheminee-vaujany` Cheminée de Vaujany (décollage de l'après-midi) | 1600 m | 1817 m | approx |  |
| 205 m | `chartreuse/pilier-sud-dent-de-crolles` Pilier sud de la Dent de Crolles | 1800 m | 1595 m | approx |  |
| 203 m | `belledonne/saint-genis` Mont Saint-Genis (premier déclencheur de la face ouest) | 1250 m | 1047 m | approx |  |
| 194 m | `aravis/etale-telepherique` L'Étale (téléphérique, La Clusaz) | 2000 m | 1806 m | approx |  |
| 187 m | `arve-faucigny/pointe-d-andey` Pointe d'Andey (Bonneville) | 1666 m | 1853 m | source |  |
| 182 m | `mont-blanc-chamonix/merlet` Merlet (Les Houches) | 1650 m | 1468 m | source |  |
| 181 m | `bauges/dent-arclusaz-plafond` Dent d'Arclusaz (plafond avant Grand Arc, Chamoux ou Roc des | 1832 m | 2013 m | source |  |
| 178 m | `gapencais-ceuse/ceuse-sud-plateau` Céüse – déco plein sud du plateau (point 1794) | 1794 m | 1972 m | approx |  |
| 175 m | `tarentaise/granier-deco` Granier (Aime-La Plagne) | 1380 m | 1555 m | source |  |
| 169 m | `devoluy/pic-de-bure-rando` Pic de Bure – décollage herbeux face sud (rando-vol) | 2500 m | 2669 m | approx |  |
| 169 m | `gresivaudan/bannettes-gres` Les Bannettes (Mont-Saint-Martin) | 1845 m | 1676 m | source |  |
| 167 m | `mercantour/auron-atterro` Auron – atterrissage (au nord de la station) | 1600 m | 1433 m | source |  |
| 163 m | `val-montjoie-saint-gervais/notre-dame-de-la-gorge` Notre-Dame-de-la-Gorge (atterrissage de secours) | 1210 m | 1373 m | approx |  |
| 161 m | `brianconnais-guisane/serre-chevalier-foret` Serre Chevalier – Forêt (hiver) | 2195 m | 2356 m | source |  |
| 154 m | `champsaur-valgaudemar/ancelle-atterro` Ancelle | 1466 m | 1312 m | ? |  |
| 150 m | `ubaye/pointe-des-cirques-ubaye` Pointe des Cirques (3234 m) – sommet de vol rando | 3234 m | 3084 m | source |  |
| 148 m | `chartreuse/scia-plafond-transition` La Scia (thermique de service, plafond 3000 m et départ vers | 1791 m | 1643 m | approx |  |
| 146 m | `tarentaise/la-sevoliere` La Sévolière (La Rosière / Montvalezan) | 2095 m | 2241 m | source |  |
| 145 m | `vercors-nord/col-vert` Col Vert - FFVL 5122 | 1469 m | 1614 m | source |  |
| 144 m | `chartreuse/montagne-du-sac` Montagne du Sac (au vent, face ouest du Néron vers Chalves) | 1119 m | 1263 m | source |  |
| 143 m | `ubaye/aiguille-pierre-andre-ubaye` Aiguille Pierre André (2812 m) – sommet de vol rando | 2812 m | 2669 m | source |  |
| 141 m | `bauges/savoyarde-face-ouest-pompe` Face ouest de la Savoyarde (« pompe », tache rouge de la car | 1000 m | 1141 m | approx |  |
| 139 m | `chartreuse/falaises-touvet-saint-vincent` Falaises de La Terrasse – Le Touvet – Saint-Vincent-de-Mercu | 900 m | 1039 m | approx |  |
| 137 m | `champsaur-valgaudemar/therm-cuchon-antennes` Cuchon d'Ancelle : antennes (déco d'été) et soaring S/SO | 1750 m | 1613 m | source |  |
| 137 m | `champsaur-valgaudemar/cuchon-intermediaire` Cuchon d'Ancelle et St Léger – Intermédiaire (antennes) | 1750 m | 1613 m | ? |  |
| 137 m | `bourget-chambery/pas-de-l-echelle` Pas de l'Échelle (sud de la croix du Nivolet) | 1420 m | 1283 m | source |  |
| 131 m | `oisans-grandes-rousses/grave-glacier-meije` La Grave – Glaciers de la Meije (col des Ruillans, ~3200 m) | 3200 m | 3069 m | approx |  |
| 118 m | `vanoise/tovets-courchevel` Courchevel : Tovets (piste des Touets) | 1800 m | 1682 m | source |  |
| 115 m | `chablais/abondance-atterro` Abondance (face au gymnase) | 1093 m | 978 m | source |  |
| 113 m | `baronnies/buc-ouest` Buc Ouest | 1197 m | 1310 m | ? |  |
| 113 m | `oisans-grandes-rousses/huez-toits` Toits d'Huez / pentes sous l'Éclose | 1500 m | 1387 m | source |  |
| 112 m | `diois/ffvl5114-plaines-de-poet` Les Plaines de Poët | 880 m | 768 m | source |  |
| 107 m | `arve-faucigny/pointe-d-areu` Pointe d'Areu (Le Reposoir / Magland) | 2478 m | 2371 m | source |  |
| 102 m | `vanoise/col-de-la-loze-thermique` Col de la Loze / Lanches : thermiques d'hiver et de printemp | 2404 m | 2302 m | source |  |
| 100 m | `arve-faucigny/mole-ecutieux` Tête de l'Écutieux (La Tour) | 1515 m | 1615 m | source |  |
| 98 m | `serre-poncon-embrunais/atterro-reallon-courtier` Réallon – Le Courtier | 1500 m | 1598 m | source |  |
| 97 m | `vanoise/les-pres-bozel` Bozel : Les Prés | 1574 m | 1477 m | source |  |
| 97 m | `oisans-grandes-rousses/villar-darene-lac-du-pontet` Villar-d'Arêne – Lac du Pontet (FFVL 5214) | 2013 m | 2110 m | source |  |
| 96 m | `chablais/chatel-morclan` Châtel - Morclan | 1870 m | 1966 m | source |  |
| 96 m | `bauges/margeriaz-arete-plafond` Margériaz (arête qui monte « toute seule », plafond avant le | 1719 m | 1815 m | source |  |
| 94 m | `bauges/galoppaz-relance` Pointe de la Galoppaz (relance entre la Savoyarde et le Colo | 1566 m | 1660 m | source |  |
| 92 m | `prealpes-grasse-castellane/castellane-colle-bernaiche` Castellane – Crête de Colle Bernaiche (relais TV) | 1450 m | 1358 m | approx |  |
| 89 m | `chartreuse/grande-sure` La Grande Sûre (vol rando, ouest) | 1578 m | 1667 m | source |  |
| 87 m | `combe-de-savoie/grand-arc-plafond` Grand Arc et Petit Arc (plafond avant Albertville ou retour  | 2371 m | 2458 m | source |  |
| 86 m | `buech-laragne-chabre/beaumont-ouest` Rocher de Beaumont – Ouest | 1600 m | 1514 m | ? |  |
| 86 m | `ubaye/aiguille-grande-ubaye` Aiguille Grande (3064 m) – sommet de vol rando | 3064 m | 2978 m | source |  |
| 86 m | `bauges/la-couleuvre` La Couleuvre (Aillon-le-Jeune) | 1516 m | 1602 m | source |  |
| 84 m | `val-montjoie-saint-gervais/domes-de-miage` Dômes de Miage (paralpinisme) | 3600 m | 3516 m | source |  |
| 83 m | `trieves/courtet-combe-droite-deco` Combe à droite du déco de Courtet (faces ouest) | 1365 m | 1282 m | approx |  |
| 81 m | `diois/couspeau` Montagne de Couspeau (sous le Grand Delmas) | 1425 m | 1506 m | approx |  |
| 81 m | `chartreuse/pas-de-rocheplane` Pas de Rocheplane (sortie par la crête) | 1850 m | 1769 m | source |  |
