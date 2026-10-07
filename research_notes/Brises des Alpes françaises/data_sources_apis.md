# Open data sources & web APIs for a static (GitHub Pages) 3D paragliding map of the French Alps — exact endpoints, keys, CORS, licences (state Oct 2026)

Research conditions (read this first): in this session the egress proxy blocked direct WebFetch/curl to almost every official domain (thermal.kk7.ch, open-meteo.com, data.ffvl.fr, pioupiou.fr, paraglidingearth.com, geoservices.ign.fr / data.geopf.fr, arcgisonline, opentopomap, openfreemap, maptiler, geo.admin.ch, openaip, holfuy, winds.mobi, data.gouv.fr). The shared WebSearch budget ran out after 6 searches. Verification therefore relies on:
(a) the official source repositories on GitHub (Open-Meteo website + server, Mapterhorn, OpenFreeMap, Tilezen/joerd, AWS Open Data Registry, planeur-net/FFVP airspace, winds.mobi API), read through raw.githubusercontent.com;
(b) open-source applications that call these APIs (exact URL templates, attribution strings, notes on keys and proxies), cited with commit-pinned links;
(c) search-engine extracts of official pages (kk7, Open-Meteo, Pioupiou, FFVL, IGN), marked "(search extract)";
(d) direct CORS tests (curl with an `Origin:` header) from this environment on 2026-10-07, done only where egress was allowed (AWS S3 and raw.githubusercontent.com).
A CORS claim based only on inference is marked as such.

Worked example coordinates used below: Annecy (45.90 N, 6.13 E) = XYZ tile z10 x=529 y=364 (TMS y=659) and z12 x=2117 y=1458 (TMS y=2637). I computed these with the standard Web-Mercator formula.

---

## Q1. Thermal / skyways data (thermal.kk7.ch, XContest-derived): exact tile templates, `src` parameter, hotspot downloads, third-party policy

### Takeaway
kk7 publishes raster tiles at `https://thermal.kk7.ch/tiles/{layer}/{z}/{x}/{y}.png?src={your-hostname}`. They use the TMS y-axis, so MapLibre needs `scheme: "tms"`. The licence is **CC BY-NC-SA 4.0**. Every request must carry `src=<your domain>`, and anyone putting the tiles on their own map server must contact the author about the expected load. A bounding-box hotspot API, `/api/hotspots/{csv|gpx|cup|geojson}/{season}/{S},{W},{N},{E}`, lets you download a French Alps hotspot list. A free, non-commercial, open-source app may use both with attribution. Browser CORS for kk7 is **not verified**: the evidence conflicts.

