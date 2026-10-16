# Le simulateur de vol (onglet « Jeu »)

Un simulateur de parapente dans le navigateur, au-dessus de la carte 3D du site. Il vole dans le
**modèle de vent du site** (brises de pente et de vallée, vent météo modifié par le relief, dangers
documentés) : c'est ce qui le distingue des simulateurs existants, dont l'aérologie est générique.
Code : `apps/web/src/game/` (chargé seulement à l'ouverture de l'onglet).

## Ce qui est simulé

### L'aile (`flight.ts`)

- **Polaire** d'une aile moyenne (trim 37 km/h, chute mini 0,98 m/s vers 20 % de frein, finesse ≈ 10),
  déclinée en **EN-A / EN-B / EN-C** : vitesse, finesse, amortissement, sensibilité aux fermetures,
  ampleur et virage d'une fermeture, réouverture, course de frein avant décrochage et vrille,
  stabilité et inertie en spirale.
- **Densité de l'air** (atmosphère standard) et **poids total volant** : vitesse et chute vraies
  ×√(ρ₅₀₀/ρ)·√(m/95 kg), soit +8 % à 2000 m.
- **Pendule** pilote–voile (suspentes 7 m, ≈ 5 s) : abattée au relâché des freins, cabrage à
  l'entrée d'un thermique ; l'aile réagit à l'air filtré par son inertie (≈ 0,3 s), pas à chaque
  secousse.
- **Virage** aux freins avec **sellette automatique**, inclinaison coordonnée avec retard pendulaire,
  chute en virage (×n^1,5), **traînée parasite** ∝ V² ; au-delà de ~60 % de frein d'un côté le virage
  diverge en **spirale** (EN-B à 75 % tenu : ≈ 77°, 4 g, 17 m/s, 124°/s ; une EN-A n'y entre pas
  d'elle-même) et la sortie prend d'autant plus de temps que l'aile est exigeante.
- **Incidents** : fermetures asymétriques et frontales déclenchées par les bords francs de l'air
  (seuil relevé par la pression aux freins — le pilotage actif —, abaissé par l'accélérateur),
  calées sur les essais EN 926-2 (EN-B : 90–180° de cap, 15–45° de roulis) ; réouverture spontanée ou
  en pompant ; **cravate** possible après une grosse fermeture (stabilo : X) ; décrochage, vrille.
- **Accélérateur** progressif, **oreilles**.
- Une plume soulevée par un thermique fait rouler l'aile et l'écarte du thermique : il faut tourner
  du côté qui monte.

### L'air (`airmass.ts`, `game-worker.ts`)

- **Vent** : le modèle du site évalué à la position et à l'altitude du pilote (fenêtre de 45 km qui
  suit le pilote), plus l'**ascendance de relief** calculée sur le terrain fin (~10 m) : vent local ×
  pente le long du vent, décroissant avec la hauteur à l'échelle de la paroi.
- **Thermiques** placés là où le modèle met le potentiel thermique (soleil sur la pente, convexité…) et
  là où l'atlas documente ou mesure (kk7) des thermiques. Profil d'Allen (2006, NASA TM-2006-213475) :
  rayon croissant avec la hauteur, maximum dans le tiers inférieur de la couche, anneau descendant.
  Un ou plusieurs noyaux qui dérivent, étirés et couchés par le vent ; plus forts sur une pente au
  vent, déchirés sous le vent ; cycles de bulles de 9 à 21 min ; tous les déclencheurs ne marchent pas
  tous les jours ; tailles variées. Sous un cumulus, l'ascendance se renforce jusqu'à la base.
- **Trous d'air** et **petites bulles** trop étroites pour enrouler, **convergences** documentées,
  descente de fond entre les thermiques.
- **Turbulence** : champ figé emporté par le vent (hypothèse de Taylor), tourbillons de quelques
  dizaines à quelques centaines de mètres selon la hauteur sol, lu au centre et aux deux bouts d'aile.
- **Météo** : tirée selon la saison (régimes de vent alpins, instabilité, humidité) ou réglée à la
  main ; elle évolue en vol (vent qui tourne et forcit, masse d'air qui respire, cumulus qui se
  développent l'après-midi). Plafond et base des nuages en découlent.

Banc d'essai chiffré : `npx tsx scripts/dev/game-flight-bench.ts` (polaire, coup de frein, traversée
et enroulement d'un thermique, `--spiral`, `--profile`, `--track`) ; tests : `apps/web/test/`.

### Le décollage (`launch.ts`)

Face pente ou face voile : la voile monte selon le vent relatif (vent du site + course) vers sa
position d'équilibre au-dessus du pilote ; sans temporisation au frein elle le dépasse ; un vent de
travers la couche, à contrer au frein du côté haut ; on décolle quand elle est stable, la vitesse air
suffisante et la pente qui s'ouvre. Échecs expliqués (dépassement, voile sur le côté, retombée, bout du
déco).

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

Clavier : A/Q frein gauche +/−, E/D frein droit +/−, Espace accélérateur (au déco : se retourner),
Z courir / tirer les A, O oreilles, X stabilo, flèches : tête, C regard devant, V vue, T thermiques,
P pause, M son, +/− temps accéléré. Écran tactile : deux curseurs de frein, boutons.

## Limites connues

- Point matériel avec pendule de tangage, pas un modèle multicorps : suffisant pour la sensation
  selon la littérature (la masse apparente change le rayon de virage d'environ 6 %), mais les
  incidents sont scénarisés plutôt que calculés.
- Bandes EN 926-2 des classes C et D non vérifiées sur la norme ; chiffres du décollage et des
  contacts au sol à caler avec des pilotes.
- Les thermiques suivent le potentiel du modèle et l'atlas ; ils ne sont pas validés trace par trace.

## Sources principales

- Allen, M. J. (2006), *Updraft Model for Development of Autonomous Soaring Uninhabited Air Vehicles*,
  NASA TM-2006-213475 — https://ntrs.nasa.gov/citations/20060004052
- Rapports d'essais EN 926-2 (bandes A/B) : https://service.dhv.de/dbfiles/managed/muster/hersteller_zertifikate/EN_926-22013_Rook2.pdf ,
  https://www.apcoaviation.com/wp-content/uploads/2023/08/certification.nestra.S.pdf ; résumé des classes :
  https://dhpc.org.uk/assets/files/Exam%20Revision%20Material/Glider%20ratings%20-%20en926.pdf
- Modèles de parapente : Slegers & Costello (2003) https://www.camm.gatech.edu/images/7/73/Slegers_2003_AspectsControlPAPS.pdf ;
  P. Heatwole, *glidersim* https://pfheatwole.github.io/thesis/system_dynamics.html
- Turbulence : modèle de Dryden https://www.mathworks.com/help/aeroblks/drydenwindturbulencemodelcontinuous.html
- Nuages volumétriques temps réel : Schneider, *The Real-time Volumetric Cloudscapes of Horizon Zero Dawn*
  https://www.advances.realtimerendering.com/s2015/The%20Real-time%20Volumetric%20Cloudscapes%20of%20Horizon%20-%20Zero%20Dawn%20-%20ARTR.pdf
- Technique de pilotage (thermique, arrondi, décrochage) : https://xcmag.com/fly-better/paragliding-techniques-paramotoring-skills/thermalling-how-tight-should-you-turn/ ,
  https://blog.flywithgreg.com/how-to-swoop-flare-your-paraglider/ , https://flybubble.com/blog/paraglider-control-stall-spin-collapse
