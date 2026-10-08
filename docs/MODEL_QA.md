# Contrôle du modèle de vent contre l’atlas

Généré par `npm run model:check` le 2026-10-08 sur `apps/web/public/data/atlas.json` (atlas du 2026-10-08), modèle TypeScript de référence (`packages/model`) sur le MNT réel. Durée : 11,4 s.

## Critères

- **Brises** : échantillons le long du tracé (10 à 90 % de sa longueur), au milieu de la fenêtre horaire, en juillet sans vent météo (janvier pour une brise d’hiver ; vent météo ou canicule simulés pour une brise conditionnelle). Niveaux : sol (50 m), puis 30 % et 60 % de la couche : altitude atteinte documentée (« Épaisseur » : « sensible jusqu’à 2500 m d’altitude », mesurée depuis le fond de vallée), sinon épaisseur documentée, sinon profondeur locale de la vallée pour les brises de vallée, 200 m pour la pente, 100 m pour un catabatique, 1000 m pour plaine → montagne et régionale. Sens : cos > 0.5 sur au moins 60 % des points. Vitesse (si documentée) : rapport médian modèle / fiche entre 0,5 et 1,6 au sol et à 30 %, au moins 0,3 à 60 % (la brise faiblit vers le haut de la couche, Zardi & Whiteman 2013). Hors horaires (2 h 30 avant le début, ou après la fin) et hors condition : composante le long du tracé < 30 % de la vitesse documentée.
- **Convergences** : convergence du modèle (divergence lissée, comme la couche « Convergences ») à 80 m sol, à l’heure de « Quand », avec une tolérance d’une maille (216 m) autour de la ligne : moyenne > 0 et au moins la moitié des points > 0.
- **Thermiques** : potentiel thermique (max sur 3 × 3 mailles, positions approchées) au-dessus de la médiane des terres dans un rayon de 5 km, aux heures « Heures » (12h–15h si non précisées) ; et, quand un début est documenté, colonne thermique affichée (potentiel ≥ 0,22, seuil des colonnes des sites connus) à ±1 h d’un début explicite (« dès 10h », « 3 h après le lever du soleil »), sinon au plus tard au milieu de la période documentée (1 h après son début pour une période courte).
- **Pièges** : venturi, sous le vent, foehn et brise forte, sous le vent météo cité par « Conditions » (30 km/h par défaut, 40 si « fort », 15 si « faible ») ou à l’heure de brise citée, au point même (à 330 m près), avec la couche des dangers documentés (ce que voit l’utilisateur) et, à titre indicatif, par le modèle de relief seul : accélération ≥ ×1,15 par rapport à la médiane des fonds de vallée voisins (10 km) ou indice venturi ≥ 0,3 ; abri ou turbulence ≥ 0,35 ; vent descendant ≥ 0,8 × vent météo ou turbulence ≥ 0,3 ; vent ≥ 20 km/h. Sans vent ni horaire cité : non testable.

## Taux de réussite par catégorie

| Catégorie | Réussis | Testés | Taux | Non testables |
| --- | --- | --- | --- | --- |
| brises | 258 | 275 | 94 % | 2 |
| convergences | 62 | 72 | 86 % | 9 |
| thermiques | 713 | 823 | 87 % | 0 |
| pièges | 113 | 161 | 70 % | 49 |
| **total** | **1146** | **1331** | **86 %** | 60 |

Pièges au point par le modèle de relief seul (sans la couche des dangers documentés) : 82/161 (51 %), dont sous le vent 31/53. Le reste n’apparaît que par la couche des dangers documentés, active quand le vent simulé correspond à leurs conditions.

Contrôle : décollages face au vent (première orientation documentée, 20 km/h) affichés sous le vent ou turbulents : 10/462 (2,2 %) — Aouille de Criou (Samoëns) (S) ; Grand Châtelard (accès par Jarrier) (SW) ; Saint-François-Longchamp – télésiège de la Lauzière (FFVL 2323) (N) ; Les Orres – Costias (Haut Forest) (S, danger documenté « Les Orres : sous le vent de la crête par S et E ») ; Soleil Bœuf (N) ; Col des Faïsses (W) ; Chauvet (face au col du Festre) (NE) ; Buc Est – La Tanière (E, danger documenté « Venturi entre Buc et Le Fort ») ; Jocou (Lus-la-Croix-Haute / Châtillon) (S, danger documenté « Jocou : venturi de vent de sud à l’est du sommet ») ; Chalvet Nord (peu utilisé) (N, danger documenté « Décollages du Chalvet sous le vent par Mistral (N/NO) »).

Contrôles élémentaires des brises :

| Contrôle | Réussis | Testés | Taux |
| --- | --- | --- | --- |
| condition | 0 | 1 | 0 % |
| hors condition | 11 | 11 | 100 % |
| hors horaires | 235 | 241 | 98 % |
| sens, 30 % couche | 257 | 264 | 97 % |
| sens, 30 % de l’altitude atteinte | 10 | 10 | 100 % |
| sens, 60 % couche | 258 | 265 | 97 % |
| sens, 60 % de l’altitude atteinte | 9 | 10 | 90 % |
| sens, sol | 268 | 275 | 97 % |
| tracé | 0 | 1 | 0 % |
| vitesse, 30 % couche | 124 | 126 | 98 % |
| vitesse, 30 % de l’altitude atteinte | 10 | 10 | 100 % |
| vitesse, 60 % couche | 125 | 126 | 99 % |
| vitesse, 60 % de l’altitude atteinte | 9 | 10 | 90 % |
| vitesse, sol | 134 | 136 | 99 % |

Calendrier : déclenchement des thermiques au début explicite (« dès 10h », « à partir de midi », « 3 h après le lever du soleil ») : écart médian modèle − fiche -0,50 h sur 64 sites (21 trop tôt, 13 trop tard). Les heures « après-midi » ou « 12h-17h » des fiches de thermiques décrivent souvent la meilleure période plutôt que le déclenchement : seuls les débuts explicites mesurent un décalage systématique.

## Taux de réussite par secteur

| Secteur | Brises | Convergences | Thermiques | Pièges | Total |
| --- | --- | --- | --- | --- | --- |
| Alpes françaises | 25/25 | 13/13 | – | 6/6 | 44/44 |
| Aravis | 7/7 | 1/2 | 23/23 | 1/3 | 32/35 |
| Arves – Galibier | 2/3 | – | 7/9 | – | 9/12 |
| Baronnies | 7/7 | – | 17/22 | 2/4 | 26/33 |
| Bauges | 8/8 | 4/5 | 15/17 | 0/2 | 27/32 |
| Beaufortain | 3/4 | 1/2 | 12/13 | 1/3 | 17/22 |
| Belledonne | 12/12 | 2/2 | 24/25 | 3/5 | 41/44 |
| Bornes | 3/3 | 2/2 | 10/11 | 2/2 | 17/18 |
| Bourget – Chambéry | 5/7 | 1/1 | 14/14 | 4/5 | 24/27 |
| Briançonnais | 6/7 | 2/3 | 7/12 | 6/7 | 21/29 |
| Buëch – Chabre | 6/6 | 3/3 | 14/16 | 2/7 | 25/32 |
| Chablais | 8/8 | – | 18/20 | 5/5 | 31/33 |
| Chamonix – Mont-Blanc | 5/5 | – | 19/24 | 1/1 | 25/30 |
| Champsaur | 2/3 | 1/1 | 14/16 | 0/1 | 17/21 |
| Chartreuse | 12/15 | 2/2 | 38/40 | 3/3 | 55/60 |
| Combe de Savoie | 3/4 | – | 16/19 | 1/2 | 20/25 |
| Cuvette grenobloise | 7/7 | 1/1 | 7/7 | 2/2 | 17/17 |
| Dévoluy | 1/1 | 1/1 | 7/8 | 1/1 | 10/11 |
| Digne – Lure | 5/5 | – | 16/17 | 3/5 | 24/27 |
| Diois | 10/10 | – | 22/28 | 5/9 | 37/47 |
| Faucigny – Arve | 6/7 | – | 12/16 | 6/7 | 24/30 |
| Gapençais – Céüse | 4/4 | 1/1 | 7/9 | 2/2 | 14/16 |
| Giffre | 3/4 | – | 22/22 | 4/4 | 29/30 |
| Grésivaudan | 5/5 | 2/3 | 1/1 | 1/2 | 9/11 |
| Haut-Verdon | 1/1 | 2/2 | 24/25 | – | 27/28 |
| Haute-Maurienne | 4/4 | – | 11/14 | 4/4 | 19/22 |
| Lac d’Annecy | 10/10 | 5/6 | 27/29 | 2/3 | 44/48 |
| Matheysine – Drac | 2/3 | – | 13/14 | 4/7 | 19/24 |
| Maurienne | 5/5 | – | 15/17 | 5/5 | 25/27 |
| Megève – Val d’Arly | 3/4 | 1/2 | 8/11 | 1/4 | 13/21 |
| Mercantour | 8/8 | 1/2 | 26/28 | 3/5 | 38/43 |
| Oisans | 7/7 | 1/1 | 28/34 | 2/3 | 38/45 |
| Préalpes de Grasse | 3/3 | 3/4 | 21/24 | 3/4 | 30/35 |
| Préalpes de Nice | 5/5 | 1/1 | 16/19 | 2/2 | 24/27 |
| Queyras | 7/7 | 1/1 | 16/19 | 1/1 | 25/28 |
| Saint-André | 3/4 | 1/1 | 11/13 | 1/2 | 16/20 |
| Salève | 4/4 | – | 5/7 | 1/1 | 10/12 |
| Serre-Ponçon | 2/3 | – | 13/17 | 4/5 | 19/25 |
| Tarentaise | 8/8 | 4/4 | 26/32 | 5/5 | 43/49 |
| Trièves | 2/2 | – | 10/14 | 1/2 | 13/18 |
| Ubaye | 4/4 | – | 6/6 | 2/4 | 12/14 |
| Val Montjoie | 2/2 | 2/2 | 10/10 | 1/1 | 15/15 |
| Vallouise – haute Durance | 6/7 | 1/2 | 24/29 | 5/6 | 36/44 |
| Vanoise | 4/4 | – | 11/12 | 1/3 | 16/19 |
| Vercors est & sud | 6/6 | – | 24/26 | 1/3 | 31/35 |
| Vercors nord | 7/7 | 2/2 | 26/34 | 3/3 | 38/46 |

