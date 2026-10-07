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

