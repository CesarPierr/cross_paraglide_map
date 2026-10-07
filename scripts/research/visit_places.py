#!/usr/bin/env python3
"""Finds the places the written visits name (villages, summits, cols, valleys,
rivers) and locates them, so each step can pin them on the map and highlight
them in its text: a reader who does not know the area sees where "Voiron" or
"the Cucheron col" is.

  python3 scripts/research/visit_places.py            → visites/_lieux.json
  python3 scripts/research/visit_places.py chartreuse  (one massif)

Candidates are the capitalised names of the text (articles stripped). Each is
looked up in the IGN gazetteer (Géoplateforme, place names of BD TOPO) and
kept only when the official name matches and lies in the massif's area; the
atlas items of the area are the fallback. Unresolved names are listed in
visites/_lieux_inconnus.json for review. Results are cached: re-running only
looks up new names.
"""
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VISITS = ROOT / 'research_notes' / 'Seconde passe 2026' / 'visites'
OUT = VISITS / '_lieux.json'
UNKNOWN = VISITS / '_lieux_inconnus.json'
ATLAS = ROOT / 'apps' / 'web' / 'public' / 'data' / 'atlas.json'
API = 'https://data.geopf.fr/geocodage/search'
MARGIN = 0.1  # degrees around the massif box (about 8 km)

UP = 'A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ'
WORD = rf"[{UP}][\w’'-]*"
LINK = r"(?:de|du|des|la|le|les|l[’']|d[’']|en|sur|sous|aux?)"
CANDIDATE = re.compile(rf"{WORD}(?:(?:\s+|-)(?:{LINK}\s*)?{WORD})*")
ARTICLE = re.compile(r"^(?:Le|La|Les|L[’']|Au|Aux|Du|Des|De|D[’']|En|À|Vers|Par|Sur|Sous|Depuis|Entre|Après|Avant|Dès|Côté)\s+|^(?:L|D)[’']", re.U)
STOP = {
    'retenez', 'attention', 'contrairement', 'quand', 'plus', 'pour', 'puis', 'enfin', 'tard', 'avec', 'sans', 'selon', 'dans', 'ces', 'cette', 'ce', 'elle',
    'ils', 'il', 'on', 'si', 'mais', 'ici', 'ensuite', 'ainsi', 'chaque', 'leur', 'leurs', 'son', 'sa', 'ses', 'matin', 'midi', 'soir', 'nord', 'sud', 'est', 'ouest',
    'alpes', 'france', 'deux', 'trois', 'quatre', 'un', 'une', 'tout', 'tous', 'toute', 'toutes', 'comme', 'même', 'les', 'le', 'la', 'aux', 'au', 'en', 'par',
    'sur', 'sous', 'vers', 'depuis', 'entre', 'après', 'avant', 'dès', 'côté', 'pas', 'trois portes', 'deux règles', 'un pilote', 'les récits', 'récits',
    'premier', 'première', 'dernier', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
    'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'certains', 'certaines', 'beaucoup', 'aucun', 'aucune', 'souvent', 'parfois',
    'surtout', 'aussi', 'encore', 'donc', 'alors', 'là', 'oui', 'non', 'bien', 'très', 'peu', 'trop', 'moins', 'fois', 'dent', 'col', 'pic', 'mont', 'lac',
    'vallée', 'massif', 'plateau', 'crête', 'cirque', 'combe', 'brise', 'thermique', 'déco', 'atterro', 'atterrissage', 'décollage', 'notez', 'imaginez',
    'regardez', 'observez', 'remarquez', 'voyez', 'cela', 'celui', 'celle', 'ceux', 'chacun', 'chacune', 'autre', 'autres', 'quelques', 'plusieurs',
    'dôme', 'tour', 'tête', 'halte', 'gorges', 'gorge', 'venturi', 'ballons', 'pointe', 'aiguille', 'roche', 'rocher', 'croix', 'chapelle', 'refuge',
    'station', 'village', 'ville', 'plaine', 'source', 'sources', 'barre', 'barres', 'épaule', 'arête', 'falaise', 'falaises',
    'au dessus', 'environ', 'fin', 'début', 'milieu', 'haut', 'bas', 'face', 'faces', 'pied', 'sommet', 'bord', 'fond', 'cœur', 'coeur', 'après midi',
}
# Words before "de" that are not part of the place: "Au-dessus de Grenoble", "Nord de Saint-Hilaire".
LEAD = {'au dessus', 'nord', 'sud', 'est', 'ouest', 'environ', 'fin', 'debut', 'milieu', 'haut', 'bas', 'face', 'faces', 'pied', 'sommet', 'bord', 'fond', 'coeur', 'abords', 'sortie', 'entree'}
# Geographic kinds first: a summit beats a tram stop or a shop with the same name.
KIND_RANK = [
    (re.compile(r'sommet|montagne|col|crête|cret|pic|escarpement|rocher|cirque|vallée|gorge|plateau|cours d.eau|lac|plan d.eau|glacier|détail orographique|site de vol'), 0),
    (re.compile(r'administratif|commune'), 1),
    (re.compile(r'lieu-dit'), 2),
]
ACRONYM = re.compile(r'^[A-Z0-9]{2,6}$')
STOP_N = set()


def kind_rank(kind: str) -> int:
    for pat, r in KIND_RANK:
        if pat.search(kind):
            return r
    return 5


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r"[\s’'-]+", ' ', s).strip()


STOP_N.update(norm(x) for x in STOP)


