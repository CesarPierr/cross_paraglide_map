/**
 * Base style: satellite / topo backgrounds, 3D terrain, hillshade lit by the
 * sun of the selected hour, and OpenFreeMap labels (places and summits).
 */
import type { StyleSpecification } from 'maplibre-gl';
import type { Basemap } from '../state/store';

export const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

const ign = (layer: string, format: 'image/jpeg' | 'image/png') =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&FORMAT=${encodeURIComponent(format)}&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;

export const BASEMAPS: Record<Basemap, { label: string; description: string }> = {
  'ign-ortho': { label: 'Satellite IGN', description: 'Orthophotos IGN (France), Sentinel‑2 ailleurs' },
  s2: { label: 'Sentinel‑2', description: 'Mosaïque satellite sans nuages (EOX)' },
  'ign-plan': { label: 'Plan IGN', description: 'Carte topographique IGN' },
  otm: { label: 'OpenTopoMap', description: 'Carte topo OpenStreetMap' },
};

export const KK7_SRC = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';

export function buildStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      s2: {
        type: 'raster',
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
        tileSize: 256,
        maxzoom: 15,
        attribution:
          '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel‑2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)',
      },
      'ign-ortho': {
        type: 'raster',
        tiles: [ign('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg')],
        tileSize: 256,
        minzoom: 6,
        maxzoom: 18,
        bounds: [-5.5, 41.2, 10, 51.2],
        attribution: '<a href="https://geoservices.ign.fr" target="_blank" rel="noopener">© IGN – Géoplateforme</a>',
      },
      'ign-plan': {
        type: 'raster',
        tiles: [ign('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', 'image/png')],
        tileSize: 256,
        maxzoom: 18,
        attribution: '<a href="https://geoservices.ign.fr" target="_blank" rel="noopener">© IGN – Plan IGN</a>',
      },
      otm: {
        type: 'raster',
        tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 17,
        attribution: '© <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC‑BY‑SA), © contributeurs OpenStreetMap',
      },
      terrain: {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES],
        tileSize: 256,
        maxzoom: 14,
        encoding: 'terrarium',
        attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles (AWS, Mapzen)</a>',
      },
      hillshade: {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES],
        tileSize: 256,
        maxzoom: 13,
        encoding: 'terrarium',
      },
      'kk7-thermals': {
        type: 'raster',
        tiles: [`https://thermal.kk7.ch/tiles/thermals_all_all/{z}/{x}/{y}.png?src=${KK7_SRC}`],
        scheme: 'tms',
        tileSize: 256,
        maxzoom: 12,
        attribution: 'Thermiques © <a href="https://thermal.kk7.ch" target="_blank" rel="noopener">thermal.kk7.ch</a> (CC BY‑NC‑SA 4.0)',
      },
      'kk7-skyways': {
        type: 'raster',
        tiles: [`https://thermal.kk7.ch/tiles/skyways_all_all/{z}/{x}/{y}.png?src=${KK7_SRC}`],
        scheme: 'tms',
        tileSize: 256,
        maxzoom: 13,
        attribution: 'Skyways © <a href="https://thermal.kk7.ch" target="_blank" rel="noopener">thermal.kk7.ch</a> (CC BY‑NC‑SA 4.0)',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#1b2430' } },
      { id: 'bm-s2', type: 'raster', source: 's2', paint: { 'raster-fade-duration': 150 } },
      { id: 'bm-ign-ortho', type: 'raster', source: 'ign-ortho', paint: { 'raster-fade-duration': 150 } },
      { id: 'bm-ign-plan', type: 'raster', source: 'ign-plan', layout: { visibility: 'none' } },
      { id: 'bm-otm', type: 'raster', source: 'otm', layout: { visibility: 'none' } },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshade',
        paint: {
          'hillshade-shadow-color': 'rgba(10, 18, 40, 0.55)',
          'hillshade-highlight-color': 'rgba(255, 244, 214, 0.18)',
          'hillshade-accent-color': 'rgba(0,0,0,0)',
          'hillshade-exaggeration': 0.45,
          'hillshade-illumination-anchor': 'map',
          'hillshade-illumination-direction': 225,
        },
      },
      { id: 'kk7-thermals', type: 'raster', source: 'kk7-thermals', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.75 } },
      { id: 'kk7-skyways', type: 'raster', source: 'kk7-skyways', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.8 } },
    ],
    sky: {
      'sky-color': '#5b8fd6',
      'horizon-color': '#cfe0f2',
      'fog-color': '#e3ebf4',
      'sky-horizon-blend': 0.7,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.15,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0],
    },
  };
}

/** Vector source for labels; added after load so a third-party outage never blocks the map. */
export const LABEL_SOURCE = {
  type: 'vector' as const,
  url: 'https://tiles.openfreemap.org/planet',
  attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
};

/** Label layers from OpenFreeMap (OpenMapTiles schema), added on top of everything. */
export const LABEL_LAYERS = [
  {
    id: 'lbl-peaks',
    type: 'symbol' as const,
    source: 'openfreemap',
    'source-layer': 'mountain_peak',
    minzoom: 10,
    filter: ['all', ['has', 'name'], ['>', ['coalesce', ['get', 'ele'], 0], 1200]],
    layout: {
      'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'ele']], ' m'],
      'text-font': ['Noto Sans Italic'],
      'text-size': 11,
      'text-anchor': 'bottom',
      'text-offset': [0, -0.4],
      'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'ele'], 0]],
    },
    paint: { 'text-color': '#f3f6fb', 'text-halo-color': 'rgba(20,28,40,0.85)', 'text-halo-width': 1.3 },
  },
  {
    id: 'lbl-places',
    type: 'symbol' as const,
    source: 'openfreemap',
    'source-layer': 'place',
    minzoom: 7,
    filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false],
    layout: {
      'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, ['match', ['get', 'class'], 'city', 13, 10], 12, ['match', ['get', 'class'], 'city', 16, 'town', 13, 12]],
      'symbol-sort-key': ['match', ['get', 'class'], 'city', 0, 'town', 1, 2],
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(20,28,40,0.9)', 'text-halo-width': 1.5 },
  },
];
