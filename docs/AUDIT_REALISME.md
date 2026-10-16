# Audit de réalisme — modèle de vent, physique du jeu, cohérence visuelle

Octobre 2026. Objectif : le simulateur et la carte doivent décrire l'air des Alpes au plus près
de la physique réelle, avec une seule base partagée : tout gain du modèle profite aux deux.

## Synthèse : les dix changements qui comptent le plus

| # | Changement | Où | Gain | Effort |
|---|---|---|---|---|
| 1 | Aile à forces aérodynamiques avec vitesse inertielle : les rafales et gradients horizontaux agissent sur la vitesse air | jeu | très fort | moyen |
| 2 | Stabilité de l'air (nombre de Froude) : contournement ou franchissement du relief, rotors, ondes, vents de col | modèle → carte et jeu | très fort | moyen |
| 3 | Calendrier propre à chaque vallée (rupture d'inversion, volume de la vallée) au lieu d'un horaire commun | modèle | fort | moyen |
| 4 | Occupation du sol (roche, prairie, forêt, neige, glacier) dans les brises de pente, les thermiques et les vents de glacier | modèle + rendu | fort | élevé (données) |
| 5 | Ascendance de relief multi-échelle (elle porte en avant de la paroi et au-dessus de la crête) | jeu + modèle | fort | faible |
| 6 | Météo réelle du jour (sondage prévu) pour le plafond, la base, la stabilité et le vent en altitude | jeu + carte | fort | moyen |
| 7 | Thermiques sensibles à l'ombre des nuages et à l'exposition au vent | jeu → modèle | moyen | faible |
| 8 | Inertie thermique des pentes (démarrage et bascule du soir décalés) | modèle | moyen | faible |
| 9 | Ombres portées du relief dessinées à partir du calcul d'ensoleillement du modèle | rendu | fort (beauté) | faible |
| 10 | Neige selon le mois et l'altitude, à l'image comme dans la physique | rendu + modèle | moyen | faible |

## 1. Le vol (jeu)

**Constat mesuré.** Le vent horizontal ne touche pas l'aile. Dans `flight.ts`, le vent ne fait que
s'ajouter à la vitesse sol, et la vitesse air n'en tient aucun compte. Avec un vent de face soudain de
5 m/s, la vitesse sol tombe instantanément de 10,9 à 5,9 m/s, sans aucune inertie. La vitesse air reste
à 10,91 m/s, et l'aile ne remonte ni ne cabre.

En réalité, la vitesse inertielle est continue. La vitesse air bondit de 5 m/s puis se résorbe, et
l'aile ressource d'environ V·ΔV/g, soit quelques mètres. Une rafale arrière, ou la descente dans un
gradient de vent, fait perdre de la vitesse : c'est le piège classique de l'atterrissage. Ce défaut
efface aussi les entrées de thermique (afflux horizontal), le cisaillement à l'inversion et les rotors.

**Changement.** Faire de l'aile un point matériel :
- vitesse inertielle comme état ;
- vitesse relative à l'air = vitesse − vent (rafales comprises) ;
- portance perpendiculaire et traînée parallèle à l'écoulement relatif, avec des coefficients tirés de
  la polaire (CL = 2mg cosγ/(ρSV²), CD = CL tanγ) ;
- incidence perturbée par les rafales, revenant au trim avec la stabilité en tangage de l'aile ;
- masse apparente pour les transitoires.

L'échange vitesse-hauteur (arrondi, ressource, abattée, emballement en spirale) en découle alors, au
lieu d'un terme ajouté à la main. Les fermetures se déclenchent sur l'incidence locale : rafale
descendante, abattée en sortie de thermique, accélérateur, rafale arrière. *Transmis à l'agent
physique, en priorité.*

## 2. L'air du jeu

- **Ascendance de relief.** Elle est calculée sur la pente à ±45 m sous le pilote : à 100 m devant une
  falaise, elle devient presque nulle. En réalité, elle porte en avant de la face sur environ une
  hauteur de relief, et jusqu'à une ou deux hauteurs au-dessus de la crête. *Changement* : un profil du
  relief le long du vent, lissé sur une largeur qui croît avec la hauteur sol (σ ≈ max(40 m, 0,7 × hauteur
  sol)). On y ajoute la compression au-dessus de la crête et la dégueulante derrière.
- **Inclinaison des thermiques.** Les thermiques penchent avec le vent synoptique, alors que le pilote
  dérive avec le vent local du modèle (brise de vallée, canalisation). Dans une brise de vallée, la
  colonne part d'un côté et le pilote de l'autre. *Changement* : incliner chaque thermique avec le vent
  des couches qu'il traverse, échantillonné au-dessus de la source.
- **Base des nuages.** La formule 0,25 × (sol − 800 m), appliquée source par source, donne des bases
  décalées de plusieurs centaines de mètres entre nuages voisins. En réalité, un champ de cumulus a une
  base presque uniforme. *Changement* : un niveau de condensation régional, lissé sur une dizaine de
  kilomètres.
- **Ombre.** Une source à l'ombre d'un nuage continue de produire. En réalité, l'ombre coupe
  l'alimentation en quelques minutes : c'est ce qui rythme les cycles sous les cumulus. *Changement* : la
  force de la source suit son ensoleillement, avec un retard de quelques minutes.
- **Turbulence.** Le champ figé emporté par le vent est la bonne approche. Il lui manque encore une
  dépendance à la hauteur et à la stabilité, selon les échelles de Lenschow et Dryden.

## 3. Le modèle de vent face à l'état de l'art

Le modèle conceptuel est solide sur l'ordre de grandeur. Il s'appuie sur Whiteman 2000 et sur Zardi et
Whiteman 2013, et il est vérifié lieu par lieu contre les sources (`model:check`). Ses écarts tiennent
à quatre simplifications.

1. **Pas de stabilité de l'air.** Le sous-le-vent est géométrique (angle d'abri de Winstral), et le
   venturi dépend du seul confinement. Or tout le comportement du vent face au relief dépend du nombre
   de Froude Fr = U/(N·H) (Smith 1979 ; Durran 1990) :
   - Fr < 1 : l'air est bloqué et contourne le relief. Les vents de col et de vallée canalisés
     s'accélèrent, l'air stagne en amont. C'est le cas des matins stables et de l'hiver.
   - Fr ≈ 1 : ondes, vents descendants violents sous le vent (fœhn), ressauts et rotors (Doyle et
     Durran 2002).
   - Fr > 1 : l'air franchit le relief, avec des effets de sous-le-vent modérés. C'est l'après-midi
     convectif dans la couche de mélange.

   *Changement* : un paramètre de stabilité (gradient 850/700 hPa de la prévision, ou masse d'air du jeu)
   qui module l'intensité et l'étendue du sous-le-vent (longueur d'onde λ = 2πU/N), la canalisation et
   l'accélération aux cols. Il fournit en plus une ascendance d'onde au jeu quand les conditions s'y
   prêtent.
2. **Un même horaire pour toutes les vallées.** Le cycle des brises de vallée suit un calendrier solaire
   fixe (9 h 30, 13 h, 16 h 30, 19 h 30), commun à tout le massif. En réalité, la brise montante démarre
   quand l'inversion nocturne de la vallée est détruite (Whiteman 1982). Ce moment dépend de la
   profondeur, de la largeur, de l'orientation et de l'ensoleillement des versants. Sa force dépend de
   l'effet de volume de la vallée face à la plaine (facteur d'amplification topographique : Schmidli et
   Rotunno 2010 ; Wagner, Gohm et Rotach 2015). *Changement* : pour chaque vallée, une phase calculée à
   partir de l'ensoleillement cumulé de ses versants et de sa géométrie. Il en sort un démarrage plus
   tôt dans les grandes vallées ouvertes et ensoleillées, plus tard dans les gorges et les vallées
   orientées est-ouest, et une force graduée par vallée. Sous l'inversion du matin, les thermiques
   restent bloqués au fond de la vallée et démarrent d'abord en haut des versants.
3. **Une surface uniforme.** Les brises de pente et les thermiques ne dépendent que du soleil sur la
   pente. Or le flux de chaleur dépend de la surface : roche et éboulis chauffent fort, la prairie
   moyennement, la forêt moins, la neige et l'eau pas du tout. Les glaciers produisent même un vent
   descendant en plein jour (Oerlemans et Grisogono 2002), absent du modèle alors qu'il compte à
   Chamonix et dans les Écrins. *Changement* : intégrer une carte d'occupation du sol (CORINE Land Cover
   ou ESA WorldCover, rééchantillonnée sur la grille de 216 m) et un manteau neigeux selon le mois,
   l'altitude et l'exposition.
