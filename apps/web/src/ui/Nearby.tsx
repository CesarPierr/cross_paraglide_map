/**
 * What the sources say around a clicked point: the closest documented items
 * (thermals, relaunch points, hazards, breezes, convergences, take-offs…)
 * within a few kilometres, each with its distance and its sources.
 */
import type { Atlas, FeatureCategory } from '@brises/shared';
import { useMemo } from 'react';
import { BREEZE_COLORS, COLORS } from '../map/palette';
import { useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { showSheet } from './mobile';

const RADIUS_KM = 3;
const MAX_ITEMS = 6;

const CAT: Record<FeatureCategory, { label: string; color: string }> = {
  thermals: { label: 'Thermique', color: COLORS.thermal },
  hazards: { label: 'Piège', color: COLORS.hazard },
  breezes: { label: 'Brise', color: BREEZE_COLORS.valley },
  convergences: { label: 'Convergence', color: COLORS.convergence },
  soaring: { label: 'Soaring', color: COLORS.soaring },
  takeoffs: { label: 'Déco', color: COLORS.takeoff },
  landings: { label: 'Atterro', color: COLORS.landing },
  routes: { label: 'Itinéraire', color: COLORS.route },
};

/** Point-features weigh a little more than lines passing nearby (a breeze crosses whole valleys). */
const LINE_PENALTY_KM = 0.4;

function nearest(atlas: Atlas, lon: number, lat: number) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  const out: { id: string; cat: FeatureCategory; name: string; km: number; sources: string[] }[] = [];
  for (const cat of Object.keys(atlas.features) as FeatureCategory[]) {
    for (const f of atlas.features[cat]) {
      const g = f.geometry;
      let best = Infinity;
      if (g.type === 'Point') best = Math.hypot((g.coordinates[0] - lon) * kx, (g.coordinates[1] - lat) * ky);
      else
        for (const [x, y] of g.coordinates) {
          const d = Math.hypot((x - lon) * kx, (y - lat) * ky);
          if (d < best) best = d;
        }
      if (best > RADIUS_KM) continue;
      const p = f.properties;
      out.push({ id: p.id, cat, name: p.name, km: best, sources: p.sources ? p.sources.split(',') : [] });
    }
  }
  return out.sort((a, b) => a.km + (a.cat === 'breezes' || a.cat === 'routes' ? LINE_PENALTY_KM : 0) - (b.km + (b.cat === 'breezes' || b.cat === 'routes' ? LINE_PENALTY_KM : 0))).slice(0, MAX_ITEMS);
}

function open(id: string) {
  const c = getController();
  const d = c?.describe(`atlas:${id}`);
  if (!d) return;
  useRuntime.getState().set({ feature: d });
  showSheet();
}

const shortPub = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);

export function NearbySources({ lon, lat }: { lon: number; lat: number }) {
  const atlas = useRuntime((r) => r.atlas);
  const items = useMemo(() => (atlas ? nearest(atlas, lon, lat) : []), [atlas, lon, lat]);
  if (!atlas) return null;
  return (
    <section className="nearby">
      <p className="nearby-title">Ce que disent les sources ici · {RADIUS_KM} km</p>
      {items.length === 0 ? (
        <p className="muted small">Aucun élément documenté à moins de {RADIUS_KM} km.</p>
      ) : (
        <ul>
          {items.map((it) => {
            const srcs = it.sources.map((s) => atlas.sources[s]).filter(Boolean);
            return (
              <li key={it.id}>
                <button className="nearby-item" onClick={() => open(it.id)}>
                  <span className="dot" style={{ background: CAT[it.cat].color }} />
                  <span className="nearby-name">{it.name}</span>
                  <span className="nearby-km">{it.km < 0.1 ? 'ici' : `${it.km.toFixed(1).replace('.', ',')} km`}</span>
                </button>
                {srcs.length > 0 && (
                  <span className="nearby-srcs">
                    {CAT[it.cat].label} ·{' '}
                    {srcs.slice(0, 2).map((s, i) => (
                      <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>
                        {i > 0 ? ', ' : ''}
                        {shortPub(s.publisher || s.title)}
                      </a>
                    ))}
                    {srcs.length > 2 && ` +${srcs.length - 2}`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
