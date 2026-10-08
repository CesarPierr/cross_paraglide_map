#!/usr/bin/env python3
"""Finds the places the written visits name (villages, summits, cols, valleys,
rivers) and locates them, so each step can pin them on the map and highlight
them in its text: a reader who does not know the area sees where "Voiron" or
"the Cucheron col" is.

  python3 scripts/research/visit_places.py            → visites/_lieux.json
  python3 scripts/research/visit_places.py chartreuse  (one massif)
  python3 scripts/research/visit_places.py --fresh     (everything looked up again)

Candidates are the capitalised names of the text (articles stripped). Each is
looked up in the IGN gazetteer (Géoplateforme, place names of BD TOPO) and
kept only when the official name matches and lies in the massif's area. A
commune is placed at its village (built-up area or town hall), never at the
centre of its territory, which can be kilometres away in the mountains. A
massif or region the text names ("Belledonne", "le Dévoluy") is a zone: the
outline of its sector(s), drawn dashed on the map. Atlas items whose name is
the place (a take-off, a landing) are the last resort. Reviewed corrections in
visites/_lieux_corrections.json override everything (null drops a name).
Unresolved names are listed in visites/_lieux_inconnus.json for review.
Results are cached: re-running only looks up new names (--fresh: all again).
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
CORRECTIONS = VISITS / '_lieux_corrections.json'
ATLAS = ROOT / 'apps' / 'web' / 'public' / 'data' / 'atlas.json'
API = 'https://data.geopf.fr/geocodage/search'
MARGIN = 0.1  # degrees around the massif box (about 8 km)

UP = 'A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ'
WORD = rf"[{UP}][\w’'-]*"
LINK = r"(?:de|du|des|la|le|les|l[’']|d[’']|en|sur|sous|aux?)"
CANDIDATE = re.compile(rf"{WORD}(?:(?:\s+|-)(?:{LINK}\s*){{0,2}}{WORD})*")
ARTICLE = re.compile(r"^(?:Le|La|Les|L[’']|Au|Aux|Du|Des|De|D[’']|En|À|Vers|Par|Sur|Sous|Depuis|Entre|Après|Avant|Dès|Côté|Dans|Pour|Avec|Autour de|Sortir de|Sortir du|Jusqu[’']à|la|le|les)\s+|^(?:L|D|l|d)[’']", re.U)
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
    # Airspaces and generic words: nothing to pin.
    'tma', 'cta', 'ctr', 'zone', 'zones', 'espace', 'parc', 'réserve', 'bourg', 'préalpes', 'préalpes du nord', 'préalpes du sud', 'alpes du nord', 'alpes du sud',
    'montagne', 'montagnes', 'grand', 'grande', 'grands', 'petit', 'petite', 'petits', 'cime', 'cimes', 'table', 'altiport', 'aérodrome', 'plan', 'fenêtre',
    'chalet', 'chalets', 'pré', 'prés', 'forêt', 'bois', 'serre', 'puy', 'baou', 'bec', 'signal', 'rocher', 'rochers', 'pas', 'porte', 'portes', 'balcon',
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
AIRSPACE = re.compile(r'^(?:TMA|CTA|CTR|SIV|RTBA|ZRT|ZIT|R ?\d+|P ?\d+)\b')
# Generic word before a proper name in official toponyms: "Mont Mounier", "Montagne de Sulens".
GENERIC = re.compile(r'^(?:mont|montagne|pic|sommet|col|tete|pointe|dent|dents|roc|rocher|rochers|crete|cret|aiguille|aiguilles|signal|cime|puy|baou|bec|lac) (?:de la |de l |des |du |de |d )?')
STOP_N = set()


# Massifs and regions the text names, drawn as the dashed outline of their sector(s).
# Explicit: a sector's short name is often a town ("Chamonix", "Saint-André", "Megève")
# or a lake ("Bourget", "Serre-Ponçon"), which stays a pin.
ZONES = {
    'saleve': ['saleve-genevois'], 'genevois': ['saleve-genevois'], 'faucigny': ['arve-faucigny'], 'giffre': ['haut-giffre'], 'haut giffre': ['haut-giffre'],
    'chablais': ['chablais'], 'bornes': ['bornes'], 'aravis': ['aravis'], 'val montjoie': ['val-montjoie-saint-gervais'], 'val d arly': ['val-arly-megeve'],
    'beaufortain': ['beaufortain'], 'tarentaise': ['tarentaise'], 'vanoise': ['vanoise'], 'combe de savoie': ['combe-de-savoie'], 'bauges': ['bauges'],
    'chartreuse': ['chartreuse'], 'gresivaudan': ['gresivaudan'], 'belledonne': ['belledonne'], 'cuvette grenobloise': ['grenoble-cuvette'],
    'vercors': ['vercors-nord', 'vercors-est-sud'], 'trieves': ['trieves'], 'matheysine': ['matheysine'], 'oisans': ['oisans-grandes-rousses'],
    'maurienne': ['maurienne'], 'haute maurienne': ['haute-maurienne'], 'brianconnais': ['brianconnais-guisane'], 'queyras': ['queyras'],
    'ubaye': ['ubaye'], 'devoluy': ['devoluy'], 'champsaur': ['champsaur-valgaudemar'], 'valgaudemar': ['champsaur-valgaudemar'],
    'gapencais': ['gapencais-ceuse'], 'embrunais': ['serre-poncon-embrunais'], 'buech': ['buech-laragne-chabre'], 'baronnies': ['baronnies'],
    'diois': ['diois'], 'haut verdon': ['haut-verdon-allos'], 'prealpes de grasse': ['prealpes-grasse-castellane'], 'prealpes de nice': ['prealpes-nice-var'],
    'prealpes de digne': ['prealpes-digne-lure'], 'mercantour': ['mercantour'],
    'ecrins': ['oisans-grandes-rousses', 'ecrins-vallouise-haute-durance', 'champsaur-valgaudemar'],
}


def kind_rank(kind: str) -> int:
    for pat, r in KIND_RANK:
        if pat.search(kind):
            return r
    return 5


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r"[\s’'-]+", ' ', s).strip()


STOP_N.update(norm(x) for x in STOP)


# A lowercase generic word just before a name belongs to the place: "col des Aravis" is a col,
# "lac du Bourget" a lake, "massif de la Chartreuse" the massif.
BEFORE = re.compile(r"(?:^|[\s(])(col|lac|mont|pic|dent|dents|massif|vallée|vallon|plateau|cirque|gorges|combe|crêt|tête|pointe|aiguille|aiguilles|roc|rocher|signal|cime|barrage|cluse|montagne|chaîne|pays)\s+(de la |de l[’']|des |du |de |d[’']|)$")


def candidates(text: str) -> list[str]:
    out = []
    for m in CANDIDATE.finditer(text):
        c = m.group(0).strip(" -’'")
        lead = BEFORE.search(text[max(0, m.start() - 24):m.start()])
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
        if len(c) < 3 or norm(c) in STOP_N or ACRONYM.match(c) or AIRSPACE.match(c):
            continue
        # A lone capitalised verb opening a sentence ("Monter", "Sortir") is no place.
        if ' ' not in c and '-' not in c and re.search(r'(er|ir|re)$', c) and (m.start() == 0 or text[max(0, m.start() - 2):m.start()].strip() in {'.', ':', ''}):
            continue
        if lead and c == m.group(0).strip(" -’'"):
            out.append(lead.group(1) + ' ' + lead.group(2) + c)
        out.append(c)
    return out


def ign(name: str, lon: float, lat: float, limit: int = 10) -> list[dict]:
    q = urllib.parse.urlencode({'q': name, 'index': 'poi', 'limit': limit, 'lon': f'{lon:.4f}', 'lat': f'{lat:.4f}'})
    for attempt in range(3):
        try:
            return json.load(urllib.request.urlopen(f'{API}?{q}', timeout=20)).get('features', [])
        except Exception:  # noqa: BLE001 - retried, then treated as no answer
            time.sleep(1 + attempt)
    return []


def km(a: tuple[float, float], b: tuple[float, float]) -> float:
    return (((a[0] - b[0]) * 78) ** 2 + ((a[1] - b[1]) * 111) ** 2) ** 0.5


def village(feature: dict, results: list[dict]) -> tuple[float, float] | None:
    """Where a commune's village is: its built-up area of the same name, else its town hall."""
    p = feature['properties']
    code = set(p.get('citycode') or [])
    name = norm(p.get('toponym') or '')
    origin = tuple(feature['geometry']['coordinates'][:2])
    def same(f):
        return code & set(f['properties'].get('citycode') or []) and km(origin, f['geometry']['coordinates'][:2]) < 15
    for f in results:
        q = f['properties']
        if 'zone d\'habitation' in (q.get('category') or []) and norm(q.get('toponym') or '') == name and same(f):
            return tuple(f['geometry']['coordinates'][:2])
    halls = [f for f in ign(f"mairie {p.get('toponym')}", origin[0], origin[1]) if 'mairie' in (f['properties'].get('category') or []) and same(f)]
    # The town hall itself before an annex.
    halls.sort(key=lambda f: 0 if re.fullmatch(rf"mairie (?:de |d |du |des )?(?:la |le |les |l )?{re.escape(name)}", norm(f['properties'].get('toponym') or '')) else 1)
    return tuple(halls[0]['geometry']['coordinates'][:2]) if halls else None


