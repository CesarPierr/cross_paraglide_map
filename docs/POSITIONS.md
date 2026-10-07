# Positions à vérifier (altitude du terrain IGN)

Généré par `python3 scripts/research/check_altitudes.py`. 1366 points de la recherche déclarent une altitude ; le terrain IGN (RGE ALTI) à leur position en diffère de plus de 80 m pour **16** d’entre eux. Un écart fort signale un point mal placé (ou une altitude fausse). Quand la fiche FFVL du même site tombe à la bonne altitude, elle est proposée : à reporter dans `research_notes/Seconde passe 2026/positions/corrections.json` après contrôle.

| Écart | Élément | Déclaré | Terrain IGN | Position | Proposition |
| --- | --- | --- | --- | --- | --- |
| 270 m | `brianconnais-guisane/serre-chevalier-vallons` Serre Chevalier – Vallons (hiver) | 2234 m | 2504 m | source |  |
| 223 m | `mont-blanc-chamonix/merlet-thermiques-matin` Parc de Merlet : thermiques du matin | 1691 m | 1468 m | source |  |
| 182 m | `mont-blanc-chamonix/merlet` Merlet (Les Houches) | 1650 m | 1468 m | source |  |
| 161 m | `brianconnais-guisane/serre-chevalier-foret` Serre Chevalier – Forêt (hiver) | 2195 m | 2356 m | source |  |
| 150 m | `ubaye/pointe-des-cirques-ubaye` Pointe des Cirques (3234 m) – sommet de vol rando | 3234 m | 3084 m | source |  |
| 147 m | `belledonne/col-de-pipay-face-ouest` Col de Pipay : face ouest sous les remontées | 2015 m | 1868 m | approx |  |
| 143 m | `ubaye/aiguille-pierre-andre-ubaye` Aiguille Pierre André (2812 m) – sommet de vol rando | 2812 m | 2669 m | source |  |
| 113 m | `baronnies/buc-ouest` Buc Ouest | 1197 m | 1310 m | ? |  |
| 112 m | `diois/ffvl5114-plaines-de-poet` Les Plaines de Poët | 880 m | 768 m | source |  |
| 108 m | `aravis/meruz-char-marin` Méruz – Char Marin : pentes d’Ugine au pied du Charvin | 1173 m | 1065 m | approx |  |
| 96 m | `chablais/chatel-morclan` Châtel - Morclan | 1870 m | 1966 m | source |  |
| 89 m | `chartreuse/grande-sure` La Grande Sûre (vol rando, ouest) | 1578 m | 1667 m | source |  |
| 86 m | `chartreuse/roche-veyrand-corbel` Roche Veyrand (Corbel) : thermique de la falaise | 1275 m | 1189 m | approx |  |
| 86 m | `buech-laragne-chabre/beaumont-ouest` Rocher de Beaumont – Ouest | 1600 m | 1514 m | ? |  |
| 86 m | `ubaye/aiguille-grande-ubaye` Aiguille Grande (3064 m) – sommet de vol rando | 3064 m | 2978 m | source |  |
| 84 m | `val-montjoie-saint-gervais/domes-de-miage` Dômes de Miage (paralpinisme) | 3600 m | 3516 m | source |  |
