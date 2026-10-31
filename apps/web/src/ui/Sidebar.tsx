import { CATEGORY_ORDER, type Atlas, type AtlasFeatureProps, type AtlasMassif, type FeatureCategory } from '@brises/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { activeInSlot } from '../map/modules/schema';
import type { FeatureDetails } from '../map/modules/types';
import { BREEZE_COLORS, COLORS } from '../map/palette';
import { shownAtMassifScale } from '../map/tiers';
import { SCHEMA_PHASES, useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { SimulationPanel } from './ControlPanel';
import { FeedbackBar, startDraft } from './Feedback';
import { FigureGallery } from './Figures';
import { IconBack, IconChevron, IconGlider, IconPlus, IconSearch, IconTarget } from './icons';
import { ReadabilityControl } from './Legend';
import { goTo, openMassif, setUiMode } from './modes';
import { SheetHandle, useIsMobile } from './mobile';
import { ProbeSheet } from './ProbeCard';
import { RoutesBrowser } from './Routes';
import { RichText, SourceList } from './Sources';

/** Opens a massif: its page here and its schema on the map. */
export const openSchema = (massifId: string) => openMassif(massifId);

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

/** Opens the simulator on the take-off nearest to a place (the game's menu picks it up). */
function flyFrom(f: FeatureDetails): void {
  const [w, s, e, n] = f.bbox;
  try {
    localStorage.setItem('brises.game.goto', JSON.stringify({ lon: (w + e) / 2, lat: (s + n) / 2, name: f.title, t: Date.now() }));
  } catch {
    /* private mode: the menu opens on the last take-off */
  }
  useRuntime.getState().set({ feature: null });
  setUiMode('game');
}

function FeatureSheet({ f, atlas }: { f: FeatureDetails; atlas: Atlas }) {
  const isTakeoff =
    (f.ref.startsWith('atlas:') && atlas.features.takeoffs.some((t) => t.properties.id === f.ref.slice(6))) || (f.ref.startsWith('sites:') && (f.category === 'Décollage' || f.category === 'Site de vol'));
  const massif = f.massifId ? atlas.massifs.find((m) => m.id === f.massifId) : undefined;
  const back = () => {
    useRuntime.getState().set({ feature: null });
    if (massif && useApp.getState().schemaMassif !== massif.id) openMassif(massif.id);
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
      {f.possible && f.possible.length > 0 && (
        <section className="possible" aria-label="Possible aussi">
          <h3>Possible aussi</h3>
          <p className="possible-hint">Observations isolées, non recoupées par d’autres sources.</p>
          <ul>
            {f.possible.map((t, i) => (
              <li key={i}>
                <RichText text={t} atlas={atlas} order={f.sourceIds} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {f.warning && <p className="note">{f.warning}</p>}
      <div className="sheet-actions">
        <button className="btn ghost small" onClick={() => getController()?.flyToBbox(f.bbox)}>
          <IconTarget size={15} /> Centrer
        </button>
        {isTakeoff && (
          <button className="btn small primary" onClick={() => flyFrom(f)} title="Ouvrir le simulateur de vol sur ce décollage">
            <IconGlider size={15} /> Voler d’ici
          </button>
        )}
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

/** Sector summary: the first sentences, the rest one tap away. */
function Summary({ text, atlas, order }: { text: string; atlas: Atlas; order: string[] }) {
  const [open, setOpen] = useState(false);
  // Summaries are written in short paragraphs (the massif in one idea first): the first
  // one stays visible, the others unfold. Older one-block summaries fold after three sentences.
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const short = paragraphs.length > 1 ? paragraphs[0] : (text.match(/^(?:[^.!?]+[.!?]+\s*){1,3}/)?.[0]?.trim() ?? text);
  const folded = !open && short.length < text.length - 20;
  return (
    <div className="summary">
      {(folded ? [short] : paragraphs.length > 1 ? paragraphs : [text]).map((p, i) => (
        <p key={i}>
          <RichText text={p} atlas={atlas} order={order} />
        </p>
      ))}
      {folded && (
        <button className="link-btn" onClick={() => setOpen(true)}>
          Lire la suite
        </button>
      )}
    </div>
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

function SchemaItem({ id, color, name, meta, low, detail }: { id: string; color: string; name: string; meta?: string; low?: boolean; detail?: boolean }) {
  return (
    <li className={detail ? 'detail' : undefined}>
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

const CAT_COLOR: Record<FeatureCategory, string> = {
  breezes: BREEZE_COLORS.valley,
  convergences: COLORS.convergence,
  hazards: COLORS.hazard,
  takeoffs: COLORS.takeoff,
  soaring: COLORS.soaring,
  routes: COLORS.route,
  thermals: COLORS.thermal,
  landings: COLORS.landing,
};

const CAT_ONE: Record<FeatureCategory, string> = {
  breezes: 'Brise',
  convergences: 'Convergence',
  hazards: 'Piège',
  takeoffs: 'Déco',
  soaring: 'Soaring',
  routes: 'Itinéraire',
  thermals: 'Thermique',
  landings: 'Attéro',
};

/** Categories drawn as lines: always on the map, their names come with the zoom. */
const LINES: FeatureCategory[] = ['breezes', 'convergences', 'routes'];

const colorOf = (p: AtlasFeatureProps) => (p.category === 'breezes' ? (BREEZE_COLORS[p.kind ?? ''] ?? BREEZE_COLORS.valley) : CAT_COLOR[p.category]);

/** One line on an item: the fact a pilot looks for first. */
function metaOf(p: AtlasFeatureProps): string {
  const d = p.details ?? {};
  switch (p.category) {
    case 'breezes':
      return [ARROW_KIND[p.kind ?? ''], d.Trajet, p.speedKmh ? `${p.speedKmh} km/h` : '', d.Horaires].filter(Boolean).join(' · ');
    case 'convergences':
      return d.Quand ?? '';
    case 'hazards':
      return d.Conditions ?? '';
    case 'takeoffs':
      return [d.Orientation, d.Altitude].filter(Boolean).join(' · ');
    case 'soaring':
      return d.Vents ?? '';
    case 'thermals':
      return [d.Heures, d.Déclencheur].filter(Boolean).join(' · ');
    case 'landings':
      return d.Altitude ?? '';
    case 'routes':
      return [d.Distance, d.Points].filter(Boolean).join(' · ');
  }
}

const byRank = (a: AtlasFeatureProps, b: AtlasFeatureProps) => (a.tier ?? 2) - (b.tier ?? 2) || (b.rank ?? 0) - (a.rank ?? 0);

/** Sector whose revealed categories were last reset (a detail sheet in between keeps them). */
let revealedFor: string | null = null;

/**
 * A category of the sector, folded: its count, what the map shows of it at massif scale,
 * and « voir sur la carte » to draw it whole.
 */
function CategoryGroup({ cat, title, items, children, revealable = true }: { cat: FeatureCategory; title: string; items: AtlasFeatureProps[]; children?: React.ReactNode; revealable?: boolean }) {
  const [open, setOpen] = useState(false);
  const readability = useApp((s) => s.readability);
  const revealed = useApp((s) => s.revealed.includes(cat));
  if (!items.length && !children) return null;
  // Hotspots known only from GPS tracks stay on the live map (the diagram draws documented items).
  const drawn = items.filter((p) => p.origin !== 'kk7');
  const measured = items.length - drawn.length;
  const shown = shownAtMassifScale(
    drawn.map((p) => p.tier),
    readability,
    revealed,
  );
  const hint =
    (LINES.includes(cat)
      ? shown < drawn.length
        ? `${shown} nommée(s) à cette échelle`
        : ''
      : shown >= drawn.length
        ? 'tout sur la carte'
        : cat === 'thermals'
          ? `${shown} sur la carte, ${drawn.length - shown} en pastilles`
          : `${shown} sur la carte, ${drawn.length - shown} en zoomant`) + (measured ? ` · ${measured} point(s) chaud(s) mesuré(s), carte en direct` : '');
  const toggleReveal = () => {
    const s = useApp.getState();
    s.set({ revealed: revealed ? s.revealed.filter((c) => c !== cat) : [...s.revealed, cat] });
  };
  return (
    <section className={`item-section cat-group ${open ? 'open' : ''}`}>
      <div className="group-head">
        <button className="group-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <i className="dot" style={{ background: CAT_COLOR[cat] }} />
          <span className="group-title">
            {title} <span className="count">{items.length}</span>
            {hint && <small>{hint}</small>}
          </span>
          <IconChevron size={14} className="chev" />
        </button>
        {revealable && items.length > 0 && (
          <button className={`chip reveal ${revealed ? 'active' : ''}`} aria-pressed={revealed} onClick={toggleReveal} title={revealed ? 'Revenir à la lisibilité choisie' : 'Dessiner toute la catégorie sur la carte, quel que soit le zoom'}>
            {revealed ? 'Affichés' : 'Voir sur la carte'}
          </button>
        )}
      </div>
      {open && (
        <>
          {children}
          <ul className="items">
            {items.map((p) => (
              <SchemaItem key={p.id} id={p.id} color={colorOf(p)} name={p.name} meta={metaOf(p)} low={p.confidence === 'low' && LINES.includes(p.category)} detail={p.tier === 3} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** All-in-one reading of a massif for a typical summer day, in sync with the schematic map. */
function SchemaPanel({ m, atlas }: { m: AtlasMassif; atlas: Atlas }) {
  const { schemaPhase, tourStep, schema3d, schemaWind, synopticFrom, synopticKmh, set } = useApp();
  const slot = SCHEMA_PHASES.find((p) => p.key === schemaPhase)!;
  const feats = useMemo(() => {
    const get = (cat: FeatureCategory) =>
      atlas.features[cat]
        .filter((f) => f.properties.massif === m.id)
        .map((f) => f.properties)
        .sort(byRank);
    const [w, s, e, n] = m.bbox;
    // Transitions: cross-country routes of any sector that cross this one.
    const routes = atlas.features.routes
      .filter((f) => f.properties.massif === m.id || f.geometry.coordinates.some((c) => Array.isArray(c) && c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n))
      .map((f) => f.properties)
      .sort(byRank);
    // Breezes of neighbouring sectors that run along or into this one (they shape its day too).
    const pad = 0.05;
    const near = atlas.features.breezes
      .filter((f) => f.properties.massif !== m.id && f.properties.massif !== 'alpes-francaises' && f.geometry.coordinates.some((c) => Array.isArray(c) && c[0] >= w - pad && c[0] <= e + pad && c[1] >= s - pad && c[1] <= n + pad))
      .map((f) => f.properties);
    const own = { breezes: get('breezes'), convergences: get('convergences'), thermals: get('thermals'), hazards: get('hazards'), takeoffs: get('takeoffs'), landings: get('landings'), soaring: get('soaring') };
    // The sector's essentials (tier 1), best first.
    const essentials = Object.values(own)
      .flat()
      .filter((p) => p.tier === 1)
      .sort(byRank);
    return { near, ...own, routes, essentials };
  }, [atlas, m]);
  useEffect(() => {
    // A new sector starts from the chosen readability.
    if (revealedFor === m.id) return;
    revealedFor = m.id;
    if (useApp.getState().revealed.length) set({ revealed: [] });
  }, [m.id, set]);
  const active = feats.breezes.filter((b) => activeInSlot(b.windowStart, b.windowEnd, slot.hours));
  const other = feats.breezes.length - active.length;
  const nearActive = feats.near.filter((b) => activeInSlot(b.windowStart, b.windowEnd, slot.hours));
  return (
    <article className="sheet schema-sheet">
      <div className="massif-head">
        <button className="back" onClick={() => goTo('massifs')}>
          <IconBack size={15} /> Massifs
        </button>
        <button className="icon-btn ghost" aria-label="Fermer le massif" title="Revenir à la carte" onClick={() => goTo('carte')}>
          ×
        </button>
      </div>
      <p className="eyebrow">{m.region}</p>
      <h2>{m.shortName}</h2>
      <div className="massif-actions">
        {tourStep === null && (
          <button className="btn small primary" onClick={() => set({ tourStep: 0 })}>
            Présente-moi ce massif
          </button>
        )}
        <div className="seg small" role="radiogroup" aria-label="Relief">
          <button className={schema3d ? 'on' : ''} onClick={() => set({ schema3d: true })} role="radio" aria-checked={schema3d}>
            Relief 3D
          </button>
          <button className={!schema3d ? 'on' : ''} onClick={() => set({ schema3d: false })} role="radio" aria-checked={!schema3d}>
            À plat
          </button>
        </div>
        <button className={`btn small ghost ${schemaWind ? 'on' : ''}`} aria-pressed={schemaWind} onClick={() => set({ schemaWind: !schemaWind })} title="Particules de vent simulé sous le schéma">
          Particules
        </button>
      </div>
      <p className="muted small schema-hint">Schéma pour une journée d’été type : choisissez le moment de la journée.</p>
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
        <span>
          <i className="sw-bubble">3</i> thermiques regroupés : toucher pour déplier
        </span>
      </div>
      {m.summary && <Summary text={m.summary} atlas={atlas} order={m.sources} />}
      {feats.essentials.length > 0 && (
        <section className="item-section essentials">
          <h3>L’essentiel</h3>
          <ul className="items">
            {feats.essentials.map((p) => (
              <SchemaItem key={p.id} id={p.id} color={colorOf(p)} name={p.name} meta={[CAT_ONE[p.category], metaOf(p)].filter(Boolean).join(' · ')} />
            ))}
          </ul>
        </section>
      )}
      <div className="readability-row">
        <span className="muted small">Carte</span>
        <ReadabilityControl compact />
      </div>
      {CATEGORY_ORDER.map((cat) => {
        if (cat === 'breezes')
          return (
            <div key={cat}>
              <CategoryGroup cat="breezes" title={`Brises ${slot.label.toLowerCase()}`} items={active}>
                {!active.length && <p className="muted small">Aucune brise documentée sur ce créneau.</p>}
                {other > 0 && <p className="muted small">{other} autre(s) brise(s) documentée(s) à d’autres heures : changez de créneau.</p>}
              </CategoryGroup>
              <CategoryGroup cat="breezes" title="Brises des secteurs voisins" items={nearActive} revealable={false} />
            </div>
          );
        const titles: Record<FeatureCategory, string> = {
          breezes: '',
          convergences: 'Convergences',
          hazards: 'Pièges et dangers',
          takeoffs: 'Décollages',
          soaring: 'Soaring',
          routes: 'Transitions et itinéraires de cross',
          thermals: 'Thermiques connus',
          landings: 'Atterrissages',
        };
        return <CategoryGroup key={cat} cat={cat} title={titles[cat]} items={feats[cat]} />;
      })}
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
      <button className="btn ghost small" onClick={() => startDraft({ kind: 'new', targetTitle: m.shortName })}>
        <IconPlus size={15} /> Signaler un phénomène dans ce massif
      </button>
      <FeedbackBar key={m.id} targetRef={`massif:${m.id}`} title={m.shortName} />
    </article>
  );
}

/** The whole-Alps sector: large valley breezes, synoptic regimes, long routes. */
const OVERVIEW = 'alpes-francaises';

function MassifBrowser({ atlas }: { atlas: Atlas }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = norm(q.trim());
    return atlas.regions.map((r) => ({
      region: r,
      massifs: atlas.massifs.filter((m) => m.id !== OVERVIEW && m.region === r && (!needle || norm(`${m.name} ${m.summary}`).includes(needle))),
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
      {!q && atlas.massifs.some((m) => m.id === OVERVIEW) && (
        <button className="overview-card" onClick={() => openMassif(OVERVIEW, true)}>
          <strong>Commencer par la vue d’ensemble</strong>
          <span>Les grandes brises de vallée, les vents météo et les grands itinéraires : les clés pour lire ensuite chaque massif.</span>
        </button>
      )}
      {groups.map(
        (g) =>
          g.massifs.length > 0 && (
            <section key={g.region} className="region">
              <h3>{g.region}</h3>
              <ul>
                {g.massifs.map((m) => (
                  <li key={m.id} className="massif-row">
                    <button onClick={() => openMassif(m.id, true)}>
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
  const probe = useRuntime((r) => r.probe);
  const { selectedMassif, schemaMassif, browseOpen, mobileSheet, browseTab, uiMode } = useApp();
  // Simulation mode: the panel holds the simulation settings, a probe or a detail over them.
  const sim = uiMode === 'simulate';
  const mobile = useIsMobile();
  const massif = atlas?.massifs.find((m) => m.id === selectedMassif);
  const schema = atlas?.massifs.find((m) => m.id === schemaMassif);
  const schemaPicking = useApp((x) => x.schemaPicking);
  const open = mobile ? mobileSheet === 'browse' : sim || browseOpen || schemaPicking || !!feature || !!probe || !!schema || !!massif;
  // A new sheet starts at its top.
  const ref = useRef<HTMLElement>(null);
  const contentKey = feature?.ref ?? (probe ? `probe:${probe.lon},${probe.lat}` : sim ? 'simulation' : schema ? `schema:${schema.id}` : massif ? `massif:${massif.id}` : `browse:${browseTab}`);
  // (Also when it comes back after a visit: it was hidden, and kept the previous content's scroll.)
  const visiting = useApp((x) => x.tourStep !== null);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [contentKey, visiting]);
  return (
    <aside ref={ref} className={`sidebar panel ${open ? '' : 'collapsed'}`} aria-label="Massifs et connaissances locales">
      {mobile ? (
        <SheetHandle
          onClose={() => {
            // A detail closes back to the massif page or the simulation under it; anything else goes back to the map.
            if (sim && (feature || probe)) {
              useRuntime.getState().set({ feature: null });
              getController()?.clearProbe();
            } else if (sim) useApp.getState().set({ mobileSheet: 'none' });
            else if (feature && schemaMassif) useRuntime.getState().set({ feature: null });
            else goTo('carte');
          }}
        />
      ) : (
        !schema &&
        !probe &&
        (!sim || feature) && (
          <button
            className="icon-btn ghost panel-close"
            aria-label={sim ? 'Retour à la simulation' : 'Fermer le panneau'}
            onClick={() => (sim ? useRuntime.getState().set({ feature: null }) : goTo('carte'))}
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
      ) : probe ? (
        <ProbeSheet />
      ) : sim ? (
        <SimulationPanel />
      ) : schema ? (
        <SchemaPanel m={schema} atlas={atlas} />
      ) : massif ? (
        <SchemaPanel m={massif} atlas={atlas} />
      ) : (
        <>
          <p className="eyebrow">{browseTab === 'routes' ? 'Cross' : 'Massifs'}</p>
          {browseTab === 'routes' ? <RoutesBrowser atlas={atlas} /> : <MassifBrowser atlas={atlas} />}
        </>
      )}
    </aside>
  );
}