## Échecs

Classement : **modèle** = défaut du modèle à corriger ; **donnée** = tracé, horaires ou couloirs de la fiche à revoir (voir la dernière section) ; **limite** = limite assumée du modèle (résolution 216 m, pas de dynamique de foehn, pas d’accélération des brises aux cols, convexité à l’échelle de 1,5 km pour le potentiel thermique, pondération par la confiance des sources).

| Catégorie | modèle | donnée | limite |
| --- | --- | --- | --- |
| brises | 5 | 6 | 6 |
| convergences | 3 | 7 | 0 |
| thermiques | 46 | 0 | 64 |
| pièges | 0 | 0 | 48 |

### Brises (17)

- **Brise montante de la basse vallée de l'Arve (Annemasse → Bonneville → Marignier → Cluses) (vallée)** — `arve-faucigny/arve-basse-vallee-montante`, Faucigny – Arve · *modèle* · juillet 16h15, sans vent météo · couches : altitude atteinte documentée 2500 m
  - sens, 60 % de l’altitude atteinte : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,72)
  - vitesse, 60 % de l’altitude atteinte : attendu 6–32 km/h (doc. 20 km/h) ; obtenu 2 km/h
  - cause probable : 60 % de l’altitude atteinte : flux générique opposé (vent météo 0 km/h le long du tracé) malgré la brise documentée (poids 0,71) ; 60 % de l’altitude atteinte : vitesse documentée diluée : poids 0,71, activité 100 %, apport principal plaine/lac/mer 0 km/h
- **Brise de pente et restitution du versant SO-O de la Platière / Pertuiset (Mieussy → décollages) (pente)** — `haut-giffre/brise-pente-pertuiset-platiere`, Giffre · *limite* · juillet 18h45, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (14h30) : attendu composante < 2 km/h ; obtenu 3 km/h (10 km/h avec l’écoulement nocturne et les autres brises documentées)
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique 1 km/h, plaine/lac/mer 0 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Écoulement descendant matinal de Megève vers le bassin de Sallanches (Megève → Combloux → Lépigny → Sallanches), déduction (descendante)** — `val-arly-megeve/brise-matinale-descendante-arve-megeve`, Megève – Val d’Arly · *donnée* · juillet 3h00, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,52)
  - cause probable : 60 % profondeur : cellules attribuées à une autre brise documentée : val-arly-megeve/brise-arve-vers-megeve (poids propre moyen 0,00)
- **Brise de vallée remontant le vallon de Roselend et soleil sur les parois NO (vol du soir) (pente)** — `beaufortain/brise-pente-roselend-soir`, Beaufortain · *limite* · juillet 18h45, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (14h30) : attendu composante < 2 km/h ; obtenu 4 km/h (6 km/h avec l’écoulement nocturne et les autres brises documentées)
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique 2 km/h, plaine/lac/mer 0 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Restitution du soir d'Aiguebelette (pentes au-dessus du lac) (pente)** — `bourget-chambery/restitution-aiguebelette`, Bourget – Chambéry · *limite* · juillet 19h30, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (15h30) : attendu composante < 2 km/h ; obtenu 5 km/h (13 km/h avec l’écoulement nocturne et les autres brises documentées)
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique 2 km/h, plaine/lac/mer -0 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Brise redescendante du sommet de Montlambert (fin d'après-midi) (catabatique)** — `combe-de-savoie/brise-descendante-montlambert`, Combe de Savoie · *donnée* · juillet 3h00, sans vent météo · couches : écoulement descendant 3–100 m (S3)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian 0,06)
  - sens, 30 % couche (30 m sol) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian 0,06)
  - sens, 60 % couche (60 m sol) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 0 % (cos médian 0,05)
  - cause probable : sol (50 m) : poids de la brise documentée faible sur le tracé (0,10) : tracé hors du fond de vallée ou en bout de couloir ; 30 % couche (30 m sol) : poids de la brise documentée faible sur le tracé (0,10) : tracé hors du fond de vallée ou en bout de couloir ; 60 % couche (60 m sol) : poids de la brise documentée faible sur le tracé (0,10) : tracé hors du fond de vallée ou en bout de couloir
- **Brise montante du Manival (Saint-Ismier vers Col de Baure) (vallée)** — `chartreuse/brise-montante-manival`, Chartreuse · *donnée* · juillet 14h45, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 25 % (cos médian -0,47)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 25 % (cos médian -0,56)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 25 % (cos médian -0,56)
  - cause probable : sol (50 m) : cellules attribuées à une autre brise documentée : gresivaudan/brise-nord-gresivaudan (poids propre moyen 0,00) ; 30 % profondeur : cellules attribuées à une autre brise documentée : gresivaudan/brise-nord-gresivaudan (poids propre moyen 0,00) ; 60 % profondeur : cellules attribuées à une autre brise documentée : gresivaudan/brise-nord-gresivaudan (poids propre moyen 0,00)
- **Brise des hautes vallées vers le Col du Cucheron (Saint-Pierre-d'Entremont) (transfert de col)** — `chartreuse/brise-cucheron-entremont`, Chartreuse · *modèle* · juillet 14h45, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,73)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,72)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,72)
  - cause probable : sol (50 m) : flux générique opposé (vent météo 0 km/h le long du tracé) malgré la brise documentée (poids 0,41) ; 30 % profondeur : flux générique opposé (vent météo 0 km/h le long du tracé) malgré la brise documentée (poids 0,41) ; 60 % profondeur : flux générique opposé (vent météo 0 km/h le long du tracé) malgré la brise documentée (poids 0,41)
- **Brise d'ouest de l'après-midi sur les faces ouest (Grand Ratz, Grande Sûre) (pente)** — `chartreuse/brise-ouest-apres-midi`, Chartreuse · *limite* · juillet 17h00, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (12h30) : attendu composante < 2 km/h ; obtenu 4 km/h
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique 0 km/h, plaine/lac/mer 1 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Vent du nord thermique des lacs de Laffrey (plateau matheysin) (plaine → montagne)** — `matheysine/laffrey-nord-plateau`, Matheysine – Drac · *donnée* · juillet 15h30, sans vent météo · couches : aspiration plaine → montagne ≈ 1000 m (S4)
  - vitesse, sol (50 m) : attendu 12–37 km/h (doc. 23 km/h) ; obtenu 10 km/h
  - vitesse, 30 % couche (300 m sol) : attendu 12–37 km/h (doc. 23 km/h) ; obtenu 10 km/h
  - cause probable : sol (50 m) : cellules attribuées à une autre brise documentée : matheysine/drac-matheysine-champsaur (poids propre moyen 0,07) ; 30 % couche (300 m sol) : cellules attribuées à une autre brise documentée : matheysine/drac-matheysine-champsaur (poids propre moyen 0,07)
- **Thermique de la station de Valmeinier (brise de pente et thermique à l'atterrissage) (pente)** — `arves-thabor-galibier/valmeinier-thermique-station`, Arves – Galibier · *modèle* · juillet 15h30, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 44 % (cos médian 0,42)
  - sens, 30 % couche (60 m sol) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 44 % (cos médian 0,45)
  - sens, 60 % couche (120 m sol) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 56 % (cos médian 0,52)
  - cause probable : sol (50 m) : flux générique opposé (vallée générique -1 km/h le long du tracé) malgré la brise documentée (poids 0,43) ; 30 % couche (60 m sol) : flux générique opposé (vallée générique -1 km/h le long du tracé) malgré la brise documentée (poids 0,43) ; 60 % couche (120 m sol) : flux générique opposé (vallée générique -1 km/h le long du tracé) malgré la brise documentée (poids 0,42)
- **Brise de pente du Prorel (Saint-Blaise → Notre-Dame-des-Neiges → Croix de la Nore) (pente)** — `brianconnais-guisane/brise-pente-prorel`, Briançonnais · *limite* · juillet 15h30, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (10h00) : attendu composante < 2 km/h ; obtenu 3 km/h
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 3 km/h, vallée générique -0 km/h, plaine/lac/mer -0 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Brise descendante du soir et catabatique de Vallouise (Ailefroide → Pelvoux → Vallouise → Les Vigneaux) (descendante)** — `ecrins-vallouise-haute-durance/brise-descendante-vallouise`, Vallouise – haute Durance · *donnée* · juillet 2h15, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - vitesse, sol (50 m) : attendu 10–32 km/h (doc. 20 km/h) ; obtenu 5 km/h
  - vitesse, 30 % profondeur : attendu 10–32 km/h (doc. 20 km/h) ; obtenu 5 km/h
  - vitesse, 60 % profondeur : attendu 6–32 km/h (doc. 20 km/h) ; obtenu 3 km/h
  - cause probable : sol (50 m) : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00) ; 30 % profondeur : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00) ; 60 % profondeur : cellules attribuées à une autre brise documentée : ecrins-vallouise-haute-durance/brise-montante-gyronde (poids propre moyen 0,00)
