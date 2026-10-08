# Rapport d'agent a28cc9fcce0ac452f

**Mission** : Write the remaining massif visits

**Date** : 2026-10-07

**Consigne (début)** : Tu termines les visites guidées narratives des massifs pour le projet « Brises des Alpes » (carte d'aérologie pour le parapente), dépôt /Users/pierre/paraglide (branche main). Textes en français. Un p

---

Les neuf visites sont écrites dans `research_notes/Seconde passe 2026/visites/`. Rien d'autre n'a été modifié et il n'y a pas de commit (le dossier non suivi `sources/kk7/_osm_tiles/` ne vient pas de moi).

| Fichier | Étapes |
|---|---|
| `saleve-genevois.json` | 15 |
| `val-arly-megeve.json` | 16 |
| `ubaye.json` | 15 |
| `champsaur-valgaudemar.json` | 15 |
| `alpes-francaises.json` | 17 |
| `grenoble-cuvette.json` | 14 |
| `maurienne.json` | 14 |
| `arves-thabor-galibier.json` | 10 |
| `queyras.json` | 13 |

**Sortie finale de `npm run data:build -- --check`** (code retour 0) : aucune ligne « visite … élément introuvable ». Les seules lignes de diagnostic sont les décomptes de données (46 massifs, 1560 sources, etc.) et un avertissement existant sur une brise de `alpes-francaises` que le modèle ne simule pas. Les tailles des dumps de grenoble-cuvette, maurienne, arves-thabor-galibier et queyras étaient inchangées entre ma lecture et la fin, donc aucun enrichissement de l'autre agent n'a été manqué sur ces quatre.

**Écarts au guide**
- `alpes-francaises` a 17 étapes et `val-arly-megeve` 16, pour un maximum de 16 dans le guide. J'ai gardé les 17 de la visite d'ensemble parce qu'elle contient quatre régimes (nord/mistral, ouest, sud/foehn, est/lombarde).
- Quelques étapes citent un élément d'un massif voisin avec un préfixe, par exemple `alpes-francaises/col-d-izoard` dans `queyras`.
- `champsaur-valgaudemar.json` et `maurienne.json` ont été réécrits par un script Python pour réordonner les chapitres. La mise en page JSON est donc un peu différente des autres fichiers (tableaux `focus` sur plusieurs lignes).

**Lacunes de données**
- **arves-thabor-galibier** : presque aucun texte aérologique ; l'itinéraire des deux vols de plus de 300 km du Galibier est illisible, et les heures de la brise de la Valloirette comme de celle de l'Arvan ne sont pas documentées.
- **queyras** : rien sur Abriès, Saint-Véran, Aiguilles et Molines ; la brise du Guil n'est jamais décrite directement et son sens est déduit ; les points de virage du record de 2023 ne sont pas publiés.
- **saleve-genevois** : aucun club ne décrit de brise de vallée ; l'écoulement du matin est une déduction de confiance faible ; l'ascendance de Sur Cou n'est décrite dans aucun récit.
- **val-arly-megeve** : les sources sont minces pour Flumet et Crest-Voland ; les écoulements du matin sont des déductions ; le Christomet n'est pas documenté.
- **ubaye** : la direction de la brise du soir à Orcières côté Champsaur n'est pas précisée ; les points de virage du triangle FAI de 252 km (juillet 2021) sont illisibles.
- **champsaur-valgaudemar** : les deux sources divergent sur le sens du flux par le col Bayard ; la brise du Drac n'est qu'une flèche de carte, de confiance basse. J'ai écrit les deux versions telles quelles.
- **grenoble-cuvette** : la brise du Grésivaudan est donnée tantôt descendante, tantôt montante selon l'article, et la brise de la basse Romanche n'a aucune heure ni force documentée.
- **maurienne** : aucun récit du régime nocturne ; les trajets des décollages de Montgellafrey et de Jarrier vers le cross ne sont pas confirmés par une trace.
- **alpes-francaises** : les schémas de Gabriel Briffe (prolongements d'altitude, flux vers le Diois et vers la plaine du Pô) sont de confiance basse ; je les ai présentés comme des tendances.
