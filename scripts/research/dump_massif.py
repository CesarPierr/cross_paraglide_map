#!/usr/bin/env python3
"""Prints everything the second research pass documents for one massif, with the
raw ids a written visit cites in its `focus` lists.

  python3 scripts/research/dump_massif.py chartreuse
  python3 scripts/research/dump_massif.py --list

Files under research_notes/Seconde passe 2026/data/ merge by massif id, like
scripts/build-data.ts does.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / 'research_notes' / 'Seconde passe 2026' / 'data'
LISTS = ['breezes', 'convergences', 'thermal_spots', 'soaring_spots', 'hazards', 'takeoffs', 'landings', 'xc_routes']


def massifs():
    merged = {}
    for f in sorted(DATA.glob('*.json')):
        for m in json.loads(f.read_text()).get('massifs', []):
            cur = merged.setdefault(m['id'], {'files': []})
            cur['files'].append(f.name)
            for k, v in m.items():
                if isinstance(v, list):
                    cur.setdefault(k, []).extend(v)
                elif k not in cur or not cur[k]:
                    cur[k] = v
    return merged


def short(v, n=600):
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + '…'


def main():
    all_m = massifs()
    if len(sys.argv) < 2 or sys.argv[1] == '--list':
        for mid, m in all_m.items():
            print(mid, '|', m.get('name', ''), '|', ', '.join(m['files']))
        return
    m = all_m.get(sys.argv[1])
    if not m:
        sys.exit(f'unknown massif {sys.argv[1]}')
    print(f"# {sys.argv[1]} — {m.get('name', '')}  (files: {', '.join(m['files'])})")
    print('\nSUMMARY:', m.get('summary', ''))
    for tip in m.get('tips', []):
        print('TIP:', short(tip, 400))
    for key in LISTS:
        items = m.get(key, [])
        if not items:
            continue
        print(f'\n## {key} ({len(items)})')
        for it in items:
            when = it.get('hours') or it.get('best_hours') or it.get('when') or it.get('conditions') or it.get('wind_dirs') or it.get('orientations') or ''
            extra = ' '.join(f'{k}={short(it[k], 80)}' for k in ('kind', 'speed_kmh', 'alt_m', 'distance_km', 'confidence', 'trigger') if it.get(k) not in (None, ''))
            text = it.get('description') or ' / '.join(x for x in (it.get('mechanism'), it.get('usage')) if x)
            print(f"- [{it.get('id')}] {it.get('name')} | {short(when, 120)} | {extra}\n    {short(text)}")
    effects = m.get('synoptic_effects', [])
    if effects:
        print(f'\n## synoptic_effects ({len(effects)})')
        for e in effects:
            print(f"- {e.get('wind')}: {short(e.get('effect'), 400)}")


main()