def inside(lon, lat, box):
    return box[0] - MARGIN <= lon <= box[2] + MARGIN and box[1] - MARGIN <= lat <= box[3] + MARGIN


def zone(n: str, massifs: dict) -> dict | None:
    """A massif or region: the anchor of its label and the sector(s) whose outline is drawn."""
    key = re.sub(r'^(?:massif|pays|vallee|plateau) (?:de la |de l |des |du |de |d )?', '', n)
    ids = [i for i in ZONES.get(key, []) if i in massifs]
    if not ids:
        return None
    lon = sum(massifs[i]['center'][0] for i in ids) / len(ids)
    lat = sum(massifs[i]['center'][1] for i in ids) / len(ids)
    return {'lon': round(lon, 5), 'lat': round(lat, 5), 'kind': 'massif', 'massifs': ids, 'source': 'atlas'}


def official_names(p: dict) -> tuple[list[str], list[str]]:
    """The feature's names as written, and the same without their generic word ("Mont Mounier" → "mounier")."""
    raw = [p.get('toponym') or ''] + (p.get('name') if isinstance(p.get('name'), list) else [p.get('name') or ''])
    # Official names often carry an article: "Le Néron", "Le Guiers Mort".
    names = list(dict.fromkeys(re.sub(r'^(le|la|les|l) ', '', norm(x)) for x in raw if x))
    bare = [GENERIC.sub('', x) for x in names]
    return names, [x for x in bare if x and x not in names]


