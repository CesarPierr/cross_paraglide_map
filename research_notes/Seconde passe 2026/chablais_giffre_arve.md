# Seconde passe 2026 : lot `chablais_giffre_arve`

Massifs : `saleve-genevois`, `arve-faucigny`, `haut-giffre`, `chablais`.
Fichier de données : `data/chablais_giffre_arve.json` (version complète, 4 massifs, 8 figures, 187 sources).
La première passe n'avait pu lire aucune page (proxy bloqué) ; cette fois le réseau était ouvert. `npm run data:build -- --check` ne signale plus aucune alerte sur ces quatre massifs (deux alertes d'altitude et de position ont été corrigées en cours de travail : Châtel - Morclan et l'atterro des Putheys).

## 1. Volumes avant / après

| Catégorie | Première passe | Seconde passe |
|---|---|---|
| Brises | 10 | 21 |
| Convergences | 0 | 0 |
| Dangers | 11 | 41 |
| Thermiques | 1 | 12 |
| Soaring | 2 | 11 |
| Décollages | 10 | 44 |
| Atterrissages | 8 | 26 |
| Effets du vent synoptique | 12 | 31 |
| Itinéraires de cross | 0 | 12 |
| Figures | 0 | 8 |
| Sources | 38 | 187 |

## 2. Sources lues (ce qu'on y a trouvé)