- **Brise du lac de Serre-Ponçon (lac → pentes de Saint-Vincent et de Savines) (lac)** — `serre-poncon-embrunais/brise-lac-serre-poncon`, Serre-Ponçon · *donnée* · juillet 15h15, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,49)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 33 % (cos médian 0,19)
  - cause probable : sol (50 m) : poids de la brise documentée faible sur le tracé (0,34) : tracé hors du fond de vallée ou en bout de couloir ; 30 % profondeur : cellules attribuées à une autre brise documentée : alpes-francaises/ubaye (poids propre moyen 0,28)
- **Flux de la cuvette de Gap vers le Champsaur par le col Bayard (deux sens rapportés) (transfert de col)** — `champsaur-valgaudemar/brise-gap-col-bayard`, Champsaur · *modèle* · juillet 15h30, sans vent météo · couches : profondeur locale de la vallée (crêtes − fond)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 58 % (cos médian 0,77)
  - sens, 30 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,72)
  - sens, 60 % profondeur : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,71)
  - cause probable : sol (50 m) : flux générique opposé (vallée générique -0 km/h le long du tracé) malgré la brise documentée (poids 0,37) ; 30 % profondeur : flux générique opposé (vallée générique -0 km/h le long du tracé) malgré la brise documentée (poids 0,37) ; 60 % profondeur : flux générique opposé (vallée générique -0 km/h le long du tracé) malgré la brise documentée (poids 0,37)
- **Brise de pente de la face SE du Chalvet (matin) (pente)** — `saint-andre-verdon/brise-pente-chalvet-sud-est`, Saint-André · *limite* · juillet 14h45, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - hors horaires (8h00) : attendu composante < 2 km/h ; obtenu 3 km/h (-1 km/h avec l’écoulement nocturne et les autres brises documentées)
  - cause probable : hors horaires : composante dans le sens du tracé hors horaires : pente 2 km/h, vallée générique -3 km/h, plaine/lac/mer -0 km/h, vent météo 0 km/h (brise documentée active à 0 %)
- **Brise de pente de l'après-midi vers le Belvédère de Sapenay (pente)** — `bourget-chambery/ffvl1113-brise-pente-sapenay-belvedere`, Bourget – Chambéry · *modèle* · juillet 17h30, sans vent météo · couches : brise de pente 100–200 m (S1, règle cycle-brise-pente)
  - sens, sol (50 m) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,54)
  - sens, 30 % couche (60 m sol) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,54)
  - sens, 60 % couche (120 m sol) : attendu cos > 0.5 sur ≥ 60 % du tracé ; obtenu 50 % (cos médian 0,53)
  - cause probable : sol (50 m) : flux générique opposé (vallée générique -1 km/h le long du tracé) malgré la brise documentée (poids 0,45) ; 30 % couche (60 m sol) : flux générique opposé (vallée générique -1 km/h le long du tracé) malgré la brise documentée (poids 0,45) ; 60 % couche (120 m sol) : flux générique opposé (vallée générique -1 km/h le long du tracé) malgré la brise documentée (poids 0,44)

### Convergences (10)

- **Confluence de Menthon-Saint-Bernard / Talloires (rive est, Roc de Chère)** — `lac-annecy/confluence-menthon-talloires`, Lac d’Annecy · *donnée* · juillet 15h30, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,00 m/s, 50 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 0,69 m/s sur la ligne)
- **Confluence du col des Aravis (brise de La Clusaz / brise de Flumet)** — `aravis/confluence-col-des-aravis`, Aravis · *modèle* · juillet 15h30, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,60 m/s, 0 % > 0
  - cause probable : les flux modélisés ne se rencontrent pas sur cette ligne à cette heure
- **Confluence des brises de Flumet et de Sallanches au-dessus de Megève (habituellement vers Praz-sur-Arly), glisse vers Combloux** — `val-arly-megeve/confluence-praz-sur-arly-megeve-combloux-2015`, Megève – Val d’Arly · *donnée* · juillet 17h30, vent météo de sud 15 km/h, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne 0,65 m/s, 38 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 5,93 m/s sur la ligne)
- **Rencontre des descentes du col de la Seigne et du Cormet de Roselend aux Chapieux** — `beaufortain/convergence-chapieux-seigne-cormet`, Beaufortain · *donnée* · juillet 15h30, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,49 m/s, 33 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 0,24 m/s sur la ligne)
- **Confluence du secteur d'École (brise de la Compôte × vent météo de N ou S)** — `bauges/confluence-ecole-compote`, Bauges · *donnée* · juillet 15h30, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,28 m/s, 40 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 0,15 m/s sur la ligne)
- **Confluence nuageuse entre le Saint-Eynard et Chamrousse (signe de brise forte)** — `gresivaudan/confluence-chamrousse-saint-eynard`, Grésivaudan · *donnée* · juillet 18h45, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne 0,71 m/s, 36 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 6,02 m/s sur la ligne)
- **Confluence Durance / Romanche-Guisane (de Saint-Chaffrey au Monêtier)** — `brianconnais-guisane/conv-saint-chaffrey-granon`, Briançonnais · *donnée* · juillet 15h00, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,03 m/s, 21 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 3,21 m/s sur la ligne)
- **Confluence brise SE / vent météo d'O dans la vallée de Vallouise** — `ecrins-vallouise-haute-durance/conv-vallouise-brise-se-vent-ouest`, Vallouise – haute Durance · *donnée* · juillet 9h45, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne 0,02 m/s, 38 % > 0
  - cause probable : convergence présente mais décalée ou intermittente (max 2,82 m/s sur la ligne)
- **Convergence mobile E/O sur le champ d'atterrissage de Thorenc (Col de Bleine)** — `prealpes-grasse-castellane/convergence-bleine-atterro`, Préalpes de Grasse · *modèle* · juillet 14h45, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,53 m/s, 0 % > 0
  - cause probable : les flux modélisés ne se rencontrent pas sur cette ligne à cette heure
- **Confluence de la brise de la Bévéra et de la brise du col de Castillon à Sospel** — `mercantour/convergence-sospel-castillon`, Mercantour · *modèle* · juillet 16h30, sans vent météo, 80 m sol
  - convergence le long de la ligne : attendu moyenne > 0 et ≥ 50 % des points > 0 ; obtenu moyenne -0,61 m/s, 0 % > 0
  - cause probable : les flux modélisés ne se rencontrent pas sur cette ligne à cette heure

### Thermiques (110)

