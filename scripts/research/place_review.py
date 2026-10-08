#!/usr/bin/env python3
"""Review sheet of the places a written visit names, for a human or an agent
checking them: each step's text, then every place it highlights with where it
was located (official name, kind, commune it lies in, distance and direction
from the massif's centre), or the sector(s) outlined for a massif or region.

  python3 scripts/research/place_review.py beaufortain
  python3 scripts/research/place_review.py --lookup "Saint-Guérin" 6.6 45.68   (IGN candidates near a point)

Corrections go to visites/_lieux_corrections.json (massif → name → place or
null), applied by visit_places.py.
"""
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VISITS = ROOT / 'research_notes' / 'Seconde passe 2026' / 'visites'
ATLAS = ROOT / 'apps' / 'web' / 'public' / 'data' / 'atlas.json'
GEO = 'https://data.geopf.fr/geocodage'
_communes: dict = {}


def get(url: str) -> dict:
    try:
        return json.load(urllib.request.urlopen(url, timeout=20))
    except Exception:  # noqa: BLE001 - shown as unknown
        return {}


def commune(lon: float, lat: float) -> str:
    key = (round(lon, 4), round(lat, 4))
    if key not in _communes:
        # The commune whose territory holds the point (API Découpage administratif).
        q = urllib.parse.urlencode({'lon': lon, 'lat': lat, 'fields': 'nom'})
        try:
            found = json.load(urllib.request.urlopen(f'https://geo.api.gouv.fr/communes?{q}', timeout=20))
        except Exception:  # noqa: BLE001 - shown as unknown
            found = []
        _communes[key] = found[0]['nom'] if found else 'hors de France ?'

    return _communes[key]


def where(lon: float, lat: float, cx: float, cy: float) -> str:
    dx = (lon - cx) * 111.32 * math.cos(math.radians(cy))
    dy = (lat - cy) * 111.32
    d = math.hypot(dx, dy)
    dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
    return f'{d:.0f} km {dirs[round(math.degrees(math.atan2(dx, dy)) / 45) % 8]} du centre du secteur'


def lookup(name: str, lon: float, lat: float) -> None:
    q = urllib.parse.urlencode({'q': name, 'index': 'poi', 'limit': 15, 'lon': lon, 'lat': lat})
    for f in get(f'{GEO}/search?{q}').get('features', []):
        p = f['properties']
        x, y = f['geometry']['coordinates'][:2]
        print(f"{p.get('toponym')!r:45} {', '.join(p.get('category') or [])[:40]:40} lon {x:.5f} lat {y:.5f}  ({', '.join(p.get('city') or []) if isinstance(p.get('city'), list) else p.get('city')})")


def main() -> None:
    if sys.argv[1] == '--lookup':
        lookup(sys.argv[2], float(sys.argv[3]), float(sys.argv[4]))
        return
    mid = sys.argv[1]
    atlas = json.loads(ATLAS.read_text())
    massifs = {m['id']: m for m in atlas['massifs']}
    m = massifs[mid]
    cx, cy = m['center']
    known = json.loads((VISITS / '_lieux.json').read_text()).get(mid, {})
    unknown = json.loads((VISITS / '_lieux_inconnus.json').read_text()).get(mid, [])
    visit = next(json.loads(p.read_text()) for p in VISITS.glob('*.json') if not p.name.startswith('_') and json.loads(p.read_text()).get('massif') == mid)
    names = sorted(known, key=len, reverse=True)
    pattern = re.compile('(?<![\\w-])(?:' + '|'.join(re.escape(n) for n in names) + ')(?![\\w-])') if names else None
    print(f"# {m['name']} ({mid}) — centre lon {cx} lat {cy}, emprise {m['bbox']}\n")
    for i, st in enumerate(visit['steps'], 1):
        text = f"{st['title']}\n{st['text']}"
        print(f"## Étape {i} — {st['title']}\n{st['text']}\n")
        seen = set()
        for hit in pattern.finditer(text) if pattern else []:
            n = hit.group(0)
            if n in seen:
                continue
            seen.add(n)
            p = known[n]
            if p.get('massifs'):
                print(f"  - « {n} » → ZONE en pointillés : secteur(s) {', '.join(massifs[x]['name'] for x in p['massifs'] if x in massifs)}")
            else:
                print(f"  - « {n} » → {p['label']} [{p.get('kind', '')}, {p.get('source', '')}] lon {p['lon']} lat {p['lat']} — commune {commune(p['lon'], p['lat'])}, {where(p['lon'], p['lat'], cx, cy)}")
        print()
    print(f"Noms non localisés (non surlignés) : {', '.join(unknown) or 'aucun'}")


main()
