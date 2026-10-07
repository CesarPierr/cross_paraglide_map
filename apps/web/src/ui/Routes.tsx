/**
 * Cross-country routes: the documented ones (filter, open, read leg by leg)
 * and the user's own, traced on the map. Each leg is read against the atlas:
 * relaunch climbs, hazards, convergences, and the breezes of the simulated
 * hour as head, tail or cross wind.
 */
import type { Atlas, AtlasFeature } from '@brises/shared';
import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../map/palette';
import { useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { IconSearch } from './icons';
import { showBrowse } from './mobile';
import { cleanPlace } from './Tour';
import { analyseRoute, distKm, type LegReport, type LngLat } from './route-analysis';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const LENGTHS = [
  { key: 'all', label: 'Toutes', test: () => true },
  { key: 'short', label: '< 60 km', test: (km: number) => km < 60 },
  { key: 'mid', label: '60–150 km', test: (km: number) => km >= 60 && km <= 150 },
  { key: 'long', label: '> 150 km', test: (km: number) => km > 150 },
] as const;

const routeKm = (f: AtlasFeature) => {
  const d = Number.parseFloat((f.properties.details?.Distance ?? '').replace(',', '.'));
  if (Number.isFinite(d)) return d;
  const c = f.geometry.coordinates as LngLat[];
  return c.slice(1).reduce((s, p, i) => s + distKm(c[i], p), 0);
};

function openAtlas(id: string) {
  const c = getController();
  const d = c?.describe(`atlas:${id}`);
  if (!d) return;
  useRuntime.getState().set({ feature: d });
  showBrowse();
}

/** Shows a documented route as the current plan (drawn, analysed below). */
function showRoute(f: AtlasFeature) {
  const pts = f.geometry.coordinates as LngLat[];
  const names = (f.properties.details?.Points ?? '').split(' → ').map(cleanPlace);
  useRuntime.getState().set({ plan: { points: pts, names, picking: false, title: f.properties.name } });
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  getController()?.flyToBbox([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], { maxZoom: 11 });
}

const REL: Record<string, string> = { face: 'de face', dos: 'de dos', travers: 'de travers' };

function Leg({ leg, i }: { leg: LegReport; i: number }) {
  const fly = () => getController()?.map.flyTo({ center: leg.to, zoom: 12, duration: 1400 });
  return (
    <li className="leg">
      <button className="leg-head" onClick={fly}>
        <span className="leg-n">{i + 1}</span>
        <span className="leg-name">
          {leg.fromName || `Point ${i + 1}`} → {leg.toName || `Point ${i + 2}`}
        </span>
        <span className="leg-km">{leg.km.toFixed(1).replace('.', ',')} km</span>
      </button>
      <ul className="leg-facts">
        {leg.climbs.slice(0, 2).map((c) => (
          <li key={c.id}>
            <i style={{ background: COLORS.thermal }} />
            <button onClick={() => openAtlas(c.id)}>Relance : {c.name}</button>
            {c.details?.Heures && <small> · {c.details.Heures}</small>}
          </li>
        ))}
        {leg.breezes.map((b) => (
          <li key={b.p.id}>
            <i style={{ background: b.relation === 'face' ? COLORS.hazard : '#38bdf8' }} />
            <button onClick={() => openAtlas(b.p.id)}>
              Brise {REL[b.relation]} : {b.p.name}
            </button>
            {b.p.speedKmh ? <small> · ≈ {b.p.speedKmh} km/h</small> : null}
          </li>
        ))}
        {leg.convergences.map((c) => (
          <li key={c.id}>
            <i style={{ background: COLORS.convergence }} />
            <button onClick={() => openAtlas(c.id)}>Convergence : {c.name}</button>
          </li>
        ))}
        {leg.hazards.map((h) => (
          <li key={h.id} className="warn">
            <i style={{ background: COLORS.hazard }} />
            <button onClick={() => openAtlas(h.id)}>Attention : {h.name}</button>
          </li>
        ))}
        {!leg.climbs.length && !leg.breezes.length && !leg.hazards.length && !leg.convergences.length && <li className="muted">Rien de documenté sur ce tronçon.</li>}
      </ul>
    </li>
  );
}

/** Leg-by-leg reading of the current plan at the simulated hour. */
export function PlanReading() {
  const atlas = useRuntime((r) => r.atlas);
  const plan = useRuntime((r) => r.plan);
  const hour = useApp((s) => s.hour);
  const legs = useMemo(() => (atlas && plan && plan.points.length > 1 ? analyseRoute(atlas, plan.points, plan.names, hour) : []), [atlas, plan, hour]);

  // Keep the drawn route in sync with the plan.
  useEffect(() => {
    getController()?.setRoute(plan?.points ?? []);
    getController()?.setPicking(!!plan?.picking);
  }, [plan]);
  // Leaving the routes panel hides the drawing; the plan itself is kept.
  useEffect(
    () => () => {
      getController()?.setRoute([]);
      getController()?.setPicking(false);
    },
    [],
  );

  if (!plan) return null;
  const total = legs.reduce((s, l) => s + l.km, 0);
  const head = legs.filter((l) => l.breezes.some((b) => b.relation === 'face')).length;
  const set = (patch: Partial<NonNullable<typeof plan>>) => useRuntime.getState().set({ plan: { ...plan, ...patch } });
  return (
    <section className="plan">
      <div className="plan-head">
        <b>{plan.title ?? 'Mon itinéraire'}</b>
        <button className="icon-btn ghost" aria-label="Fermer l’itinéraire" onClick={() => useRuntime.getState().set({ plan: null })}>
          ×
        </button>
      </div>
      {plan.picking && <p className="hint">Touchez la carte pour poser les points de passage, dans l’ordre du vol.</p>}
      {!plan.title && (
        <div className="sheet-actions">
          <button className={`btn small ${plan.picking ? 'primary' : ''}`} onClick={() => set({ picking: !plan.picking })}>
            {plan.picking ? 'Terminer le tracé' : 'Ajouter des points'}
          </button>
          <button className="btn ghost small" disabled={!plan.points.length} onClick={() => set({ points: plan.points.slice(0, -1), names: plan.names.slice(0, -1) })}>
            Annuler le dernier
          </button>
        </div>
      )}
      {legs.length > 0 && (
        <>
          <p className="plan-sum">
            {total.toFixed(0)} km · {legs.length} tronçon{legs.length > 1 ? 's' : ''}
            {head ? ` · brise de face sur ${head}` : ''} · lecture à {Math.floor(hour)}h{String(Math.round((hour % 1) * 60)).padStart(2, '0')}
          </p>
          <ol className="legs">
            {legs.map((l, i) => (
              <Leg key={i} leg={l} i={i} />
            ))}
          </ol>
          <p className="muted small">Relances, pièges et brises documentés à moins de 1,5 km du tronçon. Changez l’heure en bas pour voir la journée évoluer.</p>
        </>
      )}
    </section>
  );
}

export function RoutesBrowser({ atlas }: { atlas: Atlas }) {
  const [q, setQ] = useState('');
  const [len, setLen] = useState<(typeof LENGTHS)[number]['key']>('all');
  const plan = useRuntime((r) => r.plan);
  const regionOf = useMemo(() => new Map(atlas.massifs.map((m) => [m.id, m.region])), [atlas]);
  const groups = useMemo(() => {
    const needle = norm(q.trim());
    const test = LENGTHS.find((l) => l.key === len)!.test;
    const list = atlas.features.routes.filter((f) => test(routeKm(f)) && (!needle || norm(`${f.properties.name} ${f.properties.details?.Points ?? ''}`).includes(needle)));
    const by = new Map<string, AtlasFeature[]>();
    for (const f of list) {
      const r = regionOf.get(f.properties.massif) ?? 'Alpes';
      by.set(r, [...(by.get(r) ?? []), f]);
    }
    return [...by.entries()].map(([region, routes]) => ({ region, routes: routes.sort((a, b) => routeKm(b) - routeKm(a)) }));
  }, [atlas, q, len, regionOf]);
  return (
    <div className="browser">
      <PlanReading />
      {!plan && (
        <button className="btn small primary plan-start" onClick={() => useRuntime.getState().set({ plan: { points: [], names: [], picking: true } })}>
          Tracer mon itinéraire
        </button>
      )}
      <label className="search">
        <IconSearch size={16} />
        <input type="search" placeholder="Itinéraire, site, col…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un itinéraire" />
      </label>
      <div className="chips" role="group" aria-label="Distance">
        {LENGTHS.map((l) => (
          <button key={l.key} className={`chip ${len === l.key ? 'active' : ''}`} onClick={() => setLen(l.key)}>
            {l.label}
          </button>
        ))}
      </div>
      {groups.map((g) => (
        <section key={g.region} className="region">
          <h3>{g.region}</h3>
          <ul>
            {g.routes.map((f) => (
              <li key={f.properties.id}>
                <button onClick={() => showRoute(f)}>
                  <span className="item-name">
                    {f.properties.name}
                    <small>{f.properties.details?.Points?.split(' → ').slice(0, 4).join(' → ')}</small>
                  </span>
                  <span className="tag">{Math.round(routeKm(f))} km</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!groups.length && <p className="muted small">Aucun itinéraire pour ce filtre.</p>}
    </div>
  );
}
