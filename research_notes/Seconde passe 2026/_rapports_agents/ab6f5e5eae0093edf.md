# Rapport d'agent ab6f5e5eae0093edf

**Mission** : Passe thermiques et relances · bauges_bourget_combe, chartreuse_gresivaudan_belledonne

---

Passe thermiques terminée sur mes deux lots. `npm run data:build -- --check` ne signale aucune alerte, et les deux JSON sont valides. Je n'ai touché ni au code ni à git, seulement aux deux JSON et aux deux fichiers `.md` de mes lots.

**Thermiques avant → après**

| Lot / massif | Avant | Après |
|---|---|---|
| Chartreuse | 11 | 24 |
| Belledonne | 5 | 8 |
| Grésivaudan | 0 | 0 |
| Bourget-Chambéry | 3 | 7 |
| Combe de Savoie | 3 | 6 |
| Bauges | 2 | 14 |

Le Grésivaudan reste à 0 : ses relances sont sur les reliefs voisins, donc rattachées à la Chartreuse et à Belledonne. Chaque point ajouté ou complété porte une `confidence` et un rôle (déclencheur, relance ou plafond). J'ai aussi ajouté des waypoints dans les routes classiques (Saint-Eynard, Dent de Crolles, Granier, grand tour du Bocal, petit tour des Bauges, retour par la Combe). Il y a deux routes nouvelles (Montlambert–Arclusaz–Grand Arc–Chamoux, et faces est des Bauges), une dizaine de sources nouvelles par lot, et des tips.

**Les deux points du propriétaire**
- **Les Antennes** : ajoutées en confiance `medium`, position `approx`. Le lieu-dit n'existe ni à l'IGN ni dans OSM. Je l'ai placé sur les pylônes OSM « FT/TDF » (45.2938 N, 5.8755 E), seul groupe d'antennes sur ce relief. Il faut que le propriétaire confirme l'emplacement ; l'autre candidat, moins probable, est le mât Orange à 1 km au sud du déco.
- **Château Nardent** : ajouté en `medium`, position `source` (lieu-dit IGN, sommet OSM 1217 m).

**Autres points notables ajoutés**
- Chartreuse : gencives de la Dent de Crolles, Émeindras, Pas de Rocheplane, cirque de Saint-Même, plafond de la Scia, Montagne du Sac, Saint-Marcel d'en haut, Mont Outheran.
- Belledonne : Roche Béranger (trois récits : 2400-2650 m avant le Connex) et Bramefarine.
- Bauges et Bourget : Pic de la Sauge, Mont Charvet, Galoppaz, Arclusaz, Roc des Bœufs (six récits), Julioz, Margériaz, Pertuiset, Tour des Ébats, col de la Cochette/Bange, épaule du Semnoz, relais du Mont du Chat, Mont de la Charvaz, Mont Grelle.
- Combe : Tours de Montmayeur, Grand Arc et Petit Arc.

**Introuvable ou incertain**
- Introuvables : les pare-avalanches et l'école d'escalade du Manival, les réservoirs avant le Saint-Eynard, le « bout de Bange ». Les aéromodélistes du Semnoz et l'angle de route avant le Crêt de Châtillon sont placés par déduction (`approx`).
- Vallée des Huiles : en `low`, car deux récits la situent différemment.
- Dôme de Bellefond : absent de l'IGN, point placé par déduction sur la crête.
- Étoiles des diapositives de Jean-Nono : détectées par traitement d'image, mais le fond de carte est trop imprécis pour en tirer des coordonnées. Elles m'ont seulement confirmé l'ordre des points (Antennes, Château Nardent, Saint-Eynard) ; les falaises du Touvet–Saint-Vincent–La Flachère sont donc en `low`.
- Aucune URL nouvelle bloquée.

Les sections « Thermiques et points de relance (passe complémentaire) » sont ajoutées aux deux `.md`. Le détail des sources, de la méthode de positionnement et de ce qui n'a pas été localisé s'y trouve.

Fichiers dans `/Users/pierre/paraglide/research_notes/Seconde passe 2026/` :
- `data/chartreuse_gresivaudan_belledonne.json`
- `data/bauges_bourget_combe.json`
- `chartreuse_gresivaudan_belledonne.md`
- `bauges_bourget_combe.md`

Les sauvegardes d'avant-passe sont dans `.cache/research/docs/<lot>/pre_thermo_backup.json`.
