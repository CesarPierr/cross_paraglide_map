/**
 * Airspaces for free flight (POAFF dataset of Pascal Bazile, data.gouv.fr,
 * baked by `npm run data:airspace`). Three families, toggled separately:
 * regulation (P/R/D zones, controlled airspace, FFVL/FFVP protocols),
 * wildlife and parks (overflight limits), and other air activities
 * (parachuting, winches, gliding, model flying). Not an official source:
 * pilots must check SIA/NOTAM.
 */
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import type { AppState, LayerKey } from '../../state/store';
import { AIRSPACE_COLORS } from '../palette';
import { bboxOf, type FeatureDetails, type MapModule, type ModuleContext } from './types';

type Group = 'regulated' | 'controlled' | 'protocol' | 'protect' | 'activity';

interface AirspaceProps {
  id: string;
  name: string;
  group: Group;
  type: string;
  class: string;
  activity: string;
  floor: string;
  ceiling: string;
  floorM: number;
  floorAgl: boolean;
  ceilingM: number;
  activation: string;
  desc: string;
  notam: boolean;
  protocol?: string;
}

interface AirspaceFile extends GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AirspaceProps> {
  source: string;
  url: string;
  license?: string;
  release?: string;
}

export const AIRSPACE_TYPE_LABELS: Record<string, string> = {
  P: 'Zone interdite (P)',
  R: 'Zone réglementée (R)',
  D: 'Zone dangereuse (D)',
  ZRT: 'Zone réglementée temporaire (ZRT)',
  RTBA: 'Réseau très basse altitude militaire (RTBA)',
  TSA: 'Zone temporairement réservée (TSA)',
  TRA: 'Zone temporairement réservée (TRA)',
  CBA: 'Zone transfrontalière (CBA)',
  Q: 'Zone dangereuse (Q)',
  CTR: 'Zone de contrôle d’aérodrome (CTR)',
  TMA: 'Région de contrôle terminale (TMA)',
  CTA: 'Région de contrôle (CTA)',
  LTA: 'Région inférieure de contrôle (LTA)',
  RMZ: 'Zone à radio obligatoire (RMZ)',
  TMZ: 'Zone à transpondeur obligatoire (TMZ)',
  'FFVL-Prot': 'Protocole FFVL : vol libre autorisé sous conditions',
  'FFVP-Prot': 'Protocole FFVP (vol à voile)',
  PROTECT: 'Zone de protection (faune, parc, site sensible)',
  PRN: 'Parc ou réserve naturelle : survol à éviter',
  SUR: 'Site sensible : survol à éviter',
  AER: 'Aéromodélisme',
  PJE: 'Parachutage',
  VOL: 'Activité vol à voile',
  TRPLA: 'Treuillage de planeurs',
  TRVL: 'Treuillage vol libre',
  BAL: 'Ballons',
  AP: 'Drones (activité particulière)',
};

const GROUP_LABELS: Record<Group, string> = {
  regulated: 'Zone réglementée',
  controlled: 'Espace contrôlé',
  protocol: 'Protocole vol libre',
  protect: 'Protection de la faune',
  activity: 'Activité aérienne',
};

/** Which map toggle shows which family. */
const TOGGLE_GROUPS: [LayerKey, Group[]][] = [
  ['airspace', ['regulated', 'controlled', 'protocol']],
  ['airspaceProtect', ['protect']],
  ['airspaceActivity', ['activity']],
];

const LAYERS = ['airspace-fill', 'airspace-line', 'airspace-label'] as const;

