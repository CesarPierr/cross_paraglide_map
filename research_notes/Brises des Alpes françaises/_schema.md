# Structured data contract (read this before writing your JSON file)

Besides your Markdown notes, every researcher writes ONE JSON file
(`data/<topic>.json` inside this folder) that feeds a 3D interactive map of the
French Alps for paragliding cross-country pilots. The map draws breezes as
animated arrows along their waypoints, convergence lines as glowing lines,
spots as markers. So geometry matters as much as text.

## Rules

- Language of free text: French (the app is in French). Keep proper names as used locally.
- Coordinates: WGS84 decimal degrees, `lon` then `lat`, 4 decimals.
  Take them from an authoritative page (FFVL site sheet, paraglidingearth,
  Wikipedia/Geonames village or summit coordinates, club page). NEVER invent.
  If you had to estimate (e.g. "the spur 1 km north of X"), add
  `"coord_quality": "approx"`; otherwise `"coord_quality": "source"`.
- Breeze `waypoints` are ORDERED IN THE DIRECTION THE AIR FLOWS
  (from where the air comes, to where it goes). Use villages / passes / lakes
  along the valley axis as waypoints (3-8 points for a long valley), so the line
  can be snapped onto the valley floor. For slope breezes, give the foot of the
  slope then the crest.
- Every factual item cites one or more `sources` ids (`"S3"`), defined in the
  file-level `sources` array. An item with no source must have
  `"confidence": "low"` and say "déduction" in its description.
- Distinguish typical summer (spring–summer thermal season) daytime regime from
  morning/evening/night regimes; put the regime in `hours`.
- Speeds in km/h. If a source says "forte", "soutenue", give your best numeric
  interpretation and keep the original wording in the description.
- Do not pad: an empty array is better than an invented item.

## JSON shape

```json
{
  "topic": "short topic name",
  "massifs": [
    {
      "id": "kebab-case-slug",
      "name": "Nom du massif / secteur",
      "parent_massif": "optional: e.g. Préalpes du Nord",
      "summary": "4-8 phrases: personnalité aérologique du secteur pour le cross (régime de brise, heures, pièges, comment on le traverse).",
      "bbox": [minLon, minLat, maxLon, maxLat],
      "center": [lon, lat],
      "breezes": [
        {
          "id": "slug",
          "name": "Brise montante du Grésivaudan",
          "kind": "valley | slope | plain-to-mountain | lake | pass-transfer | downvalley | katabatic | regional",
          "waypoints": [ { "name": "Grenoble", "lon": 5.7245, "lat": 45.1885, "coord_quality": "source" } ],
          "hours": "12h-19h (été)",
          "speed_kmh": { "typical": 15, "max": 30 },
          "season": "avril-septembre",
          "layer_depth_m": "optional: thickness / up to which altitude it is felt",
          "description": "Ce que disent les sources, y compris formulations d'origine.",
          "confidence": "high | medium | low",
          "sources": ["S1", "S4"]
        }
      ],
      "convergences": [
        {
          "id": "slug",
          "name": "Convergence de ...",
          "geometry": { "type": "LineString", "coordinates": [[lon, lat], [lon, lat]] },
          "when": "heures / conditions",
          "mechanism": "quelles masses d'air / brises se rencontrent",
          "usage": "comment les pilotes l'exploitent, et ses dangers (surdéveloppement, cisaillement...)",
          "confidence": "high | medium | low",
          "sources": ["S2"]
        }
      ],
      "hazards": [
        {
          "id": "slug",
          "name": "...",
          "kind": "venturi | lee-rotor | strong-breeze | downdraft | foehn | landing-turbulence | airspace | overdevelopment | other",
          "lon": 0, "lat": 0, "radius_km": 2,
          "conditions": "quand ça se produit (heure, vent synoptique)",
          "description": "...",
          "sources": ["S1"]
        }
      ],
      "thermal_spots": [
        {
          "id": "slug", "name": "...", "lon": 0, "lat": 0, "alt_m": 0,
          "best_hours": "11h-15h",
          "trigger": "ce qui déclenche (barre rocheuse plein sud, éperon, village, lisière...)",
          "description": "...", "sources": ["S1"]
        }
      ],
      "soaring_spots": [
        {
          "id": "slug", "name": "...", "lon": 0, "lat": 0,
          "wind_dirs": ["NW", "W"],
          "description": "dynamique / thermodynamique, plage de vent, pièges",
          "sources": ["S1"]
        }
      ],
      "takeoffs": [
        {
          "id": "slug", "name": "...", "lon": 0, "lat": 0, "alt_m": 0,
          "orientations": ["W", "NW"],
          "description": "aérologie du déco, heures, pièges",
          "sources": ["S1"]
        }
      ],
      "landings": [
        { "id": "slug", "name": "...", "lon": 0, "lat": 0, "alt_m": 0, "description": "...", "sources": ["S1"] }
      ],
      "synoptic_effects": [
        {
          "wind": "N | NE | E | SE | S | SW | W | NW | Bise | Foehn | Mistral | Lombarde | Vent du Sud",
          "effect": "Comment le secteur réagit: faces volables, zones sous le vent, brise renforcée/bloquée, déplacement des convergences, seuils de force.",
          "sources": ["S1"]
        }
      ],
      "xc_routes": [
        {
          "id": "slug", "name": "...",
          "waypoints": [ { "name": "...", "lon": 0, "lat": 0 } ],
          "distance_km": 0,
          "description": "transitions clés, où on recharge, où on se fait piéger",
          "sources": ["S1"]
        }
      ],
      "tips": ["conseil court de pilote cross [S3]"]
    }
  ],
  "sources": [
    {
      "id": "S1",
      "title": "...",
      "url": "https://...",
      "publisher": "club / école / FFVL / forum / magazine / auteur",
      "type": "pdf | web | forum | video | book | presentation",
      "lang": "fr",
      "notes": "ce que contient la source, utile pour retrouver l'info"
    }
  ]
}
```

Validate the file is parseable JSON before finishing
(`python3 -c "import json,sys; json.load(open(sys.argv[1]))" <file>`).
