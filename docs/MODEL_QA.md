# Contrôle du modèle de vent contre l’atlas

Généré par `npm run model:check` le 2026-10-07 sur `apps/web/public/data/atlas.json` (atlas du 2026-10-07), modèle TypeScript de référence (`packages/model`) sur le MNT réel. Durée : 5,3 s.

## Critères

- **Brises** : échantillons le long du tracé (10 à 90 % de sa longueur), au milieu de la fenêtre horaire, en juillet sans vent météo (janvier pour une brise d’hiver ; vent météo ou canicule simulés pour une brise conditionnelle). Niveaux : sol (50 m), puis 30 % et 60 % de la couche : altitude atteinte documentée (« Épaisseur » : « sensible jusqu’à 2500 m d’altitude », mesurée depuis le fond de vallée), sinon épaisseur documentée, sinon profondeur locale de la vallée pour les brises de vallée, 200 m pour la pente, 100 m pour un catabatique, 1000 m pour plaine → montagne et régionale. Sens : cos > 0.5 sur au moins 60 % des points. Vitesse (si documentée) : rapport médian modèle / fiche entre 0,5 et 1,6 au sol et à 30 %, au moins 0,3 à 60 % (la brise faiblit vers le haut de la couche, Zardi & Whiteman 2013). Hors horaires (2 h 30 avant le début, ou après la fin) et hors condition : composante le long du tracé < 30 % de la vitesse documentée.
- **Convergences** : convergence du modèle (divergence lissée, comme la couche « Convergences ») à 80 m sol, à l’heure de « Quand », avec une tolérance d’une maille (216 m) autour de la ligne : moyenne > 0 et au moins la moitié des points > 0.
- **Thermiques** : potentiel thermique (max sur 3 × 3 mailles, positions approchées) au-dessus de la médiane des terres dans un rayon de 5 km, aux heures « Heures » (12h–15h si non précisées) ; et, quand un début est documenté, colonne thermique affichée (potentiel ≥ 0,22, seuil des colonnes des sites connus) à ±1 h d’un début explicite (« dès 10h », « 3 h après le lever du soleil »), sinon au plus tard au milieu de la période documentée (1 h après son début pour une période courte).
- **Pièges** : venturi, sous le vent, foehn et brise forte, sous le vent météo cité par « Conditions » (30 km/h par défaut, 40 si « fort », 15 si « faible ») ou à l’heure de brise citée, dans un rayon de min(Rayon, 3 km) : accélération ≥ ×1,15 par rapport à la médiane des fonds de vallée voisins (10 km) ou indice venturi ≥ 0,3 ; abri ou turbulence ≥ 0,35 ; vent descendant ≥ 0,8 × vent météo ou turbulence ≥ 0,3 ; vent ≥ 20 km/h. Sans vent ni horaire cité : non testable.

## Taux de réussite par catégorie

| Catégorie | Réussis | Testés | Taux | Non testables |
| --- | --- | --- | --- | --- |
| brises | 240 | 257 | 93 % | 1 |
| convergences | 61 | 70 | 87 % | 9 |
| thermiques | 124 | 150 | 83 % | 0 |
| pièges | 107 | 148 | 72 % | 42 |
| **total** | **532** | **625** | **85 %** | 52 |

Contrôles élémentaires des brises :

| Contrôle | Réussis | Testés | Taux |
| --- | --- | --- | --- |
| hors condition | 10 | 10 | 100 % |
| hors horaires | 230 | 235 | 98 % |
| sens, 30 % couche | 238 | 246 | 97 % |
| sens, 30 % de l’altitude atteinte | 10 | 10 | 100 % |
| sens, 60 % couche | 239 | 247 | 97 % |
| sens, 60 % de l’altitude atteinte | 9 | 10 | 90 % |
| sens, sol | 249 | 257 | 97 % |
| tracé | 0 | 1 | 0 % |
| vitesse, 30 % couche | 114 | 116 | 98 % |
| vitesse, 30 % de l’altitude atteinte | 10 | 10 | 100 % |
| vitesse, 60 % couche | 115 | 116 | 99 % |
| vitesse, 60 % de l’altitude atteinte | 9 | 10 | 90 % |
| vitesse, sol | 124 | 126 | 98 % |

Calendrier : déclenchement des thermiques au début explicite (« dès 10h », « à partir de midi », « 3 h après le lever du soleil ») : écart médian modèle − fiche -1,50 h sur 23 sites (13 trop tôt, 2 trop tard). Les heures « après-midi » ou « 12h-17h » des fiches de thermiques décrivent souvent la meilleure période plutôt que le déclenchement : seuls les débuts explicites mesurent un décalage systématique.

## Taux de réussite par secteur

| Secteur | Brises | Convergences | Thermiques | Pièges | Total |
| --- | --- | --- | --- | --- | --- |
| Alpes françaises | 26/26 | 13/13 | – | 6/6 | 45/45 |
| Aravis | 6/7 | 2/2 | 8/9 | 1/3 | 17/21 |
| Arves – Galibier | 3/3 | – | – | – | 3/3 |
| Baronnies | 4/4 | – | 1/2 | 2/3 | 7/9 |
| Bauges | 8/8 | 4/5 | 2/2 | 2/2 | 16/17 |
| Beaufortain | 3/4 | 1/2 | 2/2 | 0/2 | 6/10 |
| Belledonne | 9/9 | 2/2 | 4/5 | 2/4 | 17/20 |
| Bornes | 3/3 | 2/2 | 4/5 | 1/2 | 10/12 |
| Bourget – Chambéry | 5/5 | 1/1 | 2/3 | 3/5 | 11/14 |
| Briançonnais | 5/7 | 1/3 | 2/4 | 7/7 | 15/21 |
| Buëch – Chabre | 6/6 | 3/3 | 5/5 | 3/7 | 17/21 |
| Chablais | 8/8 | – | 1/2 | 5/5 | 14/15 |
| Chamonix – Mont-Blanc | 5/5 | – | 3/5 | 1/1 | 9/11 |
| Champsaur | 3/3 | – | 2/2 | – | 5/5 |
| Chartreuse | 12/15 | 2/2 | 11/11 | 3/3 | 28/31 |
| Combe de Savoie | 3/4 | – | 3/3 | 1/2 | 7/9 |
| Cuvette grenobloise | 7/7 | 1/1 | – | 2/2 | 10/10 |
| Dévoluy | 1/1 | 1/1 | 2/3 | 1/1 | 5/6 |
| Digne – Lure | 4/4 | – | 3/3 | 4/5 | 11/12 |
| Diois | 9/9 | – | 6/6 | 4/8 | 19/23 |
| Faucigny – Arve | 6/7 | – | 4/5 | 6/7 | 16/19 |
| Gapençais – Céüse | 4/4 | 1/1 | 3/3 | 2/2 | 10/10 |
| Giffre | 3/4 | – | 2/2 | 1/4 | 6/10 |
| Grésivaudan | 5/5 | 3/3 | – | 1/2 | 9/10 |
| Haut-Verdon | 1/1 | 2/2 | 1/1 | – | 4/4 |
| Haute-Maurienne | 4/4 | – | 0/1 | 3/3 | 7/8 |
| Lac d’Annecy | 9/10 | 6/6 | 6/6 | 2/3 | 23/25 |
| Matheysine – Drac | 2/3 | – | 1/1 | 3/4 | 6/8 |
| Maurienne | 3/3 | – | – | 3/3 | 6/6 |
| Megève – Val d’Arly | 2/2 | 1/1 | 1/2 | 0/3 | 4/8 |
| Mercantour | 7/7 | 1/2 | 2/2 | 4/5 | 14/16 |
| Oisans | 7/7 | 1/1 | 4/4 | 3/3 | 15/15 |
| Préalpes de Grasse | 3/3 | 3/4 | 3/3 | 2/4 | 11/14 |
| Préalpes de Nice | 5/5 | 1/1 | 3/3 | 0/2 | 9/11 |
| Queyras | 7/7 | 0/1 | 1/2 | 1/1 | 9/11 |
| Saint-André | 3/4 | 1/1 | 5/6 | 1/2 | 10/13 |
| Salève | 2/2 | – | 2/3 | 1/1 | 5/6 |
| Serre-Ponçon | 2/3 | – | 1/2 | 5/5 | 8/10 |
| Tarentaise | 6/7 | 3/4 | 5/7 | 5/5 | 19/23 |
| Trièves | 2/2 | – | 2/2 | 1/2 | 5/6 |
| Ubaye | 2/3 | – | – | 3/3 | 5/6 |
| Val Montjoie | 2/2 | 2/2 | 1/2 | 1/1 | 6/7 |
| Vallouise – haute Durance | 6/7 | 1/2 | 5/6 | 5/6 | 17/21 |
| Vanoise | 4/4 | – | 3/4 | 3/3 | 10/11 |
| Vercors est & sud | 6/6 | – | 4/4 | 1/3 | 11/13 |
| Vercors nord | 7/7 | 2/2 | 4/7 | 2/3 | 15/19 |