export class AirspaceModule implements MapModule {
  readonly id = 'airspace';
  readonly clickableLayers = ['airspace-fill'];
  private ctx: ModuleContext | null = null;
  private features = new Map<string, { props: AirspaceProps; coords: number[][] }>();
  private meta: Pick<AirspaceFile, 'source' | 'url' | 'license' | 'release'> | null = null;
  private loading: Promise<void> | null = null;
  private groups: Group[] = [];

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
  }

  /** Loaded lazily the first time one of the toggles is switched on. */
  private load(): Promise<void> {
    this.loading ??= (async () => {
      const ctx = this.ctx!;
      ctx.notify({ type: 'status', module: this.id, message: 'Chargement des espaces aériens…' });
      const fc = (await fetch('data/airspace.json').then((r) => r.json())) as AirspaceFile;
      this.meta = { source: fc.source, url: fc.url, license: fc.license, release: fc.release };
      for (const f of fc.features) {
        const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates.flat() : f.geometry.coordinates.flat(2);
        this.features.set(f.properties.id, { props: f.properties, coords });
      }
      const { map } = ctx;
      map.addSource('airspace', { type: 'geojson', data: fc });
      const color = ['match', ['get', 'type'], ...Object.entries(AIRSPACE_COLORS).flat(), '#94a3b8'] as unknown as ExpressionSpecification;
      // Zones starting high above the ground hardly concern paragliders: faded.
      const relevance = ['case', ['any', ['get', 'floorAgl'], ['<', ['get', 'floorM'], 3000]], 1, 0.4] as ExpressionSpecification;
      const fillOpacity = ['match', ['get', 'group'], 'protect', 0.16, 'protocol', 0.18, 'activity', 0.12, 0.09] as ExpressionSpecification;
      ctx.addLayer({ id: 'airspace-fill', type: 'fill', source: 'airspace', paint: { 'fill-color': color, 'fill-opacity': ['*', fillOpacity, relevance] } }, 'areas');
      ctx.addLayer(
        {
          id: 'airspace-line',
          type: 'line',
          source: 'airspace',
          paint: {
            'line-color': color,
            'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 2.2],
            'line-opacity': ['*', 0.85, relevance],
            // Wildlife and activity zones are advisory: dashed outline.
            'line-dasharray': ['match', ['get', 'group'], 'protect', ['literal', [2, 1.5]], 'activity', ['literal', [1, 1.5]], ['literal', [1, 0]]],
          },
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
      this.refresh();
      ctx.notify({ type: 'status', module: this.id, message: null });
    })();
    return this.loading;
  }

  private refresh(): void {
    const map = this.ctx!.map;
    const filter = ['in', ['get', 'group'], ['literal', this.groups]] as FilterSpecification;
    for (const id of LAYERS) {
      if (!map.getLayer(id)) continue;
      map.setFilter(id, filter);
      map.setLayoutProperty(id, 'visibility', this.groups.length ? 'visible' : 'none');
    }
  }

  apply(s: AppState, prev: AppState | null): void {
    if (prev && TOGGLE_GROUPS.every(([k]) => prev.layers[k] === s.layers[k])) return;
    this.groups = TOGGLE_GROUPS.filter(([k]) => s.layers[k]).flatMap(([, g]) => g);
    if (!this.groups.length && !this.loading) return;
    if (!this.loading) void this.load().catch(() => this.ctx?.notify({ type: 'status', module: this.id, message: 'Espaces aériens indisponibles' }));
    else if (this.features.size) this.refresh();
  }

  describe(id: string): FeatureDetails | null {
    const f = this.features.get(id);
    if (!f) return null;
    const p = f.props;
    const tone = p.type === 'P' || p.type === 'R' || p.type === 'RTBA' || p.type === 'ZRT' ? 'bad' : p.group === 'protocol' ? 'ok' : p.group === 'protect' ? 'warn' : 'info';
    const release = this.meta?.release ? ` (version du ${this.meta.release.slice(6, 8)}/${this.meta.release.slice(4, 6)}/${this.meta.release.slice(0, 4)})` : '';
    return {
      ref: `${this.id}:${id}`,
      category: GROUP_LABELS[p.group] ?? 'Espace aérien',
      title: p.name,
      badges: [{ label: AIRSPACE_TYPE_LABELS[p.type] ?? p.type, tone }, ...(p.class && p.class.length <= 2 ? [{ label: `Classe ${p.class}` }] : [])],
      stat: `${p.floor} → ${p.ceiling}`,
      details: [
        ['Plancher', p.floor],
        ['Plafond', p.ceiling],
        ...(p.activation ? ([['Activation', p.activation]] as [string, string][]) : []),
        ...(p.notam ? ([['NOTAM', 'activité annoncée par NOTAM : à consulter']] as [string, string][]) : []),
      ],
      paragraphs: p.desc ? [p.desc] : undefined,
      warning: `Compilation POAFF${release} à partir du SIA et des protocoles, non officielle : vérifiez toujours le SIA, les SUP AIP et les NOTAM avant de voler.`,
      links: [
        ...(p.protocol ? [{ label: 'Protocole (PDF)', url: p.protocol }] : []),
        { label: 'Source : POAFF, cartographie vol libre (data.gouv.fr)', url: this.meta?.url ?? 'https://www.data.gouv.fr/datasets/cartographies-aeriennes-dediees-a-la-pratique-du-vol-libre' },
        { label: 'SIA : cartes et SUP AIP', url: 'https://www.sia.aviation-civile.gouv.fr/' },
      ],
      bbox: bboxOf(f.coords),
      attribution: this.meta?.license ? `${this.meta.source} · ${this.meta.license}` : undefined,
    };
  }
}
