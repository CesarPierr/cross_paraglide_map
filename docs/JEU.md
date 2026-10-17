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
- **Vue pilote** (l'œil suit la tête : assis dans la sellette en vol, debout au déco) ou de
  l'extérieur. Au déco, les mains tiennent élévateurs et freins et suivent les élévateurs quand la
  voile monte : bras en arrière face pente, devant soi face à la voile.
- **Météo** : réglée à la main, aléatoire selon la saison (puis elle évolue), ou **météo du jour**
  (`forecast.ts`) : la prévision AROME au décollage pour aujourd'hui donne le vent aux crêtes, la
  masse d'air par le gradient 850–700 hPa (3 °C/km → stable, 9 → très instable) et l'humidité par
  la hauteur de la base des cumulus au-dessus du sol.
- **Trace IGC** : le vol est enregistré (un point par seconde une fois en l'air) et se télécharge à
  la fin au format IGC (`igc.ts`), pour le revoir dans les outils de vol habituels ; l'en-tête le
  marque comme vol simulé (pas d'enregistrement de sécurité G).
- **Tableau de bord** : vario, pression dans chaque frein (kg, la jauge pulse quand la pression
  mollit avant une fermeture), sellette, accélérateur, aide au décollage puis au posé (course
  d'arrêt) ; sur écran tactile, boutons Affaler et Recommencer.
- **Manches de cross** sur les itinéraires documentés : balises dans l'ordre (cylindres de 400 m),
  chrono, distance validée si l'on pose avant le but, finesse nécessaire jusqu'à la balise.
- **Pause** : ce que disent les sources autour (dangers, brises, thermiques…), **carte topo**
  interactive.
- Vario sonore, bruit du vent selon la vitesse, claquement de la voile ; vautours en thermique
  (plus fréquents dans les Préalpes du Sud) ; thermiques visibles en flux rouges (option).
- Paysage : orthophotos IGN, relief, bâtiments ; les tuiles sont gardées sur l'appareil (service
  worker `public/tiles-sw.js`) et ne sont pas retéléchargées d'une session à l'autre. Lumière, ombres
  et matériaux du sol : voir ci-dessous.

### Le paysage (`lod.ts`, `ground.ts`, `region.ts`, `materials.ts`)

- **Détail des tuiles par la distance vraie** (`lod.ts`) : MapLibre choisit le niveau de chaque tuile
  d'après sa distance et l'angle sous lequel elle est vue, en supposant que le point visé est au sol.
  Avec la caméra du pilote, ce point est en l'air : près de l'horizontale l'orthophoto réclamait ses
  tuiles les plus fines jusqu'à l'horizon (10 600 tuiles IGN à 89° de tangage, page figée) et le
  relief s'effondrait en quelques tuiles grossières (relief flou, jupes visibles aux sauts de niveau).
  Le niveau suit désormais la seule distance à l'œil (texel ≈ pixel à l'écran), plancher donné par la
  distance au relief le plus proche (une paroi à 30 m de l'aile est aussi nette que le sol à 30 m) ;
  les tuiles du relief lui-même (maillage et texture où l'image est drapée) suivent la même règle
  (au plus z17), le Sentinel-2 un niveau en dessous. 130 à 175 tuiles IGN en vol, quel que soit
  le tangage ; l'axe donné à MapLibre reste à 0,1° au moins de l'horizontale.
- **Lumière du relief** (`ground.ts`, `region.ts`) : trois niveaux d'altitudes autour du pilote, tirés
  du relief tel que MapLibre le dessine (6 km à ~6 m, 60 km à ~60 m) et de la grille du modèle de vent
  (160 km à 216 m, pour les montagnes non chargées, derrière la caméra) ; pour chacun, la pente, les
  **ombres portées** (marche vers le soleil, pénombre douce) et la part de ciel que le relief laisse
  voir (horizon dans huit directions : fonds de vallée et gorges moins éclairés). Refait quand les
  altitudes changent ou que le soleil bouge, réparti sur quelques images. L'orthophoto est lue comme
  le sol sous la lumière de référence (midi d'été, soleil à 60° au sud), la part de cette lumière
  propre à la pente retirée, puis éclairée par le soleil de l'heure sur cette pente, derrière les
  ombres des montagnes et des nuages (clouds.ts), par le ciel ouvert et par le sol en contrebas. Elle
  remplace l'ombrage de MapLibre. Le planeur et les arbres 3D passent à l'ombre des montagnes et des
  nuages comme le sol.
- **Matériaux par type de sol** (`materials.ts`) : chaque pixel est classé d'après la couleur de la
  photo ramenée en albédo, la pente, l'altitude et les parts d'arbres, de sol nu, de neige et glace et
  de bâti de la maille ESA WorldCover (216 m) ; seuils lus sur les orthophotos (forêt dense : albédo
  0,035–0,075, verte ; lacs : cyan saturé, plats ; calcaire : 0,25–0,4, gris ; glacier : > 0,4).
  Puis un détail procédural (sept motifs générés au démarrage sur le GPU, aucun fichier), qui apparaît
  là où la photo manque de pixels et fond avec la distance :
  - forêt : houppiers de tailles diverses, trouées sombres, ombre propre qui grandit quand le soleil
    baisse, point chaud (plus claire soleil dans le dos, plus sombre à contre-jour) ;
  - roche et falaises : strates d'épaisseur inégale, la plupart affleurantes, quelques-unes en
    corniche avec le pied à l'ombre, diaclases, coulures sombres, sur les faces verticales
    (projection latérale) ; les bancs suivent des plis doux (pendage de quelques degrés, jusqu'à
    ~15°, qui tourne d'une falaise à l'autre) et ne longent donc pas les courbes de niveau ; au-delà
    de ~60° la photo, étirée dans la pente, est lissée en travers et les grands bancs (une dizaine
    de mètres) restent visibles à plusieurs kilomètres, en teintes plus qu'en relief ; une forêt
    sombre dans une maille boisée reste forêt jusqu'à ~68° (le relief grossier raidit la forêt le
    long d'une barre) ; blocs et éboulis vus du dessus. Le micro-relief n'incline jamais la normale
    de plus de 45° : au-delà, un texel ne fait qu'un trait noir ;
  - prairie et alpage : touffes et taches ; cultures : sillons, orientés différemment d'une parcelle
    à l'autre ;
  - neige et glace : sastrugi en travers du vent, crevasses en travers de l'écoulement des glaciers,
    reflet doux vers le soleil, scintillement des cristaux tout près ; à l'ombre, la lumière du ciel
    la rend bleutée ;
  - eau : reflet du ciel (Fresnel, assombri vers l'horizon où sont les rives), éclat du soleil,
    rides poussées par le vent du modèle au pilote, brises comprises (plus de rugosité quand elles
    deviennent plus fines qu'un pixel) ; hauts-fonds turquoise compris ;
  - bâti : pas de détail ; bâtiments 3D avec murs (enduit, pierre, bois, béton) et toits (ardoise,
    tuiles, tôle) variés, éclairés du côté du soleil.
- **Neige de saison** : au-dessus d'une limite mensuelle (≈ 900 m en janvier, 1 650 m en avril,
  2 500 m en juin), calée sur les limites médianes des Alpes (Hantel et al. 2012 : ≈ 800 m l'hiver,
  ≈ 3 100 m l'été, plus haute l'hiver à l'ouest) et 250 m plus haute dans les massifs du sud, plus
  secs (Durand et al. 2009) ; 280 m plus bas en ubac, plus haut en adret, irrégulière près de la
  limite, absente des faces de plus de ~55° et des affleurements sombres, cachée sous les arbres.
  De juillet à septembre, l'orthophoto (prise en été) montre déjà la neige de la saison. Les arbres
  3D suivent aussi la saison (feuillus nus l'hiver, jaunes et orangés en octobre).
- **Coût** (M1 Pro, 1920×1080, passe du paysage dessinée 200 fois hors écran, médiane) : 0,51–0,56 ms
  d'origine, 0,64–0,72 ms avec la lumière du relief, 1,11–1,33 ms avec les matériaux. Les passes du
  relief tournent seulement quand quelque chose change, une étape lourde par image : une mise à jour
  du niveau proche coûte ≈ 3 ms de GPU répartis sur ~7 images, plus le dessin des altitudes par
  MapLibre (≈ 2,5 ms, sur une seule image), au plus une fois par seconde (le niveau lointain toutes
  les 4 s) : ≈ 0,1 ms par image en moyenne en vol.
  Sur téléphone : niveaux en 512², matériaux sans motifs de détail ; si les images restent lentes,
  la qualité adaptative du ciel retire les motifs de détail (ordinateur) ou les matériaux
  (téléphone), la lumière et les ombres du relief restent. Outil de captures et de mesure :
  `npx tsx scripts/dev/game-capture.ts` (`__game.world.benchGround()`, `benchRelief()` en développement).

## Commandes

Clavier : A/Q frein gauche +/−, E/D frein droit +/−, S/F sellette à gauche/droite, Espace accélérateur
(au déco : se retourner), Z courir / tirer les A, O oreilles, X stabilo en vol / affaler la voile (C)
au sol, R replacer la voile après un décollage interrompu, flèches : tête, C regard devant, V vue,
T thermiques, P pause, M son, +/− temps accéléré. Écran tactile (de préférence en paysage) : deux
curseurs de frein sur les bords, en vol l'accélérateur et les oreilles à côté d'eux et la sellette en
curseur au milieu (elle revient au centre quand on la lâche) ; au déco, courir (ou tirer les A),
affaler et recommencer ; glisser ailleurs pour regarder autour. Les crédits des cartes se replient
dans leur bouton (i) une fois en vol.

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
- Paysage : le type de sol est déduit de la couleur de la photo (erreurs possibles : champ sombre,
  toit clair, calcaire pris pour de la neige au-dessus de 2 400 m) ; un bâtiment isolé hors des zones
  bâties reçoit parfois le détail du sol derrière lui ; les rivières étroites ne sont pas reconnues
  comme de l'eau ; les lacs ne reflètent pas les montagnes ; le relief proche reste celui des tuiles
  AWS (~25 m) ; la neige suit une climatologie, pas l'enneigement du jour.

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
- Limite des neiges : Hantel, M., Maurer, C., Mayer, D. (2012), *The snowline climate of the Alps
  1961–2010*, Theor. Appl. Climatol. 110, 517–537, https://doi.org/10.1007/s00704-012-0688-9 ;
  Durand, Y. et al. (2009), *Reanalysis of 47 Years of Climate in the French Alps (1958–2005):
  Climatology and Trends for Snow Cover*, J. Appl. Meteor. Climatol. 48,
  https://doi.org/10.1175/2009JAMC1810.1
- Occupation du sol : ESA WorldCover 10 m 2021 v200 (CC BY 4.0), https://esa-worldcover.org
- Reflets : microfacettes GGX (Walter et al. 2007, *Microfacet Models for Refraction through Rough
  Surfaces*, EGSR) et approximation de Fresnel de Schlick (1994).
- Nuages volumétriques temps réel : Schneider, *The Real-time Volumetric Cloudscapes of Horizon Zero Dawn*
  https://www.advances.realtimerendering.com/s2015/The%20Real-time%20Volumetric%20Cloudscapes%20of%20Horizon%20-%20Zero%20Dawn%20-%20ARTR.pdf
- Technique de pilotage (thermique, arrondi, décrochage) : https://xcmag.com/fly-better/paragliding-techniques-paramotoring-skills/thermalling-how-tight-should-you-turn/ ,
  https://blog.flywithgreg.com/how-to-swoop-flare-your-paraglider/ , https://flybubble.com/blog/paraglider-control-stall-spin-collapse
