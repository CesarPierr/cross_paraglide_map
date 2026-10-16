# Le simulateur de vol (onglet « Jeu »)

Un simulateur de parapente dans le navigateur, au-dessus de la carte 3D du site. Il vole dans le
**modèle de vent du site** (brises de pente et de vallée, vent météo modifié par le relief, dangers
documentés) : c'est ce qui le distingue des simulateurs existants, dont l'aérologie est générique.
Code : `apps/web/src/game/` (chargé seulement à l'ouverture de l'onglet).

## Ce qui est simulé

### L'aile (`flight.ts`)

- **Point matériel inertiel** : le parapente a sa propre vitesse sol ; l'aile voit la vitesse relative
  à l'air, rafales comprises. Portance perpendiculaire au vent relatif et inclinée par le roulis,
  traînée le long, poids ; **masse ajoutée** de l'air entraîné par la voile (≈ 22 kg normale à la
  voile, d'après Lissaman & Brown) : le vario suit une ascendance franche en ≈ 0,2 s. Une rafale de
  face de 5 m/s donne +5 m/s de vitesse air d'un coup puis une ressource (+6 m) ; une rafale arrière
  −5 m/s et ≈ 5 m perdus. Arrondi, ressource, abattée et emballement de la spirale sortent des forces.
- **Coefficients tirés de la polaire** (trim 37 km/h, chute mini 0,98 m/s à 20 % de frein, finesse
  9,9, surface projetée 21,5 m²) : CL et CD par position de frein et d'accélérateur ; le frein donne
  40 % de sa portance tout de suite (cambrure), le reste par l'incidence que prend la voile (stabilité
  en tangage, τ = 0,6 s) ; traînée induite et décollement près du CLmax (≈ 1,5 vers 88 % de frein sur
  la B). Densité et poids total : vitesse et chute × √(ρ₅₀₀/ρ)·√(m/95 kg).
- **Stabilité de vitesse du pendule** : plus rapide que l'équilibre (frein, accélérateur, charge), la
  voile est tenue cabrée, plus lente piquée : l'oscillation vitesse–hauteur s'amortit en un ou deux
  balancements (relâché depuis 50 % : abattée 10°, +4 % de vitesse, vario −2,4 m/s). Le pendule visible
  (≈ 5,5 s) suit la force aérodynamique : bascule au freinage, abattée au relâché et à la réouverture.
- **Arrondi** : freins à fond en 0,4 s depuis le trim, +0,9 m/s de vario et 1,5 s de palier à 1,5 g,
  décrochage 2,6 s plus tard si l'on maintient. Effet de sol (McCormick) réel mais négligeable : l'aile
  est à ~7 m du sol, 0,2 % de chute en moins.
- **Virage** : freins et sellette demandent un taux de virage, l'inclinaison suit avec un retard
  pendulaire, la portance inclinée tourne la trajectoire, le cap suit le vent relatif. La sellette part
  d'abord à l'envers (≈ 4° de roulis opposé) puis tourne. Au-delà de ~60 % de frein intérieur à basse
  vitesse le virage dérape à plat ; la demi-aile intérieure trop lente décroche : vrille (arrêt mains
  hautes en ≈ 1 s). Spirale EN-B à 75 % : 77°, 3,7 g, 14 m/s (réf. DHV 14 m/s), 111°/s, sortie
  spontanée en 435° ; l'EN-A ne s'y engage pas (1,8 g), l'EN-C plus engagée.
- **Fermetures sur l'incidence** : marge d'incidence au centre et à chaque bout d'aile (l'air y est
  échantillonné, le côté qui ferme est celui de la rafale) ; elle grandit avec la pression aux freins,
  diminue avec l'accélérateur, une rafale descendante, une rafale arrière (la voile part devant).
  Rafale franche critique : B bras hauts 2,1 m/s, 35 % de frein 3,4 m/s, accélérateur à fond 0,9 m/s,
  A 2,8 m/s, C 1,7 m/s. Bandes EN 926-2 : A 50 % → 21° de cap, 11° de roulis ; B 70 % → 103°, 38° ;
  C 75 % → 255°. Frontale : bascule arrière puis abattée à la réouverture (< 1,5 s sur la B).
  Contre-frein trop fort : le côté ouvert, surchargé, décroche (vrille) ; à la réouverture d'une grosse
  fermeture l'aile abat et l'autre côté ferme plus facilement 2,5 s (cascade). Décrochage freins à fond
  en 2,8 s, abattée de 41° à la sortie (bande EN-B 30–60°). Cravate et réouverture au pompage inchangées.
