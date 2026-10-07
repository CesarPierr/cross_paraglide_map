# Seconde passe 2026 : lot devoluy_gap_buech_diois

Massifs : devoluy, champsaur-valgaudemar, gapencais-ceuse, buech-laragne-chabre, baronnies, diois.
Données : `data/devoluy_gap_buech_diois.json` (181 sources, 35 figures, validé par `npm run data:build -- --check` : aucune alerte sur ces six massifs).

Remarque d'identifiants : le fichier de départ ne portait pas de préfixe « HS » mais des sources S1 à S45. Elles sont conservées telles quelles (non renumérotées) ; les sources ajoutées vont de S46 à S184.

## Sources lues, avec ce qu'on y a trouvé

Club, école, fédération (lus en entier)
- **Vol Libre Diois** (13 pages : accueil/Diois, cross classiques, Clamontard, Justin, Solaure, Lesches, col de Rousset, Valdrôme/Le Duffre, Jocou, Volvent, Montagne de Baise, règlementation aérienne, balises, récit « Col du Rousset à Gap »). Brise du Diois dite « nord » dès midi-13h, divergence ouest à Châtillon, bascule ouest de fin d'après-midi (Couspeau, Aucelon, Aurel), thermiques 10-11h faces sud / 12-13h faces nord, limite des plafonds à Valdrôme et au col de Cabre, mistral et foehn local du Vercors, zones vautours/ZSM/R196B, tous les décos et atterros avec leurs pièges, cross classiques et un vol Rousset → Dévoluy → Veynes.
- **Air Buëch** (club de Laragne) : page Chabre (dust devils en détail, orientation, « sauf Est »), Melves, Colombier, WaterFly 2025 et 2026 (topos de cross de Chabre à Saint-Genis avec balises, fichiers .wpt lus), programme de la soirée météo « Le Buëch de Laragne à Aspres » (programme seulement), liste des pages et médias du site (WordPress REST). Les pages « Sécurité/Formation » ne contiennent que des liens.
- **Flylaragne** (Chabre Open) : pages « Sites and Weather » (Laragne, Séderon avec Bergiès/Buc/Le Fort, Aspres) et « Airspace » (R71 Salon FL075).
- **Sisteron-Buëch (Geotrek)** : fiches Chabre / Espranons / Fainéants (incompatibilité avec l'ouest, dusts) ; panneau de site déjà lu en première passe (S2).
- **Différen'ciel** (club de Gap) : 7 fiches de sites (Charance, Guizière, Noyer, Cuchon, Richards, Bâtie-Neuve, Saint-Vincent).
- **École de Parapente des Baronnies** (S39, relu) : Soubeyrand, Nyons, col d'Ey.
- **FFVL** : environ 60 fiches de terrain lues dans le navigateur intégré (Cloudflare bloque curl), plus le fichier de coordonnateur `ffvl_sites_alpes.json` (186 fiches du secteur). Coordonnées, orientations, dangers, restrictions, aérologie idéale.
- **Les Toiles du Sud** : PDF « Les surprises aérologiques » lu en entier (30 pages) ; p.21 dust devil (Chabre cité), p.29 « Surfer la vague » (attéro improvisé près d'Aspres). Les autres PDF de `doc_public/meteo` (bases d'aérologie, météo régionale, infos météo) ne contiennent rien sur le secteur ; le dossier `doc_public/` est en 403 (liste lue via la page « Documents publics »). Les « séjours estivaux » n'ont pas eu lieu dans ce secteur.
- **AVG Gap-Tallard** (PDF vol à voile de 54 pages) : présentation d'un stage ; peu d'aérologie (onde + thermique, largage Malaup 1500 m, falaise de Céüse, Bure, ALAT). Pas de schéma.

Cartes et schémas annotés (voir « Figures »)
- **Gabriel Briffe**, « Brises et confluences classiques des Alpes du Sud » (79 diapos, 71 Mo) et « Points de largage Alpes du Sud » (26 diapos) : récupérés sur ses liens Drive, rendus image par un script maison (les flèches sont des objets vectoriels sur des captures Google Earth).
- **Cartes de Karlis (Flying Karlis)** dans le dossier Drive du fil parapentiste.info « Compilation des brises des Alpes » : 5 images (Chabre, Baronnies–Serres, global Baronnies–Diois–Durance, Aspres, Alpes sud-ouest).
- **Carte Google My Maps « Brises des Alpes »** (F. Largeault) exportée en KML : 100 polylignes du secteur ; sens = ordre des points (les trois derniers sommets forment la pointe). Noms de lieux déduits d'un gazetteer OSM (Overpass).

Forums et récits
- parapentiste.info : Superdévoluy, Joue du Loup, lac du Sautet (col du Noyer), Col de l'Aup, Vercors et Dévoluy, devoluy (Gicon), Site de Laragne, Laragne ?, Ceüse, site proche d'Orpierre (aucune donnée neuve), Compilation des brises des Alpes.
- Récit de rando-vol au pic de Bure (Rapaces d'Azur, 2015).

## Changements par rapport à la première passe (volumes)

| massif | brises | convergences | dangers | thermiques | soaring | décos | attéros | effets synoptiques | routes xc |
|---|---|---|---|---|---|---|---|---|---|
| devoluy | 1 → 1 | 0 → 1 | 1 → 7 | 0 → 3 | 0 → 2 | 0 → 10 | 0 → 3 | 2 → 7 | 0 → 2 |
| champsaur-valgaudemar | 0 → 3 | 0 → 0 | 0 → 5 | 0 → 2 | 0 → 3 | 2 → 8 | 1 → 5 | 0 → 5 | 0 → 2 |
| gapencais-ceuse | 0 → 4 | 0 → 1 | 0 → 7 | 1 → 3 | 0 → 3 | 1 → 7 | 0 → 5 | 1 → 7 | 1 → 4 |
| buech-laragne-chabre | 2 → 6 | 1 → 3 | 4 → 11 | 0 → 5 | 2 → 6 | 5 → 19 | 0 → 14 | 4 → 6 | 0 → 4 |
| baronnies | 1 → 5 | 0 → 0 | 1 → 8 | 0 → 2 | 1 → 4 | 1 → 10 | 0 → 9 | 2 → 6 | 0 → 2 |
| diois | 2 → 9 | 0 → 0 | 0 → 16 | 0 → 6 | 0 → 5 | 0 → 16 | 0 → 7 | 1 → 8 | 0 → 5 |

Corrections
- **Cuchon d'Ancelle** (alerte MNT) : la fiche FFVL donne 1600 m mais les coordonnées sont au sommet du Cuchon (2002 m OSM) ; altitude portée à 1900 m (Différen'ciel : 1500 à 1950 m). Déco intermédiaire passé à 1750 m (≈ antennes, à vérifier), orientations S/SO ajoutées.
- **Falaises de Céüse** (alerte MNT) : le premier tour plaçait le point à l'ouest de la falaise (5.9333, 44.5) ; nouvelle position = Pic de Céüse (5.9617, 44.5086, 2016 m, OSM). La falaise sud s'étend plus bas ; l'alerte a disparu.
- Chabre : « Espranons » déduit du déco FFVL « Top » (le caillouteux, plus haut) ; « Fainéants » = moquette sud ; orientations FFVL/Geotrek ajoutées ; la Table d'orientation sous le vent par NO précisée.
- Circuit planeur Céüse – Bure – Charance : coordonnées de Céüse et Bure corrigées, distance calculée (ancienne valeur 0 = inconnue).
- Col de Milmandre : l'altitude FFVL de 506 m a été jugée erronée (col à ≈ 852 m OSM) ; position OSM du col.
- Sigoyer : altitude alignée sur le MNT (alerte).
- Dévoluy : tracé de la brise de vallée refait (Veynes → col du Festre → Agnières → Saint-Étienne, S>N d'après un pilote et le schéma de Briffe).
- Diois : la brise de la Drôme avait « confiance basse, sans source » ; elle repose maintenant sur le club du Diois et la carte collaborative.

Retiré
- Aucun élément de la première passe n'a été retiré. Le déco « Le Vieux Chaillol » (FFVL 5041) n'a pas été repris : ses coordonnées tombent sur le sommet (3162 m) pour une altitude déclarée de 1030 m (incohérent, aucune description).

Éléments non repris dans les massifs de ce lot
- La Bâtie-Neuve et Saint-Vincent-les-Forts (secteur Serre-Ponçon, couvert par un autre lot) apparaissent seulement dans les conseils du Gapençais.

## Figures déclarées (`figures`)

F1 à F13 et leurs découpes par massif : diapos 59, 60, 63, 70, 71, 72, 74 de Briffe, diapos 13-18 des points de largage, carte collaborative (Diois, Buëch, Baronnies, Champsaur, Gapençais), topos WaterFly 2025/2026 (images directes), p.21 et p.29 des « surprises aérologiques » ; F14 à F18 : cartes de Karlis (images Drive directes, `drive.google.com/uc?export=download&id=…`).
Les flèches de Briffe sont qualitatives (perspective Google Earth) : les positions déduites sont `approx` et la confiance est basse. Les flèches de Karlis ont été confrontées au KML qui les numérise : elles se recoupent (Buëch, Durance, Drôme, Diois).

## Ce qui reste à vérifier ou n'a pas pu être lu

- Légende des cercles rouges (dust devils ? ascendances ?) et des bandes orange des cartes de Karlis : non donnée ; seuls les éléments de brise sont repris.
- Vidéo de Karlis (YouTube 4Kmqz_IOmCA), livre « Guide to Chabre » et PDF « Chabre Challenge 100 km » : bloqués (boutique/formulaire) ; les routes de 100 km depuis Chabre manquent.
- Sens contradictoire du flux au col Bayard (Briffe : Gap → Champsaur ; KML : Champsaur → Gap) : les deux versions sont gardées, confiance basse.
- Aucune brise ni site de vol dans le Valgaudemar, aucune donnée précise sur Chaillol ni Laye ; aucune convergence documentée dans le Diois ni dans les Baronnies en dehors des flèches.
- Convergences Gap–Tallard et Rhône–Buëch : tracés schématiques, ± 5 km.
- Les hauteurs (couche d'air) et vitesses sont des interprétations sauf mention contraire.
- Autres documents du dossier Drive de Robin S. non lus (autres lots) : « Brises Ecrins », « Voler dans les écrins », « Le parapente dans le briançonnais », « cross-massifs-transitions Club St-Hil'air », « aerologie_montagne », « Bible Météo ».
- Les sources non utilisées dans ce lot (S12-S20, S40-S44 de la première passe : Serre-Ponçon, Ubaye, Queyras) sont conservées.

## URL bloquées

Ajoutées à `.cache/research/blocked_urls.txt` : boutique Flying Karlis (Guide to Chabre), vidéo YouTube de Karlis, index `cataloguevollibre.free.fr/Dept-05/` (403), fiches FFVL en curl (403 Cloudflare, lisibles dans le navigateur intégré).


## Thermiques et points de relance (passe complémentaire)

Passe demandée par `BRIEF_THERMIQUES.md`. Convention de confiance : plusieurs récits concordants ou un récit précis = `medium` ; récit isolé ou lieu imprécis = `low` ; extrapolation par le relief et l'exposition, sans récit = `low` avec « déduction » dans la description.

Volumes de `thermal_spots` (avant → après) : devoluy 3 → 7, champsaur-valgaudemar 2 → 3, gapencais-ceuse 3 → 7, buech-laragne-chabre 5 → 10, baronnies 2 → 8, diois 6 → 19. Au total 21 → 54. Sept descriptions existantes complétées (Noyer, Beaumont, Chabre crête, Saint-Genis, But Sapiau, Aucelon, Richards). Deux figures ajoutées (F19-diois-nord, F20-diois-sud).

### Ajouté, avec sources
- **Diois** (Vol Libre Diois, pages cross classiques, Rousset, Baise, Solaure, Valdrôme, Jocou, Justin, Volvent, récit Rousset → Gap ; images annotées des cartes nord et sud, regardées) : col de Beaumont (plafond de sortie), plateau de Saint-Dizier, Valdrôme / col de Cabre (limite des plafonds), pompe devant le déco du Rousset, Châtillon (raccroché du Glandasse), falaises du Glandasse, entrée de la Jarjatte / Chamousset, Duffre (cross tôt le matin), Jocou, Baise → Dent de Die, Justin (thermiques hachés), vautours à Clamontard, pompe devant l'arête SO de Saint-Genis. La position de la Dent de Die a été corrigée (IGN) et la route `xc-rousset-gap` reçoit le waypoint manquant ; danger de la dégueulante de Boulc.
- **Laragne / Chabre / Aspres** (fil parapentiste.info « Cross au départ de Saint-Vincent les Forts », réponses sur Laragne ; topos WaterFly ; fiche d'Aspres) : Orpierre (monter à 2000-2200 m avant de transiter), antennes de Beaumont (meilleur plafond du jour), seuil de 2300 m pour Saint-Genis, combe ouest de Saint-Genis (dégueulante), plaine de Rosans / L'Épine, Durbonas, col Saint-Ange et rocher de la Garde (déductions) ; deux routes nouvelles (Aspres → Durbonas → Bure, Chabre → Orpierre → Beaumont → Aspres → Bure).
- **Gap** : Guizière (premiers thermiques), Charance (déclencheur vers le Bure), Petite Céüse, Pic de Gleize ; la route Guizière → Charance atteint le Bure.
- **Dévoluy** : faces ouest du Rattier / Obiou (basse confiance), Chauvet (déduction), chaîne Vachères – Cluse – Bure, Faraut ; divergence de sources sur l'heure du Noyer notée.
- **Champsaur** : antennes du Cuchon (déduction).
- **Baronnies** : Buc Ouest et Buc Est (Flylaragne, FFVL), col de Milmandre (falaises), col d'Ey (première combe à l'est), Villefranche-le-Château, Garde-Grosse (déduction, basse confiance) ; danger du retour Beaumont → Nyons face à la brise.

### Non localisé ou non lu
- Le sommet de Saint-Genis (Diois / Vercors sud) n'est pas géocodable : position de la pompe reprise sur le repère de Ponet, `approx`, confiance basse. Taches rouges des cartes du Diois non géoréférencées : positions lues sur le terrain par toponyme, `approx`.
- Cercles rouges en pointillés des cartes de Karlis (Chabre, Orpierre) : légende non donnée, non repris. Vidéo YouTube de Karlis, livre « Guide to Chabre », PDF « Chabre Challenge » : toujours bloqués.
- Aucun récit de thermique trouvé pour Nyons, Soubeyrand, Buis, Mévouillon (hors Bergiès et Buc), Valgaudemar, Chaillol, Orcières, ni pour Serres et Veynes ; Facebook de Parapente Embrun non lu. WebSearch ne remonte que des pages commerciales pour les Baronnies.
- Les altitudes plafond proviennent de récits isolés et ne sont pas des moyennes.

## Passe secteurs minces

Date : 7 octobre 2026. Convention de confiance : récit précis ou plusieurs récits = `medium` ; extrapolation du relief = `low` avec « déduction ». Identifiants existants conservés, rien supprimé. `npm run data:build -- --check` : aucune alerte nouvelle.

### Champsaur et Valgaudemar (`champsaur-valgaudemar`)

Volumes avant → après : brises 3 → 3 (trois complétées, Valgaudemar passée de `low` à `medium`), convergences 0 → 1, hazards 5 → 7, thermiques 3 → 7, soarings 3 → 4, décollages 8 → 12, atterrissages 5 → 7, effets synoptiques 5 → 6 (quatre complétés), routes 2 → 5, conseils 5 → 10 ; 17 sources (S194 à S210).

**Sources nouvelles**
- Fil parapentiste.info « Voler dans le Champsaur » (2017-2021) lu en entier : avis de pilotes locaux sur Orcières, Ancelle, les Richards, le Vieux Chaillol et le col de la Pisse.
- Récits du CHVD lus en entier : rando-cross du Col Vert vers le Champsaur et le Valgaudemar (juillet 2026), semaine itinérante de mai 2026, vol bivouac de retour de mi-août 2024, Trans'Alps 2024, vols des Richards (31 mars 2021), Col Vert « sudistes » (31 juillet 2020), semaine itinérante 2014, week-end du Noyer (11-12 septembre 2010), vol de l'Olan au Valgaudemar (30 septembre 2009), topo du Vieux Chaillol et « camp de base du Frêne » (juin-juillet 2025).
- Fil parapentiste.info « Vol rando dans le Valgaudemar – col de Pétarel » (août 2026) ; récit Blues Team de mai 2015 (bordure ouest des Écrins) ; fiche FFVL 5041 du Vieux Chaillol (accès, altitude 1030 m incohérente) et site ParaglidingEarth 15526 (3120 m).
- Positions : géocodeur IGN.

**Ajouté ou corrigé**
- *Thermiques et relances* : Grun de Saint-Maurice (3500 m), Banc du Peyron (1100 m en 8 minutes), éperon sud de l'Olan, entrée de la vallée de Champoléon (restitution du soir) ; Richards et Cuchon complétés.
- *Brises* : matin très calme puis brise installée toute la journée à Orcières, installation parfois chaotique en début d'après-midi aux Richards, brise « ronflante » du Valgaudemar (10-15 km/h à l'atterrissage de La Chapelle), observation de compétition au col Bayard ; les directions de la brise du Drac (deux versions contradictoires) ne sont pas tranchées.
- *Convergence* : confluence des brises de vallée à l'entrée de la vallée de Champoléon (`low`, géométrie indicative, récit du Cairn d'Orcières à 17h30).
- *Dangers* : brise de la vallée de Valbonnais et combe du Goulet derrière La Salette ; Vieux Chaillol (vol imposé vers le sud par le Parc des Écrins) ; atterrissage des Richards enrichi (venturi par ouest, gradient par sud, nord + brise).
- *Nouveaux sites* : Vieux Chaillol (sommet), Soleil Bœuf de Saint-Michel-de-Chaillol, col de Pétarel, replat sous le pas de l'Olan, atterrissages du Frêne et de La Chapelle-en-Valgaudémar, soaring du soir sur Archinard.
- *Routes* : parcours classique des Richards vers Grenoble (jusqu'au Colombier), rando-cross Pic de Bure → Valgaudemar → Valbonnais (juillet 2026), vol bivouac Piolit → Richards → Colombier (août 2024).
- Une correction a été faite avant enregistrement : l'orientation du Soleil Bœuf de Chaillol est « de l'ouest à l'est par le sud » (le nord-ouest avait été ajouté par erreur).

**Introuvable**
- Aucun horaire ni vitesse de la brise du Drac ; le sens montant (de Gap ou de Vizille) reste contradictoire entre sources ; le Valgaudemar n'a toujours aucun site officiel FFVL.
- Traces des cross de Champsaur (CFD, XContest, Syride) inaccessibles ; Cuchon de Molines, Ratz de Bec et Coiro (point exact) non localisés par le géocodeur ; confluence du Drac Blanc et du Drac Noir non localisée précisément.
- Les sites de Réallon (col de la Gardette, station, fiches 3069/13583), de La Bâtie-Neuve et de Rabou n'ont pas été traités (autres secteurs).



## Audit des thermiques (octobre 2026)

Contexte : le propriétaire, pilote local, a relevé des thermiques oubliés (Antennes et Château Nardent à Saint-Hilaire, Grand Ratz). Les listes de lacunes (`docs/COUVERTURE.md`, `docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`) ont été reprises une à une pour les six massifs du lot, les dossiers du lot et les fiches FFVL (`ffvl_sites_alpes.json`) relus, et chaque position vérifiée sur le terrain IGN (RGE ALTI) et les toponymes IGN. Convention de confiance : `medium` quand un texte donne le lieu, l'heure ou la nature du thermique et qu'une mesure ou un deuxième texte concorde ; `low` avec « déduction » quand seul un point chaud mesuré par les traces GPS (kk7, `thermal.kk7.ch`) ou un seul indice (fiche, ParaglidingEarth) s'appuie sur le relief. Les points chauds disent où ça monte, pas pourquoi : leur position est reprise, le déclencheur est lu sur l'exposition et la pente du terrain, et la mesure ne sépare pas toujours le thermique de la dynamique (sites-écoles de brise : Saint-Jean de Sault, Roynac). Le web ouvert (WebSearch) ne remonte que des pages commerciales pour ces secteurs ; les sources utiles sont les fiches FFVL, les topos des clubs (Air Buëch, Vol Libre Diois, Tichodromes, École des Baronnies), les fils parapentiste.info, les récits CHVD et l'export ParaglidingEarth (indicateurs « thermals / soaring / xc »).

Au total 32 thermiques créés (Dévoluy 1, Gapençais 1, Buëch 5, Baronnies 10, Diois 8, Champsaur 7) et 9 éléments dont la position ou l'altitude a été corrigée. Le contrôle de fidélité (`npm run model:check`) signale `aureille-pente-sud-matin` comme défaut du modèle : l'heure de déclenchement simulée (10h15 en juillet) est en retard d'un quart d'heure sur la fenêtre de la fiche (8h-12h), même défaut que Guizière, Bergiès sud, Buc Est et Aucelon, déjà dans le modèle avant l'audit.

### Dévoluy (`devoluy`)

**Thermique créé (1)**
- `tete-de-la-clappe-face-sud` (`low`) : point chaud kk7 à 92 % (94 % le matin) à 350 m au sud-sud-ouest de la Tête de la Clappe, au-dessus des décollages FFVL 2313 et 5055. La fiche 2313 dit « plutôt site du matin, sous le vent du sud-ouest à partir de la mi-journée » : le profil mesuré concorde. Classé au Dévoluy par la géométrie, il sert les décollages du Gapençais.

**Positions corrigées**
- `pic-de-bure-rando` : la position était le sommet du Pic de Bure (terrain 2677 m pour 2500 m déclarés). Le récit des Rapaces d'Azur (2015) place le décollage herbeux « 200 m en contrebas des oreilles de l'observatoire » (les antennes de Plateau de Bure, 2553 m) : ramené sur la pente sud sous l'observatoire (5.9079 E 44.6262 N, 2360 m IGN), approximatif.
- `la-superdevoluy-village` : la position n'était pas à Superdévoluy (terrain 1268 m pour 1500 m) ; ramenée au centre de la station (géocodeur IGN, 1487 m).
- `chauvet-festre` (décollage et thermique) : placés au col du Festre (1444 m) alors que le fil dit « le Chauvet face au col du Festre » ; le sommet du Chauvet (toponyme IGN, 2,4 km à l'ouest-sud-ouest du col) est à 2021 m. Position et altitude ramenées sur ce sommet.

**Lacunes écartées**
- Collet du Tât (FFVL 5345) : aucun point chaud mesuré à moins de 3 km, aucune source ne décrit de thermique ; le site est une crête de dynamique en brise de nord-ouest (fil Superdévoluy 2012, fiche FFVL) et le seul avis sur l'heure vient d'un non-pilote (« ça doit le faire en fin d'après-midi »).
- Les « quelques petits thermiques » du bout du plateau de Superdévoluy (fil de 2016) : une phrase sans lieu précis, non localisable.
- `therm-bure-sud` (position approximative au sommet, aucune trace GPS mesurée à moins de 2 km), `therm-vacheres-cluse-chaine` et `therm-faraut-longer` : positions conservées (toponymes IGN), traces GPS rares sur ces sommets.
- Courtet et Rochassac relèvent du secteur du Trièves (autre lot).

### Gapençais et Céüse (`gapencais-ceuse`)

**Thermique créé (1)**
- `montagne-de-saint-maurice-faces-ouest` (`low`) : le décollage de Piégut (FFVL 405, « vol uniquement en ouest et par brise établie ») n'avait aucun thermique ; un point chaud kk7 à 81 % se trouve à 2,4 km au nord sur la pente ouest de la Montagne de Saint-Maurice, uniquement en fin de journée (82 %), ce qui concorde avec une face ouest et la brise de la Durance établie.
- Les deux décollages de la Clappe (FFVL 2313 et 5055) sont servis par `tete-de-la-clappe-face-sud` (voir Dévoluy).

**Position corrigée**
- `ceuse-sud-plateau` : la position était le sommet de Céüse (1972 m pour 1794 m déclarés). Le forum de 2008 décrit la montée depuis le col des Guérins puis le décollage « vers le point côté 1794, plein sud, pente faible » : ramené sur le rebord sud du plateau (5.9410 E 44.4997 N, terrain IGN 1789 m), approximatif.

**Lacunes écartées**
- Aérodrome de Gap-Tallard : l'élément parle de planeurs (onde, thermique) mais ne localise aucun thermique ; ceux de Malaup et de Céüse sont décrits, aucun point chaud mesuré à moins de 3 km.
- `falaise-ceuse` (position au sommet, la falaise s'étend plus au sud), `therm-malaup` (sommet IGN vérifié), `therm-bure-gap` : positions approximatives conservées, traces GPS rares autour de Céüse.

### Buëch, Laragne et Chabre (`buech-laragne-chabre`)

**Thermiques créés (5)**
- `suillet-tresclaeoux` (`medium`) : point chaud kk7 à 90 % à 100 m du Suillet, balise B36 de la WaterFly 2026 et point « Wpt3 » de la WaterFly 2025 (Air Buëch) : le club le choisit deux années de suite entre la crête de Chabre ouest et Beaumont.
- `serre-de-lhomme-chanousse` (`low`) : point chaud kk7 à 95 % (96 % en été), le plus fort du secteur, sur une pente sud à 1100 m ; aucun texte.
- `porte-sereine-barre-saint-genis-ouest` (`medium`) : Air Buëch écrit qu'on peut « longer la barre de Saint Genis sur plus de 4 km vers l'ouest en thermo-dynamique » depuis le Colombier, ce qui conduit à la Porte Sereine (décollage FFVL 5340, balise de la WaterFly 2025) ; le thermique de la crête était placé à 4,5 km à l'est.
- `aureille-pente-sud-matin` (`medium`) : la fiche FFVL 13505 réserve le site « le matin, de 8h à 12h dans un vent de tendance sud » ; point chaud kk7 à 300 m (99 % le matin).
- `montagne-doule-faces-ouest` (`low`) : point chaud kk7 à 78 % (87 % le matin) sur la pente ouest sous les décollages de la Montagne d'Oule (FFVL 2365 et 2370) ; rapproché du thermique du matin de Cuberselle.

**Lacunes écartées**
- Mison (FFVL 13538) : site de restitution du soir (flux descendant la Méouge sur les falaises), dynamique ; aucun thermique décrit ni point chaud à moins de 3,5 km.
- La Plane / Melves (FFVL 14251) : site de restitution qui « fonctionne de manière optimale en ouest » (Air Buëch) ; la page parle de « s'extraire par les combes de la tête de Boursier », sans thermique ; le thermique de la Malaup est à 4,3 km.
- `therm-saint-genis` : position vérifiée (sommet de « la Montagne de l'Aup ou de Saint-Genis », toponyme IGN). `therm-rocher-de-garde` (balise B37) et `therm-rosans-epine-plaine` (lieu imprécis) : positions conservées.

### Baronnies (`baronnies`)

**Thermiques créés (10)**
- `arfuyen-pente-est-sud-est` (`medium`) : les fiches FFVL 1523 et 1524 disent « site du matin… très turbulent en condition thermique », « aérologie compliquée en été » : c'était classé en danger ; le thermique s'établit après la fenêtre du matin. Aucun point chaud à moins de 2 km.
- `la-trappe-pente-sud`, `soubeyrand-pente-sud-ouest`, `saint-amand-pas-de-la-feuille`, `saint-hippolyte-graveyron-pente-sud` (tous `low`) : point chaud kk7 à moins de 200 m du décollage FFVL concerné (80 %, 90 %, 93 %, 83 %) ; ParaglidingEarth y renseigne « thermals » ; aucune source de thermique.
- `saint-jean-sault-pente-ouest` (`low`) : point chaud à 99-100 % toute l'année, le plus fort des Baronnies, à 140 m du décollage de Saint-Jean (fiche 1745) ; la mesure traduit sans doute surtout l'ascendance de pente de la brise d'ouest (fiche de l'atterrissage : « vol de pente »).
- `ventoux-fonfiole-sommet` (`low`) : trois décollages du sommet du Ventoux sans thermique ; ParaglidingEarth y renseigne thermiques, soaring et cross ; point chaud kk7 faible (71 %, 81 % en été) sur la pente nord-est de la combe de Fonfiole.
- `montagne-de-buisseron-sud-ouest` (`low`, 96 %), `col-de-la-chaine-gippieres` (`low`, 98 %), `grands-rochers-de-banne-nord-ouest` (`low`, 91 %) : points chauds forts sans décollage ni texte.

**Lacunes écartées**
- Mont Rachas Sud (FFVL 1318) : « peu de rendement en nord, peu utilisé », brise de pente seulement, aucun point chaud à moins de 1,5 km.
- Le Seigneur (FFVL 13469, Monieux) : fiche sans aérologie, aucun point chaud, ParaglidingEarth sans donnée.
- Ventoux Sud (Crêtes et Chapelle) : couverts par `ventoux-fonfiole-sommet` (à 700 m et 1,4 km).
- `buc-ouest` : altitude de la fiche (1197 m) pour des coordonnées à 1310 m ; le décollage est « tout le long de la montée à pied », l'écart n'est pas une erreur de position.

### Diois (`diois`)

**Thermiques créés (8)**
- `crete-chamaloc-romeyer-pillouse` (`medium`) : trois points chauds kk7 à 97, 93 et 91 % sur la crête entre les vallées de Chamaloc et de Romeyer, que le club du Diois décrit pour qui rate la pompe du col de Rousset : « vous trouverez très certainement de quoi remonter ».
- `aurel-clot-du-ciel-pente-ouest` (`medium`) : fiche FFVL 710 « profite de la brise de vallée, belles restitutions » ; point chaud à 93 % surtout en fin de journée.
- `glandasse-abel-pente-sud` (`medium`) : fiche FFVL 694 « dynamique par vent de sud et bonnes conditions thermiques » ; le thermique des faces sud du Glandasse était à 3,5 km.
- `rocher-de-laigle-pillouse-sud` (`medium`) : troisième point chaud (91 %) de la même crête Chamaloc – Romeyer, 1 km au sud-ouest du Pas de Pillouse.
- `roynac-pente-sud-ouest` (`low`) : point chaud à 100 % (71 % même en hiver), le plus fort du secteur ; la mesure inclut sans doute la dynamique du vent de sud-ouest.
- `saint-maurice-antennes-pente-nord-ouest` (`low`, 84 %, été), `aurel-butte-de-laigle-pente-sud-ouest` (`low`, 94 % ; site interdit par arrêté), `cote-belle-couspeau` (`low`, 92 %, sur la crête de Cotebelle que le vol de Couspeau franchit).

**Position corrigée**
- `couspeau` : la position était le sommet du Grand Delmas (1542 m pour 1425 m déclarés) ; ramenée sur la pente sud 300 m au sud-ouest (1430 m IGN), approximatif.

**Lacunes écartées**
- Plaines de Poët (FFVL 5114) : le contrôle IGN actuel donne 878 m pour 880 m déclarés (l'alerte de `docs/POSITIONS.md` est obsolète) ; décollage de dynamique N/NO, aucun point chaud à moins de 1,5 km.
- `diois-poyols-punition` : décrit la conséquence d'une sortie trop basse (posé à Poyols), le plafond à viser est le col de Beaumont (`therm-col-beaumont-plafond`).
- Col de Volvent (FFVL 5184) : l'alerte porte sur une brise, pas sur un thermique ; `therm-aucelon-est` le couvre.
- `therm-plateau-saint-dizier`, `therm-valdrome-limite-plafonds`, `therm-glandasse-falaises-bande` (taches rouges non géoréférencées), `therm-lus-jarjatte-chamousset` (sommet du Chamousset, IGN) : positions conservées, traces GPS rares.

### Champsaur et Valgaudemar (`champsaur-valgaudemar`)

**Thermiques créés (7, tous `low`)** : `breche-de-lhomme-etroit-vieux-chaillol` (84 % en été, 1,1 km à l'est du sommet du Vieux Chaillol, FFVL 5041 : aucun texte ne décrit d'ascendance, le point chaud n'était qu'un thermique mesuré de l'atlas), `orcieres-cairns-pente-nord-est` (99 %, le plus fort du Champsaur, à 2,2 km au sud des cairns d'Orcières ; profil matin et midi, cohérent avec « très calme le matin, puis la brise »), `combe-fourchue-pente-sud-ouest` (97 %), `le-caire-saint-michel-de-chaillol` (95 %, toute l'année, sous le Soleil Bœuf et le col du Palastre), `puy-des-pourroys-adroit` (93 %, 2570 m), `moussiere-sous-banc-du-peyron` (90 % ; le récit CHVD de juillet 2026 d'un pilote à 2130 m « sous le Banc du Peyron » regagnant 1100 m en 8 minutes correspond à cette pente sud plus qu'au sommet), `archinard-serre-lunel` (90 %, face nord-ouest du « gros dynamique sur Archinard »).

**Positions corrigées** : `ancelle-atterro` (altitude 1466 m de la fiche → 1312 m, terrain IGN au village), `cuchon-intermediaire` et `therm-cuchon-antennes` (altitude 1750 m estimée → 1613 m, terrain IGN à la position de la fiche FFVL 13578 qui donne 1600 m).

**Lacunes écartées**
- Forest des Baniols (FFVL 3091) : fiche sans description, aucun point chaud à moins de 4 km.
- Vieux Chaillol (FFVL 5041) : décollage de sommet à 3163 m pour un vol rando de descente plein sud ; aucun texte ne décrit d'ascendance (le point chaud voisin est documenté en `low`, voir ci-dessus).
- Cairns d'Orcières (FFVL 208 et 13537) : servis par le nouveau thermique à 2,2 km (la limite de 3 km est respectée).
- `ffvl14138-gorges-declenchement-thermique` (atterrissage des Gorges, position de la fiche) : conservé.