- **Secteur du Coin (pied de la face ouest)** — `saleve-genevois/saleve-coin-thermique`, Salève · *limite* · juillet 14h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,28 (médiane 0,30, rang 28 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -122 m, altitude 701 m)
- **Plaine de Troinex (départ thermique à l'atterrissage)** — `saleve-genevois/saleve-troinex-thermique`, Salève · *limite* · juillet 13h30 (heures non précisées : milieu de journée supposé)
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,31 (médiane 0,31, rang 44 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -25 m, altitude 419 m)
- **Falaise est des Quatre Têtes (Burzier)** — `arve-faucigny/quatre-tetes-falaise-est`, Faucigny – Arve · *modèle* · juillet 15h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Cordon – Tête du Planet** — `arve-faucigny/cordon-tete-du-planet`, Faucigny – Arve · *modèle* · juillet 13h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 9h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Atterrissage de Chedde (Passy) : turbulent en conditions thermiques, restitution du soir** — `arve-faucigny/passy-chedde-thermiques-atterro`, Faucigny – Arve · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,36, rang 28 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -181 m, altitude 625 m)
- **Chedde (Passy) : pentes de Praz Coutant** — `arve-faucigny/chedde-praz-coutant`, Faucigny – Arve · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,42 (médiane 0,45, rang 46 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -23 m, altitude 1163 m)
- **Châtel : thermiques en plein après-midi sur l'atterrissage et à Morclan** — `chablais/chatel-atterro-thermique`, Chablais · *limite* · juillet 15h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,39 (médiane 0,47, rang 36 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -213 m, altitude 1162 m)
- **Saint-Guérin (atterrissage du Mont de Grange) : thermiques possibles sur la haie** — `chablais/saint-guerin-atterro-haie`, Chablais · *limite* · juillet 13h30 (heures non précisées : milieu de journée supposé)
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,38 (médiane 0,44, rang 34 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -224 m, altitude 1213 m)
- **Doussard : larges thermiques entre l'atterrissage et le lac par NE fort** — `lac-annecy/doussard-thermiques-bout-du-lac`, Lac d’Annecy · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,26 (médiane 0,29, rang 37 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -43 m, altitude 461 m)
- **Seynod – Vieugy : thermiques au-dessus des zones d’activités (traversée d’Annecy)** — `lac-annecy/seynod-vieugy-zone-industrielle`, Lac d’Annecy · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,27 (médiane 0,32, rang 15 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -130 m, altitude 563 m)
- **Alex – La Balme-de-Thuy (thermiques de la vallée du Fier)** — `bornes/alex-balme-de-thuy`, Bornes · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,33, rang 36 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -253 m, altitude 548 m)
- **Versant Servoz / Plaine-Joux (transition vers Chedde)** — `mont-blanc-chamonix/versant-servoz-plaine-joux`, Chamonix – Mont-Blanc · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,41, rang 20 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -190 m, altitude 803 m)
- **Parc de Merlet : thermiques du matin** — `mont-blanc-chamonix/merlet-thermiques-matin`, Chamonix – Mont-Blanc · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Flégère – Index : thermiques tôt le matin** — `mont-blanc-chamonix/flegere-thermiques-matin`, Chamonix – Mont-Blanc · *modèle* · juillet 13h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 9h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Planpraz – Brévent (face sud-est) : relance depuis le Plan de l'Aiguille** — `mont-blanc-chamonix/planpraz-relance-depuis-plan-de-l-aiguille`, Chamonix – Mont-Blanc · *modèle* · juillet 11h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 9h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Crête des Aiguilles Rouges au nord de l'Index (Aiguille du Lac Blanc) : faces est le matin** — `mont-blanc-chamonix/aiguilles-rouges-crete-nord-flegere`, Chamonix – Mont-Blanc · *modèle* · juillet 13h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 10h15 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Tête du Planet – Plateau des Benets (thermiques dès le matin)** — `val-arly-megeve/cordon-thermiques-matin`, Megève – Val d’Arly · *modèle* · juillet 13h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 9h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Au-dessus de Praz-sur-Arly : relance après la traversée du Val d'Arly (3100 m)** — `val-arly-megeve/praz-sur-arly-relance-3100`, Megève – Val d’Arly · *limite* · juillet 14h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,37 (médiane 0,46, rang 23 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -157 m, altitude 1021 m)
- **Megève : thermique très couché par la brise à la balise de Megève** — `val-arly-megeve/megeve-thermique-couche-b6`, Megève – Val d’Arly · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,33 (médiane 0,41, rang 20 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -120 m, altitude 1092 m)
- **Face sud de Bisanne (thermiques du matin)** — `beaufortain/bisanne-sud-matin`, Beaufortain · *modèle* · juillet 10h15
  - déclenchement : attendu colonne thermique au plus tard à 10h15 (heures documentées 8h00–12h30) ; obtenu 10h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Montgirod - Arcachat : face sud-est du matin** — `tarentaise/montgirod-arcachat-se`, Tarentaise · *modèle* · juillet 12h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h45 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Prariond / Les Villards de Macot (La Plagne)** — `tarentaise/prariond-macot`, Tarentaise · *limite* · juillet 9h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,00 (médiane 0,00, rang 0 %)
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 12h30 (trop tard)
  - cause probable : pente peu ensoleillée à cette heure dans le modèle (ensoleillement 40 %, exposition 325°)
- **Au-dessus d'Aime : thermique de confluence (relance vers Bourg-Saint-Maurice)** — `tarentaise/aime-confluence-thermique`, Tarentaise · *limite* · juillet 18h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,16 (médiane 0,21, rang 28 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -157 m, altitude 740 m)
- **Montagne de Tête (Valmorel) : thermiques puissants dès 16h, dynamique dès 12h** — `tarentaise/montagne-de-tete-valmorel-thermiques`, Tarentaise · *modèle* · juillet 15h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h00) ; obtenu 10h00 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Col du Petit-Saint-Bernard : crête de Verney** — `tarentaise/col-du-petit-saint-bernard-thermique`, Tarentaise · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,51 (médiane 0,57, rang 32 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -110 m, altitude 2168 m)
- **Terrains de foot et pylônes de Bozel : déclencheur sur l'approche** — `vanoise/bozel-terrains-de-foot-declencheur`, Vanoise · *limite* · juillet 14h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,33 (médiane 0,45, rang 18 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -286 m, altitude 834 m)
- **Vallée des Huiles (thermique du milieu de vallée)** — `combe-de-savoie/vallee-des-huiles-relance`, Combe de Savoie · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,28 (médiane 0,35, rang 29 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -140 m, altitude 831 m)
- **Atterrissage de Montlambert : thermiques de déclenchement autour du terrain** — `combe-de-savoie/montlambert-atterro-thermiques`, Combe de Savoie · *limite* · juillet 16h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,24 (médiane 0,26, rang 20 %)
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (13h00) ; obtenu 11h00 (trop tôt)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -121 m, altitude 276 m)
- **Atterrissage de L'Arclusaz (Saint-Pierre-d'Albigny) : activité thermique technique** — `combe-de-savoie/arclusaz-atterro-vignes`, Combe de Savoie · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,27 (médiane 0,28, rang 43 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -71 m, altitude 385 m)
- **Cusy – La Grande Côte : pentes du bas des Bauges ouest** — `bauges/cusy-grande-cote`, Bauges · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,32, rang 29 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -77 m, altitude 766 m)
- **Cusy – Les Perrières** — `bauges/cusy-les-perrieres`, Bauges · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,30 (médiane 0,31, rang 44 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -79 m, altitude 721 m)
- **Falaise est devant les décollages de Saint-Hilaire** — `chartreuse/facade-est-st-hilaire`, Chartreuse · *modèle* · juillet 13h54
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h48) ; obtenu 10h15 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Face ouest de Chamrousse (Aiguille / Croix)** — `belledonne/chamrousse-face-ouest`, Belledonne · *modèle* · juillet 16h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (13h00) ; obtenu 11h30 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Parking et atterrissage de l'Aigle (déclenchements thermiques)** — `vercors-nord/aigle-parking-thermique`, Vercors nord · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,33 (médiane 0,36, rang 38 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -97 m, altitude 1022 m)
- **Thermique en avant (à l'ouest) du massif de l'Aigle** — `vercors-nord/aigle-thermique-avant-massif`, Vercors nord · *limite* · juillet 17h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,27 (médiane 0,27, rang 50 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -94 m, altitude 1009 m)
- **Face sud d'Autrans-Bellecombe** — `vercors-nord/bellecombe-generosite`, Vercors nord · *modèle* · juillet 14h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (10h00) ; obtenu 12h00 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Arêtes du Gerbier : plafond et relance entre Côte 2000 et Cornafion** — `vercors-nord/gerbier-aretes-thermique`, Vercors nord · *modèle* · juillet 15h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Col Vert : pompe de service dans les pierriers** — `vercors-nord/col-vert-pompe-pierriers`, Vercors nord · *modèle* · juillet 14h45
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (10h30) ; obtenu 9h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Antenne (émetteur) de Bellecombe : thermique attendu** — `vercors-nord/bellecombe-antenne-emetteur`, Vercors nord · *modèle* · juillet 14h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (10h00) ; obtenu 12h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **La Plaine (Autrans) : possible thermique fin février par vent d'ouest** — `vercors-nord/ffvl2227-autrans-la-plaine-thermique-fevrier`, Vercors nord · *limite* · juillet 13h30 (heures non précisées : milieu de journée supposé)
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,35 (médiane 0,39, rang 36 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -89 m, altitude 1026 m)
- **Les Deux Sœurs (col de l'Arzelier) : relance généreuse après le Crêt de la Ferrière** — `vercors-est-sud/deux-soeurs-arzelier-thermique`, Vercors est & sud · *modèle* · juillet 15h15
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h00) ; obtenu 9h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Antenne de l'émetteur à l'est du Jocou : bon thermique vers l'Obiou** — `trieves/jocou-antenne-emetteur-est`, Trièves · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,37 (médiane 0,40, rang 40 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -195 m, altitude 1168 m)
- **Tête de l'Obiou et Grand Ferrand : plafond des crêtes** — `trieves/obiou-grand-ferrand-plafond`, Trièves · *modèle* · juillet 16h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (14h00) ; obtenu 10h00 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Rochassac : faces ouest sous la bergerie (crête de Fluchaire)** — `trieves/rochassac-faces-ouest-sous-la-bergerie`, Trièves · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,36 (médiane 0,39, rang 37 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -179 m, altitude 1256 m)
- **Courtet : faces ouest au nord du décollage (vers les alpages de Rochassac)** — `trieves/courtet-faces-ouest-vers-rochassac`, Trièves · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,34 (médiane 0,39, rang 28 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -132 m, altitude 1216 m)
- **Le Combenon (Saint-Arey) : thermique au décollage de la Tête de Vache et du Razier** — `matheysine/combenon-tete-de-vache-thermique`, Matheysine – Drac · *limite* · juillet 10h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,01 (médiane 0,05, rang 26 %)
  - déclenchement : attendu colonne thermique au plus tard à 10h30 (heures documentées 8h00–13h00) ; obtenu 11h30 (trop tard)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI 29 m, altitude 1060 m)
