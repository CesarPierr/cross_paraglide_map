# Brief commun : seconde passe de recherche « Brises des Alpes »

Projet : carte 3D de l'aérologie des Alpes françaises pour le parapente et le cross
(dépôt `/Users/pierre/paraglide`). Le site affiche brises de vallée et de pente, convergences,
pièges, thermiques, soaring, décos, attéros, effets du vent météo et itinéraires de cross, par
massif, chaque élément avec ses sources cliquables. Ta mission : rendre ton lot de massifs aussi
complet, exact et sourcé que possible, **vallée par vallée**.

## À lire d'abord

1. `research_notes/Brises des Alpes françaises/_schema.md` (contrat de base, obligatoire).
2. `research_notes/Seconde passe 2026/_schema.md` (ce qui change : version complète, figures).
3. Ton fichier de départ `research_notes/Seconde passe 2026/data/<lot>.json` (première passe de
   tes massifs) et les notes Markdown de la première passe correspondantes dans
   `research_notes/Brises des Alpes françaises/*.md`.
4. `reports/Brises des Alpes françaises.md`, section « Seconde passe : les sources à lire en
   priorité » (sources déjà repérées mais jamais lues faute de réseau).

## Ce que tu produis

- `research_notes/Seconde passe 2026/data/<lot>.json` : tu édites ce fichier en place. C'est la
  version complète de tes massifs. Garde ce qui est valable, corrige, complète. Ne touche à aucun
  autre fichier de données.
- `research_notes/Seconde passe 2026/<lot>.md` : notes de recherche en français : sources lues
  (avec ce qu'on y a trouvé), changements par rapport à la première passe (corrigé, ajouté,
  retiré et pourquoi), figures trouvées, ce qui a échoué ou reste à vérifier, URL bloquées.
- Ton message final (court, en français) : volumes avant/après par catégorie, sources majeures
  lues, alertes `--check` restantes sur tes massifs, URL bloquées que l'humain pourrait débloquer.

## Ce qu'on attend sur chaque massif

Pour **chaque vallée et chaque site de vol** du secteur : brise de vallée (sens, heures, force,
épaisseur), brises de pente des faces principales, brise du soir / restitution, convergences,
pièges (venturi, rotors, brise forte à l'attéro, sous le vent, surdéveloppement, espaces aériens,
zones de protection de la faune, interdictions de survol des parcs nationaux), points de
déclenchement thermique connus, soaring, décollages et atterrissages (officiels FFVL et
communautaires) avec orientations, réaction au vent météo par direction (N, NW, W, SW, S, SE, E,
NE, bise, foehn, lombarde, mistral…), routes de cross réelles avec points de passage, conseils
de pilotes. Le résumé du massif (4-8 phrases) doit donner sa personnalité aérologique.

## Où chercher (réseau complet, pas de quota côté machine)

Priorité aux documents de club, d'école, de fédération (FFVL, ligues, comités départementaux),
de PNR et aux forums de pilotes : sites de clubs, pages « nos sites », « aérologie », « topo »,
« météo locale », PDF de formation, présentations de stages, bulletins, comptes rendus de
sorties, récits de cross, fiches FFVL, ParaglidingEarth, XContest (récits), parapentiste.info,
toutleparapente, Vol Libre / Parapente Mag (articles en ligne), vidéos avec description.
Explore les sites de club en profondeur (menu, plan du site, dossier `wp-content/uploads`,
téléchargements) : beaucoup ont des ressources sur plusieurs massifs.

Outils, du plus simple au plus lourd :

- `curl -sSL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"`
  pour les pages et les PDF. Range les fichiers récupérés dans `.cache/research/docs/<lot>/`.
- PDF : `pdftotext -layout`, puis `pdftoppm -r 70 -png -f N -l N` pour les pages qui contiennent
  des schémas, et `pdfimages -png` pour extraire les images. Regarde les images avec l'outil Read
  (il affiche les images) : les schémas annotés (flèches de brise dessinées sur une photo ou une
  carte, confluences, zones de dégueulante) sont prioritaires. Extrais-en les éléments
  géolocalisés et déclare chaque figure dans `figures`.
- Images de pages web (`<img>` dans les articles de club) : télécharge et regarde-les aussi.
- WebSearch / WebFetch sont des outils différés : charge-les avec ToolSearch
  (`select:WebSearch,WebFetch`). Utilise WebSearch pour découvrir les sources ; si son quota
  s'épuise, continue avec le navigateur.
- Navigateur intégré (outils `mcp__Claude_Browser__*`) pour les pages qui demandent JavaScript ou
  qui renvoient 403 à curl. **Ouvre ton propre onglet** (`tabs_create`), passe toujours son
  `tabId`, lis avec `get_page_text` / `read_page` plutôt qu'avec des captures, et ferme ton onglet
  à la fin. Tu peux y utiliser un moteur de recherche (Bing, Qwant, DuckDuckGo). N'utilise pas
  Claude in Chrome (`mcp__claude-in-chrome__*`) : il est réservé à l'agent principal.
- Coordonnées : `.cache/research/paraglidingearth_alps.tsv` (déco, orientations, attéro, n° FFVL),
  `.cache/research/ffvl_sites_alps.tsv` s'il existe, Nominatim
  (`https://nominatim.openstreetmap.org/search?format=json&q=...`, 1 requête/s, avec un User-Agent
  `brises-des-alpes-research`), Wikipédia. Vérifie les altitudes avec
  `npm run data:build -- --check` (compile tout sans rien écrire ; filtre les alertes sur tes
  massifs avec grep).

## Règles

- Ne jamais inventer. Une position estimée : `coord_quality: "approx"`. Un élément sans source :
  `confidence: "low"` et « déduction » dans la description.
- Brises : `waypoints` dans le sens de l'écoulement, 3 à 8 points le long de l'axe de la vallée
  (villages, cols, lacs). Pente : pied puis crête. Horaires en texte (« 12h-19h (été) »),
  vitesses en km/h.
- Chaque élément cite ses sources. Chaque source a une URL qui permet de la retrouver (page,
  PDF avec numéro de page dans `notes`). Si deux sources divergent, garder les deux versions,
  citer les deux, baisser la confiance.
- Formulation : paraphrase en français ; une citation d'origine courte (une phrase au plus)
  entre guillemets est permise. Ne recopie pas de longs passages.
- Pas d'identifiant, de connexion, de formulaire, de CAPTCHA. Si une page est derrière une
  vérification Cloudflare ou une connexion, n'insiste pas : ajoute l'URL et ce que tu en
  attends à `.cache/research/blocked_urls.txt` (une ligne : `<lot> | <url> | <pourquoi>`).
  Bandeaux de cookies : refuser le non essentiel.
- Ne touche pas au code, à git, ni aux fichiers des autres lots. Valide ton JSON
  (`python3 -c "import json,sys; json.load(open(sys.argv[1]))" <fichier>`) et lance
  `npm run data:build -- --check` avant de finir.
- Vise l'exhaustivité : lis vraiment les documents (pas seulement les résultats de recherche),
  couvre chaque vallée, et préfère dix éléments bien sourcés à cinquante approximatifs.
