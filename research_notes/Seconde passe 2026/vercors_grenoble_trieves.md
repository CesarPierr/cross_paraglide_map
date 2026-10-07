# Seconde passe 2026 : lot vercors_grenoble_trieves

Massifs : grenoble-cuvette, vercors-nord, vercors-est-sud, trieves, matheysine. Données : `data/vercors_grenoble_trieves.json` (état final du 2026-10-07 : 160 sources, 9 figures, `--check` sans alerte sur ces massifs).

Volumes avant → après (somme des 5 massifs) : brises 7 → 25 ; convergences 1 → 5 ; dangers 7 → 44 ; thermiques 0 → 14 ; soaring 2 → 11 ; décollages 6 → 57 ; atterrissages 1 → 36 ; effets synoptiques 10 → 34 ; routes de cross 1 → 16 ; conseils 9 → 27 ; sources 34 → 160 ; figures 0 → 9.

## Sources lues (et ce qu'on y a trouvé)

- **« Dans l'Y grenoblois » (Vol Libre n°298, 2001, Kerkhove et Bertrand)**, reproduit en 4 images sur le fil parapentiste.info t49137 (S35). Lu image par image. p1 : Grenoble au cœur d'un Y, la cluse de Voreppe fait 75 % de l'aérologie locale, brises de vallée jusqu'à 900 m ; p2 : fig. 1a (brise de cluse forte, Grésivaudan descendant, confluence NE de Grenoble 400-500 m, 2-3 m/s), 1b (Grésivaudan aussi montant par fortes chaleurs), 2a-2b (vent S/SO) ; p4 : fig. 2c-2d (S au sol vers Vif, trop fort), 3 (front froid par la cluse, cols de Vence/Coq/Ayes, confluence Crolles-Lumbin), 4 (N/NE froid, confluence au sud de Grenoble, atterro de Lumbin impossible après 9h30-10h).
- **Carte « Vol libre Vercors » (Département de l'Isère, PNR du Vercors, FFVL, LPO, Mogoma 2018)**, PDF hébergé par Les Tichodromes (S49), 2 pages lues en images : flèches de brise, spirales thermiques, sites officiels, zones de rapaces et périodes critiques (faucon pèlerin janvier-juillet, aigle royal janvier-septembre, gypaète et vautour fauve janvier-août), réserve des Hauts-Plateaux, altitude minimum de survol 1100 m au col de Rousset ; page 2 : fiches de sites.
- **Carte Largeault « Brises des Alpes »** (S48) : export KML de la carte Google My Maps (mid 1LZ-3QtkG48alQEQfushGC6d_bAS9Y7o), dossier « vercors-diois » : 81 polylignes dessinées dans le sens de l'écoulement (pointe en fin de ligne), compilées d'après la carte du PNR ; sans légende. Les coordonnées des waypoints (`source`) sont celles des sommets des lignes. Lignes « Chartreuse » (Voreppe-Grenoble-Le Touvet, Grésivaudan) utilisées pour la cuvette.
- **Lans en l'Air** (S24, S37-S47) : 14 pages (liste des sites, « idées de cross », une page par site).
- **Fiches FFVL** : une vingtaine lues via le navigateur intégré (curl est bloqué par Cloudflare), puis fichiers `.cache/research/ffvl_sites_alps.tsv` et `ffvl_sites_alpes.json` fournis par le coordinateur (857 fiches) : coordonnées `source` et orientations de tous les décos/atterros, avec descriptions et dangers. Sources S100 et suivantes (une par fiche, URL `https://federation.ffvl.fr/sites_pratique/voir/<id>`).
- **Barbules Wiki** (S66-S68, via l'API MediaWiki) : cross du Serpaton (crêt de la Ferrière, Deux Sœurs, Grand Veymont), record de groupe de l'équipe de France du 25/04/1997 (279 km, Retkingen), Aigle (« Le Peuil »), Courtet. **Vol Libre Diois** (S56-S63) : aérologie du Diois (brise de nord, verrou de Châtillon, nuages orographiques sur Vassieux et Rousset), col de Rousset, Jocou (venturi de Lus-la-Croix-Haute), réglementation (réserve 300 m/sol, R196B, ZSM Glandasse), récits Rousset-Gap et Courtet. **Envol Sud-Isère** (S64) et **Matheysine Parapente** (S65) : Connex, Laffrey, Colombier, Sénépy (matin seulement). **Les Tichodromes** (S9 via archive.org, S51-S54) : récit des 204 km, ZSM gypaète, Saint-Jean-en-Royans.
- Fils parapentiste.info : cartographie des brises (S36, page 1), Vercors et Dévoluy (S33, en entier), vent de nord autour de Grenoble (S8, en entier). toutleparapente (S50), infos-parapente (S55), Is'Air, trieves-vercors.fr : peu d'aérologie propre.
- Non lus : PDF ATA « Les brises » (404), page parapente-isere.com (404), tichodromes.org (domaine disparu, lu via archive.org).

## Changements par rapport à la première passe

**Corrigé**
- **Alerte « Alpage du Sénépy »** : la première passe plaçait le déco à 44.87 N / 5.74 E (MNT 593 m, recalé à 2452 m). Fiches FFVL 14266/14267 : 44.9004 N / 5.7354 E, 1365 m, favorables S/SO, défavorables N/NE (alerte `--check` disparue). Matheysine Parapente : Sénépy face sud, vols le matin seulement.
- « Vierge du Vercors », rouleaux de brise et brise « souvent forte » : appartiennent au Pas de Saint-Martin (page club S41, fiche FFVL 1514), pas à l'Aigle. Hazard `aigle-vierge-rouleaux` **retiré**, remplacé par `saint-martin-vierge-rouleaux` ; vitesse du val de Lans abaissée.
- Courtet : orientations N/NO (FFVL 854, Barbules) au lieu de W ; 1365 m ; coordonnées FFVL.
- Récit 204 km (S9) : le texte sur le Moucherotte (déco OSO sous le vent, balise NNE 15-25 km/h) est confirmé via archive.org ; il devient route de cross complète.
- Positions approximatives de village remplacées par les coordonnées FFVL/ParaglidingEarth (Aigle, Belvédère, Saint-Nizier, Serpaton ×3, Laffrey, Moucherotte N). Coordonnées du club Lans en l'Air parfois en degrés-minutes mal formatés (Belvédère « 45.52171 ») : non reprises.
- R196B : activable du 16/09 au 30/06 (FFVL), non activable mercredi, samedi, dimanche, jours fériés (Vol Libre Diois) ; réserve des Hauts-Plateaux : décollage, vol et atterrissage interdits à moins de 300 m/sol (S58).

**Ajouté** : Y grenoblois complet (6 brises, 3 convergences, dangers, effets synoptiques) ; brise du Drac vers Vif/Monteynard/Monestier ; basse Romanche (déduction) ; val de Lans, Autrans-Méaudre, Rencurel/Romeyère, Saint-Martin, Gresse, Vercors central, Royans, Drôme-Chamaloc, Trièves-Croix-Haute, col de Menée, Drac-Matheysine-Champsaur ; 93 décos et atterros FFVL ; zones de rapaces, réserve, ZSM gypaète, espaces aériens (CTR2 Grenoble, TMA Lyon, R196B, aérodrome de Saint-Jean, parc des Écrins) ; effets synoptiques par direction ; 16 routes de cross (Lans en l'Air, Barbules, Vol Libre Diois, récit des 204 km).

**Retiré** : seulement `aigle-vierge-rouleaux` (mal attribué).

## Figures déclarées (F1 à F9)
F1 (Y grenoblois, 4 images servimg), F8 (carte de Xath), F2-F3-F5 (carte du PNR du Vercors, PDF pages 1 et 2), F4-F6-F9 (carte Largeault), F7 (Trièves : PNR + Largeault). `image_url` vide quand la figure n'existe que dans le PDF.

## Échecs, doutes, à vérifier
- Nominatim a répondu 429 pendant toute la session (limite partagée) : positions de la Vierge du Vercors, du col de Romeyère, du Bec de l'Orient, du Grand Veymont, du Mont Aiguille, des Deux Sœurs, de Corps, de Toussière, du Glandasse et d'Archiane, etc. en `approx`.
- Flèches Largeault et PNR sans légende : sens lu d'après la pointe, vitesses/heures/épaisseurs le plus souvent non documentées (champs nuls plutôt qu'inventés), confiance faible à moyenne.
- Vassieux, Font d'Urle : aucun site FFVL ni page de club trouvés (une « aire de Font d'Urle » existe dans le recensement des équipements sportifs, non lue : bookcity.fr a expiré). Mens (hors Courtet, Châtel), Lalley, Clelles, Monestier : peu de sources d'aérologie ; le Trièves repose surtout sur Courtet.
- Sens de la brise du Grésivaudan : descendante (fig. 1a) ou montante (fig. 1b, Largeault) selon la situation : les deux sont conservées, confiance moyenne.
- Les fils parapentiste.info sur Laffrey/Montaud (S8) : seul le passage « Montaud, Courtet, Montlambert par nord fort » a été retrouvé dans la page 1 du fil ; le texte sur Laffrey de la première passe n'y figure pas.
- aero-sat.com (école de Courtet) sert actuellement du contenu de spam : ignoré. PDF toutleparapente « VolLibreweb.pdf » et images jimcdn inaccessibles : remplacés par la même carte hébergée par Les Tichodromes.
- Colombier (Valbonnais) : la fiche du club écrit « 31 juin » pour la fin de l'interdiction de survol du parc des Écrins : reprise telle quelle, avec « (sic) ».
- Lignes Largeault du Diois (13-15, 19-29, etc.) laissées au lot devoluy_gap_buech_diois, sauf 15 (col de Menée → Le Percy) et 20 (Drôme → Romeyer) reprises ici.

## Thermiques et points de relance (passe complémentaire)

Constat de départ : la seconde passe ne retenait comme `thermal_spots` que les endroits explicitement appelés « thermique » (14 éléments). Les pilotes parlent surtout de pompes de service, de raccroches, de plafonds et d'antennes le long des cheminements. Cette passe ajoute **32 points** (thermiques 14 → 46 : cuvette 0 → 1, Vercors nord 7 → 23, Vercors est et sud 4 → 12, Trièves 2 → 9, Matheysine 1 → 1), 3 dangers, 3 routes de cross, 4 conseils et 37 sources (S193 à S229). Rien n'a été supprimé ni renommé. `npm run data:build -- --check` : aucune alerte.

Convention de confiance : plusieurs sources concordantes ou récit précis = `medium` ; extrapolation sans récit explicite = `low` (un seul cas : `pilier-nord-serpaton-extraction`, « déduction » dans la description).

### Sources lues
- Récits et topos du **CHVD** (club de marche et vol du Dauphiné) : le blog est ouvert à l'API WordPress, les 1326 articles ont été aspirés (`.cache/research/docs/vercors_grenoble_trieves/chvd/`) puis filtrés sur les mots du brief. Une trentaine de récits utilisés (Moucherotte, Col Vert, Belvédère, Dent Percée, Cornafion, Courtet, Châtel, Jocou, Montaud, Rachais, Pic Saint-Michel, Peuil, Magic Week, 201 km, triangle FAI).
- Relues en entier : Lans en l'Air (idées de cross, Aigle, sites), Tichodromes (versant est depuis le col de l'Arc, Tour du Vercors), Vol Libre Diois (col de Rousset, Jocou, récits), parapentiste.info (fiche et récit du Serpaton, fil « transition Chartreuse → Vercors »), Barbules (Serpaton), fiches FFVL (`ffvl_sites_alpes.json`), carte PNR du Vercors (page 1 relue : les spirales de thermiques y sont sans nom, déjà exploitées).
- Positions : géocodeur IGN pour les sommets, crêtes, croix et lieux-dits (S226), OpenStreetMap/Overpass pour les mâts et le Mont de Ménil (S227), FFVL pour les décos.