- **Pression aux freins** (exposée au HUD, en kg) : ≈ 4,5 kg à 50 % stabilisé, croît avec la pression
  dynamique et la course ; elle suit la marge d'incidence : elle mollit avant une fermeture (le signal
  du pilotage actif), se raffermit quand l'aile bascule, mollit avant le décrochage, nulle côté fermé.
  Piloter à la pression (freiner quand elle mollit, freiner l'abattée) supprime les fermetures du banc
  et réduit d'un tiers le tangage.
- Une plume soulevée par un thermique fait rouler l'aile et l'écarte du thermique : il faut tourner
  du côté qui monte.

### L'air (`airmass.ts`, `pilot-air.ts`, `game-worker.ts`)

- **Vent du site** évalué à la position et à l'altitude du pilote (5 fois par seconde, lissé), avec le
  **gradient près du sol** : profil logarithmique (rugosité 0,15 m, plus rugueux sous le vent) qui
  atteint le vent plein vers 25 m en air instable et 95 m en air stable (82 % du vent à 10 m l'après-
  midi, 65 % le soir). En finale dans un vent qui tombe à zéro au sol, sans compenser : −0,4 m/s de
  vitesse air et une chute au contact doublée. Le cisaillement vertical du modèle (brise de vallée sous
  le vent d'altitude, inversion) secoue.
- **Relief fin** (~10 m, le long du vent) : écoulement potentiel sur le profil, c.-à-d. la pente lissée
  par un noyau dont la largeur est la hauteur sol : l'ascendance commence en avant de la face
  (0,8 m/s à 100 m du pied d'une face de 300 m par 20 km/h), monte au-dessus de la crête et faiblit
  avec la hauteur ; survitesse et compression sur la crête (+70 % à 30 m), descendance derrière ;
  facteur 3D (une crête plutôt qu'un sommet). **Décollement** derrière une crête raide (> ~17°) au-delà
  de ~20 km/h : rotor (vent qui remonte près du sol, ~0,2 fois le vent), couche de cisaillement à
  hauteur de crête. **Venturi** dans les cols et passages étroits (+22 % dans 300 m). Le « sous le
  vent » du modèle (216 m) complète pour les crêtes plus lointaines.
- **Thermiques** placés sur le potentiel du modèle (intensité saisonnière `thermalSeason` du modèle) et
  l'atlas. Profil d'Allen (2006), cycle de vie en cosinus (Rachelson) avec un tirage par bulle (durée,
  rampes, force), 9 à 21 min ; cœur du côté au vent, descendance plus forte de ce côté ; **bord net** en
  air instable (paroi de ~5 m et tourbillons de 4 m dans la couche de cisaillement, ε ≈ 0,05–0,1 m²/s³ :
  ce qui ferme une aile) ; régime de **bulles** au-delà de ~25 km/h ; chaque thermique est **couché par
  le vent du site** échantillonné à sept hauteurs au-dessus de sa source (brise de pente ou de vallée en
  bas, vent d'altitude en haut) et son sommet revient contre le vent sous l'inversion. **Masse
  conservée** : anneau descendant d'Allen (plus fort dans la moitié haute) et puits large autour de
  chaque thermique rendent son flux, fond de convection à moyenne nulle (monte sur les reliefs
  ensoleillés, descend sur les vallées) : w moyen 0,006 m/s sur 16 × 16 km. **Ombre** : une source
  sous un cumulus perd son alimentation en 2–3 min et la retrouve en ~4 min, l'effet monte avec les
  bulles : les cycles sous les nuages. **Plafond et base des cumulus régionaux** (relief lissé sur
  ~10 km : 6 m d'écart de base sur 4 km au-dessus d'un relief de 600 m).
- **Convergences** documentées : ligne d'ascendance compensée de part et d'autre, les brises qui s'y
  rencontrent (≈ 1,6 m/s de bascule du vent en la traversant).
- **Trous d'air** et petites bulles (moyenne retirée : masse conservée).
- **Turbulence** : champ figé transporté par l'air (hypothèse de Taylor), σ et tailles de tourbillons
  selon la hauteur, le vent et la stabilité : Dryden près du sol (σw ≈ 0,13 × vent à 6 m, Lw = h, Lu
  plus long), Lenschow en couche convective, plus le sous-le-vent, le rotor, le cisaillement et les
  bords de thermiques ; lue au centre et aux deux bouts d'aile.
- **Météo** : tirée selon la saison (régimes de vent alpins, instabilité, humidité) ou réglée à la
  main ; elle évolue en vol (vent qui tourne et forcit, masse d'air qui respire, cumulus qui se
  développent l'après-midi). Plafond et base des nuages en découlent.

Coût : l'air au centre et aux bouts d'aile plus le pas de vol prennent 4,6 µs par pas de 1/120 s sur un
portable (321 thermiques dans la fenêtre), sans allocation.

Banc d'essai avec critères (PASS/FAIL) : `npx tsx scripts/dev/game-flight-bench.ts`
(`--only wing|air|day|perf`, `--verbose`) ; tests : `apps/web/test/`.

### Le décollage et le posé (`launch.ts`)

Face pente ou face voile : la voile monte selon le vent relatif (vent du site + course) vers sa
position d'équilibre au-dessus du pilote ; sans temporisation au frein elle le dépasse ; un vent de
travers la couche, à contrer au frein du côté haut ; en courant, les freins dirigent la course. Par vent
fort, dos à la voile, elle se lève seule en **mur** (basse, bord d'attaque ouvert), à tenir aux freins
avant de la monter ; sa traction croît avec la pression dynamique et, au-delà de ce que tiennent les
pieds, elle **traîne** le pilote ou l'**arrache** s'il lui fait face voile en l'air ; l'**affaler** (C,
touche X, ou freins à fond) interrompt proprement le décollage (R pour la replacer). On décolle quand
elle est stable, la vitesse air suffisante et la pente qui s'ouvre. Échecs expliqués.

Au **posé**, l'impact est jugé le long de la normale à la pente (≤ 2,5 m/s posé, 2,5–4 m/s dur, plus :
crash ; arriver vent arrière dans une pente montante, c'est la pente qui vient à soi), puis le pilote
**court** : ~3 m/s² de freinage par les jambes, aidé en montée, poussé en descente ; trop vite (au-delà
d'un sprint) ou incapable de s'arrêter en descente, il chute ; la voile reste en l'air tant qu'il y a du
vent et peut le traîner s'il ne l'affale pas.

### Le jeu

- Tous les décos de l'atlas et de la FFVL dans l'emprise du relief ; départ en l'air ou au déco.
- **Manches de cross** sur les itinéraires documentés : balises dans l'ordre (cylindres de 400 m),
  chrono, distance validée si l'on pose avant le but, finesse nécessaire jusqu'à la balise.
- **Pause** : ce que disent les sources autour (dangers, brises, thermiques…), **carte topo**
  interactive.
- Vario sonore, bruit du vent selon la vitesse, claquement de la voile ; vautours en thermique
  (plus fréquents dans les Préalpes du Sud) ; thermiques visibles en flux rouges (option).
- Paysage : orthophotos IGN, relief, bâtiments ; les tuiles sont gardées sur l'appareil (service
  worker `public/tiles-sw.js`) et ne sont pas retéléchargées d'une session à l'autre.

## Commandes

Clavier : A/Q frein gauche +/−, E/D frein droit +/−, S/F sellette à gauche/droite, Espace accélérateur
(au déco : se retourner), Z courir / tirer les A, O oreilles, X stabilo en vol / affaler la voile (C)
au sol, R replacer la voile après un décollage interrompu, flèches : tête, C regard devant, V vue,
T thermiques, P pause, M son, +/− temps accéléré. Écran tactile : deux curseurs de frein, boutons.

## Limites connues

- Point matériel inertiel avec pendule visible, pas un modèle multicorps : le balancement ne modifie
  pas l'incidence (couplage essayé : il déstabilise l'oscillation vitesse–hauteur) ; la stabilité de
  vitesse en tient lieu. Les incidents se déclenchent sur l'incidence mais leur déroulé reste
  paramétré sur les bandes EN 926-2.
- Relief : écoulement potentiel linéaire sur un profil 2D le long du vent (facteur 3D grossier),
  rotor paramétré par la géométrie de la crête, pas d'ondes de ressaut.
- Tourbillons des bords de thermiques calés sur une estimation de Kolmogorov et l'expérience de vol,
  pas sur des mesures ; la spirale calée sur la plage des rapports EN (12–19 m/s), plus 17 m/s.
- Bandes EN 926-2 des classes C et D non vérifiées sur la norme ; chiffres du décollage, du posé et de
  la course d'arrêt à caler avec des pilotes.
- Les thermiques suivent le potentiel du modèle et l'atlas ; ils ne sont pas validés trace par trace.

## Sources principales

- Allen, M. J. (2006), *Updraft Model for Development of Autonomous Soaring Uninhabited Air Vehicles*,
  NASA TM-2006-213475 — https://ntrs.nasa.gov/citations/20060004052
- Rapports d'essais EN 926-2 (bandes A/B) : https://service.dhv.de/dbfiles/managed/muster/hersteller_zertifikate/EN_926-22013_Rook2.pdf ,
  https://www.apcoaviation.com/wp-content/uploads/2023/08/certification.nestra.S.pdf ; résumé des classes :
  https://dhpc.org.uk/assets/files/Exam%20Revision%20Material/Glider%20ratings%20-%20en926.pdf
- Modèles de parapente : Slegers & Costello (2003) https://www.camm.gatech.edu/images/7/73/Slegers_2003_AspectsControlPAPS.pdf ;
  P. Heatwole, *glidersim* https://pfheatwole.github.io/thesis/system_dynamics.html
- Turbulence : modèle de Dryden (MIL-F-8785C) https://www.mathworks.com/help/aeroblks/drydenwindturbulencemodelcontinuous.html ;
  couche convective : Lenschow et al. (1980), repris dans https://acp.copernicus.org/articles/23/4045/2023/acp-23-4045-2023.pdf
- Cycle de vie des thermiques (Rachelson), inclinaison (Bencatel), conservation de la masse (Allen) : synthèse
  ISAE-Supaero https://websites.isae-supaero.fr/IMG/pdf/report.pdf
- Masse ajoutée d'une voile (Lissaman & Brown), repris par Toglia & Vendittelli
  https://rosa.uniroma1.it/rosa00/dis_technical_reports/article/download/8850/8821
- Survitesse sur les crêtes (théorie de Jackson & Hunt, 1975) et effet de sol (McCormick) : formules
  classiques, non relues ici.
- Nuages volumétriques temps réel : Schneider, *The Real-time Volumetric Cloudscapes of Horizon Zero Dawn*
  https://www.advances.realtimerendering.com/s2015/The%20Real-time%20Volumetric%20Cloudscapes%20of%20Horizon%20-%20Zero%20Dawn%20-%20ARTR.pdf
- Technique de pilotage (thermique, arrondi, décrochage) : https://xcmag.com/fly-better/paragliding-techniques-paramotoring-skills/thermalling-how-tight-should-you-turn/ ,
  https://blog.flywithgreg.com/how-to-swoop-flare-your-paraglider/ , https://flybubble.com/blog/paraglider-control-stall-spin-collapse
