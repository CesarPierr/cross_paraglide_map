import type { Atlas, AtlasMassif, FeatureCategory } from '@brises/shared';
import { compassFr } from '@brises/model';
import { useEffect, useMemo, useRef, useState } from 'react';
import { activeInSlot } from '../map/modules/schema';
import type { FeatureDetails } from '../map/modules/types';
import { BREEZE_COLORS, COLORS } from '../map/palette';
import { SCHEMA_PHASES, useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { FeedbackBar, startDraft } from './Feedback';
import { FigureGallery } from './Figures';
import { IconBack, IconMountain, IconPlus, IconSearch, IconTarget } from './icons';
import { SheetHandle, showBrowse, useIsMobile } from './mobile';
import { RoutesBrowser } from './Routes';
import { RichText, SourceList } from './Sources';

/** Opens the schematic all-in-one view of a massif. */
export function openSchema(massifId: string) {
  useRuntime.getState().set({ feature: null });
  useApp.getState().set({ schemaMassif: massifId, selectedMassif: massifId, schemaPicking: false });
  showBrowse();
}

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

/** What the phenomenon is, in plain words: open for beginners, one tap away for the others. */
function Explain({ text }: { text: string }) {
  const level = useApp((s) => s.level);
  const [open, setOpen] = useState(level === 'decouverte');
  return open ? (
    <p className="explain">{text}</p>
  ) : (
    <button className="link-btn explain-toggle" onClick={() => setOpen(true)}>
      Qu’est-ce que c’est ?
    </button>
  );
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
      {f.explain && <Explain key={f.ref} text={f.explain} />}
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
      {f.ref.startsWith('atlas:') && atlas.features.routes.some((r) => r.properties.id === f.ref.slice(6)) && (
        <button
          className="btn small primary"
          onClick={() => {
            const r = atlas.features.routes.find((x) => x.properties.id === f.ref.slice(6))!;
            useRuntime.getState().set({
              feature: null,
              plan: { points: r.geometry.coordinates as [number, number][], names: (r.properties.details?.Points ?? '').split(' → '), picking: false, title: r.properties.name },
            });
            useApp.getState().set({ browseTab: 'routes', schemaMassif: null, selectedMassif: null, browseOpen: true });
          }}
        >
          Lire tronçon par tronçon
        </button>
      )}
      {f.ref.startsWith('atlas:') && <FigureGallery atlas={atlas} featureId={f.ref.slice(6)} title="Figures d’origine" />}
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
      {m.summary && <Summary text={m.summary} atlas={atlas} order={m.sources} />}
      <div className="sheet-actions">
        <button className="btn small primary" onClick={() => openSchema(m.id)}>
          <IconSchema /> Vue schéma
        </button>
        <button
          className="btn small"
          onClick={() => {
            openSchema(m.id);
            useApp.getState().set({ tourStep: 0 });
          }}
        >
          Présente-moi ce massif
        </button>
        <button className="btn ghost small" onClick={() => getController()?.flyToBbox(m.bbox, { maxZoom: 11 })}>
          <IconMountain size={15} /> Survoler en 3D
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
      <FigureGallery atlas={atlas} massif={m.id} />
      <SourceList ids={m.sources} atlas={atlas} limit={6} title="Sources du massif" />
      <FeedbackBar key={m.id} targetRef={`massif:${m.id}`} title={m.shortName} />
    </article>
  );
}

/** Sector summary: the first sentences, the rest one tap away. */
function Summary({ text, atlas, order }: { text: string; atlas: Atlas; order: string[] }) {
  const [open, setOpen] = useState(false);
  const short = text.match(/^(?:[^.!?]+[.!?]+\s*){1,3}/)?.[0]?.trim() ?? text;
  const folded = !open && short.length < text.length - 20;
  return (
    <div className="summary">
      <p>
        <RichText text={folded ? short : text} atlas={atlas} order={order} />
      </p>
      {folded && (
        <button className="link-btn" onClick={() => setOpen(true)}>
          Lire la suite
        </button>
      )}
    </div>
  );
}

