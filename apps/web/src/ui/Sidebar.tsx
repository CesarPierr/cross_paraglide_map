import type { Atlas, AtlasMassif, FeatureCategory } from '@brises/shared';
import { compassFr } from '@brises/model';
import { useMemo, useState } from 'react';
import type { FeatureDetails } from '../map/modules/types';
import { BREEZE_COLORS, COLORS } from '../map/palette';
import { useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { FeedbackBar, startDraft } from './Feedback';
import { IconBack, IconMountain, IconPlus, IconSearch, IconTarget } from './icons';
import { RichText, SourceList } from './Sources';

const SECTION_ORDER: FeatureCategory[] = ['breezes', 'convergences', 'hazards', 'thermals', 'soaring', 'takeoffs', 'landings', 'routes'];
const SECTION_TITLES: Record<FeatureCategory, string> = {
  breezes: 'Brises',
  convergences: 'Convergences',
  hazards: 'Pièges et dangers',
  thermals: 'Thermiques connus',
  soaring: 'Soaring',
  takeoffs: 'Décollages',
  landings: 'Atterrissages',
  routes: 'Itinéraires cross',
};

const dotColor = (cat: FeatureCategory, kind?: string) =>
  cat === 'breezes'
    ? (BREEZE_COLORS[kind ?? ''] ?? BREEZE_COLORS.valley)
    : ({ convergences: COLORS.convergence, hazards: COLORS.hazard, thermals: COLORS.thermal, soaring: COLORS.soaring, takeoffs: COLORS.takeoff, landings: COLORS.landing, routes: COLORS.route } as Record<string, string>)[cat];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

function openFeature(ref: string) {
  const c = getController();
  const d = c?.describe(ref);
  if (!d) return;
  useRuntime.getState().set({ feature: d });
  c?.flyToBbox(d.bbox);
}

function FeatureSheet({ f, atlas }: { f: FeatureDetails; atlas: Atlas }) {
  const massif = f.massifId ? atlas.massifs.find((m) => m.id === f.massifId) : undefined;
  const back = () => {
    useRuntime.getState().set({ feature: null });
    if (massif) useApp.getState().set({ selectedMassif: massif.id });
  };
  return (
    <article className="sheet">
      <button className="back" onClick={back}>
        <IconBack size={15} /> {massif ? massif.shortName : 'Retour'}
      </button>
      <p className="eyebrow">{f.category}</p>
      <h2>{f.title}</h2>
      {f.badges && (
        <div className="badges">
          {f.badges.map((b) => (
            <span key={b.label} className={`badge ${b.tone ?? ''}`}>
              {b.label}
            </span>
          ))}
        </div>
      )}
      {f.stat && <p className="big-stat">{f.stat}</p>}
      {f.details && f.details.length > 0 && (
        <dl className="details">
          {f.details.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {f.paragraphs?.map((p, i) => (
        <p key={i} className="desc">
          <RichText text={p} atlas={atlas} order={f.sourceIds} />
        </p>
      ))}
      {f.warning && <p className="note">{f.warning}</p>}
      <div className="sheet-actions">
        <button className="btn ghost small" onClick={() => getController()?.flyToBbox(f.bbox)}>
          <IconTarget size={15} /> Centrer
        </button>
        {f.links?.map((l) => (
          <a key={l.url} className="btn ghost small" href={l.url} target="_blank" rel="noopener noreferrer">
            {l.label}
          </a>
        ))}
      </div>
      {f.sourceIds && <SourceList ids={f.sourceIds} atlas={atlas} />}
      {f.attribution && <p className="muted small" dangerouslySetInnerHTML={{ __html: f.attribution }} />}
      <FeedbackBar key={f.ref} targetRef={f.ref} title={f.title} />
    </article>
  );
}

const WIND_SECTORS: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, SO: 225, W: 270, O: 270, NW: 315, NO: 315, Bise: 45, Mistral: 340, Lombarde: 80, Foehn: 180, 'Vent du Sud': 180 };

function windMatches(label: string, from: number, kmh: number): boolean {
  if (kmh < 5) return false;
  const key = Object.keys(WIND_SECTORS)
    .sort((a, b) => b.length - a.length)
    .find((k) => label.trim().startsWith(k));
  if (key === undefined) return false;
  return Math.abs(((WIND_SECTORS[key] - from + 540) % 360) - 180) <= 30;
}

function MassifSheet({ m, atlas }: { m: AtlasMassif; atlas: Atlas }) {
  const { synopticFrom, synopticKmh } = useApp();
  const byId = useMemo(() => {
    const map = new Map<string, { cat: FeatureCategory; name: string; kind?: string; confidence?: string; speed?: number }>();
    for (const cat of SECTION_ORDER) for (const f of atlas.features[cat]) map.set(f.properties.id, { cat, name: f.properties.name, kind: f.properties.kind, confidence: f.properties.confidence, speed: f.properties.speedKmh });
    return map;
  }, [atlas]);
  return (
    <article className="sheet">
      <button className="back" onClick={() => useApp.getState().set({ selectedMassif: null })}>
        <IconBack size={15} /> Tous les massifs
      </button>
      <p className="eyebrow">{m.region}</p>
      <h2>{m.shortName}</h2>
      {m.name !== m.shortName && <p className="subtitle">{m.name}</p>}
      {m.summary && (
        <p className="summary">
          <RichText text={m.summary} atlas={atlas} order={m.sources} />
        </p>
      )}
      <div className="sheet-actions">
        <button className="btn small" onClick={() => getController()?.flyToBbox(m.bbox, { maxZoom: 11 })}>
          <IconMountain size={15} /> Survoler le massif
        </button>
        <button className="btn ghost small" onClick={() => startDraft({ kind: 'new', targetTitle: m.shortName })}>
          <IconPlus size={15} /> Ajouter un phénomène
        </button>
      </div>
      {m.synoptic.length > 0 && (
        <section className="item-section">
          <h3>Selon le vent météo</h3>
          <dl className="synoptic">
            {m.synoptic.map((s, i) => (
              <div key={i} className={windMatches(s.wind, synopticFrom, synopticKmh) ? 'match' : ''}>
                <dt>{s.wind}</dt>
                <dd>
                  <RichText text={s.effect} atlas={atlas} order={m.sources} />
                </dd>
              </div>
            ))}
          </dl>
          {synopticKmh >= 5 && <p className="muted small">Surligné : le vent simulé ({compassFr(synopticFrom)} {synopticKmh} km/h).</p>}
        </section>
      )}
      {SECTION_ORDER.map((cat) =>
        m.items[cat].length ? (
          <section key={cat} className="item-section">
            <h3>
              {SECTION_TITLES[cat]} <span className="count">{m.items[cat].length}</span>
            </h3>
            <ul className="items">
              {m.items[cat].map((id) => {
                const it = byId.get(id);
                if (!it) return null;
                return (
                  <li key={id}>
                    <button onClick={() => openFeature(`atlas:${id}`)}>
                      <span className="dot" style={{ background: dotColor(cat, it.kind) }} />
                      <span className="item-name">{it.name}</span>
                      {it.confidence === 'low' && <span className="tag warn">déduction</span>}
                      {cat === 'breezes' && it.speed !== undefined && <span className="tag">{it.speed} km/h</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}
      {m.tips.length > 0 && (
        <section className="item-section">
          <h3>Conseils cross</h3>
          <ul className="tips">
            {m.tips.map((t, i) => (
              <li key={i}>
                <RichText text={t} atlas={atlas} order={m.sources} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <SourceList ids={m.sources} atlas={atlas} limit={6} title="Sources du massif" />
      <FeedbackBar key={m.id} targetRef={`massif:${m.id}`} title={m.shortName} />
    </article>
  );
}

function MassifBrowser({ atlas }: { atlas: Atlas }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = norm(q.trim());
    return atlas.regions.map((r) => ({
      region: r,
      massifs: atlas.massifs.filter((m) => m.region === r && (!needle || norm(`${m.name} ${m.summary}`).includes(needle))),
    }));
  }, [atlas, q]);
  const total = atlas.stats;
  return (
    <div className="browser">
      <label className="search">
        <IconSearch size={16} />
        <input type="search" placeholder="Massif, vallée, site…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un massif" />
      </label>
      <p className="muted small stats-line">
        {total.massifs} secteurs · {total.breezes} brises · {total.convergences} convergences · {total.sources} sources
      </p>
      {groups.map(
        (g) =>
          g.massifs.length > 0 && (
            <section key={g.region} className="region">
              <h3>{g.region}</h3>
              <ul>
                {g.massifs.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => {
                        useApp.getState().set({ selectedMassif: m.id });
                        getController()?.flyToBbox(m.bbox, { maxZoom: 11 });
                      }}
                    >
                      <span className="item-name">
                        {m.shortName}
                        <small>{m.name.split(' (')[1]?.replace(/\)$/, '') ?? ''}</small>
                      </span>
                      <span className="mini-counts" title="brises · convergences · pièges">
                        <i style={{ background: BREEZE_COLORS.valley }} />
                        {m.items.breezes.length}
                        <i style={{ background: COLORS.convergence }} />
                        {m.items.convergences.length}
                        <i style={{ background: COLORS.hazard }} />
                        {m.items.hazards.length}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
      <button className="btn ghost small add-global" onClick={() => startDraft({ kind: 'new' })}>
        <IconPlus size={15} /> Signaler un phénomène local
      </button>
    </div>
  );
}

export function Sidebar() {
  const atlas = useRuntime((r) => r.atlas);
  const feature = useRuntime((r) => r.feature);
  const { selectedMassif, panelOpen } = useApp();
  const massif = atlas?.massifs.find((m) => m.id === selectedMassif);
  return (
    <aside className={`sidebar panel ${panelOpen ? '' : 'collapsed'}`} aria-label="Massifs et connaissances locales">
      {!atlas ? (
        <div className="skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : feature ? (
        <FeatureSheet f={feature} atlas={atlas} />
      ) : massif ? (
        <MassifSheet m={massif} atlas={atlas} />
      ) : (
        <MassifBrowser atlas={atlas} />
      )}
    </aside>
  );
}

