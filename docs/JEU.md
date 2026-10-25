# Le simulateur de vol (onglet « Jeu »)

Un simulateur de parapente dans le navigateur, au-dessus de la carte 3D du site. Il vole dans le
**modèle de vent du site** (brises de pente et de vallée, vent météo modifié par le relief, dangers
documentés) : c'est ce qui le distingue des simulateurs existants, dont l'aérologie est générique.
Code : `apps/web/src/game/` (chargé seulement à l'ouverture de l'onglet).

## Ce qui est simulé

### L'aile (`flight.ts`)

- **Freinage par paliers** (EN-B, 95 kg, air calme) : 37,4 km/h et 1,11 m/s bras hauts, 33 km/h à
  20 %, chute mini 0,97 m/s vers 30 % (31 km/h), 27 km/h et 1,13 m/s à 50 %, 23 km/h et 2 m/s à 80 %,
  décrochage vers 88 % ; chaque palier de 10 % pris en ~2 s, sans le plongeon qui suivait un coup de
  frein (amortissement en tangage, coupé en virage serré).
- **Spirale engagée** : frein d'un côté à 60–75 % (et sellette), 74–77° d'inclinaison, nez bas de
  30–38°, 10–13 m/s de chute sous ~3,7 g ; sortie mains hautes avec ressource. Le nez bas de la
  trajectoire s'ajoute au balancier de l'aile, la tête ne compense plus que ~15° de roulis et 8° de
  tangage : en vue pilote, le sol remplit l'écran.
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
  pendulaire, la portance inclinée tourne la trajectoire, le cap la suit. La sellette part
  d'abord à l'envers (≈ 4° de roulis opposé) puis tourne. Au-delà de ~60 % de frein intérieur à basse
  vitesse le virage dérape à plat ; la demi-aile intérieure trop lente décroche : vrille (arrêt mains
  hautes en ≈ 1 s). La demi-aile intérieure est jugée à son centre de portance (2 m, demi-envergure
  projetée elliptique) et sa demande de portance croît comme (V/v)^0,7 (une voile souple reporte une
  partie de sa charge) ; le resserrement du virage en spirale vient de la charge (> 1,15 g) : il ne
  devance plus la prise de vitesse. Avant, à 1 000–2 000 m, un frein intérieur à 75 % finissait en
  vrille à ~50° d'inclinaison (le banc ne testait la spirale qu'à 3 000 m). Spirale EN-B à 75 % :
  77–78°, 12,5 m/s à 1 000 m, 13–14 m/s à 3 000 m (réf. DHV 14 m/s), 3,7 g, 115°/s, nez bas 37–50°
  (« 360 face planète »), sortie spontanée en ~370° ; pas de vrille à 80 % progressif.
- **Cap tenu** : le cap est un état de l'aile, plus une copie du vent relatif. Une rafale, une brise,
  l'aspiration d'un thermique tournent l'écoulement avant que le parapente suive l'air : il dérape, la
  surface latérale de la voile l'emporte avec l'air (sa trace dérive, en ~1,4 s) et la voile ne se
  remet au vent que lentement (5 s : son lacet vers la rafale et le roulis que la force latérale donne
  à la voile se compensent presque). Une rafale latérale de 3 m/s tourne le cap de 3°, et non plus des
  16° de l'écoulement. Un bout d'aile soulevé fait rouler l'aile (≈ 1° tenu par m/s d'écart entre les
  bouts, amortissement en roulis Clp ≈ −0,12 d'une voile arquée) et la fait lacer (≈ 0,9°/s par m/s,
  portance inclinée vers l'avant, Cnp ≈ −CL/16) : elle s'écarte d'environ 2°/s du côté qui monte tant
  que ça dure (2 m/s sous un bout pendant 2 s : 6° de cap, 3° de roulis) ; avant, le couplage était
  ~10 fois plus fort et la secousse aléatoire dépendait du pas de calcul. Mains hautes en turbulence
  modérée (σw 1 m/s) : cap médian 3,5° sur 10 s (12° au 95e centile, contre ±180° en 5 min avant),
  roulis efficace 1,3°. Dans le jeu (6 décos, juillet 14 h, 60 s mains hautes, robot
  `scripts/dev/game-flight-live.ts`) : cap médian 1,1° sur 10 s (95 % : 6°) contre 7,7° (95 % : 66°)
  avant, roulis au 95e centile 1,1° contre 17°.