def resolve(name: str, massif: dict, atlas_items: list, massifs: dict) -> dict | None:
    box = massif['bbox']
    cx, cy = massif['center']
    n = norm(name)
    z = zone(n, massifs)
    if z:
        return {**z, 'label': name}
    best = None
    results = ign(name, cx, cy)
    for f in results:
        p = f['properties']
        lon, lat = f['geometry']['coordinates'][:2]
        if not inside(lon, lat, box):
            continue
        names, bare = official_names(p)
        exact = n in names
        prefix = any(x.startswith(n + ' ') for x in names)
        generic = n in bare
        if not (exact or prefix or generic):
            continue
        cats = p.get('category') or []
        kr = min([kind_rank(c) for c in cats] or [5])
        # Never a tram stop, a district or a leisure park; a prefix only for a town or a hamlet
        # ("Saint-Hilaire du Touvet"); a name without its generic word only for a summit, a col, a lake.
        if kr == 5 or (prefix and not exact and not generic and kr not in (1, 2)) or (generic and not exact and kr > 0):
            continue
        rank = (0 if exact else 1 if generic else 2, kr, (lon - cx) ** 2 + (lat - cy) ** 2)
        if best is None or rank < best[0]:
            best = (rank, f)
    if best:
        f = best[1]
        p = f['properties']
        cats = p.get('category') or []
        lon, lat = f['geometry']['coordinates'][:2]
        if any(re.search(r'administratif|commune', c) for c in cats):
            v = village(f, results)
            if v:
                lon, lat = v
        return {'lon': round(lon, 5), 'lat': round(lat, 5), 'label': p.get('toponym') or name, 'kind': (cats[0] if cats else ''), 'source': 'ign'}
    # Last resort: an atlas item of the area that bears the place's name (a take-off, a landing, a site).
    for f in atlas_items:
        props = f['properties']
        if f['geometry']['type'] != 'Point' or props['category'] not in ('takeoffs', 'landings', 'soaring', 'thermals') or len(n) < 4:
            continue
        item = norm(re.sub(r'\s*\(.*?\)', '', props['name']))
        item = re.sub(r'^(?:deco|decollage|atterrissage|atterro|site|thermique|point chaud)(?: du| de la| de l| des| de| d)? ', '', item)
        if item == n or item.startswith(n + ' '):
            lon, lat = f['geometry']['coordinates']
            if inside(lon, lat, box):
                return {'lon': round(lon, 5), 'lat': round(lat, 5), 'label': props['name'], 'kind': props['category'], 'source': 'atlas'}
    return None


