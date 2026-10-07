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
