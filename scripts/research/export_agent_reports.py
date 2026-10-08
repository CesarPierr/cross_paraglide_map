#!/usr/bin/env python3
"""Copies the final report of every research agent into the repository, so the
collected knowledge survives the machine: mission, date, and the agent's own
closing report (sources read, items created, gaps). Full transcripts (pages
read, queries) are archived privately, see _methode/ARCHIVE.md.

  python3 scripts/research/export_agent_reports.py

Reads ~/.claude/projects/<this project>/<session>/subagents/agent-*.jsonl and
writes research_notes/Seconde passe 2026/_rapports_agents/<agent id>.md plus
the README index. Reports already written are kept (an agent's report does
not change once it has finished), except when the transcript holds a longer one.
"""
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'research_notes' / 'Seconde passe 2026' / '_rapports_agents'
PROJECT = Path.home() / '.claude' / 'projects' / ('-' + str(ROOT).strip('/').replace('/', '-'))


def final_report(path: Path) -> tuple[str, str, str]:
    """Mission (first prompt line), date, last substantial assistant text."""
    mission, date, report = '', '', ''
    for line in path.read_text(errors='ignore').splitlines():
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = rec.get('message') or {}
        content = msg.get('content')
        if not date and rec.get('timestamp'):
            date = rec['timestamp'][:10]
        if msg.get('role') == 'user' and not mission and isinstance(content, str):
            mission = content.strip().split('\n')[0][:200]
        if msg.get('role') == 'assistant' and isinstance(content, list):
            text = '\n'.join(c.get('text', '') for c in content if c.get('type') == 'text').strip()
            if len(text) > 300:
                report = text
    return mission, date, report


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for meta in sorted(PROJECT.glob('*/subagents/agent-*.meta.json')):
        agent = meta.name.removeprefix('agent-').removesuffix('.meta.json')
        transcript = meta.with_name(f'agent-{agent}.jsonl')
        if not transcript.exists():
            continue
        description = json.loads(meta.read_text()).get('description', '')
        mission, date, report = final_report(transcript)
        if not report:
            continue
        target = OUT / f'{agent}.md'
        title = description or mission
        body = f'# Rapport d\'agent {agent}\n\n**Mission** : {title}\n\n**Date** : {date or "?"}\n\n**Consigne (début)** : {mission}\n\n---\n\n{report}\n'
        if not target.exists() or len(body) > len(target.read_text()):
            target.write_text(body)
        rows.append((date, agent, title))
    # Index: every report in the folder, the newest first.
    known = {a: (d, t) for d, a, t in rows}
    for f in OUT.glob('*.md'):
        if f.name == 'README.md' or f.stem in known:
            continue
        head = f.read_text().split('\n')
        mission = next((l.split(':', 1)[1].strip() for l in head if l.startswith('**Mission**')), '')
        known[f.stem] = ('', mission)
    lines = [
        '# Rapports finaux des agents de recherche',
        '',
        'Extraits des transcriptions par `scripts/research/export_agent_reports.py` (dernier message substantiel de chaque agent : sources lues, éléments créés, lacunes). '
        'Les transcriptions complètes (requêtes, pages lues) et les documents téléchargés sont archivés hors du dépôt public : voir `../_methode/ARCHIVE.md`.',
        '',
        '| Date | Agent | Mission |',
        '| --- | --- | --- |',
    ]
    for agent, (date, title) in sorted(known.items(), key=lambda kv: kv[1][0], reverse=True):
        lines.append(f'| {date or "—"} | [{agent}]({agent}.md) | {title} |')
    (OUT / 'README.md').write_text('\n'.join(lines) + '\n')
    print(f'{len(rows)} rapports exportés, {len(known)} au total → {OUT}')


main()
