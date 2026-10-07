# Brief : passe « thermiques et points de relance »

Projet « Brises des Alpes » (dépôt `/Users/pierre/paraglide`). Lis d'abord
`research_notes/Brises des Alpes françaises/_schema.md` et `research_notes/Seconde passe 2026/_schema.md`.

## Le problème à corriger

La seconde passe n'a retenu comme `thermal_spots` que les endroits explicitement appelés
« thermique ». Les pilotes, eux, parlent surtout de **points de raccroche et de relance** le long
des cheminements : « j'arrive aux Antennes, la frontière sud du bocal de Saint Hil », « arrivée
vers Château Nardent… les points-clés du parcours classique vers le Saint-Eynard », « on raccroche
sous la Dent », « la pompe qui me ramènera », « plaf à 2800 au-dessus de… », « ça remonte
toujours sur l'éperon de… », « le déclencheur de la face ouest ». Ces ascendances récurrentes
manquent, alors que ce sont elles qui permettent de remonter (par exemple jusqu'à la Dent de
Crolles depuis Saint-Hilaire). Le propriétaire, pilote local, l'a constaté à Saint-Hilaire :
les Antennes et Château Nardent manquent, et sûrement d'autres. Le défaut touche tous les massifs.

## Ce que tu fais, pour chacun de tes lots

1. Relis **tous** les documents déjà téléchargés du lot dans `.cache/research/docs/<lot>/`
   (récits de cross, comptes rendus de sorties de club, PDF de cheminements, fiches FFVL dans
   `.cache/research/ffvl_sites_alpes.json`), les notes `research_notes/Seconde passe 2026/<lot>.md`,
   et les champs texte du JSON du lot (descriptions des `xc_routes`, `tips`, `summary`, `synoptic_effects`).
   Cherche les mots : thermique, ascendance, pompe, plaf/plafond, raccroche/raccrocher,
   relance, remonter, déclencheur, « ça monte », « ça porte », bulle, « point clé »,
   cheminement, « on enroule », « on refait le plein ».
2. Complète sur le web pour les sites majeurs de chaque massif : pages « cheminements », « cross
   classiques », « topo » des clubs et des écoles, et récits de vol. Le web est accessible : curl,
   WebSearch/WebFetch (outils différés, à charger avec ToolSearch `select:WebSearch,WebFetch`), et le
   navigateur intégré dans ton propre onglet si une page demande JavaScript (`tabs_create`, passe
   toujours le `tabId`, ferme ton onglet à la fin). Récupère et regarde aussi les **images annotées**
   (cheminements dessinés, cercles de thermiques) et les pages de PDF qui en contiennent
   (`pdftoppm -r 70 -png -f N -l N`, puis l'outil Read).
3. Pour chaque point d'ascendance récurrent nommé, ajoute (ou complète) un élément
   `thermal_spots` dans le massif concerné du JSON du lot :
   - `name` : nom local tel qu'employé par les pilotes, par exemple « Les Antennes (Saint-Hilaire) » ;
   - `lon`/`lat` : position réelle du relief qui déclenche. Prends-la sur OSM ou Nominatim (pylône,
     antenne, lieu-dit, sommet), sur le géocodeur IGN
     (`https://data.geopf.fr/geocodage/completion/?text=...&type=PositionOfInterest`), sur Wikipédia ou
     sur la fiche FFVL. Sinon `coord_quality: "approx"` ; ne jamais inventer ;
   - `alt_m` si connue ; `best_hours` d'après les sources (« dès 11h », « en fin de matinée »,
     « l'après-midi »…) ;
   - `trigger` : ce qui déclenche (éperon, barre rocheuse, village, antenne sur une crête, lisière,
     confluence de brises) ;
   - `description` : le rôle sur le cheminement. Dis s'il s'agit d'un **déclencheur**, d'un
     **point de relance** (on y raccroche pour continuer) ou d'un **plafond** (là où l'on prend le
     plus de hauteur), d'où l'on vient et où cela permet d'aller (par exemple « relance pour
     remonter vers la Dent de Crolles »). Ajoute une courte citation de la source entre guillemets ;
   - `sources` : ajoute la source au tableau `sources` du fichier si elle n'y est pas (URL précise,
     page du PDF dans `notes`).
   Si un point est surtout une **transition** ou un **piège** (« ne pas dépasser l'antenne par
   brise de nord : venturi »), mets-le dans `hazards` ou complète l'`xc_routes` correspondant,
   mais garde aussi le thermique s'il est décrit.
4. Complète les `xc_routes` classiques (le « parcours classique » de chaque grand site) avec ces
   points comme `waypoints`, dans l'ordre réellement volé.
5. Ne supprime rien. Ne renomme aucun identifiant existant. Garde le JSON valide
   (`python3 -c "import json,sys; json.load(open(sys.argv[1]))" <fichier>`) et lance
   `npm run data:build -- --check` pour voir les alertes de tes massifs (altitudes, sources inconnues).
6. Ajoute à `research_notes/Seconde passe 2026/<lot>.md` une section
   « Thermiques et points de relance (passe complémentaire) » : ce que tu as ajouté, d'où, et ce
   que tu n'as pas pu localiser.

## Règles

- Pas de connexion, de formulaire ni de CAPTCHA. Une page bloquée va dans
  `.cache/research/blocked_urls.txt` (`<lot> | <url> | <raison>`).
- Paraphrase en français ; une citation d'origine courte (une phrase au plus) est permise.
- Ne touche qu'aux fichiers de tes lots : `research_notes/Seconde passe 2026/data/<lot>.json` et
  `research_notes/Seconde passe 2026/<lot>.md`. Pas de code, pas de git.
- Enregistre régulièrement : une coupure de quota peut survenir.
- Message final, en français et court : nombre de thermiques avant/après par massif, les
  points notables ajoutés, ce qui reste introuvable.
