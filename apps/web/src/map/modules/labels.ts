/** Place names and summits from OpenFreeMap vector tiles (added after load so an outage never blocks the map). */
import type { LayerSpecification } from 'maplibre-gl';
import type { AppState } from '../../state/store';
import type { MapModule, ModuleContext } from './types';

const LAYERS: LayerSpecification[] = [
  {
    id: 'lbl-peaks',
    type: 'symbol',
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
    type: 'symbol',
    source: 'openfreemap',
    'source-layer': 'place',
    minzoom: 7.5,
    filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false],
    layout: {
      'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, ['match', ['get', 'class'], 'city', 12, 9], 12, ['match', ['get', 'class'], 'city', 15, 'town', 13, 11.5]],
      'symbol-sort-key': ['match', ['get', 'class'], 'city', 0, 'town', 1, 2],
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(20,28,40,0.9)', 'text-halo-width': 1.5 },
  },
];

export class LabelsModule implements MapModule {
  readonly id = 'labels';
  private ctx: ModuleContext | null = null;

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
    ctx.map.addSource('openfreemap', {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    });
    for (const l of LAYERS) ctx.addLayer(l, 'labels');
  }

  apply(s: AppState, prev: AppState | null): void {
    if (prev && prev.layers.labels === s.layers.labels && prev.basemap === s.basemap) return;
    // The topo map prints its own place names: ours would double them.
    const on = s.layers.labels && s.basemap !== 'topo';
    for (const l of LAYERS) this.ctx?.map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none');
  }
}