### Ajouté
- **Vercors nord** : Croix des Suifs et Dent Percée (relances Aigle/Belvédère → Pic Saint-Michel), pompe de service du Belvédère, crête des Crocs au sentier Gobert, arêtes du Gerbier (plafond 2800 m), pompe des pierriers du Col Vert, épaule du Cornafion, col de l'Arc face est, plafond du Moucherotte (avant la transition vers la Chartreuse), le Mollard / éperon de Sassenage (raccroche en arrivant du Néron), Grande et Petite Moucherolle, pompe et antenne de Montaud, relais du Bec de l'Orient, antenne de Bellecombe, Pas des Rages (plafond avant les gorges de la Bourne).
- **Cuvette** : bulles du Mont Jalla / Bastille (relance sous la ZIT) ; piège de la pointe sud du Néron (rangé en danger, pas en thermique).
- **Vercors est et sud** : Deux Sœurs (> +4 m/s), plafond du Grand Veymont, Mont Aiguille, Tête Chevalière, But Sapiau (col de Rousset), Roc de Toulau (thermique de 14h), Pré de Cinq Sous, pilier nord du Serpaton (déduction), point bas du Crêt de la Ferrière (danger).
- **Trièves** : pompe devant le déco de Courtet, arête de Fluchaire, Châtel, Mont de Ménil (confluence par nord), pompe et antenne de l'émetteur du Jocou, plafond de l'Obiou et du Grand Ferrand. Routes : tour du bocal de Courtet (45 km) et Jocou → Mesnil → Obiou.
- **Matheysine** : danger de la combe du Goulet (brise de Valbonnais, 28 juillet 2026).
- **Routes** : waypoints insérés dans l'ordre volé dans `belvedere-crocs-cornafion-moucherotte`, `cote2000-lans`, `faces-est-moucherotte-grand-veymont`, `moucherotte-petit-veymont-rachais-chartreuse`, `autrans-moucherotte-neron`, `gorges-bourne-st-martin`, `montaud-sud`, plus la route nouvelle `col-vert-grand-veymont-jocou-sud`. Positions « env. » devenues sourcées (IGN) : Rachais, col de Romeyère, Bec de l'Orient, Rencurel, Crêt de la Ferrière, Deux Sœurs, Grand Veymont, Mont Aiguille.

