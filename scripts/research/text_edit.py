"""Lists and applies text rewrites of the research files and the guided visits, touching
nothing else (layout preserved by textjson). See _methode/STYLE_TEXTES.md.

  # what to rewrite, with the facts around it (one JSON object per line)
  python3 scripts/research/text_edit.py list <lot> [<massif>]
  python3 scripts/research/text_edit.py visit-list <massif>

  # apply an edits file
  python3 scripts/research/text_edit.py apply <lot> edits.json
  python3 scripts/research/text_edit.py visit-apply <massif> edits.json

Edits file of a lot (any subset):
  {"<massif>": {
     "summary": "…",
     "tips": ["…", …],                        # same number of tips, same [S..] tags
     "synoptic_effects": {"<index>": "…"},    # new effect text by index (0-based)
     "<category>": {"<item id>": {"description": "…", "possible": ["…"], "note": "…",
                                   "mechanism": "…", "usage": "…"}}}}
  (an empty string or list removes the field: "note": "", "possible": [])
Edits file of a visit: {"<step index>": {"title": "…", "text": "…"}}
"""
import fcntl
import json
import sys
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from textjson import load, save  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'research_notes' / 'Seconde passe 2026'
CATEGORIES = ['breezes', 'convergences', 'hazards', 'thermal_spots', 'soaring_spots', 'takeoffs', 'landings', 'xc_routes']
TEXT = ['description', 'mechanism', 'usage', 'possible', 'note']
CONTEXT = ['name', 'kind', 'hours', 'when', 'conditions', 'best_hours', 'trigger', 'season', 'orientations', 'wind_dirs', 'alt_m', 'speed_kmh', 'distance_km', 'coord_quality', 'confidence', 'sources']


@contextmanager
def locked(path: Path):
    """Serialises read-modify-write of a file between writers sharing a lot."""
    with open(path.with_suffix(path.suffix + '.lock'), 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def lot_path(lot: str) -> Path:
    p = BASE / 'data' / f'{lot}.json'
    if not p.exists():
        sys.exit(f'lot inconnu : {lot}')
    return p


def cmd_list(lot: str, massif: str | None) -> None:
    d = load(lot_path(lot))
    for m in d['massifs']:
        if massif and m['id'] != massif:
            continue
        print(json.dumps({'massif': m['id'], 'name': m['name'], 'summary': m.get('summary', ''), 'tips': m.get('tips', []), 'synoptic_effects': [{'index': i, 'wind': e.get('wind'), 'effect': e.get('effect')} for i, e in enumerate(m.get('synoptic_effects', []))]}, ensure_ascii=False))
        for cat in CATEGORIES:
            for it in m.get(cat, []):
                row = {'massif': m['id'], 'category': cat, 'id': it.get('id', it.get('name'))}
                row.update({k: it[k] for k in CONTEXT if k in it})
                row.update({k: it[k] for k in TEXT if k in it})
                print(json.dumps(row, ensure_ascii=False))


def set_text(obj: dict, key: str, value) -> None:
    if value in ('', []):
        obj.pop(key, None)
    else:
        obj[key] = value


def cmd_apply(lot: str, edits_path: str) -> None:
    path = lot_path(lot)
    with locked(path):
        _apply(path, lot, edits_path)


def _apply(path: Path, lot: str, edits_path: str) -> None:
    d = load(path)
    edits = json.loads(Path(edits_path).read_text())
    massifs = {m['id']: m for m in d['massifs']}
    n = 0
    for mid, e in edits.items():
        m = massifs.get(mid)
        if m is None:
            sys.exit(f'massif inconnu dans {lot} : {mid}')
        if 'summary' in e:
            m['summary'] = e['summary']
            n += 1
        if 'tips' in e:
            if len(e['tips']) != len(m.get('tips', [])):
                sys.exit(f"{mid} : {len(e['tips'])} conseils au lieu de {len(m.get('tips', []))}")
            m['tips'] = e['tips']
            n += 1
        for idx, text in (e.get('synoptic_effects') or {}).items():
            m['synoptic_effects'][int(idx)]['effect'] = text
            n += 1
        for cat in CATEGORIES:
            items = {it.get('id', it.get('name')): it for it in m.get(cat, [])}
            for iid, fields in (e.get(cat) or {}).items():
                it = items.get(iid)
                if it is None:
                    sys.exit(f'{mid}/{cat} : élément inconnu {iid}')
                for k, v in fields.items():
                    if k not in TEXT:
                        sys.exit(f'{mid}/{cat}/{iid} : champ non textuel « {k} » refusé')
                    set_text(it, k, v)
                n += 1
    save(path, d)
    print(f'{n} modification(s) appliquée(s) à {path.name}')


def cmd_visit_list(massif: str) -> None:
    d = load(BASE / 'visites' / f'{massif}.json')
    for i, s in enumerate(d['steps']):
        print(json.dumps({'index': i, **{k: s[k] for k in ('chapter', 'title', 'text', 'focus', 'phase', 'wind', 'view') if k in s}}, ensure_ascii=False))


def cmd_visit_apply(massif: str, edits_path: str) -> None:
    path = BASE / 'visites' / f'{massif}.json'
    with locked(path):
        _visit_apply(path, edits_path)


def _visit_apply(path: Path, edits_path: str) -> None:
    d = load(path)
    edits = json.loads(Path(edits_path).read_text())
    for idx, fields in edits.items():
        step = d['steps'][int(idx)]
        for k, v in fields.items():
            if k not in ('title', 'text'):
                sys.exit(f'étape {idx} : champ « {k} » refusé (seuls title et text)')
            step[k] = v
    save(path, d)
    print(f'{len(edits)} étape(s) modifiée(s) dans {path.name}')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == 'list':
        cmd_list(a[1], a[2] if len(a) > 2 else None)
    elif a[0] == 'apply':
        cmd_apply(a[1], a[2])
    elif a[0] == 'visit-list':
        cmd_visit_list(a[1])
    elif a[0] == 'visit-apply':
        cmd_visit_apply(a[1], a[2])
    else:
        sys.exit(__doc__)