def candidates(text: str) -> list[str]:
    out = []
    for m in CANDIDATE.finditer(text):
        c = m.group(0).strip(" -’'")
        prev = c
        while True:
            c = ARTICLE.sub('', c).strip()
            if c == prev:
                break
            prev = c
        # "Au-dessus de Grenoble", "Nord de Saint-Hilaire": the place is after the link word.
        words = re.split(r'\s+(?:de|du|des|d[’\'])\s*', c, maxsplit=1)
        if len(words) == 2 and norm(words[0]) in LEAD:
            c = words[1]
        if len(c) < 3 or norm(c) in STOP_N or ACRONYM.match(c):
            continue
        # A lone capitalised verb opening a sentence ("Monter", "Sortir") is no place.
        if ' ' not in c and '-' not in c and re.search(r'(er|ir|re)$', c) and (m.start() == 0 or text[max(0, m.start() - 2):m.start()].strip() in {'.', ':', ''}):
            continue
        out.append(c)
    return out


def ign(name: str, lon: float, lat: float) -> list[dict]:
    q = urllib.parse.urlencode({'q': name, 'index': 'poi', 'limit': 10, 'lon': f'{lon:.4f}', 'lat': f'{lat:.4f}'})
    for attempt in range(3):
        try:
            return json.load(urllib.request.urlopen(f'{API}?{q}', timeout=20)).get('features', [])
        except Exception:  # noqa: BLE001 - retried, then treated as no answer
            time.sleep(1 + attempt)
    return []


def inside(lon, lat, box):
    return box[0] - MARGIN <= lon <= box[2] + MARGIN and box[1] - MARGIN <= lat <= box[3] + MARGIN


def resolve(name: str, massif: dict, atlas_items: list, massifs: dict) -> dict | None:
    box = massif['bbox']
    cx, cy = massif['center']
    n = norm(name)
    # A massif named in the text: its sector.
    named = [m for m in massifs.values() if m['id'] != 'alpes-francaises' and (n == norm(m['shortName']) or norm(m['shortName']).startswith(n + ' ') or n == norm(m['id'].replace('-', ' ')))]
    if named:
        m = min(named, key=lambda x: (x['center'][0] - cx) ** 2 + (x['center'][1] - cy) ** 2)
        return {'lon': m['center'][0], 'lat': m['center'][1], 'label': m['shortName'], 'kind': 'massif', 'source': 'atlas'}
    best = None
    for f in ign(name, cx, cy):
        p = f['properties']
        lon, lat = f['geometry']['coordinates'][:2]
        if not inside(lon, lat, box):
            continue
        names = [p.get('toponym') or ''] + (p.get('name') if isinstance(p.get('name'), list) else [p.get('name') or ''])
        # Official names often carry an article: "Le Néron", "Le Guiers Mort".
        names = [re.sub(r'^(le|la|les|l) ', '', norm(x)) for x in names if x]
        exact = n in names
        prefix = any(x.startswith(n + ' ') for x in names)
        if not (exact or prefix):
            continue
        cats = p.get('category') or []
        kr = min([kind_rank(c) for c in cats] or [5])
        # Never a tram stop, a district or a leisure park; a prefix only for a town or a hamlet ("Saint-Hilaire du Touvet").
        if kr == 5 or (not exact and kr > 2):
            continue
        rank = (0 if exact else 1, kr, (lon - cx) ** 2 + (lat - cy) ** 2)
        if best is None or rank < best[0]:
            best = (rank, {'lon': round(lon, 5), 'lat': round(lat, 5), 'label': p.get('toponym') or name, 'kind': (cats[0] if cats else ''), 'source': 'ign'})
    if best:
        return best[1]
    # Fallback: an atlas item of the area whose name holds the place as whole words.
    word = re.compile(rf'(^| ){re.escape(n)}( |$)')
    for f in atlas_items:
        props = f['properties']
        if n and len(n) >= 4 and word.search(norm(props['name'])) and f['geometry']['type'] == 'Point':
            lon, lat = f['geometry']['coordinates']
            if inside(lon, lat, box):
                return {'lon': round(lon, 5), 'lat': round(lat, 5), 'label': name, 'kind': props['category'], 'source': 'atlas'}
    return None


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    atlas = json.loads(ATLAS.read_text())
    massifs = {m['id']: m for m in atlas['massifs']}
    items = [f for l in atlas['features'].values() for f in l]
    cache = json.loads(OUT.read_text()) if OUT.exists() else {}
    unknown = json.loads(UNKNOWN.read_text()) if UNKNOWN.exists() else {}
    for path in sorted(VISITS.glob('*.json')):
        if path.name.startswith('_'):
            continue
        visit = json.loads(path.read_text())
        mid = visit['massif']
        if only and mid != only or mid not in massifs:
            continue
        m = massifs[mid]
        known = cache.setdefault(mid, {})
        # Words since recognised as generic nouns ("Tête", "Dôme") leave the gazetteer.
        for name in [k for k in known if norm(k) in STOP_N]:
            del known[name]
        missing = set(unknown.get(mid, []))
        names = []
        for st in visit['steps']:
            names += candidates(st['title'] + '. ' + st['text'])
        for name in dict.fromkeys(names):
            if name in known or name in missing:
                continue
            hit = resolve(name, m, items, massifs)
            if hit:
                known[name] = hit
            else:
                missing.add(name)
            time.sleep(0.05)
        unknown[mid] = sorted(missing)
        print(f'{mid}: {len(known)} lieux, {len(missing)} non trouvés', flush=True)
    OUT.write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True) + '\n')
    UNKNOWN.write_text(json.dumps(unknown, ensure_ascii=False, indent=1, sort_keys=True) + '\n')


main()
