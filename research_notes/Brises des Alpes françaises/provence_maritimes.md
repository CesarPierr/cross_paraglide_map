# Paragliding aerology of the Alpes-de-Haute-Provence and Alpes-Maritimes: Saint-André/Chalvet, Digne–Sisteron–Lure, Haut-Verdon, Castellane–Grasse, Nice–Var, Mercantour

> **Research status: incomplete. Read this before using these notes.**
> - The shared WebSearch quota for this turn (200 calls, shared by all agents) ran out after only 6 searches by this researcher.
> - Direct fetching was blocked by the egress proxy for every target domain I tried (WebFetch and curl): aerogliss.com, chvd.org, paraglidingmap.com, spots.guru, federation.ffvl.fr, fr.wikipedia.org, verdontourisme.com, rando-alpes-haute-provence.fr, ailements.fr, data.ffvl.fr, geonames.org, overpass-api.de and nominatim.
> - As a result, every aerology finding below comes from **search-engine summaries** of the listed pages, not from the pages themselves. Those summaries are often paraphrased into English, so the original French wording is mostly unavailable. When the summary blended several pages, I note that the attribution is uncertain.
> - Village coordinates in the JSON come from GeoNames (cities500/cities1000, obtained through the npm package `cities-500-structured` and the PyPI package `reverse_geocoder`). Some come from centroids of commune polygons in `gregoiredavid/france-geojson` (GitHub); those are flagged `approx` because they can be several km off.
> - I obtained **no coordinates for any takeoff.** In the JSON these objects carry `lon/lat = null` and `coord_quality: "missing"`.
> - Most of the scope still needs a follow-up pass once search or fetch budget is available. The most important pages to retrieve are the FFVL site sheets, Aérogliss, CHVD, XC Mag site guides and the CDVL 04/06 pages.

## How does the Mediterranean sea breeze penetrate inland in summer afternoons, and where does its front sit (Gréolières? Saint-André? Castellane)? What are its timing and its effect on thermals?

### Takeaway
- **What is sourced: the regional gliding mechanism.**
  - With slack isobars, the sea breeze develops.
  - Its cool marine air suppresses convection over a broad coastal band.
  - The sea-breeze front "often stabilises a few kilometres inland", where it creates a long usable line of thermals.
- **What is not sourced:** the front's actual position relative to Gréolières, Castellane or Saint-André, and its arrival times.
- At Saint-André, the sources only describe a "classic" breeze rising from Lac de Castillon toward the village. It is sometimes pronounced in late afternoon, and it is rarely as strong as near Briançon.