### Cited Findings
- Licence: "The Paragliding Thermal Maps Project by M. von Känel is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License." — [thermal.kk7.ch (search extract)](https://thermal.kk7.ch/)
- Mandatory `src` parameter: "For tracking purposes every remote request has to append an additional &src=[hostname] URL parameter. For web-based GIS tools, pass the domain-name as the src-parameter." — [thermal.kk7.ch (search extract)](https://thermal.kk7.ch/)
- Policy for third parties: "If you plan on including thermal tiles into your own map server, contact the developer directly with your expected load." The tiles are non-commercial only (NC clause). — [thermal.kk7.ch (search extract)](https://thermal.kk7.ch/)
- One open-source project shows this attribution while the layer is on: "Termikk: thermal.kk7.ch (CC BY-NC-SA 4.0)", and it sends its domain as `src` as the terms require. — [hpgt-com/flying-sites PR #15 (search extract)](https://github.com/hpgt-com/flying-sites/pull/15)
- Canonical template in flyXC (web, by the XCTrack/flyXC ecosystem): `'https://thermal.kk7.ch/tiles/{layer}/{z}/{x}/{y}.png?src={domain}'`, with `{domain}` = `window.location.hostname`. Max zoom is 13 for skyways and 12 for thermals. Months are `all, jan, apr, jul, oct`. Time-of-day values are `all, 04 (Morning), 07 (Midday), 10 (Evening)`. Layers are `skyways`, `thermals`. — [vicb/flyXC skyways-slice.ts](https://github.com/vicb/flyXC/blob/afdd65ff3e03a1bda35d8b9835fee7c58d20e781/apps/fxc-front/src/app/redux/skyways-slice.ts)
- Layer names follow `{skyways|thermals}_{month}_{tod}`. Examples seen in use: `skyways_all_all` and `thermals_jul_07` ([XCMaps kk7thermals.js](https://github.com/XCmaps/XCMaps/blob/22083414a2c7d9cef6144e19f0bb03dd1c4901b9/src/api/kk7thermals.js)), `thermals_all_all` ([nevbie/aeric map_screen.dart](https://github.com/nevbie/aeric/blob/206697deb299edd56eb6752f9e5d91c400e70e32/lib/ui/map_screen.dart)), `skyways_jul_07` ([dorvak.github.io summit_2d.html](https://github.com/dorvak/dorvak.github.io/blob/9c86ae198e758d91f5d3c4e6c67bcc6df9c71b08/content/summit_2d.html)).
- TMS y-scheme:
  - Logfly-web (Leaflet) uses `tms: true` and `maxNativeZoom: 13`, with attribution `'thermal.kk7.ch <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC-BY-NC-SA</a>'` and `src=logfly.app`. — [giloutho/Logfly-web tiles.js](https://github.com/giloutho/Logfly-web/blob/dc32c1696a95bd4259ac305c0c23044899a015b9/src/js/leaflet/tiles.js)
  - A MapLibre implementation adds a raster source with `tiles: ["https://thermal.kk7.ch/tiles/skyways_all_all/{z}/{x}/{y}.png"]`, `scheme: "tms"`, `maxzoom: 14`, `attribution: "thermal.kk7.ch"`. Its comment reads: "`{-y}` in the URL means TMS y-scheme; MapLibre's `scheme: "tms"` on the source handles the flip". — [ruben-hutter/flightmap main.ts](https://github.com/ruben-hutter/flightmap/blob/09aba3d5a5435ec56aa21782da8bc3a538243608/web/src/main.ts)
  - WhereToFly (Cesium) uses `{reverseY}` and the credit "Skyways © thermal.kk7.ch". — [vividos/WhereToFly mapLayerManager.js](https://github.com/vividos/WhereToFly/blob/bb176971bd31aa2000aa04628b1bb8644513782a/src/Shared/WebLib/src/js/mapLayerManager.js)
- Data origin: the tiles are "Historical thermal maps from thermal.kk7.ch, computed from XContest flights (non-commercial use)" ([nevbie/aeric](https://github.com/nevbie/aeric/blob/206697deb299edd56eb6752f9e5d91c400e70e32/lib/ui/map_screen.dart)). kk7 "is *not* open source and its data is aggregated/anonymised across *all* pilots" ([flightmap PLAN.md](https://github.com/ruben-hutter/flightmap/blob/09aba3d5a5435ec56aa21782da8bc3a538243608/PLAN.md)).
- Hotspot API (bounding box in the order `{minLat},{minLon},{maxLat},{maxLon}`):
  - Tern lists `https://thermal.kk7.ch/api/hotspots/cup/all_all/36.862,-112.819,41.295,-96.668`, `.../api/hotspots/csv/all_all/...` and `.../api/hotspots/gpx/all_all/...`. — [raghumad/Tern RoutePlannerModel.swift](https://github.com/raghumad/Tern/blob/02ac89874b4619efe74ad86e8f119b6f953d32a2/Tern/Models/RoutePlannerModel.swift)
  - A GeoJSON variant with a limit parameter, fetched directly from a browser page: `` `https://thermal.kk7.ch/api/hotspots/geojson/all_all/${bbox.southLat},${bbox.westLon},${bbox.northLat},${bbox.eastLon}?limit=${limit}` `` — [erikvoorbraak/oziexplorer-hotspots index.html](https://github.com/erikvoorbraak/oziexplorer-hotspots/blob/c0624e57754dc43c91ab55bc33444008963c9c32/index.html)
  - A script downloads Switzerland in one request (`.../api/hotspots/csv/all_all/45.659...,5.835...,47.869...,11.0`). The rows hold lat, lon, altitude and a probability percentage, e.g. `46.63365,7.64855,1750,96`. — [oli4wolf/swisstopo-tile-downloader thermikDownloader.py](https://github.com/oli4wolf/swisstopo-tile-downloader/blob/83369bea6252a482e9d0e11407d0be0a4286b222/download-scripts/thermikDownloader.py)
  - A search result is titled "Kk7" at `https://thermal.kk7.ch/api/kml`, which suggests a KML endpoint too. — [search result](https://thermal.kk7.ch/api/kml)
  - One app caches hotspots for 360 days, with the comment: "hotspots are a climatology, they barely change". — [raghumad/Tern ThermalHotspotService.kt](https://github.com/raghumad/Tern/blob/02ac89874b4619efe74ad86e8f119b6f953d32a2/tern-android/app/src/main/kotlin/com/ternparagliding/utils/geo/ThermalHotspotService.kt)
- CORS evidence conflicts:
  - One Next.js app fetches tiles "through our proxy to avoid CORS issues" (it reads pixels). — [lgkeroack/Airplan2 AirspaceCylinder.tsx](https://github.com/lgkeroack/Airplan2/blob/b401eaffcb69e2fd6986ba9f640eedda0d9c3d26/app/components/AirspaceCylinder.tsx)
  - XCMaps proxies the tiles server-side. — [XCMaps kk7skyways.js](https://github.com/XCmaps/XCMaps/blob/22083414a2c7d9cef6144e19f0bb03dd1c4901b9/src/api/kk7skyways.js)
  - Against that, flightmap loads the tiles directly as a MapLibre raster source, and oziexplorer-hotspots calls `fetch()` on the hotspot API from client-side JS (links above).

### Inferences
- Concrete tile examples for Annecy, with the `src` parameter set to our GitHub Pages hostname:
  - `https://thermal.kk7.ch/tiles/skyways_all_all/10/529/659.png?src=<user>.github.io`
  - `https://thermal.kk7.ch/tiles/thermals_jul_07/12/2117/2637.png?src=<user>.github.io`
  The y values are TMS-flipped: 2^z − 1 − y.
- French Alps hotspot download, one request covering roughly the Alps from Nice to Lake Geneva: `https://thermal.kk7.ch/api/hotspots/csv/all_all/43.6,5.0,46.5,7.8?src=<user>.github.io` (or `/geojson/...`). Because the ShareAlike clause applies, a committed copy should be credited and redistributed under CC BY-NC-SA 4.0. This does not affect the app's code licence.
- Safest static-site design: pre-download the hotspot GeoJSON at build time (GitHub Action), since the CORS behaviour is unknown and the data barely changes. Show the tiles as a plain raster overlay. If MapLibre fails on CORS, a fallback is needed, such as a DOM/`<img>` overlay or not using kk7 tiles in WebGL.
- XContest: kk7 is effectively the only open-ish product derived from XContest flights. I found no public XContest data API.

### Gaps
- kk7's `Access-Control-Allow-Origin` header could not be tested (egress blocked). It must be tested from a browser before relying on MapLibre raster loading.
- I found no published rate limit for kk7. The full kk7 terms page and the exact KML endpoint syntax were not read directly.
- XContest / XCTrack terms and APIs could not be researched (search budget exhausted).

---

## Q2. Paragliding sites (FFVL, ParaglidingEarth, OpenStreetMap, DHV)

### Takeaway
- **FFVL** has the authoritative French sites (terrains), but its API needs a key. The key is obtained from the FFVL by request and cannot be exposed in a static site. The legacy keyless JSON feeds now return a "key required" notice.
- **ParaglidingEarth** (PGE) has a keyless GeoJSON API with bbox, around-point and country queries. Its licence is ambiguous (CC BY-SA 3.0 on the old API page), and browser CORS appears unavailable, so a build-time download is the way to use it.
- **OSM via Overpass** (ODbL) is keyless and well-tagged (`free_flying:*`). The public instance has shared quotas.
- **DHV** covers only Germany, Austria and Switzerland.

### Cited Findings
- FFVL API scope: the FFVL "publishes an Open Data API that allows third-party applications to use … list and location of FFVL weather stations, readings from these weather stations, list of practice sites registered with the FFVL, and list of structures (clubs and schools)". Usage conditions are in the wiki at https://data.ffvl.fr/pmwiki/. — [balisemeteo.com news / data.gouv.fr dataset (search extract)](https://www.data.gouv.fr/datasets/reseau-de-balises-et-donnees-meteo-de-la-ffvl)
- FFVL endpoints as used in code:
  - Sites: `https://data.ffvl.fr/api?base=terrains&mode=json&key=<KEY>`. — [spasutto/logfly-web tracklogmanager.php](https://github.com/spasutto/logfly-web/blob/57d3e5c09deacf69e4224e9d559f6998529c767c/src/tracklogmanager.php)
  - Beacon list: `https://data.ffvl.fr/api/?base=balises&r=list&mode=json&key=<KEY>`. — [spasutto/logfly-web wind.php](https://github.com/spasutto/logfly-web/blob/57d3e5c09deacf69e4224e9d559f6998529c767c/src/wind.php)
  - Readings: `https://data.ffvl.fr/api/?base=balises&r=releves_meteo&key=<KEY>`. — [winds-mobi-providers ffvl.py](https://github.com/winds-mobi/winds-mobi-providers/blob/4b46e94135c3cb7382562379a3e930a6ded9e0b5/providers/ffvl.py)
- Key access: `data.ffvl.fr` requires a key obtained by application to `informatique@ffvl.fr`. "New requests have been suspended at times". FFVL licence "terms unknown", and the key request asks for them. A weather-beacon key is "a different credential" from the sites bulk file. — [Kevin-McIsaac/paragliding_site_federation README](https://github.com/Kevin-McIsaac/paragliding_site_federation/blob/7b9c642d76bad97f0804323099d9fd48950afe49/README.md)
- Legacy feeds: "On 2026-09-13, both URLs [`https://data.ffvl.fr/json/balises.json` and `https://data.ffvl.fr/json/relevesmeteo.json`] returned a notice requiring an FFVL API key instead of JSON feed data, despite an HTTP 200 response." — [benkuper/flywindow DATA_SOURCES.md](https://github.com/benkuper/flywindow/blob/97954193f22cdebb7b593109dca438e19de0531d/docs/DATA_SOURCES.md)
- ParaglidingEarth endpoints (no key):
  - `https://www.paraglidingearth.com/api/geojson/getCountrySites.php?iso=fr&style=detailled`. — [tristan0x/alpinequest-contrib landmarks README](https://github.com/tristan0x/alpinequest-contrib/blob/33f0fa52aa6c2877d5b00d893826ab411f6effb6/landmarks/README.md)
  - `http://www.paraglidingearth.com/api/geojson/getBoundingBoxSites.php?north=90&south=-90&west=-180&east=180`. — [Kevin-McIsaac/the_paragliding_app fetch_pge_sites.sh](https://github.com/Kevin-McIsaac/the_paragliding_app/blob/3e0283767116d3e4f507f82994476c52f7d057ff/bin/fetch_pge_sites.sh)
  - `.../api/geojson/getAroundLatLngSites.php?lat=..&lng=..&distance=..&limit=..&style=detailled`. — [rupeshdabbir/Paragliding-agent getSites.js](https://github.com/rupeshdabbir/Paragliding-agent/blob/8c94ccecc91d589d6260837fba05b855c60d0d6d/server/tools/getSites.js)
- PGE content: per-direction wind suitability (N…NW, 0/1/2), takeoff_altitude, landing_lat/lng, flight_rules and flags (thermals/soaring/xc), plus a stable `pge_site_id`. The source code is at framagit.org/raph-tr/paraglidingearth. — [vfosnar/osm-research paraglidingearth-cz.md](https://github.com/vfosnar/osm-research/blob/2264b8809184d02543674aa3cd5c6b691a010705/candidates/paraglidingearth-cz.md)
- PGE licence: "The older API page names CC BY-SA 3.0. The main site describes different database licensing for newer contributions. Confirm the licence of the chosen export…" — [benkuper/flywindow DATA_SOURCES.md](https://github.com/benkuper/flywindow/blob/97954193f22cdebb7b593109dca438e19de0531d/docs/DATA_SOURCES.md)
- PGE CORS hint: a browser app routes PGE through its own proxy (`'/api-paragliding/api/geojson/getAroundLatLngSites.php?...'`), with the direct URL commented out as "without proxy". — [giloutho/Logfly-web flight-site.js](https://github.com/giloutho/Logfly-web/blob/dc32c1696a95bd4259ac305c0c23044899a015b9/src/modules/Tracks/js/flight-site.js)
- OSM tags and query: `nwr(around:R,lat,lon)["free_flying:site"~"^(takeoff|landing)$"]; nwr(...)["free_flying:takeoff"="yes"]; nwr(...)["free_flying:landing"="yes"]` against `https://overpass-api.de/api/interpreter`. — [benkuper/flywindow sites.mjs](https://github.com/benkuper/flywindow/blob/97954193f22cdebb7b593109dca438e19de0531d/server/providers/sites.mjs)
- Another tool uses `way["sport"="free_flying"]` and `node["free_flying:site"="yes"]`. — [isaacsun0813/openlaunch-armb ingest-sites.ts](https://github.com/isaacsun0813/openlaunch-armb/blob/bbca27dedadf2c1491286a1f810b32c1e6cbaa1a/scripts/ingest-sites.ts)
- Tagging reference: https://wiki.openstreetmap.org/wiki/Key:free_flying. — [flywindow DATA_SOURCES.md](https://github.com/benkuper/flywindow/blob/97954193f22cdebb7b593109dca438e19de0531d/docs/DATA_SOURCES.md)
- Overpass terms: data is ODbL. "The public instance allows about 10k queries/day and about 1 GB/day **across all users**. Mirrors have their own policies". Attribution is "© OpenStreetMap contributors". overpass-api.de answered "HTTP 406 to Node's default UA". The public mirrors serve different snapshots. — [BertCh/rigi reports/licences.md](https://github.com/BertCh/rigi/blob/main/reports/licences.md)
- DHV Geländedatenbank covers "DE, AT, CH | public per-country KML, no key". "DHV publishes no terms with it" (contact gelaendeinfo@dhv.de). — [paragliding_site_federation README](https://github.com/Kevin-McIsaac/paragliding_site_federation/blob/7b9c642d76bad97f0804323099d9fd48950afe49/README.md)

### Inferences
- Static site: do not call the FFVL API from the browser, because the key would be public and no terms are published. If a key is granted, fetch in a GitHub Action and commit a filtered GeoJSON, after confirming redistribution rights with the FFVL.
- PGE: download `getCountrySites.php?iso=fr&style=detailled` (or a bbox around the Alps, e.g. `getBoundingBoxSites.php?north=46.5&south=43.6&west=5.0&east=7.8`) at build time, filter to the Alps, and credit "ParaglidingEarth.com (CC BY-SA)". Check the licence wording first.
- OSM: an Overpass query at build time is safer than per-visitor live queries, given the shared quotas. Credit "© OpenStreetMap contributors" (ODbL).
- DHV is not useful for France beyond the Swiss border region.

### Gaps
- The FFVL pmwiki terms of use (licence, attribution, redistribution) could not be read.
- PGE's current licence statement and CORS headers could not be fetched.
- The OSM wiki `Key:free_flying` page could not be fetched. The full tag list (e.g. `free_flying:site=toplanding|training_hill`, `free_flying:paragliding=yes`) is unverified here.
- Overpass CORS was not tested. It is widely used from browsers, but that is unverified in this session.

---

## Q3. Live wind stations (FFVL balises, Pioupiou/OpenWindMap, Holfuy, Météo-France, winds.mobi)

### Takeaway
- **winds.mobi** is the best fit for a keyless static site. It is a keyless JSON API with `Access-Control-Allow-Origin: *` (verified in source), it supports bbox queries, and it aggregates FFVL, Pioupiou and Holfuy among others. No terms of use were found.
- **Pioupiou/OpenWindMap** is keyless, with a free "Community License" (commercial use allowed) that requires a visible link to openwindmap.org.
- **FFVL** and **Holfuy** need a key/password. **Météo-France** observations need an API key or OAuth token. None of those three suits a static site without a backend.

### Cited Findings
- FFVL beacons: the API is "updated every 5 minutes, with 72 hours of historical data". — [data.gouv.fr FFVL dataset / balisemeteo.com (search extract)](https://www.data.gouv.fr/datasets/reseau-de-balises-et-donnees-meteo-de-la-ffvl)
- FFVL "Fetches ALL beacons globally (~650 beacons)", with no bbox support and the key required. The FFVL feed also carries station types "FFVL, PIOUPIOU, OPENWINDMAP". — [the_paragliding_app WEATHER_STATIONS.md](https://github.com/Kevin-McIsaac/the_paragliding_app/blob/3e0283767116d3e4f507f82994476c52f7d057ff/docs/api/WEATHER_STATIONS.md)
- Pioupiou endpoints:
  - `GET http://api.pioupiou.fr/v1/live/{station_id}` (latest measurements) and `GET http://api.pioupiou.fr/v1/live-with-meta/{station_id}`. `https://api.pioupiou.fr/v1/live/all` returns all stations worldwide. — [Pioupiou Live API docs (search extract)](http://developers.pioupiou.fr/api/live/)
  - Archive: `https://api.pioupiou.fr/v1/archive/{id}?start=..&stop=..`. — [arnaudlopez/beacon-live-app realSources.js](https://github.com/arnaudlopez/beacon-live-app/blob/cdc65f11b2521d00b04fa869d8eddc784b016665/server/realtime/realSources.js)
- Pioupiou licence: "The Community License is free (and will always be) and is designed for open data projects. It allows you to use the data from all the sensors of the Pioupiou Wind Network for any use − including commercial use − as long as you comply with the following rules. You must give credit and provide a link to the https://openwindmap.org website in a visible part of your application." — [Pioupiou Data Licensing (search extract)](http://developers.pioupiou.fr/data-licensing/)
- Pioupiou HTTPS conflict: one integrator notes "HTTP only (no HTTPS support)", ~1000 stations, "Wind data represents 4-minute averages", speeds in km/h ([the_paragliding_app WEATHER_STATIONS.md](https://github.com/Kevin-McIsaac/the_paragliding_app/blob/3e0283767116d3e4f507f82994476c52f7d057ff/docs/api/WEATHER_STATIONS.md)). This is contradicted by winds.mobi using `https://api.pioupiou.fr/v1/live-with-meta/all` ([winds-mobi-providers pioupiou.py](https://github.com/winds-mobi/winds-mobi-providers/tree/4b46e94135c3cb7382562379a3e930a6ded9e0b5/providers)) and by static HTML dashboards that `fetch(`https://api.pioupiou.fr/v1/live/${baliseId}`)` client-side ([marcboivin73kcb/AixWindDashboard "analyse vent v2.html"](https://github.com/marcboivin73kcb/AixWindDashboard/blob/2ad96aaaf9a34a800af686301c56f5a085c8ebf5/analyse%20vent%20v2.html)).
- Holfuy: URL format `http://api.holfuy.com/live/?s=101&pw=pass&m=JSON&tu=C&su=m/s`. "s=all" returns "all stations' data (to which you have access)", and "pw: password for the API access". — [haavardj/pyholfuy __init__.py](https://github.com/haavardj/pyholfuy/blob/8c547bd32f8d5d188ba781a86c977a864556cb90/holfuy/__init__.py)
- Holfuy bulk use with a key: `https://api.holfuy.com/live/?pw=${HOLFUY_KEY}&m=JSON&tu=C&su=km/h&s=all`. — [kyzh0/zephyr holfuy.ts](https://github.com/kyzh0/zephyr/blob/a4df2944cc2fffb10cf5f36b383162a72487e5be/server/apps/scheduler/src/scrapers/stations/types/holfuy.ts)
- Holfuy station list: winds.mobi reads `https://api.holfuy.com/stations/stations.json`. — [winds-mobi-providers](https://github.com/winds-mobi/winds-mobi-providers/tree/4b46e94135c3cb7382562379a3e930a6ded9e0b5/providers)
- Météo-France observations:
  - `https://public-api.meteofrance.fr/public/DPObs/v1/station/horaire?id_station=<id>&format=json` and `/v1/liste-stations`, with header `apikey: <api_key>`. — [mr-dgidgi/weather-pooler](https://github.com/mr-dgidgi/weather-pooler/blob/beb51e177ea5d34bada1c34eab57bf50098192e4/weather-pooler.py)
  - 6-minute data at `/v1/station/infrahoraire-6m?id_station=..&date=..&format=json`, with `Authorization: Bearer` token. — [mto-user84925/minisite-douai prove_api.mjs](https://github.com/mto-user84925/minisite-douai/blob/90b56586ce2a66c30181c399a78566d58ec127fd/scripts/prove_api.mjs)
  - Token from `https://portail-api.meteofrance.fr/token`. — [anquetos/meteoviz constants.py](https://github.com/anquetos/meteoviz-streamlit-app/blob/04f7e7e83569eca210e23f8f0745592548be50ba/constants.py)
  - Bulk climatology files (not live): `https://object.files.data.gouv.fr/meteofrance/data/synchro_ftp/BASE/{FREQ_1}/{FREQ_2}_{DD}_{A-PRE}-{A_DEBUT}-{A_FIN}_{PARAM}.csv.gz`. — [AssociationInfoclimat docs/mf/URL.md](https://github.com/AssociationInfoclimat/telechargement-climatologie-portail-api-meteofrance/blob/c1e3a7ab9be28638778d18b01906acf220e522c3/docs/mf/URL.md)
- winds.mobi API:
  - Deployed versions `winds.mobi/api/2/`, `/api/2.3/` (2.2 deprecated). The code is AGPL-3.0. — [winds-mobi-api README](https://github.com/winds-mobi/winds-mobi-api/blob/9fd23dbc76801a481fe8c626e4aeff11b223cbd9/README.md)
  - CORS: `app.add_middleware(CORSMiddleware, allow_origins=["*"])`. — [winds-mobi-api winds_mobi_api/main.py](https://github.com/winds-mobi/winds-mobi-api/blob/main/winds_mobi_api/main.py)
  - Bbox query: `https://winds.mobi/api/2.3/stations/?is-highest-duplicates-rating=true&keys=short&keys=loc&keys=status&keys=pv-name&keys=alt&keys=peak&keys=last._id&keys=last.w-dir&keys=last.w-avg&keys=last.w-max&limit=220&within-pt1-lat=..&within-pt1-lon=..&within-pt2-lat=..&within-pt2-lon=..`. History: `https://winds.mobi/api/2.3/stations/{id}/historic/?duration=21000&keys=w-dir&keys=w-avg&keys=w-max&keys=temp`. — [XCMaps wind.js](https://github.com/XCmaps/XCMaps/blob/22083414a2c7d9cef6144e19f0bb03dd1c4901b9/src/api/wind.js); [XCMaps windstations.js](https://github.com/XCmaps/XCMaps/blob/22083414a2c7d9cef6144e19f0bb03dd1c4901b9/src/components/windstations.js)
  - A GitHub Pages site calls `https://winds.mobi/api/2.3/stations/` directly from the browser. — [JungfrauTaechi/jungfrautaechi.github.io winds-mobi.js](https://github.com/JungfrauTaechi/jungfrautaechi.github.io/blob/90ce5d07debaf8963c53020e701bba11dc0f8934/src/winds-mobi.js)
  - Its providers include `ffvl.py` (with an FFVL key), `holfuy.py` and `pioupiou.py`. — [winds-mobi-providers](https://github.com/winds-mobi/winds-mobi-providers/tree/4b46e94135c3cb7382562379a3e930a6ded9e0b5/providers)

### Inferences
- Concrete winds.mobi example for the northern French Alps (bbox NW 46.5/5.5, SE 44.8/7.2): `https://winds.mobi/api/2.3/stations/?keys=short&keys=loc&keys=alt&keys=pv-name&keys=last._id&keys=last.w-dir&keys=last.w-avg&keys=last.w-max&limit=300&within-pt1-lat=46.5&within-pt1-lon=7.2&within-pt2-lat=44.8&within-pt2-lon=5.5`. The corner order is copied from XCMaps.
- Through winds.mobi a static site indirectly shows FFVL and Holfuy stations without holding those keys. The credits should then name winds.mobi and the original providers (FFVL, Holfuy, Pioupiou/OpenWindMap); that is good practice, not a verified requirement.
- Pioupiou can be called directly (no key, CORS likely, credit plus a link to openwindmap.org). Use `https://` and fall back to winds.mobi if the HTTPS/CORS question bites, since an HTTPS page cannot call an HTTP API.

### Gaps
- No winds.mobi terms of use or rate limits were found. Whether it permits third-party embedding of the redistributed FFVL/Holfuy data is unknown.
- Pioupiou CORS and HTTPS support could not be tested directly. OpenWindMap's own API host (`api.openwindmap.org`) was not verified.
- The Holfuy API terms and the conditions for obtaining a password were not found.
- The Météo-France public-API licence text (believed Etalab Licence Ouverte 2.0), quotas and CORS were not verified this session.

---

## Q4. Forecast: Open-Meteo (pressure-level winds, boundary layer height, CAPE, Météo-France AROME/ARPEGE)

### Takeaway
Open-Meteo is keyless and CORS-open (server configured with `allowedOrigin: .all`). The free tier is for non-commercial use, capped at 600 calls/min, 5,000/hour, 10,000/day and 300,000/month, with data under CC BY 4.0. A link reading "Weather data by Open-Meteo.com" is required next to the data. The Météo-France models (`meteofrance_seamless`, `meteofrance_arome_france_hd`, …) provide pressure levels from 1000 to 10 hPa, including 850 and 700, plus CAPE. `boundary_layer_height` appears for the generic forecast API, GFS and ECMWF, but **not** in the Météo-France endpoint's variable list.

### Cited Findings
- Terms, verbatim from the website source:
  - "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute."
  - "You may only use the free API services for non-commercial purposes."
  - "You accept to the CC-BY 4.0 licence"
  - "We reserve the right to block applications and IP addresses that misuse our service"
  - Commercial use = "Operating websites or apps that have subscriptions or display advertisements."
  - The limits panel adds "300.000 calls / month".
  — [open-meteo-website terms/+page.svelte](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/terms/+page.svelte); rendered at [open-meteo.com/en/terms](https://open-meteo.com/en/terms)
- Non-commercial examples include "private or non-profit websites or apps that do not have subscriptions or advertising". — [Open-Meteo terms (search extract)](https://open-meteo.com/en/terms)
- Licence and attribution: "The API data is offered under Attribution 4.0 International (CC BY 4.0) licence." "You must include a link next to any location Open-Meteo data are displayed". The required snippet is `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`. The licence page also credits "Atmospheric and wave forecasts from Météo-France" with a link to the Météo-France licence. — [open-meteo-website licence/+page.svelte](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/licence/+page.svelte); [attribution.svx](https://github.com/open-meteo/open-meteo-website/blob/main/src/lib/components/code/licence/attribution.svx)
- No API key: "free access for non-commercial use. No API key required." — [terms page meta](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/terms/+page.svelte)
- CORS: the server sets `CORSMiddleware.Configuration(allowedOrigin: .all, …)`. — [open-meteo/open-meteo configure.swift](https://github.com/open-meteo/open-meteo/blob/290493ffb9b5ee66fb1336219487a346eb27d191/Sources/App/configure.swift)
- Météo-France API:
  - The endpoint `/v1/meteofrance` exists. The generic form posts to `https://api.open-meteo.com/v1/forecast`.
  - Model values: `meteofrance_seamless`, `meteofrance_arpege_seamless`, `meteofrance_arpege_world`, `meteofrance_arpege_europe`, `meteofrance_arome_seamless`, `meteofrance_arome_france`, `meteofrance_arome_france_hd`, `meteofrance_arome_france_15min`, `meteofrance_arome_france_hd_15min`.
  - Pressure levels: 10 … 600, 650, 700, 750, 800, 850, 900, 925, 950, 1000 hPa.
  - Variables include `cape`.
  - Description: "AROME is a 1.5 km high resolution model covering France and neighboring areas. For other locations, only ARPEGE is used." "With updates for AROME every hour".
  — [open-meteo-website docs/meteofrance-api options.ts](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/docs/meteofrance-api/options.ts); [meteofrance-api/+page.svelte](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/docs/meteofrance-api/+page.svelte)
- Variable naming: `wind_speed_1000hPa`, `wind_direction_1000hPa`, `geopotential_height_1000hPa`, `temperature_975hPa`, … (pattern `<var>_<level>hPa`). — [meteofrance-api/+page.svelte](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/docs/meteofrance-api/+page.svelte)
- `boundary_layer_height` ("Boundary Layer Height PBL"), `lifted_index`, `convective_inhibition` and `freezing_level_height` are listed in the generic forecast options ([docs/options.ts](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/docs/options.ts)), the GFS API ([gfs-api/options.ts](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/docs/gfs-api/options.ts)) and the ECMWF API ([ecmwf-api/options.ts](https://github.com/open-meteo/open-meteo-website/blob/main/src/routes/en/docs/ecmwf-api/options.ts)). A search of the Météo-France options file found no `boundary_layer` entry. DWD lists `updraft`, and MeteoSwiss ICON-CH1/CH2 models are also available.
- Integrator caveats: "Availability of boundary-layer, convective and other optional fields differs by model/region. Nulls remain null." Model BLH and CAPE "do not by themselves establish climb rate or a usable thermal top". — [benkuper/flywindow DATA_SOURCES.md](https://github.com/benkuper/flywindow/blob/97954193f22cdebb7b593109dca438e19de0531d/docs/DATA_SOURCES.md)

### Inferences
- Example request for Annecy, with Météo-France winds at 850/700 hPa plus CAPE:
  `https://api.open-meteo.com/v1/forecast?latitude=45.90&longitude=6.13&hourly=wind_speed_850hPa,wind_direction_850hPa,wind_speed_700hPa,wind_direction_700hPa,geopotential_height_850hPa,geopotential_height_700hPa,cape,wind_speed_10m,wind_direction_10m&models=meteofrance_seamless&wind_speed_unit=kmh&timezone=Europe%2FParis`
- For the boundary layer height, make a second request with a model that provides it, e.g. `...&hourly=boundary_layer_height,cape,lifted_index&models=ecmwf_ifs025` (or `gfs_seamless`). Alternatively omit `models` (best_match) and handle `null`.
- Each visitor's browser calls Open-Meteo directly, so the quotas apply per client IP. A small non-commercial static site sits well within limits. Batch several coordinates in one call where possible. Do not add ads or subscriptions, which would make the use commercial.

### Gaps
- The exact behaviour of `boundary_layer_height` with `models=meteofrance_*` (null vs. error) was not tested live.
- Open-Meteo's attribution requirements for the upstream Météo-France data beyond the licence-page credit were not checked on Météo-France's site.

---

## Q5. Terrain & imagery tiles for MapLibre 3D (AWS Terrain Tiles, Mapterhorn, IGN Géoplateforme, Esri, EOX, OpenTopoMap, OpenFreeMap, MapTiler, swisstopo)

### Takeaway
- **Mapterhorn** is the best keyless 3D terrain for the French Alps: Terrarium WebP tiles built from IGN RGE ALTI 1 m (Licence Ouverte 2.0) and swissALTI3D 0.5 m, among other sources. **AWS Terrain Tiles** is the fallback: verified `Access-Control-Allow-Origin: *`, coarser source data.
- **IGN Géoplateforme public WMTS** (ortho, Plan IGN, slopes) is keyless.
- **SCAN 25** needs the private endpoint and the "transitional" key `ign_scan_ws`.
- IGN's own **terrain-RGB** WMS style also sits on the private, keyed endpoint.
- **Esri World Imagery** is not cleared for a public app without an ArcGIS key.
- **EOX s2cloudless**, **OpenFreeMap** and **swisstopo** are keyless and usable with attribution.
- **MapTiler** needs a key.

### Cited Findings
- AWS Terrain Tiles (Terrarium):
  - URL: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (also `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png`).
  - My test on 2026-10-07 returned `Access-Control-Allow-Origin: *` and `Content-Type: image/png`. — [test URL](https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/531/364.png)
  - Decoding: "`(red * 256 + green + blue / 256) - 32768`" (Web Mercator; 256/512 px variants). — [tilezen/joerd formats.md](https://github.com/tilezen/joerd/blob/master/docs/formats.md)
  - Licence pointer is the joerd attribution page, managed by "Mapzen, a Linux Foundation project". An EU replica bucket `elevation-tiles-prod-eu` exists in eu-central-1. — [awslabs/open-data-registry terrain-tiles.yaml](https://github.com/awslabs/open-data-registry/blob/main/datasets/terrain-tiles.yaml)
  - Required attribution includes "Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers" and "United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey", plus the other listed sources. — [tilezen/joerd attribution.md](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
- Mapterhorn:
  - Drop-in replacement: `"tiles": ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"], "encoding": "terrarium"`. "Code: BSD-3 … Terrain data: various open-data sources, for a full list see https://mapterhorn.com/attribution". — [mapterhorn/mapterhorn README](https://github.com/mapterhorn/mapterhorn/blob/main/README.md)
  - France source: "RGE ALTI® 1m Metropolitan France", licence "Licence Ouverte / Open Licence version 2.0", producer IGN. — [source-catalog/frrgealti1metro/metadata.json](https://github.com/mapterhorn/mapterhorn/blob/main/source-catalog/frrgealti1metro/metadata.json)
  - Switzerland: "swissALTI3D", "Open Government Data", resolution 0.5. — [source-catalog/swissalti3d/metadata.json](https://github.com/mapterhorn/mapterhorn/blob/main/source-catalog/swissalti3d/metadata.json)
  - "The TileJSON attribution is `© Mapterhorn` with that link [mapterhorn.com/attribution]. No usage, rate-limit or production-traffic policy is published." The endpoint is Cloudflare-sponsored; tiles are 512 px Terrarium WebP. — [BertCh/rigi reports/licences.md](https://github.com/BertCh/rigi/blob/main/reports/licences.md)
  - Per-source credits for an Alpine view: Copernicus GLO-30, swisstopo, "IGN RGE ALTI / LiDAR HD" (Licence Ouverte 2.0), INGV TINITALY, Regione Piemonte / Valle d'Aosta (CC BY 4.0), etc. — [BertCh/rigi attribution.ts](https://github.com/BertCh/rigi/blob/main/src/lib/licences/attribution.ts)
  - gpx.studio uses `https://tiles.mapterhorn.com/tilejson.json` as a MapLibre `raster-dem`. — [gpxstudio/gpx.studio layers.ts](https://github.com/gpxstudio/gpx.studio/blob/main/website/src/lib/assets/layers.ts)
  - openglobus configures it with `maxZoom: 17`. — [openglobus MapterhornTerrain.ts](https://github.com/openglobus/openglobus/blob/b445ffd4a97837258df1f60c0d3d45991108673c/src/terrain/MapterhornTerrain.ts)
- IGN Géoplateforme, public WMTS in Web Mercator (`TILEMATRIXSET=PM`, no key):
  - Orthophotos: `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`. Old `wxs.ign.fr` URLs migrated to `data.geopf.fr`, with a separate `/private/wmts` for keyed access. — [IGN/OpenLayers/makina-corpus pages (search extract)](https://openlayers.org/en/latest/examples/wmts-ign.html)
  - Plan IGN v2 raster: `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`. — [Akylas/alpimaps_data_generator sources.js](https://github.com/Akylas/alpimaps_data_generator/blob/fc05428452429298c62949e61adc835661cab6e1/cairn/src/lib/sources.js)
  - Mountain slope map: `...&Layer=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&FORMAT=image/png&Style=normal`, attribution `'IGN-F/Géoportail'`. — [gpx.studio layers.ts](https://github.com/gpxstudio/gpx.studio/blob/main/website/src/lib/assets/layers.ts)
  - PLAN.IGN vector tiles: `https://data.geopf.fr/tms/1.0.0/PLAN.IGN/{z}/{x}/{y}.pbf`, glyphs `https://data.geopf.fr/annexes/ressources/vectorTiles/fonts/{fontstack}/{range}.pbf`, attribution `'© <a href="https://www.ign.fr/">IGN</a>'`. — [lhapaipai/ign-tms-styles util.ts](https://github.com/lhapaipai/ign-tms-styles/blob/fc4c9ee049470f401d60bdd36e30047ae0e3f178/src/util.ts)
- IGN SCAN 25:
  - Private endpoint: `https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&FORMAT=image/jpeg&STYLE=normal&apikey=ign_scan_ws`, attribution 'IGN-F/Géoportail'. — [gpx.studio layers.ts](https://github.com/gpxstudio/gpx.studio/blob/main/website/src/lib/assets/layers.ts)
  - `GEOGRAPHICALGRIDSYSTEMS.MAPS` is marked "// Need API key" on the private server. — [Viglino/ol-ext Geoportail.js](https://github.com/Viglino/ol-ext/blob/52e2719a2b97d1a4c3d4a8d362febd892d1d19ad/src/layer/Geoportail.js)
  - "For all non-free data, it is now necessary to use the transitional keys 'ign_scan_ws'". — [IGN / developpez.net (search extract)](https://data.geopf.fr/private/wmts?apikey=ign_scan_ws&SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities)
  - An IGN news item is titled "Arrêt de la création et modification des clés et comptes sur le site des Géoservices" (Feb 2024). — [geoservices.ign.fr (search result title)](https://geoservices.ign.fr/actualites/2024-27-02-actu-cle)
  - Geotrek's documented attribution: 'Plan Scan 25 Touristique - Carte © IGN/Geoportail'. — [GeotrekCE/Geotrek-admin map-settings.rst](https://github.com/GeotrekCE/Geotrek-admin/blob/58e3c4d3b15a9eec5243d9b39cf5fb334cc0c7de/docs/advanced-configuration/map-settings.rst)
- IGN elevation / terrain-RGB:
  - IGN's own app adds a MapLibre `raster-dem` from `https://data.geopf.fr/private/wms-r/wms?apikey=${GPF_key}&bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.3.0&request=GetMap&crs=EPSG:3857&width=256&height=256&styles=terrainrgb0&layers=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.LINEAR` (minzoom 6, maxzoom 14). — [IGNF/cartes-ign-app three-d.js](https://github.com/IGNF/cartes-ign-app/blob/6b1ad10981464f044a6bbc1cc3ebd07508b0b57e/src/js/three-d.js)
  - The public WMS-R serves raw Float32 GeoTIFF elevation (`LAYERS=IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93`, `FORMAT=image/geotiff`, `CRS=EPSG:3857`, `BBOX={bbox-epsg-3857}`), decoded in MapLibre through a custom protocol. — [jo-chemla/terrain-viewer](https://github.com/jo-chemla/terrain-viewer/blob/dc7523c7169cc0f6930e48af1d445f69946d2445/public/maplibre-raster-dem-wms-float32-generic.html)
  - Another project pre-bakes RGE ALTI (`LAYERS=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES`) into Terrarium tiles. — [juroc68/hwk-front build_dem.py](https://github.com/juroc68/hwk-front/blob/7722bf7e6f9e1bc800b190e5167c732125b8241f/scripts/build_dem.py)
- Esri World Imagery:
  - Template: `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/WMTS/tile/1.0.0/World_Imagery/default/default028mm/{z}/{y}/{x}.jpg` (maxzoom 19). gpx.studio's attribution reads '© Esri, Vantor, Earthstar Geographics, and the GIS User Community'. — [gpx.studio layers.ts](https://github.com/gpxstudio/gpx.studio/blob/main/website/src/lib/assets/layers.ts)
  - Esri: "If you're using Esri content and services, you'll need to license your usage with an API key or an ArcGIS identity". Attribution is required in **any** app. — [Esri/esri-leaflet README](https://github.com/Esri/esri-leaflet/blob/master/README.md)
  - An independent licence review quotes Esri's data-attribution text "Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community" plus "Powered by Esri". It concludes the keyless URL is "**Not cleared** for a public app … without an ArcGIS subscription". — [BertCh/rigi reports/licences.md](https://github.com/BertCh/rigi/blob/main/reports/licences.md)
- EOX Sentinel-2 cloudless:
  - Template: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-{year}_3857/default/g/{z}/{y}/{x}.jpg` (note `{y}` before `{x}`). Annual mosaics 2018–2025, maxzoom ~15; the unsuffixed `s2cloudless_3857` is 2016.
  - Attribution: "Sentinel-2 cloudless {year} by <a href="https://s2maps.eu">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data {year})".
  - This source states "EOX Sentinel-2 cloudless is CC BY 4.0".
  — [opengeos/GeoLibre timelapse-providers.ts](https://github.com/opengeos/GeoLibre/blob/5587b7452ed46285a262ab20f7e2aa3f0bff28ff/packages/plugins/src/plugins/timelapse-providers.ts)
- OpenTopoMap: template `https://tile.opentopomap.org/{z}/{x}/{y}.png` (maxzoom 17), attribution '© OpenTopoMap © OpenStreetMap' ([gpx.studio layers.ts](https://github.com/gpxstudio/gpx.studio/blob/main/website/src/lib/assets/layers.ts)). "The license of the online map is CC-BY-SA." Usage terms: "See https://opentopomap.org/about#verwendung". "Please note, that the old raster tiles are depreciated. OpenTopoMap will switch to vector tiles." — [der-stefan/OpenTopoMap README](https://github.com/der-stefan/OpenTopoMap/blob/master/README.md)
- OpenFreeMap: "Using our **public instance** is completely free: there are no limits on the number of map views or requests. There's no registration, no user database, no API keys, and no cookies." "`https://tiles.openfreemap.org/planet/latest` always points to the latest deployed TileJSON. Tile URLs can use `/planet/latest/{z}/{x}/{y}.pbf`." It is built from OpenStreetMap, OpenMapTiles, Natural Earth and Wikidata. — [hyperknot/openfreemap README](https://github.com/hyperknot/openfreemap/blob/main/README.md)
- MapTiler terrain: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}` (a key is always required). — [zbycz/osmapp consts.ts](https://github.com/zbycz/osmapp/blob/c83b525c2670505f2bfba0ef47f9b63897ab46d6/src/components/Map/consts.ts)
- swisstopo:
  - Colour map: `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg`, attribution '© swisstopo'. Vector style: `https://vectortiles.geo.admin.ch/styles/ch.swisstopo.basemap.vt/style.json`. — [gpx.studio layers.ts](https://github.com/gpxstudio/gpx.studio/blob/main/website/src/lib/assets/layers.ts)
  - SWISSIMAGE / Pixelkarte: "Swiss OGD (since 2021-03-01): free, commercial use allowed … Fair use of `wmts.geo.admin.ch` applies; ask swisstopo before very heavy traffic". swisstopo's terms "require one of the source references, including '©swisstopo'". — [BertCh/rigi reports/licences.md](https://github.com/BertCh/rigi/blob/main/reports/licences.md)

### Inferences
- MapLibre raster and raster-dem sources need CORS on the tile server. gpx.studio and alpimaps load IGN `data.geopf.fr/wmts`, swisstopo, Mapterhorn and OpenTopoMap directly in MapLibre, so these hosts very likely send permissive CORS headers. That is inference, not tested here.
- Recommended stack for our app, all keyless:
  - Terrain: `raster-dem` from Mapterhorn (`https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`, `encoding: "terrarium"`, `tileSize: 512`), with the AWS Terrarium fallback (`tileSize: 256`).
  - Drape: IGN ORTHOPHOTOS or PLAN IGN v2, or EOX for the Italian/Swiss edges and swisstopo inside Switzerland.
  - Labels and peaks: OpenFreeMap vector tiles. OpenMapTiles has a `mountain_peak` layer (from my knowledge of the schema, not verified here).
- Concrete IGN example tile (Annecy z12): `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=12&TILEROW=1458&TILECOL=2117`.
- Avoid SCAN 25 (non-free, keyed with a "transitional" shared key that could be withdrawn) and Esri (needs an ArcGIS key for a public app).

### Gaps
- No CORS tests for data.geopf.fr, tiles.mapterhorn.com, tiles.maps.eox.at, tile.opentopomap.org, tiles.openfreemap.org or wmts.geo.admin.ch (egress blocked, HTTP 403 at the proxy).
- **EOX licence conflict:** GeoLibre says CC BY 4.0 for 2018–2025. My unverified recollection is that s2maps.eu labels the 2018+ mosaics CC BY-NC-SA 4.0 and only 2016 CC BY 4.0. Both are acceptable for a non-commercial app, but check s2maps.eu before shipping.
- IGN Géoplateforme rate limits and fair-use policy were not found. The Licence Ouverte 2.0 status was verified here only for RGE ALTI (via Mapterhorn), not for ortho or Plan IGN.
- The exact IGN attribution wording required by IGN itself was not read: projects use "© IGN" or "IGN-F/Géoportail".
- Not verified: the OpenTopoMap usage-policy text, the OpenFreeMap attribution string and style URL (`https://tiles.openfreemap.org/styles/liberty` is the commonly used style), MapTiler free-plan terms, and the exact swisstopo SWISSIMAGE layer id (expected `ch.swisstopo.swissimage`).
- Mapterhorn has no published usage policy for its hosted endpoint.

---

## Q6. Airspace data for paragliding (OpenAIP, planeur.net / FFVP OpenAir, FFVL)

### Takeaway
- **planeur-net (FFVP)** publishes the French airspace as OpenAir **and GeoJSON** on GitHub Pages. It is keyless, CORS-open (verified on raw.githubusercontent.com) and free of charge, explicitly unofficial and glider-optimised, with no formal licence.
- **OpenAIP** needs a free API key, both for tiles and for its core API. Its data is CC BY-NC 4.0 with attribution "© openAIP contributors". Its browser CORS is unverified.

### Cited Findings
- planeur-net (FFVP):
  - "La FFVP met à jour un fichier des espaces aériens au format OpenAir Extended et OpenAir (Standard)… compilé bénévolement à partir des publications AIP du Service de l'Information Aéronautique."
  - Downloads: `https://planeur-net.github.io/airspace/france.txt` (OpenAir), `france_openair_standard.txt`, `france-exp.txt` (with activation days/hours, experimental), `france.cub`, `france.geojson`.
  - The file ships natively in XCSoar, LXNav and Naviter products.
  - ZSM (Zones de Sensibilité Majeure) are maintained through an unofficial scrape, after the SIA stopped publishing the export files.
  — [planeur-net/airspace README](https://github.com/planeur-net/airspace)
- france.txt header: "AIRSPACE OF FRANCE — OPTIMIZED FOR GLIDER ACTIVITY — SOURCE: AIP FRANCE 2026/04/16 … UNOFFICIAL, USE AT YOUR OWN RISK … This file is provided free of charge with no warrantees … Courtesy of French Gliding Association". The version line is dated 2026-10-02, and the file holds 1,402 `AC` records (my count). — [france.txt](https://raw.githubusercontent.com/planeur-net/airspace/master/france.txt)
- CORS: raw.githubusercontent.com returned `access-control-allow-origin: *` in my test (2026-10-07). — [test URL](https://raw.githubusercontent.com/planeur-net/airspace/master/france.txt)
- OpenAIP:
  - Raster tiles: `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey={apiKey}` (z4–14), attribution '<a href="https://www.openaip.net/">OpenAIP</a> — airspace data CC BY-NC-SA'. — [phpvms seed_map_layers.php](https://github.com/phpvms/phpvms/blob/73199ca2bd9f024483288c4350bcad5d13060a0a/database/migrations_data/2026_08_31_000000_seed_map_layers.php)
  - Vector tiles: `https://{a,b,c}.api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.pbf`, "License: CC BY-NC 4.0 - attribution required". — [kewonit/aeris route.ts](https://github.com/kewonit/aeris/blob/0154fcccddbfbdf940c708094498c07cc081f12e/src/app/api/airspace-tiles/route.ts)
  - Core API: `https://api.core.openaip.net/api/airspaces?limit=1000&apiKey={key}&page={page}&fields=...` (also `pos=lat,lon&dist=`, `bbox=`, header `x-openaip-api-key`). — [vicb/flyXC download-openaip.ts](https://github.com/vicb/flyXC/blob/afdd65ff3e03a1bda35d8b9835fee7c58d20e781/apps/fxc-tiles/src/app/airspaces/download-openaip.ts); [theqkash/esp32flight airspace.c](https://github.com/theqkash/esp32flight/blob/da06b177bcc4002ba32b6f3e4f08a0fc5eed432a/main/airspace.c)
  - Licence and attribution: "Data © OpenAIP contributors, licensed CC BY-NC 4.0" ([spamsch/xplane-virtual-atc openaip.py](https://github.com/spamsch/xplane-virtual-atc/blob/0c31a09eddde195a1c335ec21faaf71f8772e211/airspace/openaip.py)). "© openAIP contributors" ([georgeorge33/ChartDesk OpenAIP.swift](https://github.com/georgeorge33/ChartDesk/blob/7fc182f0150ded58bb6f3c4a055225b4d01698be/Sources/Chartdesk/Model/OpenAIP.swift)). Older code and docs say CC BY-NC-SA ([ianlkl11234s/flight-arc-graph plan](https://github.com/ianlkl11234s/flight-arc-graph/blob/9d114a0d9ae50619feeee2dc89afdd46a369fbd6/docs/backlog/global-airspace-plan.md)).
  - CORS: "Auth: API key required (free tier at https://www.openaip.net/) … CORS: Not verified for PWA/web builds". — [betaflight-configurator openaip.ts](https://github.com/betaflight/betaflight-configurator/blob/master/src/js/notam/openaip.ts)

### Inferences
- Best fit for the static site: at build time, fetch `https://planeur-net.github.io/airspace/france.geojson` (or parse `france.txt`), clip to the Alps, and render as 3D extruded volumes in MapLibre. Credit "Espaces aériens : FFVP / planeur-net (non officiel, d'après AIP France)" and show a "ne pas utiliser pour la navigation" disclaimer.
- Glider-oriented content (sectors, wave windows) needs filtering for paragliding. Vol-libre-specific zones (e.g. FFVL "zones vol libre", ZSM) need careful handling.
- OpenAIP is possible only if a key may be public. Keys bound to a referrer are unconfirmed, so build-time fetching is safer.

### Gaps
- I could not find or verify FFVL's own airspace products ("cartes aériennes vol libre", FFVL OpenAir files) or their licence (blocked).
- planeur-net has no explicit licence file. Redistribution terms beyond "free of charge" are unclear.
- The OpenAIP terms page and the CORS behaviour of the tiles and core API were not verified.

---

## Q7. Which sources work from a static site (GitHub Pages) with no backend and no key, and which attributions are mandatory?

### Takeaway
- **Directly usable from the browser (keyless; CORS verified or strongly indicated):** Open-Meteo, AWS Terrain Tiles, winds.mobi, planeur-net airspace (GitHub-hosted), Mapterhorn, IGN public WMTS/TMS, swisstopo WMTS, EOX s2cloudless, OpenFreeMap, OpenTopoMap (CC BY-SA; raster deprecated), Pioupiou (likely), Overpass (light use).
- **Keyless but better pre-fetched at build time:** kk7 hotspots (CORS unknown) and kk7 tiles (CORS unknown), ParaglidingEarth (proxy needed per Logfly-web), OSM/Overpass extracts.
- **Not usable without a backend or exposing a secret:** FFVL API, Holfuy, Météo-France DPObs, OpenAIP, MapTiler, IGN SCAN 25 (shared transitional key; avoid), Esri (ArcGIS key needed for a public app).

### Cited Findings
- Mandatory or requested attribution strings, collected from the findings above:
  - Open-Meteo: `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>` next to the data, plus CC BY 4.0. — [open-meteo-website attribution.svx](https://github.com/open-meteo/open-meteo-website/blob/main/src/lib/components/code/licence/attribution.svx)
  - kk7: CC BY-NC-SA 4.0, credit thermal.kk7.ch, and `&src=<hostname>` on every request. — [thermal.kk7.ch (search extract)](https://thermal.kk7.ch/); used form "thermal.kk7.ch CC-BY-NC-SA" in [Logfly-web](https://github.com/giloutho/Logfly-web/blob/dc32c1696a95bd4259ac305c0c23044899a015b9/src/js/leaflet/tiles.js)
  - Pioupiou/OpenWindMap: credit plus a link to https://openwindmap.org "in a visible part of your application". — [Pioupiou Data Licensing (search extract)](http://developers.pioupiou.fr/data-licensing/)
  - Mapterhorn: `<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>`, plus producers (IGN RGE ALTI – Licence Ouverte 2.0, swisstopo, Copernicus, Italian regions). — [BertCh/rigi licences.md](https://github.com/BertCh/rigi/blob/main/reports/licences.md); [rigi attribution.ts](https://github.com/BertCh/rigi/blob/main/src/lib/licences/attribution.ts)
  - AWS Terrain Tiles: the joerd source list (EU-DEM Copernicus, USGS SRTM/GMTED, ETOPO1, …). — [tilezen/joerd attribution.md](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
  - IGN: "© IGN" or "IGN-F/Géoportail". — [ign-tms-styles](https://github.com/lhapaipai/ign-tms-styles/blob/fc4c9ee049470f401d60bdd36e30047ae0e3f178/src/util.ts); [gpx.studio](https://github.com/gpxstudio/gpx.studio/blob/main/website/src/lib/assets/layers.ts)
  - swisstopo: "© swisstopo". — [rigi licences.md](https://github.com/BertCh/rigi/blob/main/reports/licences.md)
  - EOX: "Sentinel-2 cloudless {year} by EOX IT Services GmbH (contains modified Copernicus Sentinel data {year})". — [GeoLibre](https://github.com/opengeos/GeoLibre/blob/5587b7452ed46285a262ab20f7e2aa3f0bff28ff/packages/plugins/src/plugins/timelapse-providers.ts)
  - OSM / Overpass / OpenFreeMap: "© OpenStreetMap contributors" (ODbL), linked to /copyright. — [rigi licences.md](https://github.com/BertCh/rigi/blob/main/reports/licences.md)
  - OpenTopoMap: "© OpenTopoMap (CC-BY-SA) © OpenStreetMap". — [OpenTopoMap README](https://github.com/der-stefan/OpenTopoMap/blob/master/README.md); [gpx.studio](https://github.com/gpxstudio/gpx.studio/blob/main/website/src/lib/assets/layers.ts)
  - Esri: "Esri, Maxar [now Vantor], Earthstar Geographics, and the GIS User Community" plus "Powered by Esri". — [rigi licences.md](https://github.com/BertCh/rigi/blob/main/reports/licences.md)
  - openAIP: "© openAIP contributors", CC BY-NC 4.0. — [ChartDesk](https://github.com/georgeorge33/ChartDesk/blob/7fc182f0150ded58bb6f3c4a055225b4d01698be/Sources/Chartdesk/Model/OpenAIP.swift)
  - planeur-net: "Courtesy of French Gliding Association", unofficial, no warranty. — [france.txt](https://raw.githubusercontent.com/planeur-net/airspace/master/france.txt)

### Inferences
- Since the app is free, non-commercial and open source, all NC-licensed sources (kk7, OpenAIP, possibly EOX, Open-Meteo free tier) are permissible. The app must never add ads or subscriptions, which would make the use commercial.
- ShareAlike (kk7, OpenTopoMap, possibly PGE) means any committed derived data file must carry the same licence. Keep data under `data/` with its own LICENSE/ATTRIBUTION file, separate from the code licence.
- A single MapLibre `AttributionControl` built from each source's `attribution` field, plus an "À propos / Sources" panel listing the full credits, covers the requirements.

### Gaps
- No per-source rate limits were found except Open-Meteo (600/min, 5k/h, 10k/day, 300k/month) and Overpass (about 10k queries/day and 1 GB/day shared, secondary source).
- The CORS rows marked "likely" in the table below must be confirmed with a browser test before launch.

### Summary table (name | URL template | key? | CORS? | licence/attribution | verdict for our app)

| Name | URL template (example) | Key? | CORS? | Licence / attribution | Verdict for our app |
|---|---|---|---|---|---|
| kk7 skyways/thermals tiles | `https://thermal.kk7.ch/tiles/{skyways\|thermals}_{all\|jan\|apr\|jul\|oct}_{all\|04\|07\|10}/{z}/{x}/{y}.png?src=<host>` (TMS: MapLibre `scheme:"tms"`; skyways z≤13, thermals z≤12); e.g. `.../skyways_all_all/10/529/659.png?src=<user>.github.io` | No (`src` mandatory) | Unverified / conflicting | CC BY-NC-SA 4.0; "thermal.kk7.ch (CC BY-NC-SA 4.0)"; contact author for heavy use | **Use** as optional overlay with `src` and attribution; test CORS first; fall back to `<img>` overlay if needed |
| kk7 hotspots API | `https://thermal.kk7.ch/api/hotspots/{csv\|gpx\|cup\|geojson}/all_all/{S},{W},{N},{E}?limit=N&src=<host>`; e.g. `.../geojson/all_all/43.6,5.0,46.5,7.8?src=<host>` | No | Unverified (one site fetches it client-side) | CC BY-NC-SA 4.0 (SA applies to a committed copy) | **Pre-download at build time** (climatology, stable), commit with licence note |
| FFVL API (terrains, balises) | `https://data.ffvl.fr/api/?base=terrains&mode=json&key=KEY`; `?base=balises&r=list&mode=json&key=KEY`; `?base=balises&r=releves_meteo&key=KEY` | **Yes** (by request to informatique@ffvl.fr; sometimes suspended) | Unknown | Terms unpublished/unknown (pmwiki) | **Not in browser.** Only via build-time job if key and redistribution rights granted; otherwise get FFVL stations via winds.mobi |
| ParaglidingEarth | `https://www.paraglidingearth.com/api/geojson/getBoundingBoxSites.php?north=46.5&south=43.6&west=5.0&east=7.8`; `getCountrySites.php?iso=fr&style=detailled`; `getAroundLatLngSites.php?lat=&lng=&distance=&limit=` | No | Likely **no** (Logfly-web proxies) | Old API page: CC BY-SA 3.0; newer contributions differ; credit paraglidingearth.com | **Build-time download**, filter to Alps, credit |
| OSM via Overpass | `https://overpass-api.de/api/interpreter` POST `data=[out:json];nwr["free_flying:site"~"takeoff\|landing"](43.6,5.0,46.5,7.8);out center;` | No | Likely yes (not tested) | ODbL; "© OpenStreetMap contributors"; ~10k queries/day & ~1 GB/day shared | **Build-time extract** preferred; live only for light use |
| DHV Geländedatenbank | per-country KML (DE/AT/CH) | No | n/a | No published terms | **Skip** (no France coverage) |
| Pioupiou / OpenWindMap | `https://api.pioupiou.fr/v1/live/all`; `/v1/live-with-meta/{id\|all}`; `/v1/archive/{id}?start=&stop=` | No | Likely yes (static HTML pages fetch it); HTTPS support disputed | Community License: free incl. commercial; visible credit plus link to https://openwindmap.org | **Use live** (or via winds.mobi) |
| Holfuy | `http://api.holfuy.com/live/?s={id\|all}&pw=PASSWORD&m=JSON&tu=C&su=km/h` | **Yes** (pw) | Unknown | Terms not found | **Not in browser**; get it via winds.mobi |
| winds.mobi | `https://winds.mobi/api/2.3/stations/?keys=...&within-pt1-lat=46.5&within-pt1-lon=7.2&within-pt2-lat=44.8&within-pt2-lon=5.5`; `/stations/{id}/historic/?duration=21000&keys=w-dir&keys=w-avg&keys=w-max` | No | **Yes** (`allow_origins=["*"]` in source) | Code AGPL-3.0; data terms not published; credit winds.mobi plus original providers | **Primary live-wind source** for static site (aggregates FFVL, Holfuy, Pioupiou, …) |
| Météo-France observations | `https://public-api.meteofrance.fr/public/DPObs/v1/station/horaire?id_station=ID&format=json` (header `apikey`) | **Yes** | Unknown | Open data (licence not verified here) | **Not in browser** (secret key); skip or use a backend |
| Open-Meteo | `https://api.open-meteo.com/v1/forecast?latitude=45.90&longitude=6.13&hourly=wind_speed_850hPa,wind_direction_850hPa,wind_speed_700hPa,wind_direction_700hPa,cape&models=meteofrance_seamless` (+ second call `hourly=boundary_layer_height&models=ecmwf_ifs025`) | No | **Yes** (`allowedOrigin: .all`) | CC BY 4.0; `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`; non-commercial; 600/min, 5k/h, 10k/day, 300k/month | **Use live** |
| AWS Terrain Tiles | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (`encoding:"terrarium"`, 256 px) | No | **Yes** (verified `*`) | AWS Open Data; joerd attribution list (EU-DEM Copernicus, USGS SRTM, …) | **Fallback terrain** |
| Mapterhorn | `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp` (TileJSON `https://tiles.mapterhorn.com/tilejson.json`; terrarium, 512 px) | No | Likely yes (used in MapLibre by gpx.studio) | Data per source (IGN RGE ALTI 1 m Licence Ouverte 2.0, swissALTI3D OGD, Copernicus…); `<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>`; no usage policy published | **Primary 3D terrain** |
| IGN ortho (public WMTS) | `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}` | No | Likely yes (used in MapLibre apps) | IGN open data (Licence Ouverte 2.0, not verified for this layer); "© IGN" / "IGN-F/Géoportail" | **Use** as French drape |
| IGN Plan IGN v2 raster / PLAN.IGN vector / slopes | `...&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&FORMAT=image/png...`; `https://data.geopf.fr/tms/1.0.0/PLAN.IGN/{z}/{x}/{y}.pbf`; `...&LAYER=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&FORMAT=image/png...` | No | Likely yes | "© IGN" | **Use** (topo base, slope overlay) |
| IGN SCAN 25 | `https://data.geopf.fr/private/wmts?...&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&FORMAT=image/jpeg&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&apikey=ign_scan_ws` | **Yes** (shared "transitional" key) | Unknown | Non-free data; "Carte © IGN/Géoportail" | **Avoid** (key may be withdrawn; terms unclear) |
| IGN elevation (terrain-RGB WMS / LiDAR HD) | Private: `https://data.geopf.fr/private/wms-r/wms?apikey=KEY&...&styles=terrainrgb0&layers=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES.LINEAR&bbox={bbox-epsg-3857}`; public Float32 GeoTIFF: `https://data.geopf.fr/wms-r?...&LAYERS=IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93&FORMAT=image/geotiff&CRS=EPSG:3857&BBOX={bbox-epsg-3857}` | RGB: yes; GeoTIFF: no | Unknown | Licence Ouverte 2.0 (RGE ALTI) | **Not needed:** Mapterhorn already bakes RGE ALTI into terrarium |
| Esri World Imagery | `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/WMTS/tile/1.0.0/World_Imagery/default/default028mm/{z}/{y}/{x}.jpg` | Officially yes (ArcGIS key/identity) | Not tested | "Esri, Maxar (Vantor), Earthstar Geographics, and the GIS User Community" plus "Powered by Esri" | **Avoid** without ArcGIS key |
| EOX Sentinel-2 cloudless | `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg` (z≤15) | No | Likely yes | CC BY 4.0 per GeoLibre (2018+ possibly CC BY-NC-SA 4.0; verify); "Sentinel-2 cloudless 2024 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024)" | **Use** for cross-border/low-zoom satellite |
| OpenTopoMap | `https://tile.opentopomap.org/{z}/{x}/{y}.png` (z≤17) | No | Likely yes | CC-BY-SA; "© OpenTopoMap © OpenStreetMap contributors"; usage rules at opentopomap.org/about | **Optional**, light use only (raster deprecated) |
| OpenFreeMap | TileJSON `https://tiles.openfreemap.org/planet/latest`; tiles `/planet/latest/{z}/{x}/{y}.pbf`; styles e.g. `https://tiles.openfreemap.org/styles/liberty` (style URL not verified) | No ("no limits … no API keys") | Likely yes (built for websites) | OSM ODbL, OpenMapTiles; "© OpenStreetMap contributors" (+ OpenFreeMap/OpenMapTiles credit) | **Use** for labels, peaks, roads |
| MapTiler terrain | `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=KEY` | **Yes** | Yes (commercial CDN, not tested) | Plan terms not verified | **Skip** (Mapterhorn is keyless) |
| swisstopo WMTS | `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg` (SWISSIMAGE: same pattern, layer `ch.swisstopo.swissimage`, unverified) | No | Likely yes | Swiss OGD, commercial OK, fair use; "© swisstopo" | **Use** for Swiss border areas |
| OpenAIP | Tiles: `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=KEY`; core: `https://api.core.openaip.net/api/airspaces?bbox=...&apiKey=KEY` | **Yes** (free) | Not verified | CC BY-NC 4.0 (older: CC BY-NC-SA); "© openAIP contributors" | **Secondary**; only at build time or if a public key is acceptable |
| planeur-net (FFVP) France airspace | `https://planeur-net.github.io/airspace/france.geojson`; `.../france.txt` (OpenAir); `.../france-exp.txt` | No | **Yes** (raw.githubusercontent `*` verified; Pages likely) | No formal licence; "free of charge, no warranty, UNOFFICIAL"; credit FFVP / planeur-net; AIP France source | **Primary airspace** (build-time fetch + 3D extrusion, with disclaimer) |