## Échecs

Classement : **modèle** = défaut du modèle à corriger ; **donnée** = tracé, horaires ou couloirs de la fiche à revoir (voir la dernière section) ; **limite** = limite assumée du modèle (résolution 216 m, pas de dynamique de foehn, pas d’accélération des brises aux cols, convexité à l’échelle de 1,5 km pour le potentiel thermique, pondération par la confiance des sources).

| Catégorie | modèle | donnée | limite |
| --- | --- | --- | --- |
| brises | 4 | 8 | 5 |
| convergences | 1 | 8 | 0 |
| thermiques | 15 | 0 | 11 |
| pièges | 0 | 0 | 41 |

### Brises (17)

- **Brise montante de la basse vallée de l'Arve (Annemasse → Bonneville → Marignier → Cluses) (vallée)** — `arve-faucigny/arve-basse-vallee-montante`, Faucigny – Arve · *modèle* · juillet 16h15, sans vent météo · couches : altitude atteinte documentée 2500 m
  - sens, 60 % de l’altitude atteinte : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,73)
  - vitesse, 60 % de l’altitude atteinte : attendu 6–32 km/h (doc. 20 km/h) ; obtenu 2 km/h
  - cause probable : 60 % de l’altitude atteinte : flux générique opposé (vent météo 0 km/h le long du tracé) malgré la brise documentée (poids 0,71) ; 60 % de l’altitude atteinte : vitesse documentée diluée : poids 0,71, activité 100 %, apport principal plaine/lac/mer 0 km/h
- **Brise de pente et restitution du versant SO-O de la Platière / Pertuiset (Mieussy → décollages) (pente)** — `haut-giffre/brise-pente-pertuiset-platiere`, Giffre · *limite* · juillet 18h45, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (14h30) : attendu composante < 2 km/h ; obtenu 3 km/h (10 km/h avec l’écoulement nocturne et les autres brises documentées)
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique 1 km/h, plaine/lac/mer 0 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Brise de Doussard / Lathuile vers Chevaline et les Bauges (vallée)** — `lac-annecy/brise-doussard-chevaline-bauges`, Lac d’Annecy · *donnée* · juillet 15h30, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 33 % (cos médian 0,43)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 33 % (cos médian 0,42)
  - cause probable : 30 % profondeur : cellules attribuées à une autre brise documentée : lac-annecy/brise-lac-annecy (poids propre moyen 0,00) ; 60 % profondeur : cellules attribuées à une autre brise documentée : lac-annecy/brise-lac-annecy (poids propre moyen 0,00)
- **Brise de Saint-Jean-de-Sixt vers Le Grand-Bornand (vallée)** — `aravis/brise-saint-jean-grand-bornand`, Aravis · *donnée* · juillet 14h45, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,65)
  - cause probable : sol (50 m) : cellules attribuées à une autre brise documentée : aravis/brise-thones-la-clusaz-aravis (poids propre moyen 0,00)
- **Brise de vallée remontant le vallon de Roselend et soleil sur les parois NO (vol du soir) (pente)** — `beaufortain/brise-pente-roselend-soir`, Beaufortain · *limite* · juillet 18h45, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (14h30) : attendu composante < 2 km/h ; obtenu 4 km/h (6 km/h avec l’écoulement nocturne et les autres brises documentées)
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique 2 km/h, plaine/lac/mer 0 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Flux descendant des Chapieux, renforcé par la brise de Beaufort (Roselend → Les Chapieux → Bourg-Saint-Maurice) (descendante)** — `tarentaise/brise-chapieux-roselend`, Tarentaise · *modèle* · juillet 3h00, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 58 % (cos médian 0,91)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 58 % (cos médian 0,96)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 58 % (cos médian 0,97)
  - cause probable : sol (50 m) : flux générique opposé (vallée générique -1 km/h le long du tracé) malgré la brise documentée (poids 0,50) ; 30 % profondeur : flux générique opposé (vallée générique -1 km/h le long du tracé) malgré la brise documentée (poids 0,50) ; 60 % profondeur : flux générique opposé (vallée générique -0 km/h le long du tracé) malgré la brise documentée (poids 0,50)
- **Brise redescendante du sommet de Montlambert (fin d'après-midi) (catabatique)** — `combe-de-savoie/brise-descendante-montlambert`, Combe de Savoie · *donnée* · juillet 3h00, sans vent météo · couches : écoulement descendant 3–100 m (S3)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian 0,02)
  - sens, 30 % couche (30 m sol) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian 0,02)
  - sens, 60 % couche (60 m sol) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian 0,01)
  - cause probable : sol (50 m) : poids de la brise documentée faible sur le tracé (0,06) : tracé hors du fond de vallée ou en bout de couloir ; 30 % couche (30 m sol) : poids de la brise documentée faible sur le tracé (0,06) : tracé hors du fond de vallée ou en bout de couloir ; 60 % couche (60 m sol) : poids de la brise documentée faible sur le tracé (0,06) : tracé hors du fond de vallée ou en bout de couloir
- **Brise montante du Manival (Saint-Ismier vers Col de Baure) (vallée)** — `chartreuse/brise-montante-manival`, Chartreuse · *donnée* · juillet 14h45, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 25 % (cos médian -0,46)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 25 % (cos médian -0,55)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 25 % (cos médian -0,56)
  - cause probable : sol (50 m) : cellules attribuées à une autre brise documentée : gresivaudan/brise-nord-gresivaudan (poids propre moyen 0,00) ; 30 % profondeur : cellules attribuées à une autre brise documentée : gresivaudan/brise-nord-gresivaudan (poids propre moyen 0,00) ; 60 % profondeur : cellules attribuées à une autre brise documentée : gresivaudan/brise-nord-gresivaudan (poids propre moyen 0,00)