### Divergences et doutes
- Courtet : le premier thermique est « sur la gauche du déco » (CHVD) ou « dans la combe à droite » (récit Vol Libre Diois) : les deux sont conservés.
- Col Vert : altitude du déco 1635 m (topo CHVD) contre 1469 m (FFVL 5122) ; altitude non renseignée sur la pompe.
- Antenne de Montaud et antenne de l'émetteur du Jocou : identifiées par déduction à des mâts OSM (Mollard Guillon, mât à 3 km à l'est du Jocou), position `approx`. Le Mesnil est identifié au Mont de Ménil d'OSM, à confirmer.
- Le Mollard : position du hameau (IGN), l'éperon exact de la raccroche n'est pas localisé.

### Non localisé ou non documenté
- Rachais et Saint-Eynard (pompe du Rachais, Château Nardant, Antennes de Saint-Hilaire) relèvent du lot Chartreuse : non repris ici.
- « Antenne de Pennes » (récit Solaure, Diois), Tête de la Dame, col de Bachal : hors lot ou sans coordonnée trouvée.
- Laffrey, Sénépy, Monteynard : aucun récit de pilote décrivant des raccroches ou des plafonds (seuls la brise, le soaring du Conest et le vol du matin du Sénépy sont documentés) ; Mens (hors Châtel), Lalley, Clelles, Vassieux, Font d'Urle : rien d'exploitable. Laffrey : fil CHVD sans aérologie thermique, topo EOSYA illisible sans JavaScript.
- Pages bloquées : voir `.cache/research/blocked_urls.txt` (3 lignes ajoutées).

