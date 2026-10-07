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