- **Brise des hautes vallées vers le Col du Cucheron (Saint-Pierre-d'Entremont) (transfert de col)** — `chartreuse/brise-cucheron-entremont`, Chartreuse · *modèle* · juillet 14h45, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,71)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,69)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,69)
  - cause probable : sol (50 m) : flux générique opposé (vent météo 0 km/h le long du tracé) malgré la brise documentée (poids 0,41) ; 30 % profondeur : flux générique opposé (vent météo 0 km/h le long du tracé) malgré la brise documentée (poids 0,41) ; 60 % profondeur : flux générique opposé (vent météo 0 km/h le long du tracé) malgré la brise documentée (poids 0,41)
- **Brise d'ouest de l'après-midi sur les faces ouest (Grand Ratz, Grande Sûre) (pente)** — `chartreuse/brise-ouest-apres-midi`, Chartreuse · *limite* · juillet 17h00, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (12h30) : attendu composante < 2 km/h ; obtenu 3 km/h
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique 0 km/h, plaine/lac/mer 1 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Vent du nord thermique des lacs de Laffrey (plateau matheysin) (plaine → montagne)** — `matheysine/laffrey-nord-plateau`, Matheysine – Drac · *donnée* · juillet 15h30, sans vent météo · couches : aspiration plaine → montagne ≈ 1000 m (S4)
  - vitesse, sol (50 m) : attendu 12–37 km/h (doc. 23 km/h) ; obtenu 10 km/h
  - vitesse, 30 % couche (300 m sol) : attendu 12–37 km/h (doc. 23 km/h) ; obtenu 10 km/h
  - cause probable : sol (50 m) : cellules attribuées à une autre brise documentée : matheysine/drac-matheysine-champsaur (poids propre moyen 0,07) ; 30 % couche (300 m sol) : cellules attribuées à une autre brise documentée : matheysine/drac-matheysine-champsaur (poids propre moyen 0,07)
- **Flux d'est (Lombarde) dans la haute Clarée (Italie → Névache) (transfert de col, seulement par vent météo d’est (≥ 10 km/h))** — `brianconnais-guisane/lombarde-haute-claree`, Briançonnais · *modèle* · juillet 17h30, vent météo 90° 15 km/h · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 57 % (cos médian 0,52)
  - cause probable : 60 % profondeur : flux générique opposé (pente -0 km/h le long du tracé) malgré la brise documentée (poids 0,85)
- **Brise de pente du Prorel (Saint-Blaise → Notre-Dame-des-Neiges → Croix de la Nore) (pente)** — `brianconnais-guisane/brise-pente-prorel`, Briançonnais · *limite* · juillet 15h30, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (10h00) : attendu composante < 2 km/h ; obtenu 3 km/h
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 3 km/h, vallée générique -0 km/h, plaine/lac/mer -0 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Brise descendante du soir et catabatique de Vallouise (Ailefroide → Pelvoux → Vallouise → Les Vigneaux) (descendante)** — `ecrins-vallouise-haute-durance/brise-descendante-vallouise`, Vallouise – haute Durance · *donnée* · juillet 18h45, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian -0,98)
  - vitesse, sol (50 m) : attendu 10–32 km/h (doc. 20 km/h) ; obtenu 7 km/h
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian -0,98)
  - vitesse, 30 % profondeur : attendu 10–32 km/h (doc. 20 km/h) ; obtenu 7 km/h
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian -0,98)
  - vitesse, 60 % profondeur : attendu 6–32 km/h (doc. 20 km/h) ; obtenu 4 km/h
  - cause probable : sol (50 m) : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00) ; sol (50 m) : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00) ; 30 % profondeur : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00) ; 30 % profondeur : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00) ; 60 % profondeur : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00) ; 60 % profondeur : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00)
- **Brise du lac de Serre-Ponçon (lac → pentes de Saint-Vincent et de Savines) (lac)** — `serre-poncon-embrunais/brise-lac-serre-poncon`, Serre-Ponçon · *donnée* · juillet 15h15, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,49)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 33 % (cos médian 0,19)
  - cause probable : sol (50 m) : poids de la brise documentée faible sur le tracé (0,34) : tracé hors du fond de vallée ou en bout de couloir ; 30 % profondeur : cellules attribuées à une autre brise documentée : alpes-francaises/ubaye (poids propre moyen 0,28)
- **Brise / vent d'est de Larche (Italie → Larche plage → Maljasset) (transfert de col)** — `ubaye/brise-larche-italie`, Ubaye · *donnée* · juillet 14h45, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 40 % (cos médian -0,98)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 40 % (cos médian -0,98)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 40 % (cos médian -0,98)
  - cause probable : sol (50 m) : cellules attribuées à une autre brise documentée : ubaye/brise-ubaye (poids propre moyen 0,34) ; 30 % profondeur : cellules attribuées à une autre brise documentée : ubaye/brise-ubaye (poids propre moyen 0,34) ; 60 % profondeur : cellules attribuées à une autre brise documentée : ubaye/brise-ubaye (poids propre moyen 0,34)
- **Brise de pente de la face SE du Chalvet (matin) (pente)** — `saint-andre-verdon/brise-pente-chalvet-sud-est`, Saint-André · *limite* · juillet 14h45, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (8h00) : attendu composante < 2 km/h ; obtenu 3 km/h (-1 km/h avec l’écoulement nocturne et les autres brises documentées)
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique -3 km/h, plaine/lac/mer -0 km/h, vent météo 0 km/h (brise documentée active à 0 %)

### Convergences (9)

- **Rencontre des descentes du col de la Seigne et du Cormet de Roselend aux Chapieux** — `beaufortain/convergence-chapieux-seigne-cormet`, Beaufortain · *donnée* · juillet 15h30, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,49 m/s, 33 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 0,24 m/s sur la ligne)
- **Confluence Chapieux / Tarentaise à Bourg-Saint-Maurice (Versoyen – Gare)** — `tarentaise/confluence-bourg-saint-maurice`, Tarentaise · *modèle* · juillet 15h45, bise (nord-est) 15 km/h, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,47 m/s, 33 % > 0
  - cause probable : les flux modélisés ne se rencontrent pas sur cette ligne à cette heure
- **Confluence du secteur d'École (brise de la Compôte × vent météo de N ou S)** — `bauges/confluence-ecole-compote`, Bauges · *donnée* · juillet 15h30, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne 0,61 m/s, 40 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 2,95 m/s sur la ligne)
- **Confluence Durance / Romanche-Guisane (de Saint-Chaffrey au Monêtier)** — `brianconnais-guisane/conv-saint-chaffrey-granon`, Briançonnais · *donnée* · juillet 15h00, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,03 m/s, 14 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 5,92 m/s sur la ligne)
- **Confluence brise de Durance / Lombarde (La Vachette → descente de la Durance)** — `brianconnais-guisane/conv-lombarde-vachette`, Briançonnais · *donnée* · juillet 17h30, Lombarde (flux d’est) 15 km/h, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne 1,14 m/s, 42 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 10,93 m/s sur la ligne)
- **Confluence brise SE / vent météo d'O dans la vallée de Vallouise** — `ecrins-vallouise-haute-durance/conv-vallouise-brise-se-vent-ouest`, Vallouise – haute Durance · *donnée* · juillet 9h45, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne 0,02 m/s, 38 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 2,84 m/s sur la ligne)
- **Confluence brise montante / Lombarde descendant le Guil (Mont-Dauphin – Guillestre)** — `queyras/conv-mont-dauphin-lombarde-guil`, Queyras · *donnée* · juillet 15h15, Lombarde (flux d’est) 15 km/h, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne 0,46 m/s, 40 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 2,97 m/s sur la ligne)
- **Convergence mobile E/O sur le champ d'atterrissage de Thorenc (Col de Bleine)** — `prealpes-grasse-castellane/convergence-bleine-atterro`, Préalpes de Grasse · *donnée* · juillet 14h45, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,31 m/s, 33 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 0,21 m/s sur la ligne)
- **Confluence de la brise de la Bévéra et de la brise du col de Castillon à Sospel** — `mercantour/convergence-sospel-castillon`, Mercantour · *donnée* · juillet 16h30, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,18 m/s, 20 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 0,51 m/s sur la ligne)