def parts(name: str) -> list[str]:
    """A candidate that ran over two places ("Chamonix aux Aravis", "Savines-le-Lac sur Serre-Ponçon"): its pieces."""
    return [x for x in re.split(r'\s+(?:aux?|sur|sous|en|à|et|vers|par)\s+', name) if x != name and len(x) >= 3]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    only = args[0] if args else None
    atlas = json.loads(ATLAS.read_text())
    massifs = {m['id']: m for m in atlas['massifs']}
    items = [f for l in atlas['features'].values() for f in l]
    fresh = '--fresh' in sys.argv
    cache = json.loads(OUT.read_text()) if OUT.exists() else {}
    unknown = json.loads(UNKNOWN.read_text()) if UNKNOWN.exists() else {}
    corrections = json.loads(CORRECTIONS.read_text()) if CORRECTIONS.exists() else {}
    for path in sorted(VISITS.glob('*.json')):
        if path.name.startswith('_'):
            continue
        visit = json.loads(path.read_text())
        mid = visit['massif']
        if only and mid != only or mid not in massifs:
            continue
        m = massifs[mid]
        if fresh:
            cache[mid], unknown[mid] = {}, []
        known = cache.setdefault(mid, {})
        # Words since recognised as generic nouns ("Tête", "Dôme") leave the gazetteer.
        for name in [k for k in known if norm(k) in STOP_N]:
            del known[name]
        missing = set(unknown.get(mid, []))
        names = []
        for st in visit['steps']:
            names += candidates(st['title'] + '. ' + st['text'])
        queue = list(dict.fromkeys(names))
        while queue:
            name = queue.pop(0)
            if name in known or name in missing:
                continue
            hit = resolve(name, m, items, massifs)
            if hit:
                known[name] = hit
            else:
                missing.add(name)
                queue += parts(name)
            time.sleep(0.05)
        # Reviewed corrections have the last word: a place, or null to drop a wrong one.
        for name, fix in corrections.get(mid, {}).items():
            if fix is None:
                known.pop(name, None)
            else:
                known[name] = {**fix, 'source': fix.get('source', 'revue')}
            missing.discard(name)
        unknown[mid] = sorted(missing)
        print(f'{mid}: {len(known)} lieux, {len(missing)} non trouvés', flush=True)
    OUT.write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True) + '\n')
    UNKNOWN.write_text(json.dumps(unknown, ensure_ascii=False, indent=1, sort_keys=True) + '\n')


main()