- **Pentes du Signal (Alpe d'Huez), thermique de printemps** — `oisans-grandes-rousses/signal-huez-pentes`, Oisans · *modèle* · juillet 13h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h00) ; obtenu 10h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Crête de Côte Belle et du col du Sabot (relance vers l'Alpe d'Huez)** — `oisans-grandes-rousses/sabot-crete-cote-belle`, Oisans · *modèle* · juillet 17h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (16h00) ; obtenu 11h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Cheminée de Vaujany : « l'ascenseur » de 16h** — `oisans-grandes-rousses/cheminee-vaujany-ascenseur`, Oisans · *modèle* · juillet 17h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (16h00) ; obtenu 11h00 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Rochers du Rissiou (Vaujany), du Petit Chalvet au col du Sabot** — `oisans-grandes-rousses/rissiou-rochers`, Oisans · *modèle* · juillet 17h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (16h00) ; obtenu 10h00 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Montagne de Rachas (Deux Alpes), arête de soaring** — `oisans-grandes-rousses/deux-alpes-rachas`, Oisans · *modèle* · juillet 17h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (16h00) ; obtenu 11h00 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Au-dessus du col du Lautaret : plafond à 4050 m** — `oisans-grandes-rousses/lautaret-plafond-4050`, Oisans · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,45 (médiane 0,52, rang 32 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -125 m, altitude 2039 m)
- **Jarrier : crête au-dessus de La Balme et du Grand Châtelard (« rester haut » vers Glandon et Croix de Fer)** — `maurienne/jarrier-balme-crete-cols`, Maurienne · *limite* · juillet 9h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,00 (médiane 0,01, rang 47 %)
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h45 (trop tard)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI 112 m, altitude 1494 m)
- **Saint-Avre : adret sud-ouest au-dessus du terrain de Sainte-Marie-de-Cuines (thermique du matin et d'hiver)** — `maurienne/saint-avre-adret-sud-ouest-chaussy`, Maurienne · *limite* · juillet 11h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,00 (médiane 0,12, rang 17 %)
  - déclenchement : attendu colonne thermique au plus tard à 11h30 (heures documentées 8h00–15h00) ; obtenu 13h30 (trop tard)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -117 m, altitude 648 m)
- **Pointe de Bellecôte et Turra (thermique d'Aussois)** — `haute-maurienne/bellecote-turra`, Haute-Maurienne · *modèle* · juillet 14h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (13h00) ; obtenu 10h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Au-dessus de Sollières-Sardières : relance au retour de Termignon** — `haute-maurienne/sollieres-sardieres-relance`, Haute-Maurienne · *limite* · juillet 14h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,40 (médiane 0,51, rang 20 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -186 m, altitude 1300 m)
- **Bonneval-sur-Arc (Les Druges, Grande Feiche) : dernier relief avant le verrou** — `haute-maurienne/druges-grande-feiche-dernier-relief`, Haute-Maurienne · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,44 (médiane 0,55, rang 25 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -175 m, altitude 2070 m)
- **Granges du Galibier : déclencheur des grands cross (300 km)** — `arves-thabor-galibier/granges-du-galibier-depart-300`, Arves – Galibier · *modèle* · juillet 13h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 10h15 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Crête du Crey du Quart (Valloire) : déclencheur de début d'après-midi** — `arves-thabor-galibier/crey-du-quart-crete`, Arves – Galibier · *modèle* · juillet 15h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h45 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Barres de Notre-Dame-des-Neiges (Prorel)** — `brianconnais-guisane/thermiques-notre-dame-des-neiges`, Briançonnais · *modèle* · juillet 15h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h45 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Confluence de Briançon : verticale du Fontenil / vers le Janus** — `brianconnais-guisane/therm-conf-fontenil-janus`, Briançonnais · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,37 (médiane 0,45, rang 29 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -233 m, altitude 1299 m)
- **Confluence Durance / Lombarde : verticale de Briançon Sud (« Monsieur Meuble »)** — `brianconnais-guisane/therm-conf-briancon-sud`, Briançonnais · *limite* · juillet 17h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,26 (médiane 0,31, rang 28 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -140 m, altitude 1188 m)
- **Confluence de Saint-Chaffrey (Durance / Guisane)** — `brianconnais-guisane/therm-conf-saint-chaffrey`, Briançonnais · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,40 (médiane 0,52, rang 23 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -201 m, altitude 1344 m)
- **Faces est sous le sommet de Serre Chevalier (premier déclencheur avant le Granon)** — `brianconnais-guisane/therm-serre-chevalier-est-matin`, Briançonnais · *limite* · juillet 9h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,03 (médiane 0,03, rang 49 %)
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h30 (trop tard)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI 152 m, altitude 2388 m)
- **Confluences de la haute Durance (Briançon, L'Argentière)** — `ecrins-vallouise-haute-durance/thermiques-confluences-durance`, Vallouise – haute Durance · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,39 (médiane 0,44, rang 39 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -72 m, altitude 1475 m)
- **Rocher sud de la face est de la Croix d'Aquila (relance après le Prorel)** — `ecrins-vallouise-haute-durance/therm-aquila-rocher-sud`, Vallouise – haute Durance · *modèle* · juillet 16h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (13h00) ; obtenu 9h45 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Zone brûlée au-dessus de L'Argentière : thermique sous le vent de la Lombarde** — `ecrins-vallouise-haute-durance/therm-zone-bruleee-argentiere`, Vallouise – haute Durance · *limite* · juillet 15h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,38 (médiane 0,47, rang 32 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -137 m, altitude 1207 m)
- **Crête entre la Blanche et les Bans (faces sud)** — `ecrins-vallouise-haute-durance/therm-crete-blanche-bans`, Vallouise – haute Durance · *limite* · juillet 14h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,39 (médiane 0,50, rang 22 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -440 m, altitude 1808 m)
- **Verrou glaciaire au nord de L'Argentière : confluence déplacée** — `ecrins-vallouise-haute-durance/therm-conf-verrou-argentiere`, Vallouise – haute Durance · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,34 (médiane 0,46, rang 22 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -243 m, altitude 1177 m)
- **Plaine devant Saint-Vincent : confluences et restitution du soir** — `serre-poncon-embrunais/therm-st-vincent-plaine-restitution`, Serre-Ponçon · *limite* · juillet 18h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,19 (médiane 0,20, rang 49 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -57 m, altitude 905 m)
- **Pentes SE/S des Jambons et de Pra-Gasta (déclencheur du matin, Chorges)** — `serre-poncon-embrunais/therm-jambons-matin`, Serre-Ponçon · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Confluence d'Embrun : entre Saint-Clément et la baie Saint-Michel** — `serre-poncon-embrunais/therm-conf-embrun-clement`, Serre-Ponçon · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,31 (médiane 0,34, rang 38 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -51 m, altitude 896 m)
- **Mont Guillaume : pente sud-ouest sous le décollage (brise thermique dominante)** — `serre-poncon-embrunais/mont-guillaume-deco-pente-sud-ouest`, Serre-Ponçon · *modèle* · juillet 14h15
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 11h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Ceillac (faces sud de la combe)** — `queyras/thermiques-ceillac`, Queyras · *limite* · juillet 13h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,42 (médiane 0,50, rang 27 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -95 m, altitude 1817 m)
- **Izoard – Coste Belle : pente sud-ouest du ravin de Coste Belle, thermique d'automne** — `queyras/izoard-coste-belle-pente-sud-ouest`, Queyras · *limite* · juillet 10h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,00 (médiane 0,09, rang 0 %)
  - déclenchement : attendu colonne thermique au plus tard à 10h30 (heures documentées 8h00–13h00) ; obtenu 11h45 (trop tard)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI 40 m, altitude 2242 m)