### Cited Findings
- **Regional gliding text** (attribution uncertain between the Sisteron gliding club page and the PBA gliding met course; English paraphrase of a French original). The text explains when and how the sea breeze sets up and where its front stalls:
  - "When isobars are spaced, determining weak surface winds in this region, sea breezes can develop."
  - "This cold air from the sea suppresses all possibility of convection over a wide band parallel to the coast."
  - "During the day, the sea breeze front often stabilizes a few kilometers inland, creating a vast line of thermals that can be used by a glider pilot."
  - Sources: [Vol à voile Sisteron – Des conditions idéales](https://www.volavoile-sisteron.com/des-conditions-ideales); [PBA – Cours théorique : la météo du vol à voile](https://www.pba.asso.fr/le-vol-a-voile/instruction/cours-theorique-la-meteo-du-vol-a-voile)
- **How a sea-breeze front shows itself** (general mechanism, not site-specific):
  - The front between the air masses is marked "soit par des cumulus plus développés, soit au contraire par une éclaircie" (either by more developed cumulus or, on the contrary, by a clearing).
  - Winds converge at the front, and the meeting of marine and continental air explains "cumulus originaux à double base" (unusual double-based cumulus).
  - Sources: [Wikipédia – Régime de brise](https://fr.wikipedia.org/wiki/R%C3%A9gime_de_brise); [Météo-France Guyane – Brise de mer et front de brise](https://meteofrance.gf/fr/actualites/brise-de-mer-et-front-de-brise)
- **Where the lift is relative to the front** (general mechanism):
  - "Le front progresse vers l'arrière-pays (les basses pressions) en soulevant l'air continental, il décolle toutes les bulles thermiques". The front moves inland toward the low pressure, lifting the continental air and releasing every thermal bubble.
  - Together with the confluence, this produces "la ligne d'ascendances située juste derrière le front" (the line of lift just behind the front).
  - Source: [Annecy Mini Voiles – Confluences aérologiques parapente](https://annecyminivoiles.com/confluences-aerologiques-parapente/)
- **Saint-André-les-Alpes** (search summary; it labels this breeze "sea breeze"):
  - "The classic sea breeze rises from the lake toward Saint-André and can be quite pronounced, particularly in late afternoon."
  - "However, they rarely observe strong breezes like those seen near Briançon."
  - Attribution is uncertain: either the Aérogliss landing page or a Swiss school's stage page.
  - Sources: [Aérogliss – Atterrissage : le lac](https://www.aerogliss.com/qui-sommes-nous/le-site-de-saint-andre-les-alpes-2/atterrissages-parapente-saint-andre-les-alpes/); [Les Ailes du Léman – stage St André](https://lesailesduleman.ch/stages/lieu/57-st-andre-les-alpes)
- **Saint-André afternoon landing:** "In full afternoon, this landing area is very thermal and readily triggers thermals." — [Aérogliss – Atterrissages](https://www.aerogliss.com/qui-sommes-nous/le-site-de-saint-andre-les-alpes-2/atterrissages-parapente-saint-andre-les-alpes/)
- **Gréolières:** a Nice school writes "à 45 minutes de Nice, on décolle des crêtes de Gréolières 1800m", with the "mer Méditerranée à l'horizon" (the Mediterranean on the horizon). — [Nice Parapente](https://www.nice-parapente.fr/en/)
  - The search summarizer added that this makes Gréolières ideal for exploiting sea-breeze phenomena. That reads like the summarizer's own inference, not the school's words.
- **Distances to the coast** (computed from GeoNames coordinates; [GeoNames](https://www.geonames.org/)):

  | From | To | Distance | Note |
  |---|---|---|---|
  | Grasse | Cannes | ≈14 km | |
  | Gourdon | Antibes | ≈20 km | Gourdon is a commune centroid (approx) |
  | Gréolières | Antibes | ≈30 km | Gréolières is a commune centroid (approx) |
  | Castellane | Cannes | ≈52 km | |
  | Saint-André-les-Alpes | Cannes | ≈62 km | |

### Inferences
- The sourced statement is that the front "often stabilizes a few kilometers inland". On ordinary days, this points to the front stalling on the **first relief barrier**, roughly Grasse – Gourdon – Vence – Saint-Jeannet, 10–25 km from the shore. It would rarely reach Saint-André, 60 km inland.
  - In the JSON I drew an *indicative* front line Saint-Vallier-de-Thiey → Gourdon → Tourrettes-sur-Loup → Vence → Saint-Jeannet, flagged `confidence: low` / déduction.
- The late-afternoon "brise de mer" that Saint-André pilots report coming up from the lake could be one of several things:
  1. A lake/valley breeze of the Verdon.
  2. Marine air that penetrated far inland late in the day.
  3. Both combined.

  The sources do not settle this. The reported strength (sometimes 25–30 km/h on the SW takeoff in established thermal conditions; see below) does not, by itself, prove marine air.
- Cool marine air suppresses convection, so the regions already invaded by the breeze should have weaker, lower thermals. The best lift should be just inland of the front. This is a generic deduction from the cited mechanism.

### Gaps
- Arrival times of the sea breeze at Gourdon, Gréolières, Col de Bleine, Thorenc, Castellane and Saint-André: no source retrieved.
- Whether the front regularly crosses the Cheiron/Bleine barrier and reaches the Castellane–Saint-André area, and how pilots describe it ("la brise de mer arrive", "air marin", "plafond qui baisse"): not found.
- Var-valley penetration (Nice → Saint-Martin-du-Var → Tinée/Vésubie), and the speed of the breeze at Nice/Saint-Jeannet/Levens: not found.
- Météo-France material on Provence/Côte d'Azur sea breeze: not retrieved.
- XC Mag guides for Saint-André/Gréolières: not retrieved.

## What convergence lines are taught at Saint-André-les-Alpes and in the Préalpes de Grasse (Gréolières, Bleine, Thorenc)?

### Takeaway
- No primary source describing the locally taught convergence lines could be opened.
- The only mention is from an aggregator: a "major convergence" sets up over the Saint-André terrain and gives strong climbs. No location is given.
- No source for the Gréolières/Bleine convergences was retrieved.

### Cited Findings
- **Saint-André (aggregator):** "Saint-André-les-Alpes is famous for its powerful thermals and cross-country potential from April to October. A major convergence set up over the terrain creates massive lift, facilitating long glides with excellent climb rates." — [spots.guru – Parapente Saint-André-les-Alpes](https://www.spots.guru/guides/parapente-saint-andre-les-alpes?locale=en)
- **Saint-André takeoffs (aggregator):** "Flying revolves around two main take-offs (South-East in the morning, South-West from midday) and requires expert mastery of complex valley breezes." — [spots.guru](https://www.spots.guru/guides/parapente-saint-andre-les-alpes?locale=en); possibly [paraglidingmap.com](https://www.paraglidingmap.com/regions/st-andre-les-alpes) (attribution uncertain)
- **Saint-André launch wind (aggregator):** "Wind conditions at launch can be strong, especially later in the day as valley winds build, but once thermic activity settles, smooth evening soaring conditions often persist until sunset." — [spots.guru](https://www.spots.guru/guides/parapente-saint-andre-les-alpes?locale=en) / [paraglidingmap.com](https://www.paraglidingmap.com/regions/st-andre-les-alpes) (attribution uncertain)
- **General convergence mechanism (sea-breeze front):** convergence at the front, double-based cumulus, lift line just behind the front. — [Wikipédia – Régime de brise](https://fr.wikipedia.org/wiki/R%C3%A9gime_de_brise); [Annecy Mini Voiles](https://annecyminivoiles.com/confluences-aerologiques-parapente/)

### Inferences
- Saint-André sits where several flows meet: the Verdon valley, the lake basin to the south, and the Issole/Moriez side to the west. One source speaks of "complex valley breezes", another of a "major convergence". The two fit with breezes from different valley axes meeting over the Chalvet relief. This is a deduction and is not located.
- The JSON therefore contains **no convergence geometry for Saint-André**. Drawing one would require inventing it.

### Gaps
- What the local schools teach (Aérogliss, CHVD club article "Le Chalvet – Saint-André-les-Alpes (04)", [chvd.org](https://www.chvd.org/2024/09/18/le-chalvet-saint-andre-les-alpes-04/)):
  - named convergence lines;
  - their usual times;
  - how they move with the synoptic wind;
  - the "rochers" trigger on the Chalvet.

  The pages were found but blocked by the proxy.
- Gréolières / Col de Bleine / Thorenc / Courmes / Gourdon: no aerology source was retrieved at all. This covers convergence between the sea breeze and the northern/western flow, soaring at Gourdon, and takeoff orientations.

## How does the Mistral (and other synoptic winds) affect flying at Lure, Digne and Saint-André?

### Takeaway
- The only sourced statement is from gliding: at Sisteron, Mistral situations are frequent in autumn and winter and allow wave flights.
- Nothing retrieved describes the Mistral's effect on paragliding at Lure, Digne or Saint-André.
- At Saint-André, the only synoptic-wind advice found is landing-related: by W/NW wind, use the Moriez landing.

### Cited Findings
- **Sisteron gliding and the Mistral:**
  - Mistral situations, "frequent in autumn and winter, allow for beautiful wave soaring flights".
  - The Aéroclub International Sisteron is one of the largest gliding centres in France "thanks to the exceptional aerology of the Alpes de Haute-Provence".
  - Source: [Vol à voile Sisteron – Des conditions idéales](https://www.volavoile-sisteron.com/des-conditions-ideales)
- **Saint-Auban:** the Centre National de Vol à Voile operates 280 days per year with 25 gliders. — [Fréquence Mistral – Avec le CNVV, ça plane pour tous à Saint-Auban](https://www.frequencemistral.com/Avec-le-CNVV-ca-plane-pour-tous-a-Saint-Auban-_a7900.html)
- **Saint-André, Moriez landing:** it is "used by West or North-West wind and is often preferable to the lake landing, which can become turbulent during thermal periods." — [Aérogliss – Site de Saint-André](https://www.aerogliss.com/qui-sommes-nous/le-site-de-saint-andre-les-alpes-2/) (via search summary)

### Inferences
- The existence of Mistral wave around Sisteron/Saint-Auban implies a strong N–NW flow over the Lure/Durance relief, so lee and rotor zones exist downwind of the ridges. Their location and the paragliding thresholds are not documented here. This is a deduction.

### Gaps
- Mistral effects on the Lure south face, on Digne/Cousson, on the Durance venturi (Sisteron cluse) and at Saint-André: not retrieved.
- Wind-strength thresholds used by local pilots: not retrieved.
- Effects of the E/SE marine flows ("retour d'Est"), the Lombarde over the Mercantour, Foehn, and S/SW flows: not retrieved.

## Sector-by-sector documentation (breezes, takeoffs, landings, routes): objective inventory

### Takeaway
- Saint-André/Chalvet is the only sub-sector with sourced, site-specific aerology:
  - two takeoffs (SE in the morning; SW at 1540 m from 11h–midday);
  - breeze of 25–30 km/h in established thermals;
  - lake breeze stronger in late afternoon;
  - thermal and turbulent lake landing;
  - Moriez landing in W/NW wind.
- Every other sub-sector has, at best, generic or tourist information:
  - Haut-Verdon, Digne–Sisteron–Lure, Castellane–Grasse, Nice–Var, Mercantour.
  - In the JSON, their valley breezes are drawn by topographic deduction, with `confidence: low`.

### Cited Findings
- **Saint-André / Chalvet:**
  - Aérogliss has operated "depuis 1982 sur le mythique Chalvet", a site "emblématique des Alpes du Sud" used for training, competitions and World Cup stages. — [Verdon Tourisme – Aérogliss](https://www.verdontourisme.com/offres/aerogliss-ecole-de-parapente-saint-andre-les-alpes-fr-2918549/)
  - SW takeoff: "The South-West takeoff is located at 1540m altitude and is used from 11 AM in breeze conditions; in established thermal conditions, the breeze can reach 25 to 30 km/h" (requires good canopy control). — [Aérogliss – Site de Saint-André](https://www.aerogliss.com/qui-sommes-nous/le-site-de-saint-andre-les-alpes-2/) (via search summary)
  - **Conflict on the summit altitude:**
    - The summit is "nearly 1500 meters" according to the tourist office. — [Castellane-Verdon tourist office](https://www.castellane-verdon.com/en/commerce-service/aerogliss-ecole-de-parapente/)
    - The summit is 1613 m according to the departmental hiking sheet "Sommet de Chalvet (1 613 m)". — [Rando Alpes de Haute-Provence](https://www.rando-alpes-haute-provence.fr/trek/204882-Sommet-de-Chalvet-(1-613-m))
    - The 1540 m SW takeoff is consistent with a summit at 1613 m.
  - Flights pass over Saint-André, Moriez, the Verdon and Lac de Castillon. — [Castellane-Verdon tourist office](https://www.castellane-verdon.com/en/commerce-service/aerogliss-ecole-de-parapente/)
- **Castellane:** "only 2 paragliding sites in Castellane that are confidential, unofficial, and reserved for local pilots". The nearest accessible site is the Chalvet at Saint-André, about 20 min away along Lac de Castillon. — [Aérogliss – Castellane parapente Verdon](https://www.aerogliss.com/infos-pratiques/castellane-parapente-verdon/)
- **Gréolières:** takeoff "des crêtes de Gréolières 1800m", 45 min from Nice. — [Nice Parapente](https://www.nice-parapente.fr/en/)
  - The orientation is not given. The 1800 m figure should be checked against the FFVL sheet.
- **Coordinates used in the JSON**, from GeoNames cities500 (points), e.g.:
  - Saint-André-les-Alpes 6.5078 E / 43.9680 N
  - Allos 6.6286 / 44.2411
  - Castellane 6.5128 / 43.8471
  - Digne-les-Bains 6.2320 / 44.0925
  - Sisteron 5.9464 / 44.1900
  - Saint-Étienne-les-Orgues 5.7799 / 44.0453
  - Isola 7.0529 / 44.1857
  - Saint-Étienne-de-Tinée 6.9250 / 44.2564
  - Saint-Martin-Vésubie 7.2558 / 44.0689
  - Saint-Jeannet (06) 7.1430 / 43.7472
  - Levens 7.2258 / 43.8595
  - Source: [GeoNames](https://www.geonames.org/)
- **Château-Arnoux-Saint-Auban** 5.9942 / 44.0801. — [dr5hn countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database)
- **Approximate centroids of commune polygons**, computed from [france-geojson](https://github.com/gregoiredavid/france-geojson):
  - Moriez 6.4627 / 43.9637
  - Thorame-Haute 6.6009 / 44.0858
  - Beauvezer 6.5978 / 44.1440
  - Colmars 6.6617 / 44.1724
  - Gréolières 6.9322 / 43.8073
  - Gourdon 6.9637 / 43.7242
  - Andon (Thorenc) 6.8232 / 43.7769
  - Saint-Sauveur-sur-Tinée 7.1182 / 44.1213
  - Beuil 6.9722 / 44.1084

  These can be several km from the village or the landing.
- **Straight-line distances** for the requested routes (GeoNames points):
  - Saint-André → Allos ≈ 32 km
  - Saint-André → Gréolières ≈ 38 km (commune centroid)
  - Saint-André → Saint-Étienne-les-Orgues (south foot of Lure) ≈ 59 km
  - Digne → Sisteron ≈ 25 km
  - Source: [GeoNames](https://www.geonames.org/)

### Inferences
- **Valley breezes drawn by deduction in the JSON** (`confidence: low`; direction from the textbook daytime up-valley mechanism, [Ménégoz – Les brises](http://liberiste.com/wp-content/uploads/2019/12/15-parapente-Les-brises.pdf)):
  - Verdon, Saint-André → Thorame-Haute → Beauvezer → Colmars → Allos. This continues the sourced lake breeze "qui remonte du lac vers Saint-André".
  - Durance: Manosque → Oraison → Peyruis → L'Escale → Volonne → Aubignosc → Sisteron.
  - Bléone: Malijai → Mallemoisson → Digne → Le Brusquet.
  - Var: Saint-Laurent-du-Var → Gattières → Le Broc → Saint-Martin-du-Var → Villars-sur-Var → Puget-Théniers → Entrevaux.
  - Tinée: Clans → Saint-Sauveur → Isola → Saint-Étienne-de-Tinée.
  - Vésubie: Utelle → Lantosque → Roquebillière → Saint-Martin-Vésubie.
  - Roya: Breil → Tende.
  - Haut-Var: Puget-Théniers → Guillaumes.
- The SE takeoff in the morning and the SW takeoff from midday at Chalvet match the classic rotation of slope breezes with the sun (east-facing slopes first). This is a deduction.

### Gaps
- **No takeoff coordinates were obtained**, because the FFVL, paraglidingearth and paraglidingmap pages were blocked. This covers:
  - Chalvet SE/SW/N;
  - Digne / Cousson;
  - Sisteron;
  - Lure (south and north takeoffs);
  - Gréolières, Col de Bleine, Thorenc, Gourdon, Courmes;
  - Saint-Jeannet, Levens;
  - Valberg, Auron, Isola, Allos, Colmars, Beauvezer.
- The **Chalvet North takeoff**, the **"les rochers" trigger**, Gourdon soaring, and the Lure ridge: no source retrieved.
- **Classic XC routes:** no description of transitions or reload points was retrieved. They are therefore not in the JSON `xc_routes`:
  - Saint-André–Allos–Ubaye;
  - Saint-André–Lure;
  - Gréolières–Saint-André;
  - Digne–Sisteron;
  - the Lure ridge.
- **Hazards:** none retrieved for:
  - venturis (Durance cluse at Sisteron, Var, Col de Toutes Aures);
  - sea-breeze shear;
  - Lombarde effects in the Tinée/Vésubie;
  - airspace (Nice TMA, Saint-Auban gliding).
- **Suggested follow-up queries:**
  - FFVL site sheets: "Saint-André-les-Alpes Chalvet", "Gréolières", "Gourdon", "Col de Bleine", "Lure", "Digne Cousson", "Valberg".
  - XC Mag site guides: "St André" and "Gréolières".
  - The CHVD Chalvet article.
  - Aérogliss pages on the site and landings (original French).
  - CDVL 04/06 sites pages.
  - Fayence / Saint-Auban gliding met documents ("front de brise", "ligne de convergence", "Mistral onde Lure").