### Fédérations, comités, clubs, écoles
- **FFVL, PDF « Vol libre au Pays du Mont-Blanc » (2008, 32 p., lu en entier)** : brises thermiques 20-25 km/h, jusqu'à 30, sensibles jusqu'à 2500-3000 m ; vol à proscrire au-dessus de 20 km/h de vent à 2000 m (sites protégés comme Plaine-Joux) ; foehn (indices, vallées exposées Chamonix et Les Contamines, il peut rester cantonné entre 1400 et 1800 m) ; fiches Plaine-Joux, Varan, lac de Passy, Marlioz (UTM → 45.9158 N, 6.7060 E), Chedde ; zones réglementées p. 6 (altiport de Mayères, gypaète, réserves). Aucun schéma de brise (seulement des cartes de zones, p. 28-29).
- **CMBVL (club de Passy)** : page météo (foehn, seuil Aoste - Annecy de -4 hPa via Atmosoar ; brise de Sallanches ; retour d'est/sud-est côté Varan) et dix fiches de site (Plaine-Joux, Varan, Marlioz, Chedde, lac de Passy, Lachat d'en haut, Frioland, Barmerousse, Platé, Pormenaz).
- **FFVL, fiches terrains** (lues dans le navigateur intégré ; le site renvoie 403 à curl) et extraction `.cache/research/ffvl_sites_alpes.json` fournie en cours de passe : environ 70 fiches du secteur (124, 125, 645, 646, 1087, 1089, 1172, 1174, 1189, 1190, 1192, 1193, 1197, 1198, 1200, 1201, 1593, 14307, 298, 299, 1044, 1090...). Les secteurs de vent, dangers, TMA et restrictions en viennent.
- **Paradelta / CVLG (Genève)** : décollages, atterrissages, réglementation aérienne (CTR, TMA1 1050 m, TMA2 1700 m AMSL), challenge permanent Salève, communiqué sur les atterrissages de secours, plan des atterrissages (image).
- **CVLS (club de vol libre du Salève, cvls.fr)** : fiches décollages et atterrissages avec coordonnées GPS ; forum parapentiste.info : message du 29 septembre 2026 (brevet de pilote IPPI 4 obligatoire à Troinex).
- **Choucas Club / école Les Choucas (Mieussy)** : règlement du site (PTU obligatoire, étape vent arrière au-dessus du Giffre, Pertuiset privé).
- **CLAM (Les Ailes Morzinoises)** : comptes rendus de stages cross 2026 (trois parcours réels), newsletter (seuls décollages autorisés sur le domaine skiable), gypaète.
- **CDVL74** : zones gypaète actives (10 ZSM, dont Avoriaz, Bargy, Sixt-Passy, Sixt-Fer-à-Cheval).
- **Marche et Vol** : fiche Samoëns - La Bourgeoise (PTU main droite à l'atterro, brise très forte dès 12-13h).
- **CHOTO (Thonon-Orcier)** : club fondé en 1974, plus de 200 membres, décollages et atterro.
- **Pégase Samoëns, Faucigny Parapente, Salève Airlines** : consultés, peu d'aérologie (pages commerciales ou de vie de club).

### Cartes de brises (figures)
- **Franck Largeault, Google My Maps « Brises des Alpes »** (export KML) : couches Chablais (11 lignes), Bornes-Aravis (Cluses - Sallanches, Val de Bornes), Beaufortain - Mont-Blanc (pente Le Fayet - Plaine-Joux). Les lignes sont tracées à la main, la pointe de flèche est le dernier segment.
- **SHV/FSVL, carte « Alpines Pumpen / Pumping alpin »** (PDF d'une page, partie sud-ouest lue à 150 dpi) : flèche Annemasse - Bonneville - Cluses - Sallanches, flèche Annemasse - Saint-Jeoire - Taninges - Samoëns, Thonon - Morzine, Thonon - Abondance, montées de pente (bleu) et débordements de cols (rouge, Pas de Morgins, col des Aravis).

### Randovol, Camptocamp, forums, presse
- **Randovol** (150 pages du Chablais, lues par aspiration) : coordonnées déco/atterro, brise très forte à Abondance (étranglement des Portes), venturi au refuge de la Dent d'Oche, lignes THT, atterros.
- **Camptocamp** (API) : orientations, pentes et atterros de 14 décollages (Môle, Sur Cou, Saix, Varan, Frioland, Platé, Bourgeoise, Criou, Areu, Couennasse, Quatre Têtes, Mont de Grange, Hermone) ; **Alpes Guides** (Môle).
- **parapentiste.info** : fils Salève, Salève/Sallanches, Salève - Annecy, Môle, Bonneville, Bornes-Aravis vs Chablais, cartographie des brises (images non visibles pour un invité).
- **Léman** : SISL (12 p.), MétéoSuisse (bise ; vents du Léman), Boaton, CEPOB/Allez savoir.
- **Parapente Montagne** : Quatre Têtes ; tour du Mont-Blanc depuis Morzine (traversée du Haut-Giffre).

## 3. Changements par rapport à la première passe

### Corrigé
- **Décollages du Salève** : la première passe plaçait Téléphérique et Table à (6.18, 46.169), dans la plaine, comme un seul point. Positions des clubs : Téléphérique 46.1547, 6.1943 ; Table 46.1487, 6.1891 ; Crêts 46.1302, 6.1718. Les fiches FFVL 609, 1966, 1421 donnent des coordonnées plus décalées (jusqu'à environ 1 km) : divergence signalée dans les descriptions.
- **Atterrissages du Salève** : Pont de Zone, Cercueil et Pomier (forum 2016) sont supprimés ou interdits ; actuels : Troinex (brevet IPPI 4 obligatoire depuis septembre 2026), Jules Ferry, Le Coin.
- **Lac de Passy / plan d'eau** : le point de la première passe (6.709, 45.915) était en réalité vers Marlioz. Lac de Passy 45.9175, 6.6640 (FFVL 1174) ; Marlioz 45.9161, 6.7061 (FFVL 125) ; Chedde 45.9284, 6.7249 (FFVL 1087). Le lac est fermé du 1er avril au 1er octobre.
- **Le Môle** : orientations S-SO-O (la première passe écrivait N et S) ; atterros revus (La Tour, Ayse, champs de Bonneville ; pas d'atterro officiel).
- **Rebat du Léman** : la première passe en faisait une « brise de lac ». La SISL le définit comme le renversement de jour du vent de nuit, canalisé le long de la côte ; MétéoSuisse donne des brises lacustres de 5 à 10 nœuds. Vitesses 12 (typique) et 19 km/h (max) retenues.
- **Brise du Giffre** : l'alimentation passe par la Menoge (Fillinges, Viuz-en-Sallaz) et le col de Saxel selon les deux cartes, et non par Marignier (déduction retirée).
- **Brise d'Aulps** : la formule « soutenue à forte en milieu/fin de journée » vient d'un blog commercial (Morzinn), pas d'une fiche de club ; confiance abaissée et source signalée.
- **Super Morzine** : secteurs favorables SE-S-SO (fiche FFVL), consignes complètes par vent de nord et de sud ; orientation SO côté tourisme.
- **Mieussy** : l'atterrissage actif est « la Ferme » (FFVL 1164) ; la fiche 1163 est marquée « inutilisable ».
- **Atterro Agy / Cluses** : l'ancien terrain d'Agy est interdit depuis le 10 mai 2024 ; le Noiret reste en usage (61 atterrissages en 2025).
- **Altitudes** : Platé 2166 m (ParaglidingEarth ; la fiche FFVL porte 1030 m), Châtel - Morclan 1870 m (la fiche porte 1376 m).
- **Atterro de Morzine** : la fiche FFVL 1089 « Morzine » est cartographiée sous OpenStreetMap comme « Atterrissage FFVL Morzine Puthey » (même lieu, identification déduite).

### Ajouté
- Brises : basse Arve (Annemasse - Cluses), cluse de Cluses - Magland, retour d'est côté Varan, pentes de Varan, d'Agy / Chevran, de Pertuiset / Platière, des Saix, de la Bourgeoise, du Borne, vallée d'Abondance (très précoce), Vallée Verte, Orcier, rebat Évian et Thonon, rive Lugrin - Maxilly, morget.
- Dangers : TMA de Genève (Salève, Orcier, Mieussy, Morzine), gypaète (Avoriaz, Ardoisières, Sixt-Passy, Doran), réserve de Passy, venturi du col de Monnetier, gradient du Téléphérique, atterros du Coin, de Troinex, de Jules Ferry, de Chedde, rouleaux (Saix, Bourgeoise, Pertuiset, Plaine-Joux O-SO, Orcier, Dent d'Oche), THT d'Abondance et de Châtel, bise et vaudaire sur le Léman.
- Cross réels : boucle Super Morzine - Criou - Saix, 85 km Revard - Tournette - Mont Chéry - Morzine, Mieussy - Mont Billiat, traversée du Haut-Giffre vers Émosson, Salève vers Annecy ou le Môle ou Samoëns, challenge permanent Salève, Sur Cou - Andey.
- Effets du vent synoptique (bise, N, NO, O, SO, S, SE, E, foehn, NE) par secteur.

### Retiré
- Brise `branche-mont-arbois-combloux-megeve` : déjà couverte par le lot Mont-Blanc (`brise-arve-vers-megeve`).
- Danger `saleve-pente-turbulente` : la source était une page d'aéromodélisme (S17), pas du parapente ; remplacé par les dangers sourcés des clubs.
- Fiche `saleve-telepherique-table` : fusion erronée, scindée (l'id est gardé pour le Téléphérique ; la Table a l'id `saleve-table-orientation`).

## 4. Figures trouvées (8)

- F1 (Salève) : plan des atterrissages du CVLG (image Google Earth) : Troinex, Le Coin, Zone de zone, trois terrains « Atterro INTERDIT » ; F2 (Salève) : parcours du Challenge permanent (image Google Earth, TMA en rouge, vue oblique).
- F3 (Arve), F5 (Giffre), F7 (Chablais) : carte Largeault (flèches lues dans le KML).
- F4 (Arve), F6 (Giffre), F8 (Chablais) : carte « Pumping alpin » SHV/FSVL.
- Chaque figure liste les éléments extraits (`extracted_to`).

## 5. Ce qui reste incertain, a échoué ou manque

- **Convergences : aucune documentée.** Les sources parlent de divisions (Mont d'Arbois, Saint-Gervais), de brises de pente qui se confondent avec la brise de vallée (Arbaron) ou de « confluence de col » (Megève, autre lot), sans géométrie. Rien n'a été inventé.
- **Pas de brise de vallée documentée pour le Genevois** (seulement brises de pente, gradient, restitution du soir, bise).
- **Heures et vitesses** : presque aucune mesure locale publiée. Les valeurs chiffrées des brises de la basse Arve, du Giffre, d'Aulps et d'Abondance sont des interprétations (indiquées dans les descriptions, confiance moyenne).
- **Positions estimées** (`approx`) : balises du challenge permanent Salève (±3 km), pied de la carrière d'Étrembières, col de Monnetier, points de la carte Largeault (tracé à la main), Revard, Semnoz, Tournette, Pointe Percée, Dents Blanches (partie), atterros du Môle (La Tour, Ayse).
- **FFVL, coordonnées douteuses** : Salève (cluster de points décalés), Mont de Grange (1183), Châtel (1162), Thollon (1173), Bellevaux (1177, 1178), Habère-Poche (1155, 1156, 1187, 1188) : non utilisées ou corrigées par d'autres références.
- **Sites de Sixt, Praz de Lys, Brasses, Habère-Poche, Bellevaux** : couverts légèrement (fiches FFVL, Randovol), sans récit.
- **Pléney** : usage pour le parapente à vérifier (la newsletter CLAM 2026 ne cite que Super Morzine).
- **Joux Plane** : seulement dans un blog commercial, non retenu.
- Les listes d'atterrissage de la première passe (Pomier) ne sont pas confirmées.

## 6. URL bloquées ou inutilisables (aussi dans `.cache/research/blocked_urls.txt`)

- `https://parapente.ffvl.fr/cfd/liste/deco/20190742/type/fai` : vérification Cloudflare (vols en triangle FAI depuis Les Crêts, utile pour les routes réelles du Salève).
- `https://www.xcontest.org/world/en/flights-search/…` : réservé aux utilisateurs connectés (401).
- `https://lessorsavoyard.lemessager.fr/649303889/article/2023-09-16/…` : article payant (triangle Salève - lac d'Annecy - Chablais, 21 août 2023, seul le chapô est lisible).
- `https://marche-et-vol.fr/wp-content/uploads/2018/12/Tour-vallee-Giffre.pdf` (et `Mieussy_PM-HS-2014.pdf`, `2019/12/Samoens-la-bourgeoise.pdf`) : 404, absents de Wayback ; une copie documenterait le tour de la vallée du Giffre.
- `http://www.choto.fr/` : page d'hébergeur par défaut (nouveau site asso-choto.fr lu).
- `https://haute-savoie.ialpes.com/…` (S30) : résolution DNS impossible ; `vol-libre-geneve.ch` (fichiers CSP.kml/wpt) : hôte non résolu.
- Images jointes du fil parapentiste.info « cartographie des brises » (cartes Haute-Savoie et Annecy) : non visibles pour un invité.
- Facebook (groupes Voler à Mieussy, CHOTO, parapotes Salève) : non consultables sans connexion.

## Thermiques et points de relance (passe complémentaire)

Passe du 7 octobre 2026 (brief « thermiques et points de relance »). Thermiques avant / après : saleve-genevois 3 → 5, arve-faucigny 5 → 10, haut-giffre 2 → 10, chablais 2 → 7. Descriptions complétées sur 5 thermiques existants (Criou, Varan, Quatre Têtes, Mieussy), 2 routes ajoutées (Saix → Trapechet → Criou ; Aiguillette des Houches → Platé → Varan → Quatre Têtes → Pointe Percée), 3 points de passage ajoutés au parcours CLAM de niveau 3, 3 pièges (Criou sous le vent, Barmerousse). `npm run data:build -- --check` : aucune alerte.

**Documents relus** : tous les textes du lot (fiches FFVL, CMBVL, CVLS/CVLG, Marche et Vol, Randovol, guide « Vol libre au Pays du Mont-Blanc » p. 28-35, CLAM, Choucas, Pégase, Morzinn, forums déjà récupérés) et, du web, S200 à S210 : Paragliding Map (Salève, Mieussy/Môle), forums parapentiste.info (Criou t55395, Mieussy t6781, topo Chamonix-Arclusaz dans t2620, Varan/Plaine-Joux t54223), Marche et Vol (Saix), Summits, FFVL Cordon.

**Ajoutés**
- Salève : devant le décollage du téléphérique (thermique statique) ; Sur Cou comme relance après la plaine de La Roche (low, déduction).
- Arve/Faucigny : Môle face sud, Pointe des Brasses, Cordon – Tête du Planet, éboulis sous le Dérochoir, falaise de la Pointe de Platé ; cheminement détaillé Chamonix → Varan → Quatre Têtes → Pointe Percée d'après le topo d'un compétiteur local.
- Haut-Giffre : Criou (lame d'ascendance, zones sous le vent, face sud d'arrière-saison), plateau des Saix, Pointe du Trapechet (fin de matinée), Marcelly, col du Fornet (plein ≥ 3200 m avant Émosson) ; Angolon, Grands Vans / Tête de Louis-Philippe, Haute-Pointe / Billiat en low (points de passage de stages CLAM, relances déduites).
- Chablais : Mont Chéry face sud, Super-Morzine / crêtes de Zore vers Avoriaz, Pointe de Ressachaux (dynamique FFVL), Pléney (restitution), Pointe de Nyon (low).

**Confiance** : concordance de plusieurs sources ou récit précis → medium ; points de passage de parcours de stage sans description d'ascendance, ou texte commercial isolé → low, avec « déduction ». Les sources commerciales (Morzinn, Summits) sont signalées comme de fiabilité modérée.

**Positions approximatives** : Criou face sud et zones sous le vent, hazards de Barmerousse, Sur Cou (position source mais thermique déduit).

**Introuvable** : Rochers de Rion (« LA pompe à couillon » du topo de Chamonix vers les Aravis), arête des Saix côté Passy/Sixt, Tête des Mariages et combe de Verreu au Criou, Pas du Taureau et Dent de Barne (Haut-Giffre) : absents d'OSM/Nominatim, cités dans les descriptions seulement. Peu de récits de cross détaillés pour Salève → Môle, Sommand, Praz de Lys et la vallée d'Aulps : les comptes rendus XContest/CFD sont inaccessibles. Le secteur Annecy du Salève (Collonges, cross vers le Môle) reste décrit surtout par les fiches FFVL.

**URL bloquées** : XContest (connexion), CFD `parapente.ffvl.fr/cfd/liste/...` (Cloudflare), vidéos YouTube (descriptions illisibles en curl).


## Passe secteurs minces

Date : 7 octobre 2026. Convention de confiance : récit précis ou plusieurs récits = `medium`, extrapolation du relief = `low` avec « déduction ». Identifiants existants conservés, rien supprimé. `npm run data:build -- --check` : aucune alerte sur le massif.

### Salève et Genevois (`saleve-genevois`)

Volumes avant → après : brises 2 → 4, convergences 0 → 0, hazards 8 → 9, thermiques 5 → 6, soarings 2 → 2, décollages 3 → 3, atterrissages 3 → 3, effets synoptiques 7 → 7 (deux complétés), routes 3 → 5, conseils 5 → 9 ; 9 sources nouvelles (S211 et suivantes, voir le JSON).

**Sources nouvelles**
- Récit du cross du 17 avril 2016 du Téléphérique à Planfait (blog Liberiste, publié le 9 février 2017) et sa vidéo : TMA2, une heure à zéro avant le thermique à 1645 m, point bas à 984 m, thermique de la Chapelle-Rambaud, raccroches de Sous-Dine et du Parmelan ; commentaires de deux pilotes locaux (décoller des faces est dès 11h-12h au printemps ; Margériaz plutôt que Colombier dans les Bauges).
- Page « Site Parapente Salève » du même blog (2015) : lue, déjà recoupée par les fiches de clubs ; ajoute l'atterrissage « Pont de Zone » (411 m, probablement le même terrain que Jules Ferry : non vérifié, donc pas de fiche créée) et la mention « bulles qui remontent au printemps et en été ».
- MétéoSuisse, blog « Les vents du Léman » (déjà S117) relu : le séchard se prolonge « jusque sur les pentes ensoleillées du Salève, du Vuache et du Jura », ≈10h-16h ; vitesse en nœuds probable (le texte écrit « km/h »).
- Presse : Dauphiné Libéré (début lisible seulement) sur le triangle de 143 km du 21 août 2023 ; extrait du Messager (page en 403) pour la date et la canicule.
- Vidéo de Patrick Prince (3 août 2024) : Téléphérique → Planfait, 34 km en 1 h 26, sans détail de trajet.
- Carnet de vol de Franck Largeault (6 décembre 2019) : vent de sud 22/32 à la balise du Salève, turbulent aux Crêts.
- Positions : géocodeur IGN (La Muraz, La Chapelle-Rambaud, Sous-Dîne, Parmelan, Dents de Lanfon, Saint-Ferréol, mont Billiat), fiche FFVL 1157 (Planfait), Nominatim (Nyon, Jet d'eau).

**Ajouté ou corrigé**
- *Brises* : le séchard (`saleve-sechard-petit-lac`, `medium`, 10h-16h, 1 à 2 Bf, parfois 3 Bf), seule brise « de plaine » documentée ; un écoulement descendant des faces ouest (`saleve-ecoulement-descendant-matinal`, `low`, déduction, horaires 21h-9h distincts). Le résumé du massif, qui disait qu'aucune brise n'était documentée, est corrigé.
- *Thermique et relance* : La Chapelle-Rambaud, « fameux thermique » au milieu du « désert » de ≈15 km entre le Salève et Sous-Dine ; thermique devant le Téléphérique complété (zéro pendant une heure, 1645 m).
- *Danger* : sortie du Salève vers Annecy (plafond sous la TMA2, point bas à 4 km, dérive de 25 km/h NO) ; espaces aériens précisés (TMA2 1674 m, TMA6 FL85, TMA7 FL105, CTR d'Annecy 1065 m) ; Crêts par sud complétés par le vol de 2019.
- *Routes* : `saleve-sous-dine-parmelan-planfait-2016` (points nommés et localisés, Sous-Dine et Parmelan hors de la boîte du massif donc gardés comme balises de route et non comme thermiques) ; `saleve-triangle-143km-2023` (3 balises nommées, somme à vol d'oiseau ≈135 km contre 143 km déclarés, départ placé au Téléphérique par défaut).
- *Effets synoptiques* : nord-ouest (2016) et sud (2019) complétés ; 4 conseils.

**Introuvable ou non fait**
- Aucune convergence documentée dans le Genevois : aucun récit ne parle de rencontre de brises entre l'Arve, le Petit-Lac et le Salève ; pas de fiche inventée.
- Aucun texte de club sur une brise matinale ; l'écoulement descendant reste une déduction. Les « faces est » conseillées pour partir tôt ne sont attribuées à aucun décollage (pas de fiche, seulement un conseil).
- Traces XContest/CFD des grands vols (dont le 143 km et les vols vers Montreux) inaccessibles ; le Messager (403) non lu au-delà de l'extrait.
- Les Pomiers (pente de modélistes à 1330 m, face N-NE) cités par un site d'aéromodélisme ne sont pas un décollage de parapente et n'ont pas été retenus.

## Audit des thermiques (octobre 2026)

Les listes de lacunes (`docs/COUVERTURE.md`, `docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`) ont été reprises pour Chablais, Haut-Giffre, Faucigny – Arve et Salève. Règle de confiance : `medium` quand un texte (fiche FFVL, topo, club) décrit une ascendance au lieu, `low` avec « déduction » quand seuls un point chaud kk7 (traces GPS, `thermal.kk7.ch`) et le relief l'indiquent. Les toponymes autour des points chauds viennent d'OSM, les altitudes du terrain IGN (RGE ALTI). La documentation de ces massifs est mince (sites commerciaux, fiches FFVL, peu de récits) : la plupart des points chauds restent sans texte.

### Chablais (`chablais`)

**Thermiques créés (14)**
- Avec un texte : `chatel-morclan-depart-cross` (`medium`, fiche FFVL 1180 : « départ en cross - effet de foehn / thermiques à l'atterrissage » ; point chaud 96 %, le plus net du secteur), `dent-d-oche-refuge-face-sud` (`medium`, Randovol : « thermique de la face sud » au refuge ; point chaud 83 % à 210 m), `orcier-hermone-thermique` (`low`, la fiche 1193 parle d'une « brise thermique » ; point chaud 81 %), `saint-guerin-atterro-haie` (`low`, Camptocamp : « thermiques possibles sur la haie devant l'atterro » du Mont de Grange ; position du hameau Saint-Guérin, le terrain n'est pas localisé).
- Points chauds seuls (`low`) : `orcier-tres-le-mont-thermique` (88 %), `orcier-les-mouilles` (97 %), `thollon-memises-thermique` (92 %, couvre aussi le Lavanchy), `thollon-chalets-des-memises`, `thollon-col-de-corniens`, `chatel-couty-rapenaz` (98 %), `abondance-le-fayet` (95 %), `croix-de-l-aiguille-pas-de-croisette` (93 %), et deux points chauds situés en Suisse (Torgon `torgon-revereulaz` 99 %, Morgins `morgins-le-chene` 96 %), conservés pour que la liste soit complète mais hors du périmètre français.

**Position corrigée** : `abondance-atterro` (altitude 1093 → 978 m, terrain IGN à la position de la fiche).

**Lacunes écartées**
- `brasses-delta` (FFVL 1148) : la fiche dit « coordonnées erronées » et signale un problème avec le propriétaire depuis 2009 ; aucun point chaud à moins de 4 km, rien à décrire.
- `chatel-morclan-foehn`, `chatel-morclan` : traités par `chatel-morclan-depart-cross` ; `chatel-atterro-thermique` conservé (fiche FFVL 1162, coordonnées du fichier FFVL fausses, position au village).
- `dent-d-oche-est-ne` (rouleaux, venturi), `chapelle-hermone` : couverts par les thermiques ci-dessus.
- `mont-de-grange` : le thermique de l'atterrissage est créé ; le sommet (position 2432 m) a un point chaud trop faible (60 %).
- Non traités : « Châtel – Morclan sommet » (sans brise à moins de 6 km) et `pointe-des-follys` (aucun point chaud, aucun texte d'ascendance).
- Altitude de `chatel-morclan` (1870 m) conservée : le terrain IGN à la position FFVL est à 1966 m (sommet), la fiche donne 1376 m ; ParaglidingEarth 1867-1963 m.

### Haut-Giffre (`haut-giffre`)

**Thermiques créés (12, tous `low`)** : les 12 points chauds ≥ 90 % de la liste — `samoens-les-frasses` (100 %), `vernant-vaconnant` (99 %), `rovagne-mieussy` (98 %, sur la route Mieussy – Haute-Pointe du parcours CLAM niveau 2), `croix-du-culet-marcheusson` (97 %, avec un second point chaud à 95 %), `morzine-la-mernaz` (95 %), `pointe-de-ripaille`, `pointe-de-veret-flaine`, `samoens-plan-de-pertuet` (sur la route Samoëns – Criou), `samoens-paroi-des-allamands`, `mieussy-larroz` — plus `bourgeoise-delta-pente` (FFVL 1151, point chaud faible à 77 %). Aucun texte du dossier ne cite ces lieux-dits.
Le point chaud de la Chevran (94 %) est traité dans l'Arve (voir ci-dessous) et couvre le décollage d'Agy Plane (FFVL 298).
`sixt-reserve-zsm` est écarté (espace réglementé). `ffvl1091-flocons-verts-thermiques` : position FFVL source, loin d'un point chaud : conservée.

### Faucigny – Arve (`arve-faucigny`)

- Créés : `agy-chevran-thermiques` (`medium` : « dynamique de brise, thermiques légers et hachés » ; point chaud 94 %), `lachat-d-en-haut-thermique` (`medium` : « en condition thermique, déco possible en fin de matinée » ; point chaud 91 %), `passy-chedde-thermiques-atterro` (`low`, texte du CMBVL et de la FFVL), `arbaron-turbulent-pleine-journee` (`low`, fiche FFVL 1090), `sallettaz-romme` (`low`, le point chaud ≥ 90 % de la liste).
- Altitudes corrigées : `pointe-d-areu` (2478 → 2371 m), `mole-ecutieux` (1515 → 1615 m), `pointe-d-andey` (1666 → 1853 m ; la position est le sommet, le décollage « sous la Vierge » n'est pas localisé).
- Écartés : `barmerousse-so-rien` (le topo dit que le versant « ne donne rien » : aucun thermique à créer) ; `kedeusaz` (« brises thermiques » : une brise, pas un thermique ; aucun point chaud à moins de 2,4 km) ; `pointe-d-andey` et `carroz-arbaron-brise-atterro` (thermique décrit à 1,7 km pour Andey : `andey-faces-ouest` ; Arbaron traité ci-dessus) ; `derochoir-eboulis-pormenaz` (position source, loin d'un point chaud).
- Le soaring `agy-chevran-soaring` a sa position au décollage d'Agy Plane, à 2,8 km de la pente du Chevran où est placé le thermique.

### Salève (`saleve-genevois`)

- Position : `saleve-carriere-etrembieres` : altitude estimée 520 m, terrain 827 m à la position (au niveau de Monnetier) ; altitude corrigée, position non vérifiée (la carrière n'est pas cartographiée).
- Écartés : `geneve-espace-aerien` (espaces aériens) ; `saleve-troinex-thermique`, `sur-cou-relance-saleve`, `chapelle-rambaud-thermique-desert-saleve` (loin de tout point chaud : plaine peu volée ou position approximative d'après le récit).

## Résolution des limites (octobre 2026)

Date : 7 octobre 2026. Les limites de données restantes après l'audit des thermiques (`docs/KK7_CROISEMENT.md`, `docs/POSITIONS.md`, `docs/COUVERTURE.md`) ont été reprises pour Chablais, Giffre, Arve, Salève. Aucun identifiant supprimé ni renommé ; chaque correction est notée dans la description de l'élément (« Résolution des limites (octobre 2026) : … »).

### 1. Points chauds forts à 600 m – 1 km d'un thermique documenté

Règle de tri appliquée à chaque cas : le thermique documenté est **recalé** sur le point chaud kk7 quand sa position n'était qu'approximative (ou celle du décollage), que le texte de sa source décrit un relief que le point chaud occupe (la crête, la pente, le relief « qui encadre le col ») et qu'il n'a pas déjà son propre point chaud à moins de 600 m ; sinon le point chaud est une **seconde ascendance**, créée à part, `medium` quand un texte la décrit (fiche FFVL, fil de pilotes, récit), `low` avec « déduction » quand seuls le point chaud et le relief l'indiquent. Les élément créés citent la source kk7 (`thermal.kk7.ch`) et la source du texte rapproché, dans l'ordre. Les points chauds forts à 600 m – 1 km passent de 27 à 0 dans `docs/KK7_CROISEMENT.md`.

- **Maisons de Zore** (`zore-pentes-est-vers-avoriaz`, `low`) : point chaud à 96 % (matin et midi) à 639 m du décollage de Super-Morzine, sur la route d'Avoriaz que décrivent Morzinn et Summits.
- **Salève, falaise des Balmes** (`saleve-falaise-des-balmes`, `low`) : point chaud à 94 % au sommet de la falaise, à 250 m du décollage des Crêts, 460 m au-dessus du Coin (atterrissage).

### 2. Écarts d'altitude (`docs/POSITIONS.md`)

Constat préalable : le relevé d'altitudes IGN demandait les points par lots de 100, or le service d'altimétrie (`data.geopf.fr/altimetrie`) n'est exact que jusqu'à une trentaine de points par requête (testé : lots de 25 et 30 identiques aux requêtes unitaires, lots de 33 et plus décalés de 10 à 110 m, parfois bien plus). 1159 des 1349 valeurs du cache `positions/altitudes_ign.json` étaient décalées ; le cache a été régénéré par lots de 25. Sur les altitudes exactes la liste n'était plus de 16 mais de 17 écarts : quatre faux positifs disparaissaient (Plaines de Poët 878 m pour 880 m, Méruz – Char Marin, Roche Veyrand, Aiguille Grande 76 m), cinq écarts apparaissaient (Manival, Mont Julioz, L'Écureuil et le versant de Peisey-Vallandry, Cuchon). Tous sont tranchés : 0 écart. La règle suivie : on garde la position quand elle est confirmée par un repère indépendant (gare d'arrivée de télésiège OSM, point de ParaglidingEarth, nœud OSM d'un sommet, coordonnées du guide papier) et l'on corrige l'altitude ; on déplace la position quand c'est elle que le repère indépendant contredit.

- **Châtel – Morclan** (`chatel-morclan`) : la position (fiche FFVL 1180 « sommet ») est au sommet, 1966 m de terrain, 1963 m à ParaglidingEarth n°3034 ; les 1870 m retenus étaient ceux du second site de ParaglidingEarth « sous le sommet » (n°6870, 1867 m, à 410 m au sud-est, 1845 m de terrain), absent de l'atlas. Altitude 1966 m.

### 3. Thermiques documentés loin de tout point chaud

Examen des 119 thermiques à plus de 2 km de tout point chaud ≥ 70 % : position contrôlée contre le géocodeur IGN (toponyme à moins de 120 m pour 51 d'entre eux), l'altitude déclarée contre le terrain IGN exact (concordante à 35 m près pour 30 autres) et le relief (croupe, flanc ou creux, orientation). Très peu sont mal placés ; la plupart sont loin des points chauds parce que le site est peu volé, parce que l'ascendance est un plafond ou une relance de haute montagne, ou parce qu'elle vient d'une confluence ou d'une plaine que les traces ne distinguent pas. Le plus proche point chaud ≥ 70 % et la raison sont notés ci-dessous ; un point chaud plus faible (30 à 70 %) à moins de 1 km est mentionné quand il existe.

**Gardés à leur place, avec la raison :**

| Élément | Position vérifiée par | Point chaud ≥ 70 % le plus proche | Pourquoi loin des traces |
| --- | --- | --- | --- |
| `saleve-genevois/saleve-troinex-thermique` | altitude déclarée 423 m concordante avec le terrain IGN (420 m) | 2,7 km (87 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `saleve-genevois/sur-cou-relance-saleve` | toponyme IGN « Sur Cou » à 9 m | 4,4 km (75 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `saleve-genevois/chapelle-rambaud-thermique-desert-saleve` | église de La Chapelle-Rambaud (IGN) à 88 m | 8,0 km (71 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `arve-faucigny/derochoir-eboulis-pormenaz` | position sourcée (relief cité par le récit) | 2,3 km (90 %) | site peu volé |
| `chablais/pleney-restitution` | position sourcée (relief cité par le récit) | 2,1 km (95 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
| `haut-giffre/ffvl1091-flocons-verts-thermiques` | altitude déclarée 1144 m concordante avec le terrain IGN (1138 m) | 3,0 km (80 %) | plaine, confluence, vol du soir ou zone bâtie : peu de relief, peu de traces |