- **Brunet (vol rando de Ceillac) : sommet, départ en thermique** — `queyras/brunet-sommet-depart-en-thermique`, Queyras · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Col des Faïsses (Obiou)** — `devoluy/therm-faisses`, Dévoluy · *modèle* · juillet 15h00
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (11h00) ; obtenu 9h45 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Entrée de la vallée de Champoléon : restitution et thermiques doux du soir depuis le Cairn d'Orcières** — `champsaur-valgaudemar/orcieres-champoleon-restitution-soir`, Champsaur · *limite* · juillet 18h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,23 (médiane 0,29, rang 40 %)
  - cause probable : pente peu ensoleillée à cette heure dans le modèle (ensoleillement 0 %, exposition 101°)
- **Archinard – Serre Lunel : pente nord-ouest du soaring du soir** — `champsaur-valgaudemar/archinard-serre-lunel`, Champsaur · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,50 (médiane 0,53, rang 46 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -58 m, altitude 1748 m)
- **Col de Guizière : premiers thermiques du matin** — `gapencais-ceuse/therm-guiziere-matin`, Gapençais – Céüse · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h00 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Orpierre : monter à 2000-2200 m avant de transiter vers Beaumont** — `buech-laragne-chabre/therm-orpierre-relance-2000`, Buëch – Chabre · *limite* · juillet 14h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,32 (médiane 0,32, rang 47 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -136 m, altitude 724 m)
- **Aureille : pente sud du décollage (thermique du matin)** — `buech-laragne-chabre/aureille-pente-sud-matin`, Buëch – Chabre · *modèle* · juillet 10h00
  - déclenchement : attendu colonne thermique au plus tard à 10h00 (heures documentées 8h00–12h00) ; obtenu 10h15 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Bergiès (nord)** — `baronnies/therm-berges-nord`, Baronnies · *modèle* · juillet 12h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (12h00) ; obtenu 10h45 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Bergiès (sud) – falaise du matin** — `baronnies/therm-berges-sud`, Baronnies · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Buc Ouest : thermiques de l'après-midi puis restitution** — `baronnies/therm-buc-ouest-aprem`, Baronnies · *modèle* · juillet 17h15
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (14h00) ; obtenu 10h15 (trop tôt)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Buc Est – La Tanière : thermique dès le milieu de la matinée** — `baronnies/therm-buc-est-matin`, Baronnies · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 10h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Villefranche-le-Château : posé « dans les déclenchements »** — `baronnies/therm-villefranche-declenchements`, Baronnies · *limite* · juillet 14h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,31 (médiane 0,34, rang 34 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -86 m, altitude 802 m)
- **Faces est de la montagne d’Aucelon** — `diois/therm-aucelon-est`, Diois · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Valdrôme / col de Cabre : limite des plafonds, relance avant la Durance** — `diois/therm-valdrome-limite-plafonds`, Diois · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,38, rang 14 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -104 m, altitude 800 m)
- **Châtillon-en-Diois : point clé avant le raccroché du Glandasse** — `diois/therm-chatillon-point-cle`, Diois · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,31, rang 37 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -189 m, altitude 573 m)
- **Le Duffre (Valdrôme) : face sud-est, cross tôt le matin** — `diois/therm-duffre-sud-est-matin`, Diois · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h15 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Saint-Genis : la pompe devant l'arête sud-ouest** — `diois/therm-st-genis-arete-sw`, Diois · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,27 (médiane 0,28, rang 39 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -110 m, altitude 376 m)
- **Terrain d'atterrissage du lac (déclenche en plein après-midi)** — `saint-andre-verdon/atterro-lac-thermique`, Saint-André · *limite* · juillet 15h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,31 (médiane 0,36, rang 16 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -99 m, altitude 877 m)
- **La carrière avant les antennes (face ouest du Chalvet)** — `saint-andre-verdon/carriere-avant-antennes`, Saint-André · *limite* · juillet 12h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,19 (médiane 0,33, rang 17 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI 16 m, altitude 1277 m)
- **Crête de Lambruisse (angle côté antennes)** — `haut-verdon-allos/crete-de-lambruisse`, Haut-Verdon · *limite* · juillet 13h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,35 (médiane 0,39, rang 33 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -168 m, altitude 1165 m)
- **Rocher de la Baume (falaises calcaires de Sisteron chauffées dès le milieu de matinée)** — `prealpes-digne-lure/rocher-de-la-baume-sisteron`, Digne – Lure · *modèle* · juillet 14h30
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (10h00) ; obtenu 12h15 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Lachens ouest : pente sud-ouest sous le décollage ouest** — `prealpes-grasse-castellane/lachens-ouest-pente-sud-ouest`, Préalpes de Grasse · *limite* · juillet 10h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,01 (médiane 0,04, rang 21 %)
  - déclenchement : attendu colonne thermique au plus tard à 10h30 (heures documentées 8h00–13h00) ; obtenu 11h30 (trop tard)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI 111 m, altitude 1301 m)
- **Les Valettes (Pont-du-Loup) : terrain d'atterrissage thermique** — `prealpes-grasse-castellane/valettes-atterro-thermique`, Préalpes de Grasse · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,28 (médiane 0,30, rang 33 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -160 m, altitude 140 m)
- **Gréolières : pentes de la vallée vers Les Arrosans** — `prealpes-grasse-castellane/greolieres-pentes-arrosans`, Préalpes de Grasse · *limite* · juillet 14h15
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,45 (médiane 0,45, rang 49 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -41 m, altitude 1038 m)
- **Gourdon village (zone A, thermiques faibles et étroits)** — `prealpes-nice-var/gourdon-village-a`, Préalpes de Nice · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique à ±1 h du début documenté (8h00) ; obtenu 10h30 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Le Béoulet (Sospel) : pente sud raide à l'ouest de Monte Grosso** — `prealpes-nice-var/beoulet-pente-sud`, Préalpes de Nice · *modèle* · juillet 10h30
  - déclenchement : attendu colonne thermique au plus tard à 10h30 (heures documentées 8h00–13h00) ; obtenu 10h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **La Cime (Bonson – Gattières) : pente sud-est** — `prealpes-nice-var/la-cime-gattieres-pente-sud-est`, Préalpes de Nice · *modèle* · juillet 10h30
  - déclenchement : attendu colonne thermique au plus tard à 10h30 (heures documentées 8h00–13h00) ; obtenu 10h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Castellar : butte sous les falaises et « thermique de la Taupe »** — `mercantour/roquebrune-castellar-butte-taupe`, Mercantour · *limite* · juillet 15h30
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,28 (médiane 0,30, rang 43 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -196 m, altitude 131 m)
- **Valberg – Col des Huerris (1765 m) : brise de sud laminaire, thermiques sur le mamelon de la pente école** — `mercantour/valberg-col-des-huerris`, Mercantour · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h45 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **Saint-Hugues (atterrissage) : déclenchements thermiques dans tous les sens** — `chartreuse/ffvl13287-saint-hugues-declenchements`, Chartreuse · *limite* · juillet 13h30 (heures non précisées : milieu de journée supposé)
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,31 (médiane 0,39, rang 19 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -169 m, altitude 869 m)
- **Solaure : thermiques du matin par sud faible** — `diois/ffvl13301-solaure-thermiques-matin`, Diois · *modèle* · juillet 9h45
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 10h15 (trop tard)
  - cause probable : déclenchement décalé par rapport au début documenté
- **La Gare (Bourg-Saint-Maurice) : terrain thermique en été dès 11h** — `tarentaise/ffvl13678-la-gare-thermique-ete`, Tarentaise · *limite* · juillet 15h00
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,41, rang 14 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -158 m, altitude 806 m)
- **L'Alevoux (atterrissage) : déclenchements thermiques très turbulents en approche finale** — `vercors-nord/ffvl1039-alevoux-atterro-declenchements`, Vercors nord · *limite* · juillet 13h30 (heures non précisées : milieu de journée supposé)
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,29 (médiane 0,32, rang 32 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -63 m, altitude 355 m)
- **Cuberselle : thermique du matin de l'autre côté de la crête** — `gapencais-ceuse/ffvl3048-cuberselle-thermique-matin`, Gapençais – Céüse · *limite* · juillet 9h45
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,00 (médiane 0,00, rang 0 %)
  - déclenchement : attendu colonne thermique au plus tard à 9h45 (heures documentées 8h00–11h30) ; obtenu 11h45 (trop tard)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -7 m, altitude 1044 m)