### Thermiques (26)

- **Plaine de Troinex (départ thermique à l'atterrissage)** — `saleve-genevois/saleve-troinex-thermique`, Salève · *limite* · juillet 13h30 (heures non précisées : milieu de journée supposé)
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,31 (médiane 0,31, rang 42 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -25 m, altitude 419 m)
- **Falaise est des Quatre Têtes (Burzier)** — `arve-faucigny/quatre-tetes-falaise-est`, Faucigny – Arve · *modèle* · juillet 15h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Châtel : thermiques en plein après-midi sur l'atterrissage et à Morclan** — `chablais/chatel-atterro-thermique`, Chablais · *limite* · juillet 15h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,39 (médiane 0,47, rang 36 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -213 m, altitude 1162 m)
- **Alex – La Balme-de-Thuy (thermiques de la vallée du Fier)** — `bornes/alex-balme-de-thuy`, Bornes · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,33, rang 36 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -253 m, altitude 548 m)
- **Col des Aravis – faces sud, thermique « de la Vierge du Châtelard »** — `aravis/col-des-aravis-vierge`, Aravis · *limite* · juillet 13h30 (heures non précisées : milieu de journée supposé)
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,44 (médiane 0,47, rang 40 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -161 m, altitude 1487 m)
- **Versant Servoz / Plaine-Joux (transition vers Chedde)** — `mont-blanc-chamonix/versant-servoz-plaine-joux`, Chamonix – Mont-Blanc · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,41, rang 20 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -190 m, altitude 803 m)
- **Flégère – Index : thermiques tôt le matin** — `mont-blanc-chamonix/flegere-thermiques-matin`, Chamonix – Mont-Blanc · *modèle* · juillet 13h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 9h15 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Grande forêt du versant ouest du Prarion (Mont Paccard)** — `val-montjoie-saint-gervais/mont-paccard-foret-ouest`, Val Montjoie · *modèle* · juillet 15h15
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (14h00) ; obtenu 10h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Tête du Planet – Plateau des Benets (thermiques dès le matin)** — `val-arly-megeve/cordon-thermiques-matin`, Megève – Val d’Arly · *modèle* · juillet 13h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 9h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Montgirod - Arcachat : face sud-est du matin** — `tarentaise/montgirod-arcachat-se`, Tarentaise · *modèle* · juillet 12h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Prariond / Les Villards de Macot (La Plagne)** — `tarentaise/prariond-macot`, Tarentaise · *limite* · juillet 9h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,15 (médiane 0,18, rang 35 %)
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h15 (trop tard)
  - cause probable : pente peu ensoleillée à cette heure dans le modèle (ensoleillement 40 %, exposition 325°)
- **Col de la Loze / Lanches : thermiques d'hiver et de printemps** — `vanoise/col-de-la-loze-thermique`, Vanoise · *modèle* · juillet 14h45
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Falaise de Vérel (sortie de décollage)** — `bourget-chambery/verel-falaise`, Bourget – Chambéry · *modèle* · juillet 15h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h00) ; obtenu 10h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Face ouest de Chamrousse (Aiguille / Croix)** — `belledonne/chamrousse-face-ouest`, Belledonne · *modèle* · juillet 16h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (13h00) ; obtenu 9h45 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Parking et atterrissage de l'Aigle (déclenchements thermiques)** — `vercors-nord/aigle-parking-thermique`, Vercors nord · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,33 (médiane 0,36, rang 38 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -97 m, altitude 1022 m)
- **Thermique en avant (à l'ouest) du massif de l'Aigle** — `vercors-nord/aigle-thermique-avant-massif`, Vercors nord · *limite* · juillet 17h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,27 (médiane 0,27, rang 50 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -94 m, altitude 1009 m)
- **Escarpement rocheux à droite du déco de la Côte 2000 (1700 m)** — `vercors-nord/cote-2000-escarpement`, Vercors nord · *modèle* · juillet 15h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h30) ; obtenu 9h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Pointe de Bellecôte et Turra (thermique d'Aussois)** — `haute-maurienne/bellecote-turra`, Haute-Maurienne · *modèle* · juillet 14h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (13h00) ; obtenu 9h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Barres de Notre-Dame-des-Neiges (Prorel)** — `brianconnais-guisane/thermiques-notre-dame-des-neiges`, Briançonnais · *modèle* · juillet 15h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Crêtes du Granon** — `brianconnais-guisane/thermiques-granon-cretes`, Briançonnais · *modèle* · juillet 15h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h00) ; obtenu 9h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Confluences de la haute Durance (Briançon, L'Argentière)** — `ecrins-vallouise-haute-durance/thermiques-confluences-durance`, Vallouise – haute Durance · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,39 (médiane 0,44, rang 39 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -72 m, altitude 1475 m)
- **Faces du Mont Guillaume** — `serre-poncon-embrunais/thermiques-mont-guillaume`, Serre-Ponçon · *modèle* · juillet 15h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h00) ; obtenu 10h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Ceillac (faces sud de la combe)** — `queyras/thermiques-ceillac`, Queyras · *limite* · juillet 13h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,49 (médiane 0,54, rang 39 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -95 m, altitude 1817 m)
- **Col des Faïsses (Obiou)** — `devoluy/therm-faisses`, Dévoluy · *modèle* · juillet 15h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Bergiès (nord)** — `baronnies/therm-berges-nord`, Baronnies · *modèle* · juillet 12h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h00) ; obtenu 9h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Terrain d'atterrissage du lac (déclenche en plein après-midi)** — `saint-andre-verdon/atterro-lac-thermique`, Saint-André · *limite* · juillet 15h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,31 (médiane 0,36, rang 16 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -99 m, altitude 877 m)

### Pièges (41)