- **Classes EN** : toutes les ailes font les mêmes figures (spirale face au sol, wings, décrochage) ;
  ce qui change est l'action qu'il faut et ce que l'aile fait seule, selon la grille des essais EN
  926-2 (rapports Air Turquoise et DHV : sortie de spirale mains hautes < 720° → A, 720–1080° → B,
  spirale évaluée à 14 m/s pour toutes ; abattée en sortie de décrochage ou de frontale 0–30° → A,
  30–60° → B ; cap d'une fermeture asymétrique < 90° → A, 90–180° → B ; vrille arrêtée en < 90° → A,
  90–180° → B). Paramètres par famille (`WINGS`) : performances (polaire, vitesse et finesse à
  l'accélérateur à fond : A 45,5 km/h et 6,1, B 50,6 et 7,0, C 56,4 et 7,9), inertie (roulis et lacet
  d'une envergure plus longue : la C met plus longtemps à entrer et à sortir d'un virage, balance plus
  en wing), stabilité (amortissement en tangage et en roulis, stabilité spirale), sécurité passive
  (marge avant fermeture, cap et réouverture, cascade, cravate, course au décrochage, marge avant la
  vrille, arrêt de la vrille) ; plus aucune branche codée par classe. La course de frein est rapportée
  à celle de la classe (décrochage à 95 % sur l'A, 88 % la B, 82 % la C). Mesures (banc) : spirale
  à 1 000 m — A 85 % + sellette 76°, 10,6 m/s, nez 36°, sortie ~260° ; B 75 % 77°, 12,5 m/s, ~370° ;
  C 75 % 80°, 16 m/s, nez ~60°, ~730° ; à 75 % l'A chute 8 m/s quand la B en fait 12,5. Abattée en
  sortie de décrochage A 27°, B 40°, C 50°. Wings (75 % et sellette en phase) : 83° pour toutes, tangage
  37° (A) à 94° (C). Vrille : l'A ne vrille que forcée (vol lent à 70 % puis 100 % d'un côté) et
  s'arrête en 83° ; B 130°, C 155°. En turbulence modérée, entrée en spirale sans vrille sur 10 essais
  pour B et C, l'A à 80 % aussi (1 sur 10 à 85–90 %). Dans le jeu, sur 6 décos : spirale A 78–79°,
  12–14 m/s ; B 78–79°, 14–15 m/s ; C 78–81°, 16–17 m/s ; nez bas 40–58°, aucune vrille.
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
- Une plume soulevée par un thermique fait rouler l'aile et l'écarte du thermique, de quelques degrés
  (voir « Cap tenu ») : il faut tourner du côté qui monte.

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
  l'atlas, à 400 m l'un de l'autre au moins (haut de la fourchette d'Allen, ~2 par km² à mi-hauteur) :
  par journée moyenne en juillet à 14 h, 2 à 14 thermiques enroulables dans 2,4 km autour des décos
  mesurés (Saint-Hilaire, Chamonix, Annecy, Bauges, Vercors, Écrins, Haute-Maurienne, Nyons, Chabre,
  Ubaye, Verdon, Gréolières ; 0 à 7 avant). **Force calée sur les montées documentées** (Grésivaudan
  l'été en régime anticyclonique : « varios de 2 à 3 m/s » ; thermiques réputés, Deux Sœurs, Agy,
  Valmeinier : « souvent plus de +4 m/s ») : le cœur monte 1,45 fois l'échelle du jour (`CORE_GAIN`).
  Saint-Hilaire en août à 14 h 30, masse d'air 0,55 : dans les thermiques actifs, montée nette des 10 %
  meilleurs 2–3 m/s (1–1,8 avant), 1 % à 3,5–5 m/s ; un robot qui enroule le cœur des 16 meilleurs à
  moins de 6 km monte de 2,5 m/s en médiane (0,7 avant), 3,7 au mieux ; l'air entre les thermiques
  inchangé (médiane −0,08 m/s). Un cœur
  la plupart du temps (deux ou trois parfois), peu allongé, assez large pour y spiraler. Profil d'Allen (2006), cycle de vie en cosinus (Rachelson) avec un tirage par bulle (durée,
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
(`--only wing|air|day|perf`, `--verbose`) ; tests : `apps/web/test/`. Dans le vrai jeu (serveur de
développement) : `npx tsx scripts/dev/game-flight-live.ts` (un robot vole mains hautes puis spirale
sur six décos, avec captures ; `--wing A|B|C`) ; dérive du cap en air synthétique :
`npx tsx scripts/dev/heading-probe.ts`.