4. **Pas d'inertie thermique.** La brise de pente répond à l'ensoleillement de l'instant. En réalité,
   elle s'établit 30 à 60 min après l'arrivée du soleil sur la pente et bascule en brise descendante 30
   à 60 min après son départ (Zardi et Whiteman 2013). *Changement* : forcer la brise par l'ensoleillement
   moyen de la dernière heure, calculé analytiquement comme l'ensoleillement cumulé actuel.

Autres points, moins prioritaires :
- les thermiques du modèle ignorent l'exposition au vent (déjà traitée dans le jeu, à remonter dans le
  modèle) ;
- la brise de lac ne varie pas avec la saison, alors qu'elle est la plus forte à la fin du printemps,
  quand l'eau est encore froide ;
- le rayonnement diffus est absent, ce qui rend les pentes à l'ombre trop « mortes » ;
- le profil de la brise de pente est maximal au sol, alors que la vitesse y est nulle (affecte les
  manches à air et le décollage).

## 4. Cohérence de l'image et de la physique

- Les orthophotos portent les ombres de l'heure de la prise de vue. Le modèle calcule déjà les ombres
  portées du relief heure par heure : les dessiner (couche douce à 216 m) aligne l'image sur la
  physique. Les versants à l'ombre, sans thermique, apparaissent alors à l'ombre, et le soir devient
  spectaculaire.