## Passe secteurs minces

Date : 7 octobre 2026. Objectif : creuser les secteurs les moins documentés de l'atlas, un par un. Convention de confiance : récit précis ou plusieurs récits = `medium` ; extrapolation du relief ou des traces GPS seules = `low` avec « déduction ». Identifiants existants conservés, rien supprimé. `npm run data:build -- --check` : aucune alerte nouvelle ; `npm run model:check` : 0 paire de brises opposées.

### Matheysine – Drac (`matheysine`)

Volumes avant → après : brises 3 → 3, convergences 0 → 0, hazards 12 → 14, thermiques 1 → 14, soarings 2 → 2, décollages 11 → 12 (Grand Serre ouest, ajouté avec le secteur de la cuvette), atterrissages 8 → 8, effets synoptiques 6 → 7, routes 1 → 2, conseils 5 → 8 ; 13 sources nouvelles (S230 à S242) et 2 figures (F10-matheysine, F11-matheysine).

**Sources nouvelles ou relues**
- Présentation *La Grosse Miche* « Cross avancé : massifs et transitions » (2018, PDF) : carte « Taillefer » (page 16) et transition « > Taillefer » (page 29), lues en image. Les ronds orange (relances), les deux cheminements, les flèches d'entrée et les triangles 1 (zone sous le vent) et 2 (turbulences) ont été géoréférencés par ajustement affine sur six repères (Valbonnais, La Salette, Rocher du Lac, Lavaldens, Oris-en-Rattier, Entraigues), erreur sur les repères de 100 à 200 m : positions `approx` pour les triangles, recoupées par les points chauds kk7 pour les ronds. Ces deux pages n'avaient pas été exploitées (seules les pages 10 et 26 l'étaient pour la Maurienne).
- Récits du club *Saint-Hilaire* (9 avril 2017, avril 2018, juin 2025) : parcours des Richards à Lumbin par La Salette, le Coiro, la tête de Barbabon et le Taillefer (déjà cités par les lots Chartreuse et Bauges, jamais pour la Matheysine) ; récits de *Luc Armant* (18 août 2006, sud très fort sur le Coiro et le Taillefer) et de *Jérôme Canaud* (Air Tour 2011 : faces ouest du Conest) du site Au gré de l'air ; *Blues Team* (mai 2015, Coiro et Taillefer) ; triangle de 185 km du 19 juillet 2019 (Parapente Pays de Gex : piège de Valbonnais) ; récit de Honorin Hamard (juillet 2016, La Salette).
- Pages du club *Envol Sud-Isère* pour la Tête de Vache (turbulences « en cas de brise/activité thermique ») et le Colombier (restitution du soir), fiches FFVL déjà citées et points chauds de thermal.kk7.ch.

**Ajouté**
- *Relances du parcours classique des Richards vers Chamrousse* (`medium`) : épaule sud-est du Coiro, zone ascendante au nord-ouest du sanctuaire de La Salette (plafond 2800 m), pentes sud du Taillefer, pentes sud de la tête de Barbabon et du Grand Armet ; route `salette-coiro-barbabon-taillefer-chamrousse` (31 km) avec les distances et altitudes de transition de La Grosse Miche.
- *Thermiques des décollages FFVL sans thermique documenté* : Côte Rotte (`low`, point chaud à 98 %, le plus régulier de la zone), Jas d'Oris (`medium`, carte et traces GPS), Le Combenon (`medium`, club), Laffrey (`medium`, forum, « un peu de thermique » par bise légère), Colombiers (restitution du soir, `medium`, club), Conest (pentes sud du matin et faces ouest/nord-ouest de l'Air Tour, `medium`). Le texte « thermique » du soaring de Laffrey n'avait pas de thermique : il est maintenant décrit.
- *Autres* : cercle de Lavaldens et La Morte (`low`), Coiro sud (`low`).
- *Pièges* : zone sous le vent et turbulences du Coiro (triangles de la carte, piège de Valbonnais de 2019), sud très fort sur le Taillefer (2006). Effet « vent du sud », trois conseils (transitions chiffrées, pièges du Coiro, Grand Serre « sans rendement »).