- **Le Môle : brise de vallée très forte au col-parking de Chez Berroud (strong-breeze)** — `arve-faucigny/mole-col-chez-berroud`, Faucigny – Arve · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 1,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Platière : par tendance S-SE le décollage près du parking est sous le vent (lee-rotor)** — `haut-giffre/platiere-sud-sous-le-vent`, Giffre · *limite* · juillet 14h00, vent météo de sud 40 km/h, 80 m sol, rayon 0,8 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,05, turbulence 0,05
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 10°)
- **Plateau des Saix : rouleaux par vent d'ouest (lee-rotor)** — `haut-giffre/samoens-saix-rouleaux-ouest`, Giffre · *limite* · juillet 14h00, vent météo d’ouest 30 km/h, 80 m sol, rayon 1,0 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,15, turbulence 0,14
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 11°)
- **La Bourgeoise : rouleaux en bout de crête par vent de sud et sud-ouest (lee-rotor)** — `haut-giffre/samoens-bourgeoise-rouleaux`, Giffre · *limite* · juillet 14h00, vent météo de S 30 km/h, 80 m sol, rayon 0,8 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,00, turbulence 0,07
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 0°)
- **Rafales de cumulonimbus du nord le long du lac (strong-breeze)** — `lac-annecy/lac-cumulonimbus-nord`, Lac d’Annecy · *limite* · juillet 17h30, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 17 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Anglettaz / Parmelan : rouleaux selon le régime de vent, CTR proche (lee-rotor)** — `bornes/anglettaz-rouleaux`, Bornes · *limite* · juillet 14h00, vent météo d’ouest 30 km/h, 80 m sol, rayon 1,5 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,00, turbulence 0,00
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max -1°)
- **Col des Aravis : la brise du col rentre en cours d'après-midi (strong-breeze)** — `aravis/col-des-aravis-brise-col`, Aravis · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 2,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 15 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Venturi entre Sulens et La Tulle (brise de Faverges) (venturi)** — `aravis/sulens-la-tulle-venturi`, Aravis · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 1,5 km
  - effet attendu : attendu vent ≥ 1,15 × médiane des fonds de vallée voisins (10 km) ; obtenu max 4 km/h (×0,26 la médiane 14 km/h), venturi 0,00
  - cause probable : pas de resserrement perpendiculaire au flux détecté à la maille de 216 m
- **Rochebrune : décollage dangereux par vent de sud-ouest (rouleaux) (lee-rotor)** — `val-arly-megeve/rochebrune-rouleaux-sud-ouest`, Megève – Val d’Arly · *limite* · juillet 14h00, vent météo de SO 30 km/h, 80 m sol, rayon 1,0 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,11, turbulence 0,13
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 11°)
- **Cordon / Combloux : brise de vallée dans le dos après 13h, foehn par tendance sud (strong-breeze)** — `val-arly-megeve/cordon-brise-vent-arriere`, Megève – Val d’Arly · *limite* · juillet 16h00, sans vent météo, 80 m sol, rayon 2,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 3 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Brise d'Ugine passant au-dessus de Bisanne : thermiques de la face sud submergés l'après-midi (strong-breeze)** — `val-arly-megeve/bisanne-brise-arly-dos`, Megève – Val d’Arly · *limite* · juillet 15h45, sans vent météo, 80 m sol, rayon 2,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 16 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Bisanne Sud : brise d'Ugine dans le dos après ~12h30, rouleaux par vent d'ouest (strong-breeze)** — `beaufortain/bisanne-dos-apres-midi`, Beaufortain · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 1,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 8 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Cormet de Roselend – Les Chapieux : « cocktail de brises » (col de la Seigne, Cormet) (strong-breeze)** — `beaufortain/cormet-chapieux-cocktail-brises`, Beaufortain · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 14 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Décollage de Vérel : sous le vent du thermique et de la brise (rouleaux) (lee-rotor)** — `bourget-chambery/verel-rouleaux-decollage`, Bourget – Chambéry · *limite* · juillet 14h30, vent météo de Sud 30 km/h, 80 m sol, rayon 1,0 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,02, turbulence 0,02
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 9°)
- **Novalaise : brise forte et posé interdit (strong-breeze)** — `bourget-chambery/epine-novalaise-brise-forte`, Bourget – Chambéry · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 2,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 7 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Montlambert par vent de Nord fort : protection limitée, 'sortir du bocal' (strong-breeze)** — `combe-de-savoie/montlambert-nord-fort`, Combe de Savoie · *limite* · juillet 14h00, vent météo de nord 20 km/h, 80 m sol, rayon 2,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Brise du Grésivaudan renforcée en soirée de forte canicule (au pied de Chamrousse) (strong-breeze)** — `gresivaudan/chamrousse-brise-soir-canicule`, Grésivaudan · *limite* · juillet 18h45, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 16 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Grand Colon : brise forte et turbulente (strong-breeze)** — `belledonne/grand-colon-brise`, Belledonne · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 2,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 8 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col de Pipay / Crêt du Poulet : point dur par brise de Fond de France (strong-breeze)** — `belledonne/pipay-point-dur`, Belledonne · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 2,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 12 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Sortie de déco turbulente au Belvédère (sous le vent de la crête) (lee-rotor)** — `vercors-nord/belvedere-deco-sous-le-vent-crete`, Vercors nord · *limite* · juillet 14h00, vent météo de nord 30 km/h, 80 m sol, rayon 0,6 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,00, turbulence 0,00
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max -1°)
- **Serpaton Est : venturi au sud et brise du Drac au nord (venturi)** — `vercors-est-sud/serpaton-est-venturi`, Vercors est & sud · *limite* · juillet 11h30, sans vent météo, 80 m sol, rayon 1,0 km
  - effet attendu : attendu vent ≥ 1,15 × médiane des fonds de vallée voisins (10 km) ; obtenu max 5 km/h (×0,51 la médiane 10 km/h), venturi 0,00
  - cause probable : pas de resserrement perpendiculaire au flux détecté à la maille de 216 m
