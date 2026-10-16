"""Audit of the place texts (research files and guided visits) against a baseline revision.

Checks that a rewrite gains clarity without losing or inventing anything
(research_notes/Seconde passe 2026/_methode/STYLE_TEXTES.md):

- errors (must be fixed): a non-text field changed (what the wind model reads: names,
  hours, conditions, kinds, coordinates, sources…), an item added or removed, a number
  that the original texts of the item never contained, a visit step whose focus, phase,
  wind or view changed;
- warnings: attributions to people, publications, forums or flights left in the prose,
  long quotations, years in the prose, texts over the length targets;
- statistics before/after per lot.

Usage:
  python3 scripts/research/text_audit.py                  # every lot, baseline HEAD
  python3 scripts/research/text_audit.py --baseline 3c720f0 chartreuse_gresivaudan_belledonne
  python3 scripts/research/text_audit.py --stats          # only the before/after table
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'research_notes' / 'Seconde passe 2026'
DATA = BASE / 'data'
VISITS = BASE / 'visites'

CATEGORIES = ['breezes', 'convergences', 'hazards', 'thermal_spots', 'soaring_spots', 'takeoffs', 'landings', 'xc_routes']
# Fields a rewrite may change, per item.
ITEM_TEXT = {'description', 'possible', 'note', 'mechanism', 'usage'}
MASSIF_TEXT = {'summary', 'tips'}
STEP_TEXT = {'text', 'title'}

ATTRIBUTION = re.compile(
    r"d['’]après(?![- ]midi)|\bselon (?:un|une|des|le pilote|les pilotes|(?-i:[A-Z]))|racont|témoign|\bforum|commentaire|Vol ?Libre|XC ?Mag|Airshop|"
    r"fiche FFVL|page FFVL|site (?:de la )?FFVL|\btopo (?:de|du|d['’])|\bblog|vidéo|YouTube|Facebook|Strava|\bun pilote\b|"
    r"\b(?:des|les|plusieurs) pilotes (?:disent|racontent|rapportent|citent|signalent|décrivent|évoquent)|\brécits?\b|"
    r"retour d['’]expérience|cité par|rapporté par|\bn°\s?\d+",
    re.I,
)
YEAR = re.compile(r'(?<!Natura )\b(?:19[5-9]\d|20[0-4]\d)\b(?!\s?m\b)')
QUOTE = re.compile(r'«\s*([^»]+?)\s*»')
NUMBER = re.compile(r'\d+(?:[   ]\d{3})*(?:[.,]\d+)?')

LIMITS = {'description': 480, 'mechanism': 420, 'usage': 420, 'possible': 220, 'summary': 1600, 'tip': 260, 'effect': 420, 'step': 620}


def numbers(text: str) -> set[str]:
    out = set()
    for m in NUMBER.finditer(text or ''):
        n = re.sub(r'[   ]', '', m.group(0)).replace(',', '.')
        out.add(n.rstrip('0').rstrip('.') if '.' in n else n)
    return out


def all_text(v) -> str:
    return json.dumps(v, ensure_ascii=False)


def git_json(rev: str, path: Path):
    rel = path.relative_to(ROOT).as_posix()
    try:
        raw = subprocess.run(['git', 'show', f'{rev}:{rel}'], cwd=ROOT, capture_output=True, check=True).stdout
    except subprocess.CalledProcessError:
        return None
    return json.loads(raw)


def strip(d: dict, keys: set) -> dict:
    return {k: v for k, v in d.items() if k not in keys}


class Report:
    def __init__(self, name: str):
        self.name = name
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.stats = {'attr_before': 0, 'attr_after': 0, 'chars_before': 0, 'chars_after': 0, 'long_after': 0, 'items': 0, 'possible': 0}

    def text(self, where: str, field: str, before: str, after: str, limit_key: str):
        self.stats['chars_before'] += len(before or '')
        self.stats['chars_after'] += len(after or '')
        self.stats['attr_before'] += len(ATTRIBUTION.findall(before or ''))
        hits = ATTRIBUTION.findall(after or '')
        self.stats['attr_after'] += len(hits)
        if hits:
            self.warnings.append(f'{where} [{field}] attribution : {", ".join(sorted(set(h.lower() for h in hits)))}')
        for q in QUOTE.findall(after or ''):
            if len(q.split()) > 6:
                self.warnings.append(f'{where} [{field}] longue citation : « {q[:60]}… »')
        if field != 'note' and YEAR.search(after or ''):
            self.warnings.append(f'{where} [{field}] année dans le texte : {YEAR.findall(after)}')
        if len(after or '') > LIMITS[limit_key]:
            self.stats['long_after'] += 1
            self.warnings.append(f'{where} [{field}] {len(after)} car. (> {LIMITS[limit_key]})')


def audit_lot(path: Path, rev: str) -> Report:
    rep = Report(path.stem)
    new = json.loads(path.read_text())
    old = git_json(rev, path)
    if old is None:
        rep.warnings.append('pas de version de référence (nouveau fichier)')
        return rep
    if strip(new, {'massifs'}) != strip(old, {'massifs'}):
        rep.errors.append('champs de fichier modifiés (sources, figures, règles…)')
    old_m = {m['id']: m for m in old['massifs']}
    for m in new['massifs']:
        om = old_m.get(m['id'])
        if om is None:
            rep.errors.append(f"massif ajouté : {m['id']}")
            continue
        mid = m['id']
        # Massif-level: only summary, tips and the effect texts may change.
        def massif_core(x):
            core = strip(x, MASSIF_TEXT | set(CATEGORIES) | {'synoptic_effects'})
            core['synoptic'] = [strip(e, {'effect'}) for e in x.get('synoptic_effects', [])]
            return core
        if massif_core(m) != massif_core(om):
            rep.errors.append(f'{mid} : champs du massif modifiés (hors résumé, conseils, effets)')
        old_massif_nums = numbers(all_text({k: om.get(k) for k in ('summary', 'tips', 'synoptic_effects')}) + all_text(om))
        rep.text(mid, 'summary', om.get('summary', ''), m.get('summary', ''), 'summary')
        new_nums = numbers(m.get('summary', ''))
        tips_old = om.get('tips', [])
        for t_old in tips_old:
            rep.stats['chars_before'] += len(t_old)
            rep.stats['attr_before'] += len(ATTRIBUTION.findall(t_old))
        for i, t in enumerate(m.get('tips', [])):
            rep.stats['chars_after'] += len(t)
            hits = ATTRIBUTION.findall(t)
            rep.stats['attr_after'] += len(hits)
            if hits:
                rep.warnings.append(f'{mid} conseil {i + 1} attribution : {", ".join(sorted(set(h.lower() for h in hits)))}')
            if len(t) > LIMITS['tip']:
                rep.warnings.append(f'{mid} conseil {i + 1} : {len(t)} car. (> {LIMITS["tip"]})')
            new_nums |= numbers(re.sub(r'\[S\d+(?:\s*,\s*S\d+)*\]', '', t))
        old_tags = sorted(set(re.findall(r'S\d+', ' '.join(tips_old))))
        new_tags = sorted(set(re.findall(r'S\d+', ' '.join(m.get('tips', [])))))
        if old_tags != new_tags:
            rep.errors.append(f'{mid} : sources citées dans les conseils modifiées ({set(old_tags) ^ set(new_tags)})')
        for e_new, e_old in zip(m.get('synoptic_effects', []), om.get('synoptic_effects', [])):
            rep.text(f"{mid} vent {e_new.get('wind')}", 'effect', e_old.get('effect', ''), e_new.get('effect', ''), 'effect')
            new_nums |= numbers(e_new.get('effect', ''))
        invented = new_nums - old_massif_nums
        if invented:
            rep.errors.append(f'{mid} : chiffres absents de l’original (résumé/conseils/effets) : {sorted(invented)}')
        for cat in CATEGORIES:
            old_items = {it.get('id', it.get('name')): it for it in om.get(cat, [])}
            new_items = {it.get('id', it.get('name')): it for it in m.get(cat, [])}
            if set(old_items) != set(new_items):
                rep.errors.append(f'{mid}/{cat} : éléments ajoutés ou retirés ({set(old_items) ^ set(new_items)})')
            for iid, it in new_items.items():
                o = old_items.get(iid)
                if o is None:
                    continue
                rep.stats['items'] += 1
                where = f'{mid}/{iid}'
                if strip(it, ITEM_TEXT) != strip(o, ITEM_TEXT):
                    changed = [k for k in set(it) | set(o) if k not in ITEM_TEXT and it.get(k) != o.get(k)]
                    rep.errors.append(f'{where} : champs non textuels modifiés {changed}')
                for f in ('description', 'mechanism', 'usage'):
                    if f in it or f in o:
                        rep.text(where, f, o.get(f, ''), it.get(f, ''), f)
                if o.get('possible'):
                    for p in o['possible']:
                        rep.stats['chars_before'] += len(p)
                for p in it.get('possible', []) or []:
                    rep.stats['possible'] += 1
                    rep.text(where, 'possible', '', p, 'possible')
                if it.get('note'):
                    rep.stats['chars_after'] += len(it['note'])
                if o.get('note'):
                    rep.stats['chars_before'] += len(o['note'])
                new_item_nums = numbers(' '.join([it.get(f, '') or '' for f in ('description', 'mechanism', 'usage', 'note')] + list(it.get('possible', []) or [])))
                invented = new_item_nums - numbers(all_text(o))
                if invented:
                    rep.errors.append(f'{where} : chiffres absents de l’original : {sorted(invented)}')
    return rep


def audit_visit(path: Path, rev: str) -> Report:
    rep = Report('visite ' + path.stem)
    new = json.loads(path.read_text())
    old = git_json(rev, path)
    if old is None:
        return rep
    if strip(new, {'steps'}) != strip(old, {'steps'}):
        rep.errors.append('en-tête de visite modifié')
    if len(new.get('steps', [])) != len(old.get('steps', [])):
        rep.errors.append(f"nombre d'étapes modifié ({len(old['steps'])} → {len(new['steps'])})")
    for i, (s, o) in enumerate(zip(new.get('steps', []), old.get('steps', []))):
        where = f'étape {i + 1}'
        if strip(s, STEP_TEXT) != strip(o, STEP_TEXT):
            rep.errors.append(f'{where} : focus, phase, vent ou vue modifiés')
        rep.text(where, 'text', o.get('text', ''), s.get('text', ''), 'step')
        invented = numbers(s.get('text', '') + ' ' + s.get('title', '')) - numbers(o.get('text', '') + ' ' + o.get('title', ''))
        if invented:
            rep.errors.append(f'{where} : chiffres absents de l’original : {sorted(invented)}')
    return rep


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('lots', nargs='*', help='lot names (data/<lot>.json) and/or visit massif ids; default: all')
    ap.add_argument('--baseline', default='HEAD')
    ap.add_argument('--stats', action='store_true', help='only the summary table')
    ap.add_argument('--max', type=int, default=40, help='messages shown per file')
    args = ap.parse_args()
    paths = []
    wanted_massifs: set[str] = set()
    for p in sorted(DATA.glob('*.json')):
        if not args.lots or p.stem in args.lots:
            paths.append(('lot', p))
            wanted_massifs |= {m['id'] for m in json.loads(p.read_text())['massifs']}
    for p in sorted(VISITS.glob('*.json')):
        if p.name.startswith('_'):
            continue
        if not args.lots or p.stem in args.lots or p.stem in wanted_massifs:
            paths.append(('visit', p))
    reports = [audit_lot(p, args.baseline) if kind == 'lot' else audit_visit(p, args.baseline) for kind, p in paths]
    total_err = sum(len(r.errors) for r in reports)
    print(f"{'fichier':42} {'éléments':>8} {'car. avant':>10} {'car. après':>10} {'attrib. avant':>13} {'après':>6} {'possibles':>9} {'trop longs':>10} {'erreurs':>7}")
    for r in reports:
        s = r.stats
        print(f"{r.name[:42]:42} {s['items']:8} {s['chars_before']:10} {s['chars_after']:10} {s['attr_before']:13} {s['attr_after']:6} {s['possible']:9} {s['long_after']:10} {len(r.errors):7}")
    if not args.stats:
        for r in reports:
            if r.errors or r.warnings:
                print(f'\n== {r.name}')
                for e in r.errors[: args.max]:
                    print('  ERREUR', e)
                for w in r.warnings[: args.max]:
                    print('  avert.', w)
                more = len(r.errors) + len(r.warnings) - 2 * args.max
                if more > 0:
                    print(f'  … {more} de plus')
    print(f'\n{total_err} erreur(s)')
    return 1 if total_err else 0


if __name__ == '__main__':
    sys.exit(main())