- L'imagerie est celle de l'été, quel que soit le mois choisi. Il faut ajouter la neige selon le mois,
  l'altitude et l'exposition, et la reprendre dans la physique (pas de thermique sur la neige).
- Les falaises sont étirées par la projection verticale de l'orthophoto : une texture de roche selon la
  pente, dans la passe de composition, y remédierait.
- Les indices de vent visibles par un pilote sont les manches à air (déjà présentes) et les risées sur
  les lacs, encore à dessiner.

## 5. Plan et garde-fous

- **Jeu** (point 1 et section 2) : confié à l'agent physique en cours, avec des cas de banc pour le
  vent de face, le vent arrière et le gradient à l'atterrissage.
- **Modèle** (section 3) : réalisé par le responsable, dans `packages/model/src/field.ts`. Chaque
  changement est reproduit dans `apps/web/src/gpu/model-glsl.ts`.
- **Garde-fous** :
  - `npm run model:check` ne doit pas régresser : brises fortes, dangers, convergences, décollages
    face au vent ;
  - `npx tsx scripts/dev/lee-bench.ts` doit rester stable ;
  - le banc du jeu (`scripts/dev/game-flight-bench.ts`) doit tenir ses critères.
- **Rendu** (section 4) : vagues suivantes des agents paysage et performances.

## 6. Réalisé et constaté (16 octobre)

- **Poche froide du matin** (point 3, volet thermique) : les fonds de vallée déclenchent plus tard
  que les pentes au-dessus de l'inversion, davantage après les longues nuits, sauf si un vent météo
  brasse la vallée. Le calendrier propre à chaque vallée pour la brise elle-même reste à faire.
- **Inertie thermique** (point 4, volet thermique) : les thermiques durent environ une heure après
  le passage d'une face à l'ombre, et la restitution du soir existe désormais (82 fiches la
  décrivent). La brise de pente, elle, répond encore à l'ensoleillement de l'instant.
- GPU et CPU concordent (écart ≤ 0,001 sur 42 sondages), voir `docs/METHODOLOGIE.md` § 6.
- **Contrôle plus fidèle** : `model:check` teste maintenant chaque thermique dans la saison que dit
  sa fiche, prend la clause d'été quand elle existe et ignore les périodes niées (« rien le matin »).
  Le test plus juste a révélé deux défauts :
  1. aucune colonne thermique en automne et en hiver là où les fiches en décrivent : le facteur de
     saison des brises s'ajoutait à l'incidence déjà faible du soleil bas. **Corrigé** : les
     thermiques ont leur propre facteur (transmission de l'atmosphère et rendement du sol froid),
     6 thermiques d'octobre et de février passent, rien ne régresse (thermiques 712/823) ;
  2. les points chauds « du matin » démarrent 15 à 45 min trop tard, alors que les débuts « dès
     11h » sont en avance : la documentation mêle premiers thermiques et thermiques utiles.
- **Thermiques sous le vent** : déchirés par le rotor et l'air qui descend (jusqu'à −60 %), comme
  dans le jeu ; la méthodologie l'annonçait sans que le code le fasse.
