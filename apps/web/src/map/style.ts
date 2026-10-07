/**
 * Base style: hypsometric relief (always present, also the fallback when
 * imagery is unreachable), satellite / topo backgrounds, sun-lit hillshade,
 * 3D terrain, sky, and the empty slot markers modules insert their layers into.
 */
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Basemap } from '../state/store';
import { SLOTS, slotMarker } from './modules/types';

export const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

const ign = (layer: string, format: 'image/jpeg' | 'image/png') =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&FORMAT=${encodeURIComponent(format)}&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;

export const BASEMAPS: Record<Basemap, { label: string; description: string }> = {
  topo: { label: 'Topo', description: 'OpenTopoMap (licence libre) : courbes de niveau, crêtes, noms' },
  'ign-ortho': { label: 'Satellite', description: 'Orthophotos IGN (Licence Ouverte), Sentinel‑2 ailleurs' },
  relief: { label: 'Relief', description: 'Teintes d’altitude et ombrage solaire (sans connexion aux fonds externes)' },
};

/** Muted alpine hypsometric tints. */
export const RELIEF_COLORS: ExpressionLike = [
  'interpolate',
  ['linear'],
  ['elevation'],
  -50,
  '#1d3b57',
  0,
  '#30513f',
  250,
  '#3f6346',
  600,
  '#5e7a4f',
  1000,
  '#82905d',
  1500,
  '#a59d74',
  2000,
  '#b9ab92',
  2500,
  '#cbc0b2',
  3000,
  '#ddd8d1',
  3600,
  '#eeece9',
  4500,
  '#ffffff',
];
type ExpressionLike = (string | number | ExpressionLike)[];

const slotLayers: LayerSpecification[] = SLOTS.map((s) => ({ id: slotMarker(s), type: 'background', layout: { visibility: 'none' } }) as LayerSpecification);

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
      // Topo map under an open licence (CC-BY-SA, OpenStreetMap data): contour lines, ridges, names.
      topo: {
        type: 'raster',
        tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 17,
        attribution: '© <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC‑BY‑SA), © contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      },
      terrain: {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES],
        tileSize: 256,
        maxzoom: 14,
        encoding: 'terrarium',
        attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles (AWS, Mapzen)</a>',
      },
      dem: {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES],
        tileSize: 256,
        maxzoom: 13,
        encoding: 'terrarium',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#14202b' } },
      {
        id: 'color-relief',
        type: 'color-relief',
        source: 'dem',
        paint: { 'color-relief-color': RELIEF_COLORS as never, 'color-relief-opacity': 1 },
      },
      { id: 'bm-s2', type: 'raster', source: 's2', paint: { 'raster-fade-duration': 200 } },
      { id: 'bm-ign-ortho', type: 'raster', source: 'ign-ortho', paint: { 'raster-fade-duration': 200 } },
      { id: 'bm-topo', type: 'raster', source: 'topo', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 200 } },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'dem',
        paint: {
          'hillshade-method': 'basic',
          'hillshade-shadow-color': 'rgba(12, 20, 40, 0.6)',
          'hillshade-highlight-color': 'rgba(255, 246, 222, 0.22)',
          'hillshade-accent-color': 'rgba(0,0,0,0)',
          'hillshade-exaggeration': 0.5,
          'hillshade-illumination-anchor': 'map',
          'hillshade-illumination-direction': 225,
          'hillshade-illumination-altitude': 45,
        },
      },
      ...slotLayers,
    ],
    sky: {
      'sky-color': '#4f86cf',
      'horizon-color': '#d3e2f2',
      'fog-color': '#e3ebf4',
      'sky-horizon-blend': 0.65,
      'horizon-fog-blend': 0.55,
      'fog-ground-blend': 0.18,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0],
    },
  };
}
