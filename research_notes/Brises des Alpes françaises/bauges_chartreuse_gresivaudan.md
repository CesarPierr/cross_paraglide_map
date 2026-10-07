# Aérologie parapente — Préalpes de Savoie & sillon du Grésivaudan (Bauges, Bourget/cluse de Chambéry, Combe de Savoie, Chartreuse, Grésivaudan, Belledonne)

> **Read this first: limits on the sources (important for the report writer)**
> - The egress proxy blocked **every direct page fetch** (WebFetch and curl). Domains I tested: airshop-parapente.com, paraglidingearth.com, clubsthilair.fr, clubsthilair.files.wordpress.com, bluehouse.fr, toutleparapente.fr, parapentiste.info, flysainthilaire.com, chartreuse-tourisme.com, alpes-isere.com, frontiersin.org, meetingorganizer.copernicus.org, arxiv.org, fr/en.wikipedia.org, federation.ffvl.fr, voler.info, xcontest.org.
> - The **shared web-search budget ran out** after about 20 queries.
> - So every finding below comes from **search-engine extracts**. These are often paraphrased or translated into English by the engine, so they are not true page reads. Verbatim French appears only where the extract was in French, and is labelled "(extrait FR)". Other French wording is my back-translation, labelled "(reformulé)".
> - **Coordinates in the JSON are recalled Wikipedia/Geonames-type values that I could not re-check. All are flagged `coord_quality: "approx"`**. The one exception is the Saint-Hilaire DMS point, which came from a search extract and is ambiguous (see below). Takeoffs whose position I could not source (Montlambert, Margériaz "Fées", Trélod, Vérel, Prapoutel, Chamrousse, Chalais, Montmélian, Chamoux) were left **out of the JSON markers** and appear only in text.
> - **Key primary document to obtain:** "Surfez le vent dans l'Y grenoblois", *Vol Libre* n°298 (2001). Forum users describe it as a very complete study of the breezes of the Grenoble "Y", with maps for each weather situation ([parapentiste.info thread](https://parapentiste.info/forum/techniques-de-cross/cartographie-des-brises-dans-les-alpes-du-nord-t35042.20.html;wap2=)). Also worth obtaining: the Club St Hil'Air PDF "Cross, massifs et transitions" ([clubsthilair.fr PDF](https://clubsthilair.fr/wp-content/uploads/2018/04/cross_massifs-et-transitions.pdf)) and the PNR Bauges free-flight map ([PDF](https://infos-parapente.com/wp-content/uploads/2021/11/Carte_vol-libre_Bauges_.pdf)).

## Q1 — Which way does the afternoon breeze blow in the Grésivaudan, when, how strong, and why? (is it N→S between Chambéry and Grenoble?)

### Takeaway
**Confirmed.** The afternoon valley breeze in the lower and middle Grésivaudan (Lumbin / Saint-Hilaire landings) blows **from the north (Chambéry → Grenoble)**. It sets in from late morning, strengthens through the day and "rarely exceeds 15 km/h" at Lumbin. A synoptic north wind reinforces it and makes the landing turbulent. The mechanism local pilots describe is the **plain-to-mountain inflow through the Chambéry cluse**. This "énorme brise" (huge breeze) splits at the Montmélian bend into **one branch to the left toward Albertville** (Combe de Savoie, where the breeze is from the S/SW) and **one branch to the right toward Grenoble** (the Grésivaudan, where it is from the N/NE). I found no source for the term "brise de Pontcharra".

### Cited Findings
- **Lumbin landing (Saint-Hilaire), daily cycle (reformulé):** calm or nil early in the morning; in early to mid-morning a slope breeze "tendance Est", generally quite weak; "à partir de la fin de matinée, la brise de vallée s'établit tendance Nord", strengthening through the day but "dépasse rarement 15 km/h" — [Airshop Parapente, topo Saint-Hilaire (search extract)](https://www.airshop-parapente.com/informations-et-topo-sur-le-site-de-parapente-de-saint-hilaire-du-touvet/)
- **"Office de Tourisme" landing (Saint-Hilaire site, reformulé):** the valley breeze is "très souvent tendance Nord" and does not exceed 15 km/h. When a synoptic north wind reinforces the breeze, the landing can become turbulent — [Airshop Parapente topo (search extract)](https://www.airshop-parapente.com/informations-et-topo-sur-le-site-de-parapente-de-saint-hilaire-du-touvet/)
- The Grésivaudan is large and its valley breeze is "pas trop forte", which gives long flying windows. The Saint-Hilaire takeoffs face east, so pilots can take off early in the morning — [Airshop Parapente topo (search extract)](https://www.airshop-parapente.com/informations-et-topo-sur-le-site-de-parapente-de-saint-hilaire-du-touvet/)
- **Mechanism, the split of the Chambéry cluse breeze (extrait FR):** « L'énorme brise de la cluse de Chambéry se divise en deux branches, une tournant à gauche vers Albertville, et une autre à droite vers Grenoble, celle tournant vers Albertville coupe même le virage en passant par dessus la Savoyarde, et déferle derrière Montmélian. » — [CHVD, « Le passage de la Savoyarde » (2020)](https://www.chvd.org/2020/06/22/le-passage-de-la-savoyarde/)
- **Strength (reformulé):** these breezes are "assez fortes en général (25/30 km/h)". The Chambéry breeze is "la plus forte à la pointe sud-ouest des Bauges, par effet Venturi en bout de cluse" — [CHVD (search extract, English-translated)](https://www.chvd.org/2020/06/22/le-passage-de-la-savoyarde/)
- **A forum confirms the direction and corrects published maps:** in the Grésivaudan the breeze is "plutôt orientée Nord", while "juste au-dessus (côté Chamoux par exemple) la brise est Sud". One map was criticised because "le Grésivaudan n'est pas Sud mais Nord" — [parapentiste.info, « cartographie des brises dans les Alpes du nord »](https://www.parapentiste.info/forum/techniques-de-cross/cartographie-des-brises-dans-les-alpes-du-nord-t35042.0.html)
- **Geography that underpins the mechanism:** the Chambéry cluse starts at the north end of the Grésivaudan, crosses the subalpine chains and joins the Rhône near Culoz. It is one of the shortest and widest cluses of the northern Préalpes — [geol-alp, relief des environs de Grenoble](http://www.geol-alp.com/varietes/relief_struct_grenoble.html); [Persée, « Le problème des cluses préalpines : la cluse de Chambéry » (1957)](https://www.persee.fr/doc/rga_0035-1121_1957_num_45_1_1950)
- Breeze maps exist: a compiled Northern Alps breeze map by Franck Largeault (EPIC school, Chambéry) is built from the PNR Bauges, PNR Chartreuse and PN Vercors free-flight maps, the Swiss breeze map and Bugey data — [Rock The Outdoor](https://paragliding.rocktheoutdoor.com/media/carte-brises-alpes-du-nord/). A map compilation is also on [toutleparapente.fr](https://toutleparapente.fr/principales-brises-de-vall%C3%A9es/) (content not accessible).

### Inferences
- The N breeze in the Grésivaudan runs in the **downstream direction of the Isère** (NE → SW). It is not a classic up-valley breeze rising from Grenoble. The low, wide Chambéry cluse brings air from the Lac du Bourget / Avant-Pays plain into the Alpine furrow. Once in the Grésivaudan, that air moves toward the Grenoble basin and then on toward the large heated sinks to the south (Drac, Romanche). This is consistent with the CHVD branch "à droite vers Grenoble" and with the observed "tendance Nord" at Lumbin (inference, combining [CHVD](https://www.chvd.org/2020/06/22/le-passage-de-la-savoyarde/) and [Airshop](https://www.airshop-parapente.com/informations-et-topo-sur-le-site-de-parapente-de-saint-hilaire-du-touvet/)).
- "Juste au-dessus la brise est Sud (côté Chamoux)" can be read two ways. It may mean (a) upstream, in the Combe de Savoie, the breeze is S/SW toward Albertville, which matches the CHVD "left branch". Or it may mean (b) a vertical shear: N at low level, S above. Reading (a) is more consistent with CHVD. The **divergence/split zone would then sit near Montmélian**, at the outlet of the Chambéry cluse and the SW tip of the Bauges, rather than a "convergence de Pontcharra".
- The speed difference between the sources is explained by location. The 25–30 km/h figure applies to the cluse jet and its Venturi at the SW tip of the Bauges. The ≤15 km/h figure applies at Lumbin, about 30 km downstream, where the Grésivaudan is wide.

### Gaps
- No source found for the term "**brise de Pontcharra**", for a documented convergence at Pontcharra, or for the exact time at which the N breeze reaches each Grésivaudan village (Pontcharra, Le Touvet, Crolles, Le Versoud).
- No Météo-France or Le Versoud aerodrome (LFLG) wind-rose data could be retrieved to confirm the climatology.
- I could not check whether a weak SW up-valley breeze exists in the upper Grésivaudan (Pontcharra–Montmélian) in some situations, for example when the Chambéry inflow is weak.

## Q2 — How do breezes enter Grenoble through the Voreppe cluse, and how do they split toward the Grésivaudan and the Drac?

### Takeaway
The Voreppe cluse (Isère downstream of Grenoble) carries a **"brise de nord / nord-ouest qui remonte la vallée"** toward Grenoble. It appears from late morning or midday, is "forte en été" and "forcit assez fortement". Daytime NW predominance at Grenoble is attributed to a valley-breeze effect. **I found no source describing how this flow splits at Grenoble.** Because the Grésivaudan breeze is itself from the north and flows *into* Grenoble, the Voreppe flow very probably does **not** go up the Grésivaudan in the standard summer regime. It most likely joins the Grésivaudan flow over Grenoble and continues south (Drac/Romanche). This last point is an inference.

### Cited Findings
- FFVL site sheet, Chalais (Voreppe), reformulé: south-facing site with a valley-floor landing that is "soumis à un régime de brise (souvent forte)". The site is "protégé de la brise de nord qui remonte la vallée et apparaît en fin de matinée (forte en été)" — [FFVL terrain CHALAIS n°324](https://federation.ffvl.fr/terrain/324); [Chartreuse Tourisme, Chalais FFVL site](https://www.chartreuse-tourisme.com/en/offers/chalais-ffvl-paragliding-site-voreppe-en-2716746/)
- FFVL site sheet, Chalais – Voreppe Rivalières, reformulé: "une brise de nord peut apparaître à la mi-journée et forcir assez fortement" — [FFVL terrain n°325](https://federation.ffvl.fr/terrain/325)
- Grenoble, reformulé: "la prédominance des vents de nord-ouest en journée s'explique par un effet de brise de vallée". In winter, the strong NW winds accelerate and cool through the Voreppe cluse, then expand over Grenoble ("effet canon à neige") — [Guichet du Savoir, « Vent violent à Grenoble »](https://www.guichetdusavoir.org/question/voir/31121). Note: the extract places the Voreppe cluse "au nord-est de Grenoble", which is wrong; it is to the NW.
- At Grenoble the Isère leaves the wide Grésivaudan, turns sharply and enters a narrow cluse between the Chartreuse and Vercors cliffs — [Persée, « La Cluse de l'Isère » (1913)](https://www.persee.fr/doc/rga_0249-6178_1913_num_1_3_5495)
- Winter / stable regime (academic): during persistent inversions, simulated boundary-layer dynamics in the Grenoble valleys result from "thermal winds flowing from the higher altitude valleys which surround Grenoble". The same flow pattern recurs from episode to episode and depends only on the geometry of the terrain once the inversion is strong enough — [Largeron & Staquet 2016, *Frontiers in Earth Science* 4:70 (search extract)](https://www.frontiersin.org/journals/earth-science/articles/10.3389/feart.2016.00070/epub)
- There is a forum thread "où voler par vent de Nord autour de Grenoble ?" (content not retrievable) — [parapentiste.info](https://www.parapentiste.info/forum/meteo-aerologie/ou-voler-par-vent-de-nord-autour-de-grenoble-t5840.0.html)

### Inferences
- In summer daytime, two inflows enter the Grenoble basin: the NW Voreppe inflow and the N/NE Grésivaudan inflow (Chambéry branch). Their likely meeting and merging zone is **over Grenoble / the Isère–Drac confluence**, with the combined flow then heading up the Drac and Romanche (south). This is a low-confidence deduction that another researcher's Drac/Vercors notes should check.
- The Voreppe breeze is "souvent forte" at Chalais. That puts it among the stronger Grenoble-area breezes, in line with a narrow cluse fed directly by the plain (Voiron / Bas-Dauphiné).

### Gaps
- I found no source on the split of the Voreppe inflow between the Grésivaudan and the Drac, its timing at the Grenoble city centre, or its strength in km/h.
- The *Vol Libre* n°298 (2001) article "Surfez le vent dans l'Y grenoblois" very probably answers this question and should be consulted.

## Q3 — Where are the documented convergence lines, and when?

### Takeaway
The only explicitly documented convergence is the **"secteur de la Savoyarde"** at the SW tip of the Bauges, above Montmélian. There, the Albertville-bound branch of the Chambéry cluse breeze, which cuts the corner over the Savoyarde, meets narrower breeze tongues coming from Annecy and flowing south down the Bauges inner valleys. The area brings strong wind, turbulence and a dangerous lee "derrière Montmélian". The PNR Bauges free-flight map has a "confluences" symbol, but I could not read its content. I found no documented source for a Grésivaudan, Chartreuse or Pontcharra convergence line.

### Cited Findings
- Savoyarde convergence (reformulé from the extract): besides the Chambéry cluse breeze and its two branches, there are « des langues de brise plus étroites venant d'Annecy et descendant les vallées intérieures des Bauges vers le sud ; ces deux [systèmes] convergent dans le secteur de la Savoyarde » — [CHVD, « Le passage de la Savoyarde »](https://www.chvd.org/2020/06/22/le-passage-de-la-savoyarde/)
- The passage de la Savoyarde is the key transition from the Chartreuse toward the Bauges. It is long (10 km) and difficult, with "vent fort et turbulences attendus à la Savoyarde" — [CHVD](https://www.chvd.org/2020/06/22/le-passage-de-la-savoyarde/)
- Lee hazard (reformulé): "La zone sous le vent de la brise de Chambéry, au-dessus de Montmélian, est très dangereuse (plusieurs morts dans les années 90)" — [CHVD (search extract)](https://www.chvd.org/2020/06/22/le-passage-de-la-savoyarde/)
- The PNR Bauges free-flight map legend includes paraglider/hang-glider takeoffs, landings, thermals, weather stations ("balises"), dynamic lift, "brises de vallées" and "confluences" — [PNR Bauges, Carte vol libre (PDF)](https://infos-parapente.com/wp-content/uploads/2021/11/Carte_vol-libre_Bauges_.pdf)

### Inferences
- The Savoyarde convergence forms once the cluse inflow is established. Because the N breeze appears at Lumbin from late morning, the Savoyarde sector is probably active from late morning or early afternoon (deduction).
- By analogy with the CHVD description, a likely convergence or merge zone sits over the Grenoble basin, where the Voreppe and Grésivaudan inflows meet (deduction, unsourced).
- The split of the Chambéry inflow at Montmélian is a **divergence**, not a convergence. Pilots should expect the strongest flow and lee effects there (Venturi at the Bauges tip, lee behind Montmélian), not a convergence lift line.

### Gaps
- I found no source for convergences over the Chartreuse (for example the Charmant Som–Chamechaude line), over the Bauges plateaus (Revard–Margériaz), or along the Belledonne balcony.
- I found no source for a "convergence de Pontcharra".

## Q4 — What happens on the Chartreuse plateaus and high valleys (Saint-Pierre-de-Chartreuse, Désert d'Entremont)?

### Takeaway
**I found no source.** None of my searches returned material on the breeze regimes of the Chartreuse inner valleys or plateaus (Saint-Pierre-de-Chartreuse, Col de Porte, Le Sappey, Désert d'Entremont, Charmant Som). The only Chartreuse-specific aerology I found is on the **east face (Saint-Hilaire)**: a weak E slope breeze in the morning, and early thermals because the takeoffs face east.

### Cited Findings
- The Saint-Hilaire takeoffs (Sud and Nord, Plateau des Petites Roches, about 1000 m) face east, so pilots can take off early. Depending on conditions and the formula, takeoffs run from 800 m to 2,200 m — [Airshop topo (search extract)](https://www.airshop-parapente.com/informations-et-topo-sur-le-site-de-parapente-de-saint-hilaire-du-touvet/); [Chartreuse Tourisme, Décollage Sud](https://www.chartreuse-tourisme.com/en/touristic_sheet/decollage-sud-plateau-des-petites-roches-en-2716860); [Décollage Nord](https://www.chartreuse-tourisme.com/en/touristic_sheet/decollage-nord-plateau-des-petites-roches-en-2717525)
- A search extract gave the coordinates "045°18'41" N – 005°53'22" E" (≈ 45.3114 N, 5.8894 E), labelled as "atterrissage" for the Saint-Hilaire site. Exactly which result page this came from is uncertain ([Manawa, stage Saint-Hilaire](https://www.manawa.com/fr-FR/activite/france/grenoble/parapente/stage-2-jours-vol-solo-en-parapente-a-saint-hilaire-du-touvet-pres-de-grenoble/17479) / Chartreuse Tourisme sheets). **Caution:** this point lies at plateau level, near the Saint-Hilaire takeoffs, not on the Lumbin valley floor. The label is therefore doubtful.
- Mont Granier was flown as a hike-and-fly flight in SW wind with "thermiques variables". The Granier cliffs face Chambéry and the Lac du Bourget — [carnetdevol.largeault.net, Vol rando 105 (vol 211) Le Granier, 10/08/2020](https://carnetdevol.largeault.net/2020/08/10/vol-rando-105-vol-211-le-granier/)

### Inferences
- From the general physics only (deduction, low confidence): high valleys closed by cols, such as Saint-Pierre-de-Chartreuse (Col de Porte, Col du Cucheron) and the Désert d'Entremont (Col du Granier), should mostly carry their own up-valley breezes toward their heads and cols in the afternoon, sheltered from the big Voreppe and Chambéry inflows. This needs a local source.

### Gaps
- Everything on the Chartreuse plateaus and high valleys, the Charmant Som / Chamechaude / Col de Porte breezes, and the triggers along the Bec Margain / Dent de Crolles cliff line. The Club St Hil'Air PDF ([link](https://clubsthilair.fr/wp-content/uploads/2018/04/cross_massifs-et-transitions.pdf)) and *Vol Libre* n°298 are the probable primary sources.

## Q5 (objective) — Inventory by sub-sector: takeoffs, triggers, synoptic effects, cross routes and transitions

### Takeaway
The material is solid for the **cluse de Chambéry / Combe de Savoie / Grésivaudan** breeze system (CHVD, Airshop topo, parapentiste forum, FFVL Chalais). It is thin for site-level detail in the Bauges, Bourget and Belledonne, because the primary pages could not be read. The cross transitions that are documented are the **passage de la Savoyarde** (Chartreuse → Bauges, 10 km) and the **traversée du Grésivaudan** (Chartreuse → Belledonne, about 10 km; leave the Chartreuse side above 2,200 m and read the valley breeze below).

### Cited Findings
**Lac du Bourget / cluse de Chambéry / Avant-Pays**
- From a commercial school page (marketing tone, medium-low reliability): the Chambéry cluse acts as "un couloir thermique naturel", with exploitable thermals "dès le milieu de matinée". In summer, "une légère brise fraîche monte du lac du Bourget en fin d'après-midi" and makes conditions more regular — [Bauges Parapente, parapente Chambéry](https://www.bauges-parapente.com/parapente-chambery/)
- Vérel-Pragondran is the Chambéry takeoff used by the Z'éléphants Volants club. I found no aerology for it — [Zeleph, Vérel-Pragondran](https://www.zeleph.com/nos-sites/verel-pragondran/); [Chambéry Montagnes, aire de décollage de Vérel](https://www.chamberymontagnes.com/fiche/aire-de-decollage-de-verel/)
- Franck Largeault's logbook (EPIC Chambéry) records "Petit tour des Bauges" flights from Vérel — [Vol 162, 01/06/2020](https://carnetdevol.largeault.net/2020/06/01/vol-162-petit-tour-des-bauges/); [Vol 186](https://carnetdevol.largeault.net/2020/07/04/vol-186-petit-tour-des-bauges/)
- I found no material on Mont du Chat, Dent du Chat or Mont de l'Épine.

**Bauges**
- The road-accessible takeoffs are the Semnoz and the new "Fées" takeoff at Margériaz. In the Bauges national hunting and wildlife reserve, flying below 300 m is prohibited except in 4 authorised flight zones and at 3 takeoffs on the Trélod — [PNR Bauges map (PDF)](https://infos-parapente.com/wp-content/uploads/2021/11/Carte_vol-libre_Bauges_.pdf); [CDVL Savoie, Parc des Bauges](https://www.cdvl-savoie.fr/voler-avec-les-rapaces/parc-des-bauges/)
- Mont Revard is a free-flight site (paragliding, hang-gliding, speed-flying) — [Chambéry Montagnes, Revard](https://www.chamberymontagnes.com/en/fiche/revard-free-flight-site/)

**Combe de Savoie**
- Montlambert (extrait FR): « Le décollage de Montlambert orienté au sud-est offre surtout des conditions de vol le matin jusqu'en début d'après-midi, car en fin d'après-midi, la brise redescend du sommet. » It is reached from Montmélian by the D201 toward Saint-Pierre-d'Albigny — [Cœur de Savoie Tourisme, décollage Montlambert](https://tourisme.coeurdesavoie.fr/fiches/decollage-de-parapente-montlambert-260800/); [Les Indiens de Montlamb'air](https://www.montlambair.org/site-montlambert/)
- The left (Albertville) branch of the Chambéry breeze "déferle derrière Montmélian" — [CHVD](https://www.chvd.org/2020/06/22/le-passage-de-la-savoyarde/). The Combe breeze is "Sud" on the Chamoux side — [parapentiste.info](https://www.parapentiste.info/forum/techniques-de-cross/cartographie-des-brises-dans-les-alpes-du-nord-t35042.0.html)

**Chartreuse / Grésivaudan**
- Club St Hil'Air, founded in 1974 on the Plateau des Petites Roches, has more than 200 pilots — [Mairie du Plateau des Petites Roches, annuaire](https://www.petites-roches.org/vivre-sur-le-plateau/annuaire-plateau-pratique/club-st-hilair/)
- **Grésivaudan crossing (reformulé):** the crossing toward Belledonne "via Saint-Genis" (name as given in the extract, unverified) is the most direct move east. It means about 10 km across the Grésivaudan, leaving the Chartreuse side cleanly "au-dessus de 2200 m" and reading the valley breeze well below. The transition points named are "l'Aulp du Seuil", "St Genis" and the "Col du Barioz" — [Club St Hil'Air, « Cross, massifs et transitions » (PDF, search extract)](https://clubsthilair.fr/wp-content/uploads/2018/04/cross_massifs-et-transitions.pdf); [Fly Saint-Hilaire, cross-country](https://flysainthilaire.com/cross-country/)
- Saint-Hilaire is a major cross-country departure, with flights through the heart of the Chartreuse and possible transitions to the Vercors, Bauges and Belledonne — [Club St Hil'Air PDF (search extract)](https://clubsthilair.fr/wp-content/uploads/2018/04/cross_massifs-et-transitions.pdf)
- A "Grand tour du Bocal" (Grenoble-basin loop) is documented by the club (content not readable) — [Club St Hil'Air, 20/04/2018](https://clubsthilair.fr/2018/04/20/premier-grand-tour-du-bocal-par-matmute/). A 201 km flight linked the Vercors, Chartreuse, Bauges and Bornes — [bluehouse.fr JB6, 26/04/2024](https://www.bluehouse.fr/JB6/carnet-de-vol/2024/04/26/201-km/)

**Belledonne**
- From a commercial page (attribution uncertain, low reliability): "les pentes orientées ouest génèrent dès le printemps des thermiques puissants et réguliers" and "les crêtes produisent des ascendances dynamiques" — [Là-Haut Parapente, baptême face à Belledonne](https://www.lahautparapente.com/vol-bapteme-parapente-belledonne)
- I found no source on Prapoutel / Les Sept Laux, Chamrousse, Col du Barioz, Allevard or Saint-Mury takeoffs and their breezes.

**Synoptic effects**
- N / Bise: reinforces the Grésivaudan N breeze, and the Saint-Hilaire valley landings become turbulent — [Airshop topo](https://www.airshop-parapente.com/informations-et-topo-sur-le-site-de-parapente-de-saint-hilaire-du-touvet/)
- NW (winter): strong cold NW winds accelerate through the Voreppe cluse into Grenoble — [Guichet du Savoir](https://www.guichetdusavoir.org/question/voir/31121)
- SW: Granier flown in SW wind with variable thermals — [carnetdevol Largeault](https://carnetdevol.largeault.net/2020/08/10/vol-rando-105-vol-211-le-granier/)

### Inferences
- **For cross-country flying:** the Chambéry cluse is the hardest transition in the sector. A strong, low-level, partly Venturi inflow (25–30 km/h) runs across the track, with a documented fatal lee above Montmélian. The usual advice that follows (deduction) is to cross high and early, before the jet is fully set, and to avoid ending up low downwind of the Bauges tip.
- The Grésivaudan crossing is easier on the breeze side, since the breeze is ≤15 km/h at mid-valley. Because it blows from the N, a glide eastward from Saint-Hilaire drifts toward Grenoble, so pilots should aim upwind (north) of the target on the Belledonne side (deduction).

### Gaps
- Precise takeoff and landing coordinates and site aerology for Montmélian, Chamoux, Montlambert, Revard, Margériaz, Nivolet, Arclusaz, Trélod, Mont du Chat, Dent du Chat, Épine, Granier, Prapoutel, Chamrousse, Col du Barioz, Allevard and Saint-Mury. The FFVL and paraglidingearth pages were inaccessible.
- How Foehn, a S/SW flow or a W flow modifies the system. The thermal triggers of the Chartreuse cliffs (Bec Margain, Dent de Crolles) and of the Belledonne balcony. Coupe Icare documentation. Météo-France or academic summer data for the Grésivaudan. None of these could be retrieved.