**Divergences et doutes**
- Grand Serre : « grande pente en herbe orientée à l'ouest sans rendement » (Air Tour 2011) contre « bulles thermodynamiques bien présentes » (CHVD, 30 octobre 2024) ; les traces GPS donnent par ailleurs un point chaud à 98 % sur la Côte Rotte, 2 km au sud. Les avis sont conservés, et le décollage ouest du Grand Serre (2141 m) est ajouté.
- Coiro : « puissant » par sud établi (2017), « agréable en basse couche, turbulent en altitude » par brise (2018), rien du tout par sud très fort (2006) ; les trois sont décrits.

**Introuvable**
- Les Souillets (FFVL 3009) : aucun point chaud mesuré à moins de 3 km, aucun texte (« décollage pratiqué » seul) : aucun thermique créé. Sénépy et Monteynard : toujours aucun récit de raccroche ; le « thermique puissant et rugueux avant La Mure » du vol de Luc Armant du 27 juillet 2005 (Bleyne – La Mure) n'a pas de position (non créé).
- Le récit de l'Air Tour place le Sénépy, la Pierre Plantée et les faces ouest au-dessus du lac de Monteynard sans repère cohérent avec la carte IGN : non repris.

### Cuvette grenobloise (`grenoble-cuvette`)

Volumes avant → après : brises 7 → 7, convergences 3 → 3, hazards 7 → 7, thermiques 1 → 7, soarings 1 → 1, décollages 3 → 3, atterrissages 4 → 4, effets synoptiques inchangés, routes inchangées, conseils 4 → 6 ; 18 sources nouvelles (S243 à S260). Le Grand Serre (décollage ouest) est ajouté dans `matheysine`.

