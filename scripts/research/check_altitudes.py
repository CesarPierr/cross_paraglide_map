#!/usr/bin/env python3
"""Checks every researched point that declares an altitude against the IGN terrain
(RGE ALTI, metre-level), and proposes a better position when the FFVL sheet of the
same site matches the declared altitude. A point whose terrain is far from its
declared altitude is misplaced (or its altitude is wrong).

  python3 scripts/research/check_altitudes.py      → docs/POSITIONS.md

IGN elevations are cached in research_notes/Seconde passe 2026/positions/altitudes_ign.json.
"""
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'research_notes' / 'Seconde passe 2026'
CACHE = BASE / 'positions' / 'altitudes_ign.json'
CORRECTIONS = BASE / 'positions' / 'corrections.json'
API = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json'
LISTS = ['thermal_spots', 'soaring_spots', 'hazards', 'takeoffs', 'landings']
TOLERANCE_M = 80
BATCH = 25


def key(lon, lat):
    return f'{lon:.5f},{lat:.5f}'


def fetch(points, cache):
    todo = [p for p in points if key(*p) not in cache]
    # The IGN service is exact only for small batches (beyond ~30 points it drifts by 10 to 110 m).
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        q = f"lon={'|'.join(f'{p[0]:.5f}' for p in batch)}&lat={'|'.join(f'{p[1]:.5f}' for p in batch)}&resource=ign_rge_alti_wld&zonly=true"
        for attempt in range(3):
            try:
                z = json.load(urllib.request.urlopen(f'{API}?{q}', timeout=60))['elevations']
                break
            except Exception as e:  # noqa: BLE001 - retried, then reported
                print('retry', e)
                time.sleep(3)
        else:
            continue
        for p, e in zip(batch, z):
            cache[key(*p)] = e if e > -1000 else None
        time.sleep(0.2)


def main():
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    corrections = json.loads(CORRECTIONS.read_text())['corrections'] if CORRECTIONS.exists() else {}
    ffvl = json.loads((BASE / 'sources' / 'ffvl_sites_alpes.json').read_text())
    by_ffvl = {str(r[0]): dict(zip(ffvl['cols'], r)) for r in ffvl['rows']}
    items = []
    for f in sorted((BASE / 'data').glob('*.json')):
        for m in json.loads(f.read_text()).get('massifs', []):
            for cat in LISTS:
                for it in m.get(cat, []):
                    if not isinstance(it.get('alt_m'), (int, float)) or not isinstance(it.get('lon'), (int, float)):
                        continue
                    k = f"{m['id']}/{it.get('id')}"
                    lon, lat = (corrections[k]['lon'], corrections[k]['lat']) if k in corrections else (it['lon'], it['lat'])
                    alt = by_ffvl.get(str(it.get('ffvl_id')))
                    items.append({'key': k, 'cat': cat, 'name': it.get('name', ''), 'lon': lon, 'lat': lat, 'alt': it['alt_m'], 'quality': it.get('coord_quality'), 'file': f.name,
                                  'ffvl': (float(alt['lon']), float(alt['lat'])) if alt and alt.get('lon') else None})
    points = [(i['lon'], i['lat']) for i in items] + [i['ffvl'] for i in items if i['ffvl']]
    fetch(points, cache)
    CACHE.write_text(json.dumps(cache, indent=0))
    off = []
    for i in items:
        z = cache.get(key(i['lon'], i['lat']))
        if z is None:
            continue
        d = z - i['alt']
        if abs(d) <= TOLERANCE_M:
            continue
        alt = None
        if i['ffvl']:
            zf = cache.get(key(*i['ffvl']))
            if zf is not None and abs(zf - i['alt']) <= TOLERANCE_M:
                alt = (i['ffvl'], zf)
        off.append((abs(d), i, z, alt))
    off.sort(key=lambda x: -x[0])
    checked = sum(1 for i in items if cache.get(key(i['lon'], i['lat'])) is not None)
    lines = [
        '# Positions à vérifier (altitude du terrain IGN)',
        '',
        f'Généré par `python3 scripts/research/check_altitudes.py`. {checked} points de la recherche déclarent une altitude ; '
        f'le terrain IGN (RGE ALTI) à leur position en diffère de plus de {TOLERANCE_M} m pour **{len(off)}** d’entre eux. '
        'Un écart fort signale un point mal placé (ou une altitude fausse). Quand la fiche FFVL du même site tombe à la bonne altitude, '
        'elle est proposée : à reporter dans `research_notes/Seconde passe 2026/positions/corrections.json` après contrôle.',
        '',
        '| Écart | Élément | Déclaré | Terrain IGN | Position | Proposition |',
        '| --- | --- | --- | --- | --- | --- |',
    ]
    for d, i, z, alt in off:
        prop = f"fiche FFVL {alt[0][0]:.4f}, {alt[0][1]:.4f} (terrain {alt[1]:.0f} m)" if alt else ''
        lines.append(f"| {d:.0f} m | `{i['key']}` {i['name'][:60]} | {i['alt']} m | {z:.0f} m | {i['quality'] or '?'} | {prop} |")
    (ROOT / 'docs' / 'POSITIONS.md').write_text('\n'.join(lines) + '\n')
    print(f'{checked} points, {len(off)} écarts > {TOLERANCE_M} m, {sum(1 for x in off if x[3])} avec une fiche FFVL cohérente → docs/POSITIONS.md')


main()
