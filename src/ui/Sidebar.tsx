import { useMemo, useState } from 'react';
import type { Atlas, AtlasFeature, AtlasMassif, FeatureCategory } from '../data/atlas-types';
import { compassFr } from '../model/grid';
import { useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, KIND_LABELS } from './format';

function SourceList({ ids, atlas }: { ids: string[]; atlas: Atlas }) {
  const list = ids.map((id) => atlas.sources[id]).filter(Boolean);
  if (!list.length) return <p className="muted">Aucune source citée.</p>;
  return (
    <ol className="sources">
      {list.map((s) => (
        <li key={s.id}>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
          ) : (
            s.title
          )}
          {s.publisher && <span className="muted"> — {s.publisher}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Replace inline "[region:S3]" citations by superscript links. */
function RichText({ text, atlas }: { text: string; atlas: Atlas }) {
  const parts = text.split(/(\[[^\]]*:S\d+[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(.*)\]$/);
        if (!m) return <span key={i}>{p}</span>;
        const ids = m[1].split(/\s*,\s*/);
        return (
          <sup key={i} className="cite">
            {ids.map((id, k) => {
              const s = atlas.sources[id];
              return s?.url ? (
                <a key={id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>
                  {k ? ',' : ''}
                  {id.split(':')[1]}
                </a>
              ) : (
                <span key={id} title={s?.title}>
                  {k ? ',' : ''}
                  {id.split(':')[1] ?? id}
                </span>
              );
            })}
          </sup>
        );
      })}
    </>
  );
}

function FeatureSheet({ f, atlas }: { f: AtlasFeature; atlas: Atlas }) {
  const p = f.properties;
  const massif = atlas.massifs.find((m) => m.id === p.massif);
  return (
    <div className="sheet">
      <button
        className="back"
        onClick={() => {
          useRuntime.getState().set({ selectedFeature: null });
          if (massif) useApp.getState().set({ selectedMassif: massif.id });
        }}
      >
        ← {massif ? massif.name : 'Retour'}
      </button>
      <div className="badges">
        <span className={`badge cat-${p.category}`}>{CATEGORY_LABELS[p.category]}</span>
        {p.kind && KIND_LABELS[p.kind] && <span className="badge">{KIND_LABELS[p.kind]}</span>}
        {p.confidence && <span className={`badge conf-${p.confidence}`}>{CONFIDENCE_LABELS[p.confidence]}</span>}
      </div>
      <h2>{p.name}</h2>
      {p.speedKmh !== undefined && p.category === 'breezes' && (
        <p className="big-stat">
          ≈ {p.speedKmh} km/h{p.windowStart !== undefined ? ` · active ${p.windowStart}h → ${p.windowEnd}h` : ''}
        </p>
      )}
      {p.details && Object.keys(p.details).length > 0 && (
        <dl className="details">
          {Object.entries(p.details).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.description && (
        <div className="desc">
          {p.description.split('\n\n').map((para, i) => (
            <p key={i}>
              <RichText text={para} atlas={atlas} />
            </p>
          ))}
        </div>
      )}
      {p.coordQuality && p.coordQuality !== 'source' && (
        <p className="warn small">Position estimée à partir de descriptions : à vérifier sur la fiche FFVL avant usage.</p>
      )}
      <button className="btn ghost small" onClick={() => getController()?.flyToFeature(f)}>
        ◎ Centrer la vue
      </button>
      <h3>Sources</h3>
      <SourceList ids={p.sources.split(',').filter(Boolean)} atlas={atlas} />
    </div>
  );
}

const SECTION_ORDER: FeatureCategory[] = ['breezes', 'convergences', 'hazards', 'thermals', 'soaring', 'takeoffs', 'landings', 'routes'];

const WIND_SECTORS: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, SO: 225, W: 270, O: 270, NW: 315, NO: 315, Bise: 45, Mistral: 340, Lombarde: 80, Foehn: 180, 'Vent du Sud': 180 };

function windMatches(label: string, from: number, kmh: number): boolean {
  if (kmh < 5) return false;
  const key = Object.keys(WIND_SECTORS).find((k) => label.trim().startsWith(k));
  if (key === undefined) return false;
  const d = Math.abs(((WIND_SECTORS[key] - from + 540) % 360) - 180);
  return d <= 30;
}

function MassifSheet({ m, atlas }: { m: AtlasMassif; atlas: Atlas }) {
  const { synopticFrom, synopticKmh } = useApp();
  const get = (id: string) => atlas.features[SECTION_ORDER.find((c) => m.items[c].includes(id))!]?.find((f) => f.properties.id === id);
  return (
    <div className="sheet">
      <button className="back" onClick={() => useApp.getState().set({ selectedMassif: null })}>
        ← Tous les massifs
      </button>
      <p className="eyebrow">{m.region}</p>
      <h2>{m.name}</h2>
      {m.summary && (
        <p className="summary">
          <RichText text={m.summary} atlas={atlas} />
        </p>
      )}
      <button className="btn ghost small" onClick={() => getController()?.flyToBbox(m.bbox)}>
        ◎ Survoler le massif
      </button>
      {SECTION_ORDER.map((cat) =>
        m.items[cat].length ? (
          <div key={cat} className="item-section">
            <h3>
              {CATEGORY_LABELS[cat]}s <span className="count">{m.items[cat].length}</span>
            </h3>
            <ul className="items">
              {m.items[cat].map((id) => {
                const f = get(id);
                if (!f) return null;
                const p = f.properties;
                return (
                  <li key={id}>
                    <button
                      onClick={() => {
                        useRuntime.getState().set({ selectedFeature: id });
                        getController()?.flyToFeature(f);
                      }}
                    >
                      <span className={`dot cat-${cat} kind-${p.kind ?? ''}`} />
                      <span className="item-name">{p.name}</span>
                      {p.confidence === 'low' && <span className="tag">déduction</span>}
                      {p.speedKmh !== undefined && cat === 'breezes' && <span className="tag">{p.speedKmh} km/h</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null,
      )}
      {m.synoptic.length > 0 && (
        <div className="item-section">
          <h3>Selon le vent météo</h3>
          <p className="muted small">
            Vent actuel de la simulation : {synopticKmh < 3 ? 'calme' : `${compassFr(synopticFrom)} ${synopticKmh} km/h`} (ligne surlignée).
          </p>
          <dl className="synoptic">
            {m.synoptic.map((s, i) => (
              <div key={i} className={windMatches(s.wind, synopticFrom, synopticKmh) ? 'match' : ''}>
                <dt>{s.wind}</dt>
                <dd>
                  <RichText text={s.effect} atlas={atlas} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {m.tips.length > 0 && (
        <div className="item-section">
          <h3>Conseils cross</h3>
          <ul className="tips">
            {m.tips.map((t, i) => (
              <li key={i}>
                <RichText text={t} atlas={atlas} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="item-section">
        <h3>Sources ({m.sources.length})</h3>
        <SourceList ids={m.sources} atlas={atlas} />
      </div>
    </div>
  );
}

function MassifBrowser({ atlas }: { atlas: Atlas }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = q
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
    return atlas.regions.map((r) => ({
      region: r,
      massifs: atlas.massifs.filter((m) => m.region === r && (!needle || norm(m.name).includes(needle) || norm(m.summary).includes(needle))),
    }));
  }, [atlas, q]);
  return (
    <div className="browser">
      <input className="search" type="search" placeholder="Rechercher un massif, une vallée…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
      {groups.map(
        (g) =>
          g.massifs.length > 0 && (
            <div key={g.region} className="region">
              <h3>{g.region}</h3>
              <ul>
                {g.massifs.map((m) => {
                  const n = m.items.breezes.length + m.items.convergences.length;
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => {
                          useApp.getState().set({ selectedMassif: m.id });
                          getController()?.flyToBbox(m.bbox);
                        }}
                      >
                        <span className="item-name">{m.name}</span>
                        <span className="tag">{n} brises/conv.</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
      )}
    </div>
  );
}

export function Sidebar() {
  const atlas = useRuntime((r) => r.atlas);
  const selectedFeature = useRuntime((r) => r.selectedFeature);
  const { selectedMassif, panelOpen } = useApp();
  const feature = selectedFeature ? getController()?.getFeature(selectedFeature) : undefined;
  const massif = atlas?.massifs.find((m) => m.id === selectedMassif);
  return (
    <aside className={`sidebar panel ${panelOpen ? '' : 'collapsed'}`} aria-label="Massifs et connaissances locales">
      {!atlas ? <p className="muted">Chargement de l’atlas…</p> : feature ? <FeatureSheet f={feature} atlas={atlas} /> : massif ? <MassifSheet m={massif} atlas={atlas} /> : <MassifBrowser atlas={atlas} />}
    </aside>
  );
}