**Sources nouvelles ou relues**
- Corpus *CHVD* (1326 articles aspirés dans `.cache/research/docs/vercors_grenoble_trieves/chvd/`) interrogé par lieu : sept récits sur l'Écoutoux, le Rachais et le Néron (2006, 2007, 2009, 2012, 2021, 2022, 2025), cinq sur Chalais (2016, 2021, 2023, 2024, 2026), quatre sur la crête des Ramettes de Chamrousse (2014, 2020, 2021 ; carte SpotAir de juillet 2021), un sur le Grand Serre (30 octobre 2024). Aucun récit CHVD ne parle de Poisat.
- Site du club *Les Arcs en Ciel* (Voreppe), page de Chalais : voler le matin ou par sud faible, soaring du soir le long des falaises, départ en cross par le rocher de Chalves et la Grande Sûre ; sa carte interactive (KML Google) donne les positions des décollages, atterrissages et lignes électriques, déjà connues.
- Fiche FFVL 13474 de Poisat lue en entier dans le navigateur intégré (le texte stocké dans la base était tronqué) : brise thermique de fin de journée, appui dynamique face nord, vue à 180°, consigne de ne pas se présenter sous le vent du site.
- Points chauds de thermal.kk7.ch et IGN (BD TOPO : toponymes ; RGE ALTI : altitude, pente, exposition) pour les positions.

**Ajouté**
- *L'Écoutoux* (`medium`) : le triangle qui barre la vallée du Sapey, relance entre le Rachais et la Chartreuse, absent de toutes les données et point chaud mesuré à 100 % en toute saison (récits : puissant, anémique, ou rien à l'aplomb du sommet selon le jour).
- *Chalais* (`medium`) : bulles du matin sur l'épaule, belvédère et aiguille, remontée au-dessus du déco, soaring du soir ; le point chaud mesuré est sur la pente ouest sous le belvédère (profil de midi), ce que le texte du club ne précise pas.
- *Poisat* (`medium`) : thermique de la pente ouest et brise thermique du soir (texte FFVL).
- *Chamrousse* (`medium`) : crête des Ramettes.
- *Néron* (`low`) : pied de la face sud-est au-dessus de Saint-Martin-le-Vinoux (point chaud à 99 %, mais zone sous le vent de la brise de Voreppe selon le CHVD) ; Quaix-en-Chartreuse (la Sonnarie, `low`).

**Introuvable**
- Aucun récit ne décrit les ascendances de Vizille, de Notre-Dame-de-Mésage ni des Corbières (points chauds à 86-89 %), ni de la Dent de Moirans et du Petit Montaud (secteur Vercors nord) ; non créés.
- L'ascendance mesurée de la Grande Sûre (le Moine, rochers de Pierre Taillée), documentée par un récit CHVD de septembre 2024, relève du secteur Chartreuse : non créée ici.
- La carte des brises à l'atterrissage de Chalais (PiouPiou 111) renvoie à une photo Google non lisible.