- **Léoncel : renforcement du vent et aérologie souvent travers gauche (strong-breeze)** — `vercors-est-sud/leoncel-renforcement-vent`, Vercors est & sud · *limite* · juillet 12h30, sans vent météo, 80 m sol, rayon 1,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 4 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Verrou de Châtillon-en-Diois : brise divergeant vers l'ouest, vent reculant en basse couche (strong-breeze)** — `trieves/chatillon-verrou-brise`, Trièves · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 19 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Conest : brise dès 12h et cisaillements importants (strong-breeze)** — `matheysine/conest-cisaillement-brise-12h`, Matheysine – Drac · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 2,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Forte brise descendante du soir (Vallouise) (strong-breeze)** — `ecrins-vallouise-haute-durance/brise-descendante-soir-vallouise`, Vallouise – haute Durance · *limite* · juillet 18h45, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 17 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Déco d’Aspres saturé par la brise (strong-breeze)** — `buech-laragne-chabre/aspres-breeze-14-16`, Buëch – Chabre · *limite* · juillet 15h00, sans vent météo, 80 m sol, rayon 2,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 12 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Bascule ouest de l’après-midi : atterro sud inaccessible (strong-breeze)** — `buech-laragne-chabre/chabre-bascule-ouest`, Buëch – Chabre · *limite* · juillet 16h15, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Cuberselle : déco quasi falaise, brise trop forte (strong-breeze)** — `buech-laragne-chabre/cuberselle-brise`, Buëch – Chabre · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 1,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Mistral : flux canalisé dans le Buëch vers Sisteron (strong-breeze)** — `buech-laragne-chabre/buech-mistral-couloir`, Buëch – Chabre · *limite* · juillet 14h00, mistral (nord) 50 km/h, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 19 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col d'Ey : renforcement brutal du mistral et sous le vent de la brise d'ouest (strong-breeze)** — `baronnies/col-ey-mistral`, Baronnies · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 16 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Verrou de Châtillon-en-Diois : brise forte et recul en basse couche (strong-breeze)** — `diois/diois-chatillon-recul`, Diois · *limite* · juillet 15h30, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 19 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Bascule ouest de fin d’après-midi (Couspeau, Aucelon, Aurel) (strong-breeze)** — `diois/diois-bascule-ouest`, Diois · *limite* · juillet 17h30, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col de Volvent : brise d’ouest dès 12-14h (strong-breeze)** — `diois/diois-volvent-brise-ouest`, Diois · *limite* · juillet 13h00, sans vent météo, 80 m sol, rayon 3,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 5 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Montagne de Baise : pas de vent météo de nord ou de sud (strong-breeze)** — `diois/diois-baise-no`, Diois · *limite* · juillet 14h00, vent météo de nord 30 km/h, 80 m sol, rayon 1,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 16 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Brise soutenue et venturi au décollage Sud-Ouest du Chalvet (strong-breeze)** — `saint-andre-verdon/brise-forte-deco-so`, Saint-André · *limite* · juillet 16h00, sans vent météo, 80 m sol, rayon 0,8 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Oraison : entrées de vent brutales, brise trop sud, repose au déco interdite (strong-breeze)** — `prealpes-digne-lure/oraison-entrees-de-vent`, Digne – Lure · *limite* · juillet 14h45, sans vent météo, 80 m sol, rayon 1,5 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 15 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Gréolières par vent d'ouest : atterro sous la barre du village, déco 300 piégeux (lee-rotor)** — `prealpes-grasse-castellane/greolieres-ouest-turbulence`, Préalpes de Grasse · *limite* · juillet 14h00, vent météo d’ouest 30 km/h, 80 m sol, rayon 2,0 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,32, turbulence 0,33
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 13°)
- **Col de Bleine : turbulent par vent d'ouest fort, attention au Mistral (lee-rotor)** — `prealpes-grasse-castellane/bleine-ouest-mistral`, Préalpes de Grasse · *limite* · juillet 14h00, vent météo d’ouest 40 km/h, 80 m sol, rayon 2,0 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,00, turbulence 0,22
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 8°)
- **Roquebrune : rotors par vent d'est sur l'atterro, horaires restreints (lee-rotor)** — `prealpes-nice-var/roquebrune-rotors-est`, Préalpes de Nice · *limite* · juillet 14h00, vent météo d’est 30 km/h, 80 m sol, rayon 1,5 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,00, turbulence 0,00
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 3°)
- **Éze (Mont Bastide) : rotor de la crête par vent d'est, site fermé en été (lee-rotor)** — `prealpes-nice-var/eze-rotor-est`, Préalpes de Nice · *limite* · juillet 14h00, vent météo d’est 30 km/h, 80 m sol, rayon 1,0 km
  - effet attendu : attendu abri (sous le vent) ou turbulence ≥ 0,35 ; obtenu abri 0,23, turbulence 0,21
  - cause probable : relief au vent pas assez haut pour l’indice d’abri (angle max 12°)
- **Col de Tende : conditions très fortes en pleine journée (strong-breeze)** — `mercantour/col-de-tende-brise`, Mercantour · *limite* · juillet 14h45, sans vent météo, 80 m sol, rayon 2,0 km
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 5 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit

## Non testables

