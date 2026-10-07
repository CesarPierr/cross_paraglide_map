/**
 * Take-offs and landings from external directories (FFVL official list,
 * OpenStreetMap, ParaglidingEarth), loaded for the visible area and merged.
 * Community entries that duplicate an official one (< 250 m) are hidden.
 */
import type { FlyingSite, SiteProvider } from '@brises/shared';
import type { ExpressionSpecification } from 'maplibre-gl';
import type { AppState } from '../../state/store';
import { bboxOf, type FeatureDetails, type MapModule, type ModuleContext } from './types';

const KIND_LABEL = { takeoff: 'Décollage', landing: 'Atterrissage', site: 'Site de vol' } as const;

export class SitesModule implements MapModule {
  readonly id = 'sites';
  readonly clickableLayers = ['sites-takeoff', 'sites-landing'];
  private ctx: ModuleContext | null = null;
  private sites = new Map<string, FlyingSite>();
  private covered = new Map<string, [number, number, number, number][]>();
  private failed = new Set<string>();
  private timer = 0;
  private abort: AbortController | null = null;
  private showOfficial = true;
  private showCommunity = true;

  constructor(private providers: SiteProvider[]) {}

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
    const { map } = ctx;
    map.addSource('ext-sites', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const official = ['==', ['get', 'status'], 'official'] as ExpressionSpecification;
    for (const kind of ['landing', 'takeoff'] as const)
      ctx.addLayer(
        {
          id: `sites-${kind}`,
          type: 'symbol',
          source: 'ext-sites',
          minzoom: 8,
          filter: ['all', ['==', ['get', 'kind'], kind === 'takeoff' ? 'takeoff' : 'landing'], ['!', ['get', 'dup']]],
          layout: {
            'icon-image': ['case', official, kind, `${kind}-community`],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.45, 13, 0.85],
            'icon-allow-overlap': true,
            'text-field': ['step', ['zoom'], '', 12, ['concat', ['get', 'name'], ['case', ['has', 'orient'], ['concat', '\n', ['get', 'orient']], '']]],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10.5,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-optional': true,
            'text-max-width': 10,
          },
          paint: { 'text-color': '#e2e8f0', 'text-halo-color': 'rgba(15,23,42,0.9)', 'text-halo-width': 1.2 },
        },
        'points',
      );
    map.on('moveend', () => this.schedule());
    this.schedule();
  }

  apply(s: AppState, prev: AppState | null): void {
    if (prev && prev.layers.sitesOfficial === s.layers.sitesOfficial && prev.layers.sitesCommunity === s.layers.sitesCommunity) return;
    this.showOfficial = s.layers.sitesOfficial;
    this.showCommunity = s.layers.sitesCommunity;
    const map = this.ctx?.map;
    const any = this.showOfficial || this.showCommunity;
    if (map) for (const id of this.clickableLayers) map.setLayoutProperty(id, 'visibility', any ? 'visible' : 'none');
    this.render();
    this.schedule();
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.load(), 450);
  }

  private wanted(p: SiteProvider): boolean {
    return p.id === 'ffvl' ? this.showOfficial : this.showCommunity;
  }

  private async load(): Promise<void> {
    const map = this.ctx?.map;
    if (!map) return;
    const zoom = map.getZoom();
    const b = map.getBounds();
    // Round outwards so small pans reuse the previous request.
    const q = (v: number, up: boolean) => (up ? Math.ceil(v * 10) : Math.floor(v * 10)) / 10;
    const bbox: [number, number, number, number] = [q(b.getWest(), false), q(Math.max(b.getSouth(), 43), false), q(b.getEast(), true), q(Math.min(b.getNorth(), 47.5), true)];
    if ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) > 6) return; // too large: wait for a closer view
    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    const jobs = this.providers
      .filter((p) => this.wanted(p) && zoom >= p.minZoom && !this.failed.has(p.id))
      .filter((p) => !(this.covered.get(p.id) ?? []).some((c) => c[0] <= bbox[0] && c[1] <= bbox[1] && c[2] >= bbox[2] && c[3] >= bbox[3]))
      .map(async (p) => {
        try {
          const list = await p.fetch(bbox, abort.signal);
          for (const site of list) this.sites.set(`${p.id}:${site.id}`, site);
          this.covered.set(p.id, [...(this.covered.get(p.id) ?? []), bbox]);
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          // CORS refusal or outage: stop asking this directory for the session.
          this.failed.add(p.id);
          this.ctx?.notify({ type: 'status', module: this.id, message: `${p.label} indisponible` });
        }
      });
    if (!jobs.length) return;
    await Promise.all(jobs);
    this.render();
    this.ctx?.notify({ type: 'data', module: this.id });
  }

  private render(): void {
    const map = this.ctx?.map;
    const src = map?.getSource('ext-sites') as { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined;
    if (!src?.setData) return;
    const list = [...this.sites.entries()].filter(([, s]) => (s.status === 'official' ? this.showOfficial : this.showCommunity));
    const officials = list.filter(([, s]) => s.status === 'official').map(([, s]) => s);
    const near = (a: FlyingSite, b: FlyingSite) => Math.abs(a.lat - b.lat) < 0.0023 && Math.abs(a.lon - b.lon) < 0.0032;
    src.setData({
      type: 'FeatureCollection',
      features: list.map(([key, s]) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          id: key,
          kind: s.kind === 'site' ? 'takeoff' : s.kind,
          status: s.status ?? 'community',
          name: s.name,
          ...(s.orientations?.length ? { orient: s.orientations.join(' ') } : {}),
          dup: s.status !== 'official' && officials.some((o) => o.kind === s.kind && near(o, s)),
        },
      })),
    });
  }

  describe(id: string): FeatureDetails | null {
    const s = this.sites.get(id);
    if (!s) return null;
    const provider = this.providers.find((p) => p.id === s.provider);
    return {
      ref: `${this.id}:${id}`,
      category: KIND_LABEL[s.kind],
      title: s.name,
      badges: [{ label: s.status === 'official' ? 'Site officiel' : 'Annuaire communautaire', tone: s.status === 'official' ? 'ok' : 'info' }, { label: provider?.label ?? s.provider }],
      details: [
        ...(s.altitude ? ([['Altitude', `${Math.round(s.altitude)} m`]] as [string, string][]) : []),
        ...(s.orientations?.length ? ([['Orientation', s.orientations.join(', ')]] as [string, string][]) : []),
        ['Coordonnées', `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`],
      ],
      paragraphs: s.description ? [s.description] : undefined,
      links: s.url ? [{ label: 'Fiche du site', url: s.url }] : undefined,
      warning: s.status === 'official' ? undefined : 'Site issu d’un annuaire communautaire : statut, accès et autorisations à vérifier localement.',
      attribution: provider?.attribution,
      bbox: bboxOf([[s.lon, s.lat]]),
    };
  }
}