- **Ascendance dynamique** (point 5, volet modèle) : le vent météo était réduit sur les faces au
  vent comme au fond d'une vallée abritée (53 % à mi-pente). Corrigé : 47 des 115 sites de soaring
  permettent de tenir en l'air sous leur vent documenté à 20 km/h, au lieu de 17 ; avec la
  décomposition par échelles (la portance d'une crête large monte plus haut), 59.
- **Stabilité de l'air** (point 2, premier volet) : le gradient 850–700 hPa de la prévision règle la
  force des thermiques et la tenue des brises sous le vent d'altitude. Le sous-le-vent selon le
  nombre de Froude (ondes, rotors, vents de col) reste à faire.
- **Brise de lac selon la saison** : l'écart terre-eau du mois s'ajoute au soleil ; la brise est
  la plus forte au printemps (lac froid) et presque nulle en octobre (lac chaud).
- **Rotors sous l'onde, essai écarté** : sur les 28 dangers de sous-le-vent documentés que le relief
  seul manque (banc `lee-bench`), l'abri est faible à moins de 330 m (0 à 11°) mais fort à 1,5 km
  (14 à 49°), et plusieurs fiches parlent d'ondes (Chabre, Cousson, La Baume, Gap, Chalvet). Un
  rotor placé à une demi-longueur d'onde (λ = 2πU/N, air standard) en aval de la plus haute crête
  au vent ne gagne qu'un ou deux dangers (26-27 sur 53) et met Montlambert sous le vent par nord
  fort, contre l'expérience du site : il faudrait le profil de stabilité réel (inversion à hauteur
  des crêtes) pour placer les ondes. Les positions approchées de plusieurs fiches expliquent aussi
  une part des écarts.
- **Textes** : un contrôle de fidélité (`scripts/research/text_fidelity.py`) compare chaque réécriture
  à la version committée (directions apparues, effets attribués au mauvais vent, noms de lieux
  perdus). Il a trouvé des orientations et des secteurs de vent ajoutés sans source, et deux effets
  du vent intervertis ; tous ont été corrigés.

## Références

- Whiteman, C. D. (2000), *Mountain Meteorology: Fundamentals and Applications*, Oxford University Press.
- Zardi, D. et Whiteman, C. D. (2013), « Diurnal mountain wind systems », dans *Mountain Weather Research and Forecasting*, Springer.
- Whiteman, C. D. (1982), « Breakup of temperature inversions in deep mountain valleys », *J. Appl. Meteor.*
- Schmidli, J. et Rotunno, R. (2010), « Mechanisms of along-valley winds and heat exchange over mountainous terrain », *J. Atmos. Sci.*
- Wagner, J. S., Gohm, A. et Rotach, M. W. (2015), « The impact of valley geometry on daytime thermally driven flows and vertical transport processes », *Q. J. R. Meteorol. Soc.*
- Serafin, S. et al. (2018), « Exchange processes in the atmospheric boundary layer over mountainous terrain », *Atmosphere* 9(3).
- Lehner, M. et Rotach, M. W. (2018), « Current challenges in understanding and predicting transport and exchange in the atmosphere over mountainous terrain », *Atmosphere* 9(7).
- Smith, R. B. (1979), « The influence of mountains on the atmosphere », *Adv. Geophys.* 21 ; Durran, D. R. (1990), « Mountain waves and downslope winds », *Meteor. Monogr.* ; Doyle, J. D. et Durran, D. R. (2002), « The dynamics of mountain-wave-induced rotors », *J. Atmos. Sci.*
- Oerlemans, J. et Grisogono, B. (2002), « Glacier winds and parameterisation of the related surface heat fluxes », *Tellus A*.
- Allen, M. J. (2006), *Updraft model for development of autonomous soaring UAVs*, NASA TM-2006-213475 ; Lenschow, D. H. et Stephens, P. L. (1980), « The role of thermals in the convective boundary layer », *Bound.-Layer Meteor.*

*Références citées de mémoire, à vérifier avant publication.*
