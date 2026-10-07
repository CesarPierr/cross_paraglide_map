# Seconde passe 2026 : contrat de données

Le contrat de base est celui de la première passe :
[`../Brises des Alpes françaises/_schema.md`](../Brises%20des%20Alpes%20fran%C3%A7aises/_schema.md).
Tout ce qui y est écrit reste obligatoire. Ce fichier précise ce qui change pour la seconde passe.

## Un fichier par lot, version complète

Chaque fichier `data/<lot>.json` est la **version révisée et complète** des massifs qu'il contient.
Le pipeline (`scripts/build-data.ts`) **remplace** un massif de la première passe par celui de la
seconde passe qui porte le même `id` (pas de fusion). Conséquences :

- garder tous les éléments de la première passe qui restent valables, en les corrigeant ;
- ne retirer un élément que s'il est démontré faux, et le noter dans les notes du lot ;
- réutiliser les `id` des massifs existants. Un nouveau massif (vallée ou secteur absent de l'atlas)
  n'est créé que si aucun secteur existant ne le couvre ; il porte alors `parent_massif` ;
- réutiliser les `id` des éléments existants quand on les corrige, pour garder des liens stables.

## Coordonnées

Références locales (non versionnées, dans `.cache/research/`) :

- `paraglidingearth_alps.tsv` : 518 sites ParaglidingEarth (déco, orientations, attéro, n° FFVL) ;
- `ffvl_sites_alps.tsv` : fiches FFVL relevées dans le navigateur (si présent) ;
- OSM, Wikipédia, Geonames, fiches FFVL et pages de club pour le reste.

`coord_quality: "source"` seulement si la position vient d'une de ces références ou d'une page qui
donne la position (fiche, carte avec coordonnées). Indiquer la référence dans la description ou
dans un champ libre (`ffvl_id`, `pge_id`). Sinon `"approx"`.

Contrôle : `npm run data:build -- --check` compile tout sans rien écrire et affiche les alertes
(altitude déclarée très différente du MNT, point recalé, source inconnue). Filtrer sur ses massifs.

## Figures (images annotées, schémas, cartes de brises)

Les schémas dessinés par les clubs (vallées fléchées, cartes de brises, convergences tracées sur
une photo ou une carte) sont des sources de premier ordre. Pour chacun :

1. l'extraire en données géolocalisées (`breezes`, `convergences`, `hazards`…) en citant la source ;
2. le déclarer dans le tableau `figures` au niveau du fichier :

```json
{
  "id": "F1",
  "massif": "bauges",
  "title": "Carte vol libre du PNR des Bauges : brises et confluences",
  "image_url": "https://…/image.jpg (URL directe de l'image si elle existe)",
  "page_url": "https://… (page ou PDF qui contient la figure)",
  "pdf_page": 3,
  "publisher": "PNR du Massif des Bauges",
  "shows": "Ce que montre la figure : flèches de brise de telle vallée vers telle autre, confluence au-dessus de…, horaires notés…",
  "extracted_to": ["brise-montante-du-cheran", "confluence-du-semnoz"],
  "sources": ["S12"]
}
```

`extracted_to` liste les `id` des éléments tirés de la figure. Le site affiche la figure dans la
fiche du secteur avec un lien vers l'original ; elle n'est pas recopiée sur le serveur.

## Sources

Chaque source a une URL qui permet à un utilisateur de la retrouver : PDF, page de club, fil de
forum, vidéo, fiche FFVL. Pour un PDF, préciser la page dans `notes`. Les identifiants de sources
sont locaux au fichier (`S1`, `S2`…) ; ne pas renuméroter ceux qui existent déjà.
