# Véracité des textes de massif et des visites — lot brianconnais_ecrins_queyras_ubaye

6 novembre 2026. Résumés, conseils, effets du vent météo et visites des cinq massifs du lot, comparés aux textes corrigés des lieux et aux sources en cache. Les constats sont dans `veracite_massifs_brianconnais.json`, un objet par constat, enregistrés avant les corrections.

## Bilan

110 constats, tous corrigés : Briançonnais 20, Écrins 29, Serre-Ponçon 29, Ubaye 19, Queyras 13 (le détail de `field` donne résumé, conseil, effet ou visite). La section « Hors périmètre » du rapport des éléments et les constats encore présents de `veracite_lots_7-12` sont couverts ; `veracite_lots_1-6` ne concerne pas ce lot.

## Les plus graves

1. Serre-Ponçon : l'atterrissage turbulent « après 14-15 h », propre à Serre Buzard, était donné pour le Guillaume, Pierre-Arnoux et tout le lac, avec un conseil « posez-vous avant 14 h ».
2. Écrins : « le survol n'y est autorisé que du 1er juillet au 31 octobre ». La règle a trois périodes, et mai-juin est sans vol thermique.
3. Ubaye : posés listés sans leurs interdictions (Saint-Ours, Halte 2000), vol à voile « interdit toute l'année » sans « à moins de 1000 m », plafonds de la Blanche repris d'une réponse sur Laragne.
4. Écrins : « forte brise descendante » et « passage obligé vers les Bans », absents des sources ; rue de plafond sans dire le vol dans le nuage.
5. Serre-Ponçon : Chamousses « fermé en 2026 » périmé (la fiche ouvre jusqu'au 15 avril 2027), « volume protégé du Morgon » inventé, Sisteron « en amont » de la brise qui en vient, ouï-dire vers Saint-André raconté comme une pratique.
6. Distances de l'atlas dites comme des longueurs de vol (cross de Vallouise 13, 21, 35 km ; gorges du Guil 15 km) : retirées.
7. Un seul vol raconté comme une règle : Prorel-Embrun, Névache, 4000 m au Combeynot, 3000 m au Morgon, 4170 m, Soleil Bœuf à 7h45 et 10h20.
8. Queyras : le Cristillan dit sans atterrissage ; départ sous le vent « réservé aux très bons pilotes » alors que la source parle de morts.

## À corriger hors de ce lot de textes

Textes de lieux et champs structurés, non modifiés :

- `serre-poncon-embrunais/breezes/brise-durance`, `possible` : « En amont, à Sisteron » ; Sisteron est en aval.
- Conseil 10 de Serre-Ponçon : la balise [S42] ne dit pas le fait, qui est dans S28. L'audit interdit de la retirer : S28 a été ajoutée à côté.
- Champ structuré à corriger : `brise-durance-basse-guisane.hours` (« dès la mi-matinée… »), `brise-pente-puy-aillaud.hours` et `pentes-se-puy-aillaud.best_hours` (S34 dit 9h30, S32 dit 9h00, tous deux « parfois »), `brise-descendante-vallouise.hours` et `speed_kmh`, `xc_routes[].distance_km` de Vallouise. Déjà listés dans le rapport des éléments.
- `atterro-saint-blaise` : la fiche FFVL garde la ligne HT, le club la dit démontée.

## Non vérifié

- HS18 et MS17, hors cache ; S68 derrière Cloudflare (seule la note de collecte) ; S66 sur note de collecte.
- MS16 relue dans le cache : la page actuelle ne parle que des vols d'hiver. Les balises [MS16] des conseils restent, car l'audit interdit de les retirer.
- « Huit sommets » du Parc (OT La Grave, repris du rapport du 30 octobre) : le topo du club dit « certains sommets ».
- « 300 jours de soleil » de l'Ubaye, chiffre publicitaire, laissé comme « annoncés ».
- Effets non listés : relus contre les lieux, sans retour à la source pour chacun.
