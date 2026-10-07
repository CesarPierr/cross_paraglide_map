# Archive des documents de recherche

La seconde passe a téléchargé 4120 documents publics (≈ 1,5 Go : PDF de clubs et de la FFVL,
pages web, schémas annotés, cartes KML, textes extraits) et produit les transcriptions complètes
des agents de recherche (≈ 170 Mo : requêtes, pages lues, raisonnements).

Ces fichiers ne sont **pas** dans ce dépôt public : ce sont des œuvres de tiers (droits d'auteur)
et leur taille dépasse ce qu'un dépôt Git doit contenir. Ce qui est versionné ici :

- les données extraites et sourcées (`../data/*.json`), les notes de chaque lot (`../*.md`) ;
- les rapports finaux des agents (`../_rapports_agents/`) ;
- les briefs (`brief_seconde_passe.md`, `brief_thermiques.md`) et les pages bloquées
  (`pages_bloquees.txt`) ;
- l'index des documents téléchargés (`documents_index.tsv` : empreinte SHA-256 tronquée, taille,
  chemin), qui permet de vérifier une archive restaurée ;
- les scripts de recherche (`scripts/research/`) et la récolte brute des fiches FFVL
  (`../sources/ffvl_sites_alpes.json`, réimportable par `npm run data:sites`).

## Où se trouve l'archive

Sur la VM de développement : `~/brises-des-alpes-research/` (`research-docs.tar.gz` pour les
documents, `agent-transcripts.tar.gz` pour les transcriptions, avec leurs sommes SHA-256).

Restauration dans un clone :

```bash
scp dev-vm:brises-des-alpes-research/research-docs.tar.gz .
tar -xzf research-docs.tar.gz -C .cache/research
```

Pour la partager avec d'autres contributeurs sans la publier : un dépôt privé avec Git LFS, ou un
stockage privé (S3, Drive), en gardant cet index comme référence.
