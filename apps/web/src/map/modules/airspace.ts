/**
 * Airspaces (FFVP / planeur-net compilation of the AIP, baked by
 * `npm run data:airspace`). Draped fills and outlines coloured by type, with
 * their floor and ceiling. Not an official source: pilots must check SIA/NOTAM.
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import type { AppState } from '../../state/store';
import { AIRSPACE_COLORS } from '../palette';
import { bboxOf, type FeatureDetails, type MapModule, type ModuleContext } from './types';

interface AirspaceProps {
  id: string;
  name: string;
  class: string;
  type: string;
  floor: string;
  ceiling: string;
  floorM: number;
  floorRef: string;
  ceilingM: number;
  notam: boolean;
  frequency: string;
}

const TYPE_LABELS: Record<string, string> = {
  P: 'Zone interdite (P)',
  R: 'Zone réglementée (R / ZRT)',
  D: 'Zone dangereuse (D)',
  CTR: 'Zone de contrôle (CTR)',
  TMA: 'Région de contrôle terminale (TMA)',
  CTA: 'Région de contrôle (CTA)',
  RMZ: 'Zone à radio obligatoire (RMZ)',
  TMZ: 'Zone à transpondeur obligatoire (TMZ)',
  GSEC: 'Secteur vol à voile (GSEC)',
  ASRA: 'Zone réservée (ASRA)',
  Q: 'Zone dangereuse (Q)',
};

export class AirspaceModule implements MapModule {
  readonly id = 'airspace';
  readonly clickableLayers = ['airspace-fill'];
  private ctx: ModuleContext | null = null;
  private features = new Map<string, { props: AirspaceProps; coords: number[][] }>();
  private loaded = false;
  private wantVisible = false;

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
  }

  /** Loaded lazily the first time the layer is switched on. */
  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const ctx = this.ctx!;
    ctx.notify({ type: 'status', module: this.id, message: 'Chargement des espaces aériens…' });
    const fc = (await fetch('data/airspace.json').then((r) => r.json())) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AirspaceProps>;
    for (const f of fc.features) {
      const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates.flat() : f.geometry.coordinates.flat(2);
      this.features.set(f.properties.id, { props: f.properties, coords });
    }
    const { map } = ctx;
    map.addSource('airspace', { type: 'geojson', data: fc });
    const color = ['match', ['get', 'type'], ...Object.entries(AIRSPACE_COLORS).flat(), '#94a3b8'] as unknown as ExpressionSpecification;
    // Zones starting above ~4000 m hardly concern paragliders: faded.
    const relevance = ['case', ['<', ['get', 'floorM'], 4000], 1, 0.35] as ExpressionSpecification;
    ctx.addLayer({ id: 'airspace-fill', type: 'fill', source: 'airspace', paint: { 'fill-color': color, 'fill-opacity': ['*', 0.1, relevance] } }, 'areas');
    ctx.addLayer(
      {
        id: 'airspace-line',
        type: 'line',
        source: 'airspace',
        paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 2.2], 'line-opacity': ['*', 0.85, relevance] },
      },
      'areas',
    );
    ctx.addLayer(
      {
        id: 'airspace-label',
        type: 'symbol',
        source: 'airspace',
        minzoom: 9,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 400,
          'text-field': ['concat', ['get', 'name'], '  ', ['get', 'floor'], ' → ', ['get', 'ceiling']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-max-angle': 25,
        },
        paint: { 'text-color': color, 'text-halo-color': 'rgba(10,15,25,0.9)', 'text-halo-width': 1.2 },
      },
      'labels',
    );
    this.setVisible(this.wantVisible);
    ctx.notify({ type: 'status', module: this.id, message: null });
  }

  private setVisible(on: boolean): void {
    const map = this.ctx!.map;
    for (const id of ['airspace-fill', 'airspace-line', 'airspace-label']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }

  apply(s: AppState, prev: AppState | null): void {
    if (prev && prev.layers.airspace === s.layers.airspace) return;
    this.wantVisible = s.layers.airspace;
    if (s.layers.airspace && !this.loaded) void this.load().catch(() => this.ctx?.notify({ type: 'status', module: this.id, message: 'Espaces aériens indisponibles' }));
    else if (this.loaded) this.setVisible(s.layers.airspace);
  }

  describe(id: string): FeatureDetails | null {
    const f = this.features.get(id);
    if (!f) return null;
    const p = f.props;
    return {
      ref: `${this.id}:${id}`,
      category: 'Espace aérien',
      title: p.name,
      badges: [{ label: TYPE_LABELS[p.type] ?? p.type, tone: p.type === 'P' || p.type === 'R' ? 'bad' : 'info' }, { label: `Classe ${p.class}` }],
      stat: `${p.floor} → ${p.ceiling}`,
      details: [
        ['Plancher', p.floor],
        ['Plafond', p.ceiling],
        ...(p.frequency ? ([['Fréquence', p.frequency]] as [string, string][]) : []),
        ...(p.notam ? ([['Activation', 'par NOTAM']] as [string, string][]) : []),
      ],
      warning: 'Compilation bénévole FFVP de l’AIP, non officielle : vérifiez toujours le SIA, les SUP AIP et les NOTAM avant de voler.',
      links: [{ label: 'Source : planeur-net/airspace (FFVP)', url: 'https://github.com/planeur-net/airspace' }],
      bbox: bboxOf(f.coords),
    };
  }
}
