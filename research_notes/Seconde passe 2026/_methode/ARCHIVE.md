# Archive des documents de recherche

Les passes de recherche ont téléchargé 4349 documents publics (≈ 1,6 Go au 8 octobre 2026 : PDF de clubs et de la FFVL,
pages web, schémas annotés, cartes KML, textes extraits) et produit les transcriptions complètes
des agents de recherche (≈ 270 Mo, toutes sessions : requêtes, pages lues, raisonnements).

Ces fichiers ne sont **pas** dans ce dépôt public : ce sont des œuvres de tiers (droits d'auteur)
et leur taille dépasse ce qu'un dépôt Git doit contenir. Ce qui est versionné ici :

- les données extraites et sourcées (`../data/*.json`), les notes de chaque lot (`../*.md`) ;
- les rapports finaux des agents (`../_rapports_agents/`, extraits par `scripts/research/export_agent_reports.py`) et les propositions de thermiques non encore intégrées avec leurs recherches infructueuses (`propositions_thermiques_kk7_*.json`) ;
- les briefs (`brief_seconde_passe.md`, `brief_thermiques.md`) et les pages bloquées
  (`pages_bloquees.txt`) ;
- l'index des documents téléchargés (`documents_index.tsv` : empreinte SHA-256 tronquée, taille,
  chemin), qui permet de vérifier une archive restaurée ;
- les scripts de recherche (`scripts/research/`) et la récolte brute des fiches FFVL
  (`../sources/ffvl_sites_alpes.json`, réimportable par `npm run data:sites`).

## Où se trouve l'archive

Sur la VM de développement, `~/brises-des-alpes-research/` :

- `docs/` : copie synchronisée de `.cache/research/` (documents téléchargés, textes extraits) ;
- `transcripts/` : copie synchronisée des transcriptions de toutes les sessions et de leurs agents ;
- `research-docs.tar.gz`, `agent-transcripts.tar.gz` (+ `archives.sha256`) : l'instantané du 7 octobre.

Mise à jour après une passe de recherche (incrémentale) :

```bash
python3 scripts/research/export_agent_reports.py
rsync -a .cache/research/ dev-vm:brises-des-alpes-research/docs/
rsync -a ~/.claude/projects/-Users-pierre-paraglide/ dev-vm:brises-des-alpes-research/transcripts/
```

Restauration dans un clone :

```bash
rsync -a dev-vm:brises-des-alpes-research/docs/ .cache/research/
```

L'index `documents_index.tsv` (régénéré le 8 octobre) permet de vérifier une copie restaurée.

Pour la partager avec d'autres contributeurs sans la publier : un dépôt privé avec Git LFS, ou un
stockage privé (S3, Drive), en gardant cet index comme référence.
