"""Flags what a text rewrite may have changed in meaning, against the committed version:
directions that appear (a flipped « nord-est » → « sud-est »), and place names that
disappear. Complements text_audit.py (numbers, attributions, structure); the list is for
a human review, not a gate. See _methode/STYLE_TEXTES.md.

  python3 scripts/research/text_fidelity.py <lot> [<lot> …]
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = 'research_notes/Seconde passe 2026'
CATEGORIES = ['breezes', 'convergences', 'hazards', 'thermal_spots', 'soaring_spots', 'takeoffs', 'landings', 'xc_routes']
TEXT = ['description', 'mechanism', 'usage', 'possible', 'note']
# Directions: compounds, unambiguous words, and « est » only where it cannot be the verb.
DIRECTION = re.compile(r"\b(?:(?:nord|sud|est|ouest)(?:-(?:nord|sud|est|ouest))+|nord|sud|ouest)\b", re.I)
EST = re.compile(r"\b(?:face|faces|plein|pente|pentes|versant|côté|flanc) est\b|\b(?:à|vers|de|par|depuis) l['’]est\b|\bd['’]est\b", re.I)
ABBREV = re.compile(r"\b(?:N|S|E|O|W|NE|NO|NW|SE|SO|SW|NNE|NNO|ENE|ESE|SSE|SSO|ONO|OSO|WNW|WSW)\b(?!['’])")
# Capitalised words (places, peaks), not after a sentence break.
NAME = re.compile(r"(?<![.!?»:]\s)(?<!^)\b[A-ZÀ-Ý][a-zà-ÿ'’-]{2,}(?:[- ](?:de|du|des|la|le|les|d['’])?\s?[A-ZÀ-Ý][a-zà-ÿ'’-]+)*")


def text_of(obj: dict, keys: list[str]) -> str:
    parts = []
    for k in keys:
        v = obj.get(k)
        if isinstance(v, list):
            parts.extend(v)
        elif isinstance(v, str):
            parts.append(v)
    return '\n'.join(parts)


WORD = {'N': 'nord', 'S': 'sud', 'E': 'est', 'O': 'ouest', 'W': 'ouest'}


def spell(abbrev: str) -> str:
    """« NNE » → « nord-nord-est », « SW » → « sud-ouest »."""
    return '-'.join(WORD[c] for c in abbrev)


def directions(t: str) -> set[str]:
    out = {m.group(0).lower() for m in DIRECTION.finditer(t)}
    if EST.search(t):
        out.add('est')
    out |= {spell(m.group(0)) for m in ABBREV.finditer(t)}
    # A compound implies its parts (« sud-ouest » covers « sud » and « ouest »).
    out |= {part for d in list(out) for part in d.split('-')}
    return out


def names(t: str) -> set[str]:
    return {m.group(0) for m in NAME.finditer(t)}


def compare(where: str, old: str, new: str, context: str, out: list[str]) -> None:
    added = directions(new) - directions(old) - directions(context)
    if added:
        out.append(f'{where} : direction nouvelle {sorted(added)}')
    lost = {n for n in names(old) - names(new) if n not in context and n.split()[0] not in new}
    if lost:
        out.append(f'{where} : noms absents {sorted(lost)}')


def head(path: str) -> dict | None:
    r = subprocess.run(['git', 'show', f'HEAD:{path}'], cwd=ROOT, capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else None


def check_lot(lot: str) -> list[str]:
    path = f'{BASE}/data/{lot}.json'
    old, new = head(path), json.loads((ROOT / path).read_text())
    out: list[str] = []
    if old is None:
        return [f'{lot} : pas de version committée']
    om = {m['id']: m for m in old['massifs']}
    for m in new['massifs']:
        o = om.get(m['id'])
        if not o:
            continue
        compare(f"{m['id']}/résumé", o.get('summary', ''), m.get('summary', ''), '', out)
        compare(f"{m['id']}/conseils", '\n'.join(o.get('tips', [])), '\n'.join(m.get('tips', [])), '', out)
        for i, (a, b) in enumerate(zip(o.get('synoptic_effects', []), m.get('synoptic_effects', []))):
            compare(f"{m['id']}/vent {i}", a.get('effect', ''), b.get('effect', ''), a.get('wind', '') or '', out)
            # The effect must still describe its own wind (effects swapped between winds).
            lead = re.match(r"\s*Par (?:vent (?:de |d['’])|flux (?:de |d['’])|tendance (?:de |d['’])?|)([a-z-]+)", b.get('effect', ''), re.I)
            wind = (b.get('wind') or '').strip().upper()
            if lead and re.fullmatch(r'[NSEOW]{1,3}', wind) and lead.group(1).lower() != spell(wind):
                out.append(f"{m['id']}/vent {i} ({wind}) : l'effet commence par « {lead.group(0).strip()} » (effet d'un autre vent ?)")
        for cat in CATEGORIES:
            items = {it.get('id', it.get('name')): it for it in o.get(cat, [])}
            for it in m.get(cat, []):
                iid = it.get('id', it.get('name'))
                a = items.get(iid)
                if a is None:
                    continue
                context = ' '.join(str(it.get(k, '')) for k in it if k not in TEXT and k != 'sources')
                compare(f"{m['id']}/{cat}/{iid}", text_of(a, TEXT), text_of(it, TEXT), context, out)
    for mid in om:
        vpath = f'{BASE}/visites/{mid}.json'
        if not (ROOT / vpath).exists():
            continue
        vo, vn = head(vpath), json.loads((ROOT / vpath).read_text())
        if vo is None:
            continue
        for i, (a, b) in enumerate(zip(vo['steps'], vn['steps'])):
            compare(f'visite {mid}/{i}', a.get('title', '') + '\n' + a.get('text', ''), b.get('title', '') + '\n' + b.get('text', ''), '', out)
    return out


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for lot in sys.argv[1:]:
        rows = check_lot(lot)
        print(f'## {lot} : {len(rows)} point(s) à relire')
        for r in rows:
            print('  ' + r)