function IconSchema() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17 C8 12 12 18 21 9" />
      <path d="M16 9 h5 v5" />
      <circle cx="7" cy="7" r="2" />
    </svg>
  );
}

const ARROW_KIND: Record<string, string> = {
  valley: 'brise de vallée',
  downvalley: 'brise descendante',
  slope: 'brise de pente',
  'plain-to-mountain': 'plaine → montagne',
  lake: 'brise de lac',
  'pass-transfer': 'transfert par un col',
  regional: 'brise régionale',
  katabatic: 'catabatique',
};

function SchemaItem({ id, color, name, meta, low }: { id: string; color: string; name: string; meta?: string; low?: boolean }) {
  return (
    <li>
      <button onClick={() => openFeature(`atlas:${id}`)}>
        <span className="dot" style={{ background: color }} />
        <span className="item-name">
          {name}
          {meta && <small>{meta}</small>}
        </span>
        {low && <span className="tag warn">déduction</span>}
      </button>
    </li>
  );
}

function SchemaBlock({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  return count ? (
    <section className="item-section">
      <h3>
        {title} <span className="count">{count}</span>
      </h3>
      <ul className="items">{children}</ul>
    </section>
  ) : null;
}

/** All-in-one reading of a massif for a typical summer day, in sync with the schematic map. */
function SchemaPanel({ m, atlas }: { m: AtlasMassif; atlas: Atlas }) {
  const { schemaPhase, tourStep, set } = useApp();
  const slot = SCHEMA_PHASES.find((p) => p.key === schemaPhase)!;
  const feats = useMemo(() => {
    const get = (cat: FeatureCategory) => atlas.features[cat].filter((f) => f.properties.massif === m.id).map((f) => f.properties);
    const [w, s, e, n] = m.bbox;
    // Transitions: cross-country routes of any sector that cross this one.
    const routes = atlas.features.routes
      .filter((f) => f.properties.massif === m.id || f.geometry.coordinates.some((c) => Array.isArray(c) && c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n))
      .map((f) => f.properties);
    // Breezes of neighbouring sectors that run along or into this one (they shape its day too).
    const pad = 0.05;
    const near = atlas.features.breezes
      .filter((f) => f.properties.massif !== m.id && f.properties.massif !== 'alpes-francaises' && f.geometry.coordinates.some((c) => Array.isArray(c) && c[0] >= w - pad && c[0] <= e + pad && c[1] >= s - pad && c[1] <= n + pad))
      .map((f) => f.properties);
    return { near, breezes: get('breezes'), convergences: get('convergences'), thermals: get('thermals'), hazards: get('hazards'), takeoffs: get('takeoffs'), landings: get('landings'), soaring: get('soaring'), routes };
  }, [atlas, m]);
  const active = feats.breezes.filter((b) => activeInSlot(b.windowStart, b.windowEnd, slot.hours));
  const other = feats.breezes.length - active.length;
  const nearActive = feats.near.filter((b) => activeInSlot(b.windowStart, b.windowEnd, slot.hours));
  return (
    <article className="sheet schema-sheet">
      <button className="back" onClick={() => set({ schemaMassif: null })}>
        <IconBack size={15} /> Retour à la vue 3D live
      </button>
      <p className="eyebrow">Vue schéma · journée d’été type</p>
      <h2>{m.shortName}</h2>
      {tourStep === null && (
        <button className="btn small tour-start" onClick={() => set({ tourStep: 0 })}>
          Présente-moi ce massif
        </button>
      )}
      <div className="chips phase-chips" role="tablist" aria-label="Moment de la journée">
        {SCHEMA_PHASES.map((p) => (
          <button key={p.key} role="tab" aria-selected={p.key === schemaPhase} className={`chip ${p.key === schemaPhase ? 'active' : ''}`} onClick={() => set({ schemaPhase: p.key })}>
            {p.label}
            <small>
              {' '}
              {p.hours[0]}h–{Math.floor(p.hours[1])}h
            </small>
          </button>
        ))}
      </div>
      <div className="schema-legend" aria-hidden>
        <span>
          <i className="sw-line" style={{ background: BREEZE_COLORS.valley }} /> brise (épaisseur = force)
        </span>
        <span>
          <i className="sw-line dashed" style={{ background: COLORS.convergence }} /> convergence
        </span>
        <span>
          <i className="sw-dot" style={{ background: COLORS.thermal }} /> thermique
        </span>
        <span>
          <i className="sw-dot" style={{ background: COLORS.hazard }} /> piège
        </span>
        <span>
          <i className="sw-line dotted" style={{ background: COLORS.route }} /> transition
        </span>
      </div>
      {m.summary && <Summary text={m.summary} atlas={atlas} order={m.sources} />}
      <SchemaBlock title={`Brises ${slot.label.toLowerCase()}`} count={active.length}>
        {active.map((b) => (
          <SchemaItem
            key={b.id}
            id={b.id}
            color={BREEZE_COLORS[b.kind ?? ''] ?? BREEZE_COLORS.valley}
            name={b.name}
            meta={[ARROW_KIND[b.kind ?? ''], b.details?.Trajet, b.speedKmh ? `${b.speedKmh} km/h` : '', b.details?.Horaires].filter(Boolean).join(' · ')}
            low={b.confidence === 'low'}
          />
        ))}
      </SchemaBlock>
      {!active.length && <p className="muted small">Aucune brise documentée sur ce créneau.</p>}
      {other > 0 && <p className="muted small">{other} autre(s) brise(s) documentée(s) à d’autres heures : changez de créneau.</p>}
      <SchemaBlock title="Brises des secteurs voisins" count={nearActive.length}>
        {nearActive.map((b) => (
          <SchemaItem
            key={b.id}
            id={b.id}
            color={BREEZE_COLORS[b.kind ?? ''] ?? BREEZE_COLORS.valley}
            name={b.name}
            meta={[atlas.massifs.find((x) => x.id === b.massif)?.shortName, b.speedKmh ? `${b.speedKmh} km/h` : '', b.details?.Horaires].filter(Boolean).join(' · ')}
            low={b.confidence === 'low'}
          />
        ))}
      </SchemaBlock>
      <SchemaBlock title="Convergences" count={feats.convergences.length}>
        {feats.convergences.map((c) => (
          <SchemaItem key={c.id} id={c.id} color={COLORS.convergence} name={c.name} meta={c.details?.Quand} low={c.confidence === 'low'} />
        ))}
      </SchemaBlock>
      <SchemaBlock title="Thermiques connus" count={feats.thermals.length}>
        {feats.thermals.map((t) => (
          <SchemaItem key={t.id} id={t.id} color={COLORS.thermal} name={t.name} meta={[t.details?.Heures, t.details?.Déclencheur].filter(Boolean).join(' · ')} />
        ))}
      </SchemaBlock>
      <SchemaBlock title="Pièges et dangers" count={feats.hazards.length}>
        {feats.hazards.map((h) => (
          <SchemaItem key={h.id} id={h.id} color={COLORS.hazard} name={h.name} meta={h.details?.Conditions} />
        ))}
      </SchemaBlock>
      <SchemaBlock title="Décollages" count={feats.takeoffs.length}>
        {feats.takeoffs.map((t) => (
          <SchemaItem key={t.id} id={t.id} color={COLORS.takeoff} name={t.name} meta={[t.details?.Orientation, t.details?.Altitude].filter(Boolean).join(' · ')} />
        ))}
      </SchemaBlock>
      <SchemaBlock title="Soaring" count={feats.soaring.length}>
        {feats.soaring.map((t) => (
          <SchemaItem key={t.id} id={t.id} color={COLORS.soaring} name={t.name} meta={t.details?.Vents} />
        ))}
      </SchemaBlock>
      <SchemaBlock title="Atterrissages" count={feats.landings.length}>
        {feats.landings.map((t) => (
          <SchemaItem key={t.id} id={t.id} color={COLORS.landing} name={t.name} meta={t.details?.Altitude} />
        ))}
      </SchemaBlock>
      <SchemaBlock title="Transitions et itinéraires de cross" count={feats.routes.length}>
        {feats.routes.map((r) => (
          <SchemaItem key={r.id} id={r.id} color={COLORS.route} name={r.name} meta={[r.details?.Distance, r.details?.Points].filter(Boolean).join(' · ')} />
        ))}
      </SchemaBlock>
      {m.synoptic.length > 0 && (
        <section className="item-section">
          <h3>Selon le vent météo</h3>
          <dl className="synoptic">
            {m.synoptic.map((s, i) => (
              <div key={i}>
                <dt>{s.wind}</dt>
                <dd>
                  <RichText text={s.effect} atlas={atlas} order={m.sources} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
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
      <FigureGallery atlas={atlas} massif={m.id} />
      <SourceList ids={m.sources} atlas={atlas} limit={8} title="Sources du massif" />
      <p className="note">Schéma de synthèse des sources pour une journée thermique d’été sans vent météo marqué. Il ne remplace ni la météo du jour ni les consignes locales.</p>
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
                  <li key={m.id} className="massif-row">
                    <button
                      className="schema-quick"
                      title={`Vue schéma : ${m.shortName}`}
                      aria-label={`Vue schéma : ${m.shortName}`}
                      onClick={() => openSchema(m.id)}
                    >
                      <IconSchema />
                    </button>
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
  const { selectedMassif, schemaMassif, browseOpen, mobileSheet, browseTab } = useApp();
  const mobile = useIsMobile();
  const massif = atlas?.massifs.find((m) => m.id === selectedMassif);
  const schema = atlas?.massifs.find((m) => m.id === schemaMassif);
  const open = mobile ? mobileSheet === 'browse' : browseOpen || !!feature || !!schema || !!massif;
  // A new sheet starts at its top.
  const ref = useRef<HTMLElement>(null);
  const contentKey = feature?.ref ?? (schema ? `schema:${schema.id}` : massif ? `massif:${massif.id}` : `browse:${browseTab}`);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [contentKey]);
  return (
    <aside ref={ref} className={`sidebar panel ${open ? '' : 'collapsed'}`} aria-label="Massifs et connaissances locales">
      {mobile ? (
        <SheetHandle />
      ) : (
        !schema && (
          <button
            className="icon-btn ghost panel-close"
            aria-label="Fermer le panneau"
            onClick={() => {
              useRuntime.getState().set({ feature: null });
              useApp.getState().set({ browseOpen: false, selectedMassif: null });
            }}
          >
            ×
          </button>
        )
      )}
      {!atlas ? (
        <div className="skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : feature ? (
        <FeatureSheet f={feature} atlas={atlas} />
      ) : schema ? (
        <SchemaPanel m={schema} atlas={atlas} />
      ) : massif ? (
        <MassifSheet m={massif} atlas={atlas} />
      ) : (
        <>
          <div className="seg browse-tabs" role="tablist" aria-label="Parcourir">
            <button role="tab" aria-selected={browseTab === 'massifs'} className={browseTab === 'massifs' ? 'on' : ''} onClick={() => useApp.getState().set({ browseTab: 'massifs' })}>
              Massifs
            </button>
            <button role="tab" aria-selected={browseTab === 'routes'} className={browseTab === 'routes' ? 'on' : ''} onClick={() => useApp.getState().set({ browseTab: 'routes' })}>
              Itinéraires
            </button>
          </div>
          {browseTab === 'routes' ? <RoutesBrowser atlas={atlas} /> : <MassifBrowser atlas={atlas} />}
        </>
      )}
    </aside>
  );
}