- brises · Le Pontias (vent descendant de l'Eygues sur Nyons) (catabatique) (`baronnies/pontias`) : tracé trop court
- convergences · Confluence brise thermique / vent de vallée à Boismint (Les Menuires) (`vanoise/confluence-boismint`) : Été (le catalogue indique le site « en été uniquement »)
- convergences · Confluence nuageuse La Terrasse / Tencin (observation de pilote, temps orageux) (`gresivaudan/confluence-nuageuse-la-terrasse-tencin`) : temps virant à l'orage (observée plusieurs fois, dont probablement la Coupe Icare 2014)
- convergences · Confluence agitée de front froid au niveau de Crolles – Lumbin (`gresivaudan/confluence-front-froid-crolles-lumbin`) : passage d'un front froid stagnant sur l'arc alpin, toute saison, à n'importe quel moment
- convergences · Confluence agitée Voreppe / Chambéry vers Crolles-Lumbin (front froid) (`grenoble-cuvette/confluence-crolles-lumbin-front-froid`) : en toute saison, à tout moment, quand un front froid stagne en bordure de la chaîne alpine
- convergences · Confluence des deux vallées au sud de Grenoble par flux de N/NE froid (`grenoble-cuvette/confluence-sud-grenoble-nne`) : masse d'air polaire maritime froide et instable, vent de N/NE fort en altitude (fig. 4)
- convergences · Confluence NO de Briançon / branche détournée par Gap–Embrun (vers Saint-Crépin) (`ecrins-vallouise-haute-durance/conv-nw-saint-crepin`) : vent météo de NO fort
- convergences · Confluence des flux de N de Briançon et de Gap (Saint-Clément → Embrun → baie Saint-Michel) (`serre-poncon-embrunais/conv-embrun-nord`) : vent météo de N
- convergences · Confluence de contournement de Saint-Genis (vent de sud-est) (`buech-laragne-chabre/convergence-contournement-saint-genis`) : Vent de sud-est (diapo 74 du diaporama « Brises et confluences »)
- convergences · Rencontre de la brise de Sisteron et du débord de Saint-Geniez devant Gâche / Trainon (`prealpes-digne-lure/convergence-gache-saint-geniez`) : régime de brise (printemps-été) ; plus marquée en pleine saison
- pièges · Plateau d'Orange (Sur Cou) : rentrées d'est turbulentes, marge nécessaire par ouest / sud-ouest (strong-breeze) (`arve-faucigny/orange-surcou-est-ouest`) : rentrées d'est fortes ; ouest ou sud-ouest marqué ; foins non coupés (atterrissage interdit au printemps et en été tant que l'herbe dépasse mi-tibia)
- pièges · Super Morzine : sortie turbulente par forte brise de vallée, rouleaux par nord, dégueulantes par sud (lee-rotor) (`chablais/super-morzine-sortie`) : brise de vallée forte ; vent météo de tendance nord ou sud ; instabilité marquée
- pièges · Rafales d'orage (bornan, môlan) sur la rive du Léman (strong-breeze) (`chablais/leman-bornan-molan`) : orages sur les Préalpes, grande chaleur ; sens sud-nord ; jusqu'à 120 km/h
- pièges · Bise sur le Léman : rafales ininterrompues (15 à 90 km/h) (strong-breeze) (`chablais/leman-bise-rafales`) : situation de beau temps froid et sec ; 3, 6 ou 9 jours d'affilée
- pièges · Coche Cabane par vent du nord : forts rouleaux (lee-rotor) (`lac-annecy/coche-cabane-nord`) : vent ou brise forte de nord
- pièges · Parmelan : entre la Tête à Turpin et le refuge, zone rafaleuse (strong-breeze) (`bornes/parmelan-tete-a-turpin`) : vent ouest–nord-ouest, sans cumulus, jour de cross vers le nord
- pièges · Merlet : rouleau du plateau de Coupeau et déco en dévers (lee-rotor) (`mont-blanc-chamonix/merlet-rouleau-coupeau`) : brise de vallée établie
- pièges · Accélération de la brise sur les « 2 Têtes » (virage de l'Isère) (venturi) (`tarentaise/acceleration-2-tetes`) : Régime de brise établi
- pièges · Versant est de l'Aiguille Rousse / combe de l'Aiguille Grive (lee-rotor) (`tarentaise/rotor-aiguille-rousse-est`) : Début d'après-midi, brise établie
- pièges · Venturi de la Moraine / glacier du Col (Val Thorens, Caron) (venturi) (`vanoise/venturi-moraine-caron`) : Brise thermique d'été en face sud ; vent en temps réel (balises de station)
- pièges · Sire Nord : décollage sous le vent d'une rangée de sapins (lee-rotor) (`bourget-chambery/sire-nord-sapins`) : brises (en général nord-ouest) l'après-midi
- pièges · Sous le vent de la brise de Chambéry au-dessus de Montmélian (lee-rotor) (`combe-de-savoie/sous-le-vent-montmelian`) : après-midi, brise de cluse établie (branche Albertville par-dessus la Savoyarde)
- pièges · Vallon entre le Mont Saint-Michel et le Montgelas : cisaillements violents (lee-rotor) (`bauges/savoyarde-vallon-cisaillements`) : toutes brises, après-midi d'été
- pièges · Col de Tamié : zone sous le vent, venturi (venturi) (`bauges/col-de-tamie-venturi`) : brise de vallée de Tamié (vol interdit à Plan des Languots par brise installée)
- pièges · Roc des Bœufs : zone sous le vent (brise du lac) et lignes électriques (lee-rotor) (`bauges/roc-des-boeufs-sous-le-vent`) : brise d'Annecy/lac établie, arrivée basse au sud du Roc
- pièges · Lescheraines – Allèves : atterrissage 'scotché sur place' par la brise (strong-breeze) (`bauges/lescheraines-alleves-scotche`) : brise de vallée établie (30-35 km/h possibles)
- pièges · Thermique maison devant les décollages de Saint-Hilaire (vent arrière au déco) (lee-rotor) (`chartreuse/thermique-devant-decos-st-hilaire`) : dès que l'activité thermique est établie (fin de matinée à 15h)
- pièges · Grand Ratz : rouleaux au décollage et thermique violent en sortie de déco (lee-rotor) (`chartreuse/ratz-rouleaux`) : après-midi thermique ; sud forcissant
- pièges · Collet d'Allevard : Venturi vers la vallée du Veyton et en dessous des décollages (venturi) (`belledonne/collet-veyton-venturi`) : brise ou nord fort ; sans brise le déco Malatrait est sous le vent du nord (travers droit)
- pièges · Digue d'Allevard (lac) : Venturi, très fortes rafales et survol du lac interdit (venturi) (`belledonne/allevard-digue-venturi`) : brise soutenue d'été ou nord ; ne jamais dépasser la digue
- pièges · Collet d'Allevard : sud souvent plus fort en vallée et à la station qu'au décollage (strong-breeze) (`belledonne/allevard-sud-fort`) : sud marqué ; Super-Collet interdit sans neige (APPB)
- pièges · Rouleaux de brise à la « Vierge du Vercors » (Pas de Saint-Martin) (lee-rotor) (`vercors-nord/saint-martin-vierge-rouleaux`) : Brise forte de l'après-midi, renforcée par le vent du nord.
- pièges · Décollement du thermique devant le déco de Saint-Martin (lee-rotor) (`vercors-nord/pas-saint-martin-decollement-thermique`) : Journées très fortes, 13h-17h.
- pièges · Passages du Cornafion et du plateau des Ramées (départ de cross vers le Moucherotte) (lee-rotor) (`vercors-nord/cornafion-moucherotte-passages-turbulents`) : Départ de cross de la Côte 2000 vers le nord, après-midi.
- pièges · Limouches : cirque de Peyrus par vent de nord fort, vent de plaine renforcé (strong-breeze) (`vercors-est-sud/limouches-cirque-peyrus`) : Renforcement du vent météo (influence de la vallée du Rhône) ; site sous le vent de l'est.
- pièges · Effets venturi et vent fort au déco de Plan Lachat (Valloire–Galibier) (venturi) (`arves-thabor-galibier/venturi-plan-lachat-galibier`) : Brise de nord établie ; vent météo E à O défavorable.
- pièges · Col du Lautaret – venturis au sommet et sur les buttes (venturi) (`brianconnais-guisane/venturi-lautaret`) : vents d'O/NO ou d'E/NE soutenus ; brises de printemps et d'été
- pièges · Sous le vent des Forts (brise classique) (lee-rotor) (`brianconnais-guisane/sous-le-vent-forts-briancon`) : brise de Durance forte
- pièges · Faces ouest Tête d'Amont – Condamine : sous le vent de la brise (lee-rotor) (`ecrins-vallouise-haute-durance/sous-le-vent-tete-amont-condamine`) : brise forte (journée)
- pièges · Tête du Puy : sous le vent en brise classique (lee-rotor) (`ecrins-vallouise-haute-durance/sous-le-vent-tete-du-puy`) : brise de Durance forte
- pièges · Risoul : sous le vent en brise classique (lee-rotor) (`ecrins-vallouise-haute-durance/risoul-sous-le-vent`) : brise de Durance
- pièges · Réallon : déco SE sous le vent de la brise de SW l'après-midi (lee-rotor) (`serre-poncon-embrunais/reallon-sous-le-vent-sw`) : après-midi
- pièges · Le Cristillan : atterro possible mais sous le vent, venturi (venturi) (`queyras/cristillan-venturi`) : brise forte
- pièges · Col de l'Izoard : déco vent arrière par tendance O à N (lee-rotor) (`queyras/izoard-vent-arriere`) : tendance O à N, même très faible ; printemps-été très musclé
- pièges · Saint-Ours / Larche : vent d'E-SE par le col de l'Arche, sous le vent du col de Mirandol (lee-rotor) (`ubaye/saint-ours-col-arche`) : SE et E ; O et N fort
- pièges · Plateau d’Aurouze et station sous le vent de la tête de Pied Gros (lee-rotor) (`devoluy/aurouze-sous-le-vent`) : Brise de vallée de sud, été
- pièges · Tête de la Clape : site du matin, sous le vent du SO l’après-midi (lee-rotor) (`gapencais-ceuse/clape-matin`) : À partir de la mi-journée
- pièges · Décollage Nord 1 : rouleaux par vent O-NO (lee-rotor) (`buech-laragne-chabre/chabre-nord1-rotors`) : Vent de tendance ouest à nord-ouest
- pièges · Nyons – Garde-Grosse : travers N-NE, ouest fort, ligne HT (strong-breeze) (`baronnies/nyons-dangers`) : Vent de travers (N-NE) ou ouest fort
- pièges · Col de Milmandre : décollage dans un venturi (venturi) (`baronnies/milmandre-venturi`) : Brise souvent puissante au décollage (printemps-été)
- pièges · Solaure sous le vent dès que la brise de la Drôme arrive (lee-rotor) (`diois/diois-solaure-sous-le-vent`) : Brise d'ouest/nord-ouest de la vallée (à partir de la fin de matinée)
- pièges · Col des Robines et falaises du passage vers l'ouest (lee-rotor) (`saint-andre-verdon/col-des-robines-turbulence`) : brise d'ouest établie l'après-midi ; retour de cross vers le Chalvet / Moriez

## Défauts de données à corriger dans les notes de recherche

Repérés automatiquement ; à corriger dans les JSON de `research_notes/`, pas dans l’atlas compilé. Le fichier indiqué est celui de la première source citée (une source partagée est rattachée au premier fichier qui la cite) : à confirmer avec le préfixe de l’identifiant (secteur).

- `bornes/brise-parmelan-dingy` (annecy_bornes_aravis.json) : horaires non analysables (« non documenté ») : la brise suit le cycle générique de vallée
- `tarentaise/brise-isere-tarentaise` (tarentaise_vanoise.json) : vitesse typique 30 km/h, au-dessus des valeurs typiques (brise de vallée 3–7 m/s ≈ 10–25 km/h, S3 ; 30–40 km/h seulement en quelques sites connus) : valeur de pointe plutôt que typique ? Le modèle l’applique sur tout le couloir pendant toute la fenêtre
- `tarentaise/brise-petit-saint-bernard` (tarentaise_vanoise.json) : horaires non analysables (« Non documenté en régime de brise ; flux inverse (Italie → Bourg-Saint-Maurice) lors du foehn, à toute heure ») : la brise suit le cycle générique de vallée
- `maurienne/brise-montante-maurienne` (oisans_maurienne.json) : vitesse typique 35 km/h, au-dessus des valeurs typiques (brise de vallée 3–7 m/s ≈ 10–25 km/h, S3 ; 30–40 km/h seulement en quelques sites connus) : valeur de pointe plutôt que typique ? Le modèle l’applique sur tout le couloir pendant toute la fenêtre
- `haute-maurienne/brise-montante-haute-maurienne` (oisans_maurienne.json) : vitesse typique 30 km/h, au-dessus des valeurs typiques (brise de vallée 3–7 m/s ≈ 10–25 km/h, S3 ; 30–40 km/h seulement en quelques sites connus) : valeur de pointe plutôt que typique ? Le modèle l’applique sur tout le couloir pendant toute la fenêtre
- `brianconnais-guisane/brise-durance-basse-guisane` (brianconnais_ecrins_queyras_ubaye.json) : vitesse typique 30 km/h, au-dessus des valeurs typiques (brise de vallée 3–7 m/s ≈ 10–25 km/h, S3 ; 30–40 km/h seulement en quelques sites connus) : valeur de pointe plutôt que typique ? Le modèle l’applique sur tout le couloir pendant toute la fenêtre
- `ecrins-vallouise-haute-durance/brise-durance-embrun-briancon` (brianconnais_ecrins_queyras_ubaye.json) : vitesse typique 30 km/h, au-dessus des valeurs typiques (brise de vallée 3–7 m/s ≈ 10–25 km/h, S3 ; 30–40 km/h seulement en quelques sites connus) : valeur de pointe plutôt que typique ? Le modèle l’applique sur tout le couloir pendant toute la fenêtre
- `diois/brise-trieves-lus` (devoluy_gap_buech_diois.json) : horaires non analysables (« sans horaire dans les sources (régime de brise d'été) ») : la brise suit le cycle générique de vallée
- `prealpes-digne-lure/brise-pente-lure-sud-contras` (provence_maritimes.json) : horaires non analysables (« régime de brise orienté S à SSO ; SE léger < 20 km/h ; convection l'été « très puissante » ») : la brise suit le cycle générique de vallée
- `prealpes-nice-var/brise-de-mer-roquebrune` (provence_maritimes.json) : horaires non analysables (« jour ; site volé surtout l'hiver et en arrière-saison (voir restrictions horaires) ») : la brise suit le cycle générique de vallée
- `mercantour/brise-haut-var` (provence_maritimes.json) : horaires non analysables (« l'été : brises plus fortes (traversée aventureuse) ; printemps : volable ; la brise peut venir de Puget-Théniers plutôt que du haut Var au Dôme de Barrot ») : la brise suit le cycle générique de vallée
- `haut-giffre/brise-pente-pertuiset-platiere` (chablais_giffre_arve.json) : hors de ses horaires (14h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `lac-annecy/brise-descendante-taillefer-charbon` (annecy_bornes_aravis.json) : hors de ses horaires (14h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `beaufortain/brise-pente-roselend-soir` (montblanc_beaufortain.json) : hors de ses horaires (14h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `oisans-grandes-rousses/huez-brise-de-pente` (vercors_grenoble_trieves.json) : hors de ses horaires (10h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `mercantour/brise-bevera-sospel` (provence_maritimes.json) : hors de ses horaires (14h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `beaufortain/brise-descendante-doron ↔ tarentaise/brise-chapieux-roselend` (montblanc_beaufortain.json) : brises opposées dans le même couloir aux mêmes heures (20h30–9h30 / 20h30–9h30, cos -0,99), sans condition qui les distingue : elles se remplacent cellule par cellule. Ajouter un champ `condition` à celle qui n’existe que dans certaines situations, ou corriger le sens d’un tracé.
- `gresivaudan/brise-voreppe ↔ alpes-francaises/isere-gresivaudan-combe-de-savoie-gresivaudan` (bauges_bourget_combe.json) : brises opposées dans le même couloir aux mêmes heures (11h00–19h00 / 11h00–19h00, cos -0,98), sans condition qui les distingue : elles se remplacent cellule par cellule. Ajouter un champ `condition` à celle qui n’existe que dans certaines situations, ou corriger le sens d’un tracé.
- `arves-thabor-galibier/brise-arvan ↔ alpes-francaises/briffe-durance-vers-maurienne` (oisans_maurienne.json) : brises opposées dans le même couloir aux mêmes heures (11h00–18h30 / 13h00–18h00, cos -0,82), sans condition qui les distingue : elles se remplacent cellule par cellule. Ajouter un champ `condition` à celle qui n’existe que dans certaines situations, ou corriger le sens d’un tracé.
- `brianconnais-guisane/brise-durance-basse-guisane ↔ brianconnais-guisane/transfert-lautaret-guisane` (brianconnais_ecrins_queyras_ubaye.json) : brises opposées dans le même couloir aux mêmes heures (10h00–19h00 / 8h00–11h30, cos -1,00), sans condition qui les distingue : elles se remplacent cellule par cellule. Ajouter un champ `condition` à celle qui n’existe que dans certaines situations, ou corriger le sens d’un tracé.
- `ecrins-vallouise-haute-durance/brise-montante-gyronde ↔ ecrins-vallouise-haute-durance/brise-descendante-vallouise` (brianconnais_ecrins_queyras_ubaye.json) : brises opposées dans le même couloir aux mêmes heures (10h00–19h00 / 17h00–20h30, cos -1,00), sans condition qui les distingue : elles se remplacent cellule par cellule. Ajouter un champ `condition` à celle qui n’existe que dans certaines situations, ou corriger le sens d’un tracé.
- `queyras/brise-guil ↔ queyras/brise-arvieux-izoard` (brianconnais_ecrins_queyras_ubaye.json) : brises opposées dans le même couloir aux mêmes heures (12h30–18h30 / 12h00–19h00, cos -0,99), sans condition qui les distingue : elles se remplacent cellule par cellule. Ajouter un champ `condition` à celle qui n’existe que dans certaines situations, ou corriger le sens d’un tracé.
- `ecrins-vallouise-haute-durance/brise-descendante-vallouise` (brianconnais_ecrins_queyras_ubaye.json) : le modèle souffle partout à l’opposé du tracé : tracé peut-être inversé (à vérifier dans la source)
- `ubaye/brise-larche-italie` (brianconnais_ecrins_queyras_ubaye.json) : le modèle souffle partout à l’opposé du tracé : tracé peut-être inversé (à vérifier dans la source)