- **La Touvière (Peyrus) : bulles thermiques près du sol à l'atterrissage** — `vercors-est-sud/ffvl13417-touviere-bulles-thermiques`, Vercors est & sud · *limite* · juillet 13h30 (heures non précisées : milieu de journée supposé)
  - potentiel thermique : attendu au-dessus de la médiane locale (5 km) ; obtenu 0,28 (médiane 0,33, rang 18 %)
  - cause probable : relief concave ou bas pour le modèle (convexité TPI -163 m, altitude 572 m)

### Pièges (48)

- **Le Môle : brise de vallée très forte au col-parking de Chez Berroud (strong-breeze)** — `arve-faucigny/mole-col-chez-berroud`, Faucigny – Arve · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 5 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Rafales de cumulonimbus du nord le long du lac (strong-breeze)** — `lac-annecy/lac-cumulonimbus-nord`, Lac d’Annecy · *limite* · juillet 17h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 15 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col des Aravis : la brise du col rentre en cours d'après-midi (strong-breeze)** — `aravis/col-des-aravis-brise-col`, Aravis · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 4 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Venturi entre Sulens et La Tulle (brise de Faverges) (venturi)** — `aravis/sulens-la-tulle-venturi`, Aravis · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 1,15 × médiane des fonds de vallée voisins (10 km) ; obtenu max 3 km/h (×0,23 la médiane 14 km/h), venturi 0,00
  - cause probable : pas de resserrement perpendiculaire au flux détecté à la maille de 216 m
- **Cordon / Combloux : brise de vallée dans le dos après 13h, foehn par tendance sud (strong-breeze)** — `val-arly-megeve/cordon-brise-vent-arriere`, Megève – Val d’Arly · *limite* · juillet 16h00, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 3 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Brise d'Ugine passant au-dessus de Bisanne : thermiques de la face sud submergés l'après-midi (strong-breeze)** — `val-arly-megeve/bisanne-brise-arly-dos`, Megève – Val d’Arly · *limite* · juillet 15h45, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 3 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Vallée de Megève : très forte brise face au pilote, verrou à passer en collant au relief (strong-breeze)** — `val-arly-megeve/megeve-verrou-brise-forte-avril`, Megève – Val d’Arly · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 13 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Bisanne Sud : brise d'Ugine dans le dos après ~12h30, rouleaux par vent d'ouest (strong-breeze)** — `beaufortain/bisanne-dos-apres-midi`, Beaufortain · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 3 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Cormet de Roselend – Les Chapieux : « cocktail de brises » (col de la Seigne, Cormet) (strong-breeze)** — `beaufortain/cormet-chapieux-cocktail-brises`, Beaufortain · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 5 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Brise de vallée forte à l'atterrissage de Bozel (fort gradient) (strong-breeze)** — `vanoise/brise-forte-bozel-atterrissage`, Vanoise · *limite* · juillet 17h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Courchevel Bouc Blanc : brises fortes à très fortes l'après-midi (strong-breeze)** — `vanoise/bouc-blanc-brise-forte`, Vanoise · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 2 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Novalaise : brise forte et posé interdit (strong-breeze)** — `bourget-chambery/epine-novalaise-brise-forte`, Bourget – Chambéry · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 14 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Montlambert par vent de Nord fort : protection limitée, 'sortir du bocal' (strong-breeze)** — `combe-de-savoie/montlambert-nord-fort`, Combe de Savoie · *limite* · juillet 14h00, vent météo de nord 20 km/h, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 9 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col du Frêne : zone sous le vent, venturi (venturi)** — `bauges/col-du-frene-venturi`, Bauges · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 1,15 × médiane des fonds de vallée voisins (10 km) ; obtenu max 16 km/h (×0,79 la médiane 21 km/h), venturi 0,00
  - cause probable : pas de resserrement perpendiculaire au flux détecté à la maille de 216 m
- **École – La Compôte : brise forte et confluence (atterrissage) (strong-breeze)** — `bauges/ecole-compote-scotche`, Bauges · *limite* · juillet 14h00, vent météo de nord 30 km/h, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 18 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Brise du Grésivaudan renforcée en soirée de forte canicule (au pied de Chamrousse) (strong-breeze)** — `gresivaudan/chamrousse-brise-soir-canicule`, Grésivaudan · *limite* · juillet 18h45, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 15 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Grand Colon : brise forte et turbulente (strong-breeze)** — `belledonne/grand-colon-brise`, Belledonne · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 5 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col de Pipay / Crêt du Poulet : point dur par brise de Fond de France (strong-breeze)** — `belledonne/pipay-point-dur`, Belledonne · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 7 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Serpaton Est : venturi au sud et brise du Drac au nord (venturi)** — `vercors-est-sud/serpaton-est-venturi`, Vercors est & sud · *limite* · juillet 11h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 1,15 × médiane des fonds de vallée voisins (10 km) ; obtenu max 4 km/h (×0,45 la médiane 10 km/h), venturi 0,00
  - cause probable : pas de resserrement perpendiculaire au flux détecté à la maille de 216 m
- **Léoncel : renforcement du vent et aérologie souvent travers gauche (strong-breeze)** — `vercors-est-sud/leoncel-renforcement-vent`, Vercors est & sud · *limite* · juillet 12h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 4 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Verrou de Châtillon-en-Diois : brise divergeant vers l'ouest, vent reculant en basse couche (strong-breeze)** — `trieves/chatillon-verrou-brise`, Trièves · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 16 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Vent du sud irrégulier et rafaleux sur Monteynard (strong-breeze)** — `matheysine/monteynard-sud-rafales`, Matheysine – Drac · *limite* · juillet 14h00, vent météo de sud 30 km/h, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 8 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Conest : brise dès 12h et cisaillements importants (strong-breeze)** — `matheysine/conest-cisaillement-brise-12h`, Matheysine – Drac · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 14 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Combe du Goulet (Valbonnais) : brise de Valbonnais et rodéo (strong-breeze)** — `matheysine/valbonnais-combe-du-goulet-rodeo`, Matheysine – Drac · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 17 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col du Sabot : entrée du vent de Nord, cisaillements (strong-breeze)** — `oisans-grandes-rousses/sabot-vent-nord`, Oisans · *limite* · juillet 14h00, vent météo de Nord 40 km/h, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 19 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **« Cloutage » : vent d'altitude NO-N entraîné vers le bas (Puy Chalvin, Granon) (strong-breeze)** — `brianconnais-guisane/cloutage-nord-ouest-puy-chalvin-granon`, Briançonnais · *limite* · juillet 15h15, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 7 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Forte brise descendante du soir (Vallouise) (strong-breeze)** — `ecrins-vallouise-haute-durance/brise-descendante-soir-vallouise`, Vallouise – haute Durance · *limite* · juillet 18h45, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 7 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Brise soutenue au déco de Saint-Vincent (strong-breeze)** — `serre-poncon-embrunais/st-vincent-brise-deco`, Serre-Ponçon · *limite* · juillet 15h15, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 16 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Barcelonnette – atterro de l'Hippodrome : force de la brise (strong-breeze)** — `ubaye/hippodrome-barcelonnette-brise`, Ubaye · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Lac des Sagnes : atterrissage au vent du lac quand la brise s'alimente (strong-breeze)** — `ubaye/lac-des-sagnes-brise-plouf`, Ubaye · *limite* · juillet 14h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 5 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Derrière La Salette : forte brise de la vallée de Valbonnais, combe du Goulet bousculante (strong-breeze)** — `champsaur-valgaudemar/la-salette-valbonnais-brise-goulet`, Champsaur · *limite* · juillet 17h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 3 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Déco d’Aspres saturé par la brise (strong-breeze)** — `buech-laragne-chabre/aspres-breeze-14-16`, Buëch – Chabre · *limite* · juillet 15h00, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 5 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Bascule ouest de l’après-midi : atterro sud inaccessible (strong-breeze)** — `buech-laragne-chabre/chabre-bascule-ouest`, Buëch – Chabre · *limite* · juillet 16h15, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 3 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Mison : inversion brutale du flux du soir (strong-breeze)** — `buech-laragne-chabre/mison-inversion`, Buëch – Chabre · *limite* · juillet 19h45, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 0 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Cuberselle : déco quasi falaise, brise trop forte (strong-breeze)** — `buech-laragne-chabre/cuberselle-brise`, Buëch – Chabre · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 13 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Mistral : flux canalisé dans le Buëch vers Sisteron (strong-breeze)** — `buech-laragne-chabre/buech-mistral-couloir`, Buëch – Chabre · *limite* · juillet 14h00, mistral (nord) 50 km/h, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 16 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col d'Ey : renforcement brutal du mistral et sous le vent de la brise d'ouest (strong-breeze)** — `baronnies/col-ey-mistral`, Baronnies · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 8 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Retour de Beaumont vers Nyons : tout face à la brise (strong-breeze)** — `baronnies/beaumont-nyons-face-brise`, Baronnies · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 11 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Verrou de Châtillon-en-Diois : brise forte et recul en basse couche (strong-breeze)** — `diois/diois-chatillon-recul`, Diois · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 16 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Bascule ouest de fin d’après-midi (Couspeau, Aucelon, Aurel) (strong-breeze)** — `diois/diois-bascule-ouest`, Diois · *limite* · juillet 17h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 18 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col de Volvent : brise d’ouest dès 12-14h (strong-breeze)** — `diois/diois-volvent-brise-ouest`, Diois · *limite* · juillet 13h00, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 4 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Montagne de Baise : pas de vent météo de nord ou de sud (strong-breeze)** — `diois/diois-baise-no`, Diois · *limite* · juillet 14h00, vent météo de nord 30 km/h, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 12 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Brise soutenue et venturi au décollage Sud-Ouest du Chalvet (strong-breeze)** — `saint-andre-verdon/brise-forte-deco-so`, Saint-André · *limite* · juillet 16h00, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 20 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Venturi et brise forte à l'Andran (déco et atterro) (venturi)** — `prealpes-digne-lure/venturi-andran-digne`, Digne – Lure · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 1,15 × médiane des fonds de vallée voisins (10 km) ; obtenu max 14 km/h (×1,01 la médiane 14 km/h), venturi 0,00
  - cause probable : pas de resserrement perpendiculaire au flux détecté à la maille de 216 m
