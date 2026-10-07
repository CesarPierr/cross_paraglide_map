# Positions à vérifier (altitude du terrain IGN)

Généré par `python3 scripts/research/check_altitudes.py`. 1390 points de la recherche déclarent une altitude ; le terrain IGN (RGE ALTI) à leur position en diffère de plus de 80 m pour **0** d’entre eux. Un écart fort signale un point mal placé (ou une altitude fausse). Quand la fiche FFVL du même site tombe à la bonne altitude, elle est proposée : à reporter dans `research_notes/Seconde passe 2026/positions/corrections.json` après contrôle.

| Écart | Élément | Déclaré | Terrain IGN | Position | Proposition |
| --- | --- | --- | --- | --- | --- |
