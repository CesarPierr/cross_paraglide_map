"""Reads and writes the research JSON files exactly in their own layout, so that a text
rewrite shows only the changed sentences in the diff.

- data/*.json: json.dumps(indent=2, ensure_ascii=False) + newline;
- visites/*.json: the same, except lists of scalars and small objects of scalars
  (focus lists, wind) kept on one line.

  from textjson import load, save
  d = load(path); ...; save(path, d)
"""
import json
from pathlib import Path


def _scalars(v) -> bool:
    return all(not isinstance(x, (list, dict)) for x in (v.values() if isinstance(v, dict) else v))


def _visit(v, level: int = 0, multiline: bool = False) -> str:
    pad = '  ' * level
    if isinstance(v, dict):
        if not v:
            return '{}'
        if level >= 3 and _scalars(v):
            # Small objects inside a step (wind): one line, spaces inside the braces.
            return '{ ' + ', '.join(f'{json.dumps(k, ensure_ascii=False)}: {json.dumps(x, ensure_ascii=False)}' for k, x in v.items()) + ' }'
        items = [f'{pad}  {json.dumps(k, ensure_ascii=False)}: {_visit(x, level + 1, multiline)}' for k, x in v.items()]
        return '{\n' + ',\n'.join(items) + '\n' + pad + '}'
    if isinstance(v, list):
        if _scalars(v) and (not multiline or not v):
            return '[' + ', '.join(json.dumps(x, ensure_ascii=False) for x in v) + ']'
        items = [f'{pad}  {_visit(x, level + 1, multiline)}' for x in v]
        return '[\n' + ',\n'.join(items) + '\n' + pad + ']'
    return json.dumps(v, ensure_ascii=False)


def dumps(path: Path, d) -> str:
    if Path(path).parent.name == 'visites':
        # Two layouts exist (focus lists on one line or one id per line): keep the file's own.
        original = Path(path).read_text() if Path(path).exists() else ''
        if '"focus": [\n' in original:
            # Plain JSON layout (one value per line), with or without a final newline.
            return json.dumps(d, ensure_ascii=False, indent=2) + ('\n' if original.endswith('\n') else '')
        return _visit(d) + '\n'
    return json.dumps(d, ensure_ascii=False, indent=2) + '\n'


def load(path):
    return json.loads(Path(path).read_text())


def save(path, d) -> None:
    Path(path).write_text(dumps(Path(path), d))


if __name__ == '__main__':
    # Self-check: every file reproduces byte for byte.
    base = Path(__file__).resolve().parents[2] / 'research_notes' / 'Seconde passe 2026'
    bad = [p.name for p in sorted(base.glob('data/*.json')) + sorted(base.glob('visites/*.json')) if not p.name.startswith('_') and dumps(p, load(p)) != p.read_text()]
    print('identiques' if not bad else f'différents : {bad}')