### Le décollage et le posé (`launch.ts`)

Face pente ou face voile : la voile monte selon le vent relatif (vent du site + course) vers sa
position d'équilibre au-dessus du pilote ; sans temporisation au frein elle le dépasse ; un vent de
travers la couche, à contrer au frein du côté haut ; en courant, les freins dirigent la course. Par vent
fort, dos à la voile, elle se lève seule en **mur** (basse, bord d'attaque ouvert), à tenir aux freins
avant de la monter ; sa traction croît avec la pression dynamique et, au-delà de ce que tiennent les
pieds, elle **traîne** le pilote ou l'**arrache** s'il lui fait face voile en l'air ; l'**affaler** (C,
touche X, ou freins à fond) interrompt proprement le décollage (R pour la replacer). On décolle quand
elle est stable, la vitesse air suffisante et la pente qui s'ouvre. Échecs expliqués. La voile quitte le
sol près de sa vitesse mini (~25 km/h) : par vent de face sur une pente douce, les pieds peuvent
retoucher dans les secondes qui suivent ; ce n'est pas un posé, le pilote **court encore** et la voile le
reprend (dans les 10 s après le décollage, contact doux, pente qui descend devant).

Au **posé**, l'impact est jugé le long de la normale à la pente (≤ 2,5 m/s posé, 2,5–4 m/s dur, plus :
crash ; arriver vent arrière dans une pente montante, c'est la pente qui vient à soi), puis le pilote
**court** : ~3 m/s² de freinage par les jambes, aidé en montée, poussé en descente ; trop vite (au-delà
d'un sprint) ou incapable de s'arrêter en descente, il chute ; la voile reste en l'air tant qu'il y a du
vent et peut le traîner s'il ne l'affale pas.

### Le jeu

- Tous les décos de l'atlas et de la FFVL dans l'emprise du relief ; départ en l'air ou au déco.
- **Autres pilotes** (option du menu) : 3 à 12 parapentistes virtuels selon la journée volent le
  même air, plané de thermique en thermique, spirale de ~30 m autour du cœur avec la montée qu'il y
  donne, départ quand il faiblit ou plafonne, virage vers la vallée près du relief ; un groupe qui
  enroule marque un thermique, comme en vrai.
- **Bilan et records** : en fin de vol, durée, distance au déco, plus haut, gain total, meilleur
  thermique (moyenne d'un tour), temps pour atteindre le plafond ; les records de chaque déco sont
  gardés dans le navigateur et signalés quand ils tombent.
- **Aide au centrage** : à côté de la rose des vents, la trace des 40 dernières secondes autour du
  pilote, cap en haut, colorée par le vario, et l'endroit où ça montait le mieux (vers lequel décaler
  le virage) ; sous le vario, « moy. », la montée moyenne du dernier tour.
- **Vue pilote** (l'œil suit la tête : assis dans la sellette en vol, debout au déco) ou de
  l'extérieur. Au déco, les mains tiennent élévateurs et freins et suivent les élévateurs quand la
  voile monte : bras en arrière face pente, devant soi face à la voile.
- **Pilote et sellette** (`glider-gear.ts`, `glider-pilot.ts`) : pilote de 1,70 m (segments de
  Winter) allongé à ~35° dans une sellette cocon (speedbag, cockpit avec l'instrument sur les genoux,
  coque à protection dorsale, carénage arrière), sangles, mousquetons à 42 cm, casque ouvert, gants
  fins (main de 19 × 8,5 cm) refermés sur des poignées de frein tenues comme un manche ; cotes des
  fiches constructeurs (Buzz Z7 MS, Lightness 3, X-Rated 7, élévateurs Cruiser), postures relevées
  sur des photos en vol, au déco et en vues embarquées : mains hautes à hauteur des yeux sous les
  poulies, avant-bras presque verticaux, coudes bas contre la sellette ; en freinant, poings au menton
  puis aux hanches. Au déco il se tient debout (speedbag vide le long des tibias, carénage dressé
  derrière le dos), bras en arrière pour gonfler, puis court avec une vraie foulée. La
  voile n'est pas soudée au pilote : elle tourne autour des mousquetons (balancier amorti de ~1,1 s
  poussé par les accélérations de roulis et de tangage, sellette inclinée de ~5° à fond de
  transfert, bout d'aile soulevé par une rafale ; estimations, pas des mesures) et, au décollage,
  repart de sa position au sol. Les suspentes détendues (fermeture, oreilles, mains hautes) se
  courbent et frémissent.
- **Voile vivante** (`glider.ts` `WingDynamics`, `glider-shape.ts`) : neuf stations le long de
  l'envergure, chacune ressort amorti en flexion, avance-recul et vrillage, couplées entre elles (une
  rafale sous un bout d'aile s'y propage en onde ; bouts ~1,6 Hz, centre ~3 Hz), poussées par les
  rafales aux bouts d'aile, le roulis, le lacet et la charge ; bord d'attaque qui se creuse à
  l'approche d'une fermeture. Les fermetures balaient l'aile en ~0,15 s, le rabat claque et rebondit,
  puis se rouvre vers le bout avec un coup vers l'avant ; oreilles repliées presque à la verticale ;
  au gonflage, caissons remplis du centre vers les bouts, bouts en retard. **Tissu simulé dans
  Blender** (`scripts/blender/canopy-sim.py`, sans interface, relançable ; forme exportée par
  `canopy-export.ts` avec le code du jeu) : voile fermée sous pression (65 Pa), nervures tenues, à
  quatre niveaux de frein ; ses écarts à la forme du jeu (caissons bombés, bord de fuite festonné
  entre les pattes de frein) forment une base de 60 ko (`public/data/canopy-basis.bin`, int8) que le
  shader mélange selon le frein de chaque côté, chargée en arrière-plan. Coût : GPU de l'aile 0,117 →
  0,135 ms, CPU 0,031 → 0,034 ms par planeur ; dynamique coupée au-delà de 150 m.
- **Météo** : réglée à la main, aléatoire selon la saison (puis elle évolue), ou **météo du jour**
  (`forecast.ts`) : la prévision AROME au décollage pour aujourd'hui donne le vent aux crêtes, la
  masse d'air par le gradient 850–700 hPa (3 °C/km → stable, 9 → très instable) et l'humidité par
  la hauteur de la base des cumulus au-dessus du sol.
- **Trace IGC** : le vol est enregistré (un point par seconde une fois en l'air) et se télécharge à
  la fin au format IGC (`igc.ts`), pour le revoir dans les outils de vol habituels ; l'en-tête le
  marque comme vol simulé (pas d'enregistrement de sécurité G).
- **Contact avec le relief** : un frôlement léger d'une pente aile en vol (impact sous 1,5 m/s,
  pente de plus de 15°) ne termine plus le vol, où qu'il arrive : les pieds glissent, le vol continue,
  un message le signale ; traîné plus de 1,5 s, ou un vrai impact, c'est la fin du vol. Une alerte
  « Relief devant », avec deux bips descendants, prévient quand la trajectoire des 2 à 4 s suivantes
  rencontre le sol (en vue pilote, la pente sous soi ne se voit pas). En vue pilote, le regard se
  tourne vers l'intérieur du virage (0,6 fois l'inclinaison, jusqu'à ~35°), comme le fait un pilote.
- **Tableau de bord** : vario, pression dans chaque frein (kg, la jauge pulse quand la pression
  mollit avant une fermeture), sellette, accélérateur, aide au décollage puis au posé (course
  d'arrêt) ; sur écran tactile, boutons Affaler et Recommencer.
- **Manches de cross** sur les itinéraires documentés : balises dans l'ordre (cylindres de 400 m),
  chrono, distance validée si l'on pose avant le but, finesse nécessaire jusqu'à la balise.
- **Défis** (`challenges.ts`, menu « Défi », depuis n'importe quel déco) :
  - **Plafond** : atteindre le plafond du jour ou la base des cumulus (100 m dessous, là où l'on
    est ; au moins 200 m au-dessus du déco) le plus vite possible, chrono parti au décollage ;
  - **Aller-retour** de 5, 10 ou 20 km : une balise puis retour au déco ;
  - **Triangle FAI** de 10, 25 ou 50 km : trois balises, plus petite branche ≥ 28 % du périmètre,
    le déco sur un côté ou tout près (parcours déco → B1 → B2 → B3 → déco au plus 15 % plus long
    que le triangle).
  Cylindres de 400 m, chrono depuis le décollage, distance validée, vitesse moyenne (ou montée
  moyenne pour le plafond), réussite ou non dans le bilan, meilleur temps gardé par déco et par
  défi (`brises.game.challenges`). Les balises sont placées au lancement sur la grille du modèle
  (216 m) et la journée : dans la grille jouable, sur un relief qui fait des thermiques (au moins
  200 m de dénivelé dans 2 km : ni plaine, ni mer), sous le plafond du jour avec 250 m de marge
  (ou sous l'arrivée d'un plané à 8 depuis un déco plus haut que le plafond), les branches le long
  des reliefs plutôt qu'au-dessus des plaines et des crêtes plus hautes que le plafond, la
  première face au vent quand il souffle ; nommées d'après le lieu documenté le plus proche.
  Génération : 5 ms en moyenne (au plus ~150 ms quand une recherche fine est nécessaire), plus le
  décodage de la grille d'altitudes. Si la journée ne permet aucun parcours valide (déco de haute
  montagne sous un plafond bas), le meilleur est proposé avec un avertissement. Contrôle sur tous
  les décos : `npx tsx scripts/dev/challenges-check.ts` (`--all` : la liste du jeu, `--verbose`).
  Balises sur la vue (le cylindre du départ disparaît une fois parti) et sur la carte topo de la
  pause, avec le parcours.
- **Mode école** (`school.ts`, option du menu) : un conseil à la fois, la touche à presser en
  évidence, le frein à tirer surligné ou une flèche vers où regarder, tiré de l'état réel du vol
  (lu dix fois par seconde) ; un conseil reste au moins 3,5 s (0,8 s au déco, où les étapes suivent
  la voile) sauf plus urgent, puis attend avant de revenir ; un petit carillon pour les conseils
  importants (sécurité, entrée en thermique).
  - Au déco : le vent sur la pente (de face, de travers, arrière : ne pas décoller), tirer les A et
    courir, un ou deux paliers de frein quand la voile arrive au-dessus, le côté qui tombe, courir
    jusqu'au décollage, mains hautes ; chaque échec expliqué (voile qui retombe, qui dépasse, qui part
    sur le côté, traîné, vent arrière, décollage interrompu). Temps ralenti réglable (×0,75, ×0,5)
    pendant le décollage.
  - En vol : l'entrée dans une ascendance et le côté où tourner (le bout d'aile qui se soulève, ou
    la position du cœur), l'inclinaison (paliers de frein intérieur, sellette), le recentrage vers
    le meilleur du dernier tour (« ouvre 2–3 s quand tu y fais face »), la sortie du thermique, le
    plafond, le thermique suivant à portée (≥ 1,2 m/s, atteignable à finesse 7 avec 200 m de marge).
  - Sécurité : trop de frein (≥ 70 %, près du décrochage), relief devant et le côté le plus bas où
    virer ; l'atterrissage documenté le plus facile à rejoindre, puis l'approche (perte d'altitude
    à côté du terrain, prise de terrain en U, base, finale face au vent, arrondi vers 2 m).
  Coût mesuré (e2e, M1 Pro) : 12–18 µs par image en moyenne pour l'école et les défis, sans
  allocation par image (le texte n'est refait qu'au changement de conseil ou une fois par seconde ;
  la recherche des thermiques, deux fois par seconde et toutes les deux secondes, ~20–60 µs).
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
- **L'œil là où est le pilote** (`world.ts`) : le plan de coupe proche de MapLibre est à tan(fov/2)/25
  de la distance au point visé (~31 m à 1 200 m) et MapLibre remontait sa caméra dès que ce plan
  entrait dans le relief : de 17 à 33 m debout au décollage, jusqu'à 50 m à 15 m d'une pente, selon
  la direction du regard. Le paysage montait et descendait autour du pilote quand on tournait la tête
  (en 3e personne, la voile, dessinée à part, paraissait plus haute que la pente), et on se croyait
  plus loin du relief qu'on ne l'était (crash « loin » de la pente). Le point visé se rapproche
  désormais près du relief (plan proche à 40 % de la distance au sol, au moins 0,4 m) et MapLibre ne
  déplace plus la caméra ; la caméra de poursuite raccourcit son bras quand le relief s'interpose.
  Contrôle : `scripts/dev/camera-probe.ts` (remontée 0 m dans tous les cas, œil ≥ 1,5 m du sol).
- **Image tout autour** (`lod.ts`, `TileRing`) : MapLibre ne charge que ce que la vue contient et
  n'en garde qu'environ une vue hors champ (le nombre de tuiles de l'écran fois cinq) ; une tête
  tournée vite montrait une seconde le Sentinel-2 étiré sur les pentes proches. Les orthophotos sont
  donc gardées chargées dans toutes les directions, deux niveaux plus grossiers que la vue, jusqu'à
  80 km (30 à 90 tuiles ; téléphone 2,5 niveaux, 60 km), demandées avant les tuiles fines et tout de
  suite après un saut ; 500 tuiles gardées hors champ (200 sur téléphone). Après un demi-tour, la
  part d'image sous la moitié de son détail une demi-seconde après l'arrêt est passée de 32–56 % à
  0–17 % ; au démarrage, le jeu attend ces tuiles la caméra immobile. Coût : +0,6 à 1,1 ms de
  MapLibre par image, jusqu'à ~175 Mo de tuiles sur le GPU.
  **En virage**, chaque nouvel endroit (chaque thermique) faisait son premier tour sur une mosaïque de
  tuiles nettes et de tuiles de l'anneau, à bords droits : la vue balaie ~40°/s et les tuiles fines
  arrivent une à une (un tour en demande ~160–280 ; les tours suivants sortent du cache). Tant que la
  vue tourne (son propre taux de rotation, ou celui que les commandes demandent, en avance d'environ
  une seconde), l'anneau tient aussi les tuiles de la vue du secteur qu'elle balaiera dans la seconde
  et demie (même loi de détail, 30 km, 220 tuiles au plus, 100 sur téléphone), après celles de la vue.
  Premier tour à 40 % de frein sur une ligne de 10 Mbit/s (100 ms) : part de la vue sans sa tuile fine
  12,9 → 3,5 % (Saint-Hilaire), 15,1 → 3,5 % (Forclaz), 19,2 → 4,6 % (Pelvoux) ; +9 % de requêtes par
  tour, 0,06–0,08 ms par mise à jour (4 par seconde).
- **Fondu des tuiles** (`imagery-fade.ts`) : sous le relief, MapLibre ne fond pas les rasters (chaque
  tuile du relief garde sa texture tant que ses tuiles ne changent pas), et une tuile plus fine
  arrivait d'un coup. Son fondu enchaîné (0,3 s, la tuile mélangée à la plus grossière qu'elle
  remplace, toujours opaque) est rétabli pour les orthophotos IGN et Sentinel‑2 : les textures du
  relief qui contiennent un fondu sont redessinées tant qu'il dure (4 par image à tour de rôle, 2 sur
  téléphone), puis une dernière fois. Sur réseau ralenti, un saut de 10 km donne 4 changements
  brusques d'image au lieu de 12, une rotation de 180° 1 au lieu de 5 ; en rotation rapide, 4,8
  textures redessinées par image au lieu de 1,2, soit ~0,05 ms de plus.
- **Sans image** : là où aucune orthophoto n'est encore chargée, le fond de MapLibre est un magenta
  témoin que la passe du paysage remplace par un paysage tiré de WorldCover (`gBackdrop` : forêt,
  prés et champs, alpage, roche, glace, bâti par taches selon leurs parts). Les lacs, les rivières
  et les routes principales de la carte (OpenStreetMap par OpenFreeMap) sont dessinés sous
  l'imagerie dans deux autres teintes témoins, rendues en eau (reflets, rides, classe « eau » forcée,
  rivières en pente comprises) et en asphalte ; pas les torrents (des rubans bleus dans les pentes,
  quand d'avion on ne les voit guère sous les arbres). Leurs tuiles sont gardées tout autour du
  pilote quelle que soit la direction du regard : celles de la vue, en entrant et sortant du champ,
  faisaient redessiner les textures du relief cinq fois plus souvent. Coût : ~0,5 ms de MapLibre par
  image quand la tête tourne vite, d'où leur absence sur téléphone. Hors de France, la tuile
  blanche qu'IGN renvoie (toujours les mêmes 1 651 octets) est traitée comme absente par le service
  worker : la Suisse et l'Italie gardent leur image plus grossière au lieu d'une nappe blanche.
- **Frontière** (`public/tiles-border.js`) : IGN n'a d'images hors de France que jusqu'au niveau 12 ;
  au-delà, les tuiles à cheval sur la frontière ont leur partie étrangère en blanc pur. Sous les 195
  tuiles z12 que la frontière traverse (`scripts/dev/border-tiles.ts`, sondage d'IGN), le service
  worker remplace ce blanc par l'image z12 étirée, celle que montrent déjà les tuiles voisines hors de
  France : blanc exact à la valeur près, touchant le bord de la tuile, prolongé dans les franges du
  JPEG et les fines bandes de bord, et seulement là où l'image z12 montre autre chose (un glacier
  blanc dessous reste tel quel : 0 tuile de glacier modifiée sur 271). Une copie réduite écarte 81 %
  des tuiles de la zone ; les autres sont décodées, réparées et gardées en cache (~8 ms chacune, hors
  du fil de la page) ; temps de chargement inchangé.
- **Lumière du relief** (`ground.ts`, `region.ts`) : trois niveaux d'altitudes autour du pilote, tirés
  du relief tel que MapLibre le dessine (6 km à ~6 m, 60 km à ~60 m) et de la grille du modèle de vent
  (160 km à 216 m, pour les montagnes non chargées, derrière la caméra) ; pour chacun, la pente, les
  **ombres portées** (marche vers le soleil, pénombre douce) et la part de ciel que le relief laisse
  voir (horizon dans huit directions : fonds de vallée et gorges moins éclairés). Refait quand les
  altitudes changent ou que le soleil bouge, réparti sur quelques images. L'orthophoto est lue comme
  le sol sous la lumière de référence (midi d'été, soleil à 60° au sud), la part de cette lumière
  propre à la pente retirée, puis éclairée par le soleil de l'heure sur cette pente, derrière les
  ombres des montagnes et des nuages (clouds.ts), par le ciel ouvert et par le sol en contrebas. Elle
  remplace l'ombrage de MapLibre. Le planeur passe à l'ombre des montagnes et des nuages comme le
  sol. (Les arbres 3D ont été retirés : des cônes et des boules hors d'échelle, moins crédibles que
  la canopée des orthophotos et ses matériaux.)
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
  De juillet à septembre, l'orthophoto (prise en été) montre déjà la neige de la saison.
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

Clavier : freins par paliers de 10 % (un appui, un palier, un petit clic de plus en plus aigu et les dix
crans affichés un instant ; les mains y vont en quelques centièmes de seconde) : A/Q frein gauche +/−, E/D frein droit +/−, 0 à 9 les deux freins à 0–90 % ; sellette à la
souris (le curseur vers la gauche ou la droite de l'écran, centre neutre ; option du menu) ou S/F,
Espace accélérateur
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
- Défis : le relief exploitable est jugé sur le dénivelé de la grille du modèle (216 m), pas sur le
  potentiel thermique ; par journée faible, les décos de haute montagne (plafond du modèle vers
  2 200 m) n'ont pas toujours de triangle de 10 ou 25 km valide (signalé au lancement), et quelques
  décos de plaine (Leyrieu, Isle-Crémieu) pas de triangle de 25 km tout sur relief. Le parcours
  dépend du vent du jour : un record compare des parcours de même longueur, pas toujours les mêmes.
- École : conseils calés sur la technique publiée et le modèle du jeu, pas relus par un moniteur ;
  la détection de l'entrée en thermique et du côté à tourner lit l'air aux bouts d'aile et le cœur
  le plus proche (que le pilote ne voit pas en vrai).
- Paysage : le type de sol est déduit de la couleur de la photo (erreurs possibles : champ sombre,
  toit clair, calcaire pris pour de la neige au-dessus de 2 400 m) ; un bâtiment isolé hors des zones
  bâties reçoit parfois le détail du sol derrière lui ; les rivières étroites ne sont pas reconnues
  comme de l'eau ; les lacs ne reflètent pas les montagnes ; le relief proche reste celui des tuiles
  AWS (~25 m) ; la neige suit une climatologie, pas l'enneigement du jour. Sur téléphone, le paysage
  de remplacement n'a ni lacs, ni rivières, ni routes ; à la frontière, une fine bande blanche isolée
  au bord d'une tuile peut rester (0,3 % des tuiles de la zone) et le blanc est remplacé par l'image
  floue du niveau 12, parfois d'une autre teinte ; une tuile qui arrive où rien de sa source
  n'était dessiné (lieu jamais vu, juste après un saut) apparaît sans fondu, et le niveau de détail
  du relief lui-même saute encore.
- Pilote : speedbag et carénage rigides (pas de tissu simulé) ; postures relevées sur des photos de
  trois-quarts, angles approchés (l'inclinaison du dos reste celle des fiches, faute de vue de profil
  en vol) ; doigts sans plis ni coutures.

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