- **Oraison : entrées de vent brutales, brise trop sud, repose au déco interdite (strong-breeze)** — `prealpes-digne-lure/oraison-entrees-de-vent`, Digne – Lure · *limite* · juillet 14h45, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 13 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col de Saint-Barnabé et Soleilhas : sous le vent du Teillon, venturi (venturi)** — `prealpes-grasse-castellane/venturi-col-saint-barnabe`, Préalpes de Grasse · *limite* · juillet 15h30, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 1,15 × médiane des fonds de vallée voisins (10 km) ; obtenu max 9 km/h (×1,03 la médiane 9 km/h), venturi 0,00
  - cause probable : pas de resserrement perpendiculaire au flux détecté à la maille de 216 m
- **Cagnorina : fortes brises de vallée, atterro au déco (strong-breeze)** — `mercantour/cagnorina-forte-brise`, Mercantour · *limite* · juillet 14h45, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 17 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit
- **Col de Tende : conditions très fortes en pleine journée (strong-breeze)** — `mercantour/col-de-tende-brise`, Mercantour · *limite* · juillet 14h45, sans vent météo, 80 m sol, à 330 m du point
  - effet attendu : attendu vent ≥ 20 km/h (« fort », S8) ; obtenu max 13 km/h
  - cause probable : brise modélisée moins forte que décrite à cet endroit

## Non testables

- brises · Le Pontias (vent descendant de l'Eygues sur Nyons) (catabatique) (`baronnies/pontias`) : tracé trop court
- brises · Prolongement d'altitude de la Durance vers Champsaur - Valbonnais - Maurienne (schéma Briffe) (régionale, seulement si : schéma conceptuel de grande échelle, illustratif (non simulé dans les vallées)) (`alpes-francaises/briffe-durance-vers-maurienne`) : si : schéma conceptuel de grande échelle, illustratif (non simulé dans les vallées)
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
- pièges · Criou : zones sous le vent (zigzag rouge et trou de la sorcière) (lee-rotor) (`haut-giffre/criou-zone-sous-le-vent`) : brises installées (été, début d'après-midi)
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
- pièges · Pointe sud du Néron : sous le vent de la brise de Voreppe (lee-rotor) (`grenoble-cuvette/neron-pointe-sud-sous-le-vent`) : après-midi, brise de Voreppe établie, en transition Rachais - Néron - Vercors
- pièges · Rouleaux de brise à la « Vierge du Vercors » (Pas de Saint-Martin) (lee-rotor) (`vercors-nord/saint-martin-vierge-rouleaux`) : Brise forte de l'après-midi, renforcée par le vent du nord.
- pièges · Décollement du thermique devant le déco de Saint-Martin (lee-rotor) (`vercors-nord/pas-saint-martin-decollement-thermique`) : Journées très fortes, 13h-17h.
- pièges · Passages du Cornafion et du plateau des Ramées (départ de cross vers le Moucherotte) (lee-rotor) (`vercors-nord/cornafion-moucherotte-passages-turbulents`) : Départ de cross de la Côte 2000 vers le nord, après-midi.
- pièges · Limouches : cirque de Peyrus par vent de nord fort, vent de plaine renforcé (strong-breeze) (`vercors-est-sud/limouches-cirque-peyrus`) : Renforcement du vent météo (influence de la vallée du Rhône) ; site sous le vent de l'est.
- pièges · La Toussuire (hiver) : par tendance ouest la crête vers l'atterrissage est souvent infranchissable depuis la Pierre du Turc (lee-rotor) (`maurienne/toussuire-pierre-du-turc-crete-ouest`) : Hiver, décollage à ski de la Pierre du Turc ; tendance ouest ou ouest sensible.
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
- pièges · Montagne de Parves : rouleaux du plateau sous le décollage par vent fort (lee-rotor) (`bourget-chambery/ffvl311-parves-rouleaux-plateau`) : vent fort
- pièges · Falaise de Chanduraz : zone sous le vent à éviter depuis le radiophare (lee-rotor) (`bourget-chambery/ffvl327-colombier-chanduraz-sous-le-vent`) : (absent)
- pièges · Roynac - Col du Devès : rotor derrière le décollage (lee-rotor) (`diois/ffvl730-roynac-rotor`) : (absent)
- pièges · Saint-Maurice et Plaines de Poët : le vent se renforce vers la vallée du Rhône (25 km/h à la balise) (strong-breeze) (`diois/ffvl1316-saint-maurice-vent-rhone`) : vent soutenu, balise des plaines > 25 km/h

## Défauts de données à corriger dans les notes de recherche

Repérés automatiquement ; à corriger dans les JSON de `research_notes/`, pas dans l’atlas compilé. Le fichier indiqué est celui de la première source citée (une source partagée est rattachée au premier fichier qui la cite) : à confirmer avec le préfixe de l’identifiant (secteur).

- `bornes/brise-parmelan-dingy` (annecy_bornes_aravis.json) : horaires non analysables (« non documenté ») : la brise suit le cycle générique de vallée
- `tarentaise/brise-petit-saint-bernard` (tarentaise_vanoise.json) : horaires non analysables (« Non documenté en régime de brise ; flux inverse (Italie → Bourg-Saint-Maurice) lors du foehn, à toute heure ») : la brise suit le cycle générique de vallée
- `diois/brise-trieves-lus` (devoluy_gap_buech_diois.json) : horaires non analysables (« sans horaire dans les sources (régime de brise d'été) ») : la brise suit le cycle générique de vallée
- `prealpes-digne-lure/brise-pente-lure-sud-contras` (provence_maritimes.json) : horaires non analysables (« régime de brise orienté S à SSO ; SE léger < 20 km/h ; convection l'été « très puissante » ») : la brise suit le cycle générique de vallée
- `prealpes-nice-var/brise-de-mer-roquebrune` (provence_maritimes.json) : horaires non analysables (« jour ; site volé surtout l'hiver et en arrière-saison (voir restrictions horaires) ») : la brise suit le cycle générique de vallée
- `mercantour/brise-haut-var` (provence_maritimes.json) : horaires non analysables (« l'été : brises plus fortes (traversée aventureuse) ; printemps : volable ; la brise peut venir de Puget-Théniers plutôt que du haut Var au Dôme de Barrot ») : la brise suit le cycle générique de vallée
- `prealpes-digne-lure/ffvl197-brise-ouest-est-calavon` (fiches_ffvl.json) : horaires non analysables («  ») : la brise suit le cycle générique de vallée
- `baronnies/ffvl1318-brise-pente-rachas` (fiches_ffvl.json) : horaires non analysables («  ») : la brise suit le cycle générique de vallée
- `baronnies/ffvl1745-brise-ouest-saint-jean` (devoluy_gap_buech_diois.json) : horaires non analysables («  ») : la brise suit le cycle générique de vallée
- `baronnies/ffvl13236-brise-sud-rissas` (fiches_ffvl.json) : horaires non analysables («  ») : la brise suit le cycle générique de vallée
- `mercantour/ffvl14294-brise-roya-col-de-tende` (fiches_ffvl.json) : horaires non analysables («  ») : la brise suit le cycle générique de vallée
- `haut-giffre/brise-pente-pertuiset-platiere` (chablais_giffre_arve.json) : hors de ses horaires (14h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `lac-annecy/brise-descendante-taillefer-charbon` (annecy_bornes_aravis.json) : hors de ses horaires (14h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `bourget-chambery/restitution-aiguebelette` (bauges_bourget_combe.json) : hors de ses horaires (15h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `oisans-grandes-rousses/huez-brise-de-pente` (vercors_grenoble_trieves.json) : hors de ses horaires (10h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
- `mercantour/brise-bevera-sospel` (provence_maritimes.json) : hors de ses horaires (14h30), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)
