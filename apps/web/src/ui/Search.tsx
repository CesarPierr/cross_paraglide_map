/**
 * Global search: sectors, documented phenomena (breezes, convergences,
 * thermals, hazards, take-offs…), official FFVL sites and places (villages,
 * summits, passes) from the IGN geocoder. Keyboard: "/" or Ctrl/Cmd+K.
 */
import type { FeatureCategory, FlyingSite } from '@brises/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureDetails } from '../map/modules/types';
import { BREEZE_COLORS, COLORS } from '../map/palette';
import { useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { IconSearch } from './icons';
import { isMobileNow } from './mobile';

interface Result {
  key: string;
  group: string;
  title: string;
  meta?: string;
  color: string;
  run: () => void;
}

const CAT_LABEL: Record<FeatureCategory, string> = {
  breezes: 'Brise',
  convergences: 'Convergence',
  hazards: 'Piège',
  thermals: 'Thermique',
  soaring: 'Soaring',
  takeoffs: 'Déco',
  landings: 'Atterro',
  routes: 'Itinéraire',
};
const CAT_COLOR: Record<FeatureCategory, string> = {
  breezes: BREEZE_COLORS.valley,
  convergences: COLORS.convergence,
  hazards: COLORS.hazard,
  thermals: COLORS.thermal,
  soaring: COLORS.soaring,
  takeoffs: COLORS.takeoff,
  landings: COLORS.landing,
  routes: COLORS.route,
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Every query word must appear; earlier and whole-word matches rank first. */
function score(hay: string, words: string[]): number {
  let s = 0;
  for (const w of words) {
    const i = hay.indexOf(w);
    if (i < 0) return -1;
    s += i === 0 ? 3 : hay[i - 1] === ' ' ? 2 : 1;
  }
  return s;
}

const showSheet = () => (isMobileNow() ? useApp.getState().set({ mobileSheet: 'browse' }) : useApp.getState().set({ panelOpen: true }));

function openDetails(d: FeatureDetails) {
  useRuntime.getState().set({ feature: d });
  showSheet();
  getController()?.flyToBbox(d.bbox);
}

function siteDetails(s: FlyingSite): FeatureDetails {
  const long = ['Conditions idéales', 'Dangers', 'Restrictions', 'Réglementation aérienne'];
  return {
    ref: `search-site:${s.id}`,
    category: s.kind === 'takeoff' ? 'Décollage FFVL' : s.kind === 'landing' ? 'Atterrissage FFVL' : 'Site FFVL',
    title: s.name,
    badges: [{ label: 'Site officiel', tone: 'ok' }],
    details: [
      ...(s.altitude ? ([['Altitude', `${Math.round(s.altitude)} m`]] as [string, string][]) : []),
      ...(s.orientations?.length ? ([['Orientation', s.orientations.join(', ')]] as [string, string][]) : []),
      ...Object.entries(s.details ?? {}).filter(([k]) => !long.includes(k)),
    ],
    paragraphs: [...(s.description ? [s.description] : []), ...long.filter((k) => s.details?.[k]).map((k) => `${k} : ${s.details![k]}`)],
    links: s.url ? [{ label: 'Fiche FFVL complète', url: s.url }] : undefined,
    warning: 'Extrait de la fiche FFVL : consultez la fiche complète et les consignes locales avant de voler.',
    bbox: [s.lon - 0.01, s.lat - 0.01, s.lon + 0.01, s.lat + 0.01],
  };
}

let sitesCache: Promise<FlyingSite[]> | null = null;
const loadSites = () =>
  (sitesCache ??= fetch('data/sites-ffvl.json')
    .then((r) => (r.ok ? (r.json() as Promise<FlyingSite[]>) : []))
    .catch(() => []));

interface Place {
  x: number;
  y: number;
  names?: string[];
  fulltext: string;
  kind?: string;
  city?: string;
}

export function SearchBox() {
  const atlas = useRuntime((r) => r.atlas);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [sites, setSites] = useState<FlyingSite[]>([]);
  const [found, setFound] = useState<{ q: string; list: Place[] }>({ q: '', list: [] });
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  // "/" or Ctrl/Cmd+K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, []);

  useEffect(() => {
    if (open && !sites.length) void loadSites().then(setSites);
  }, [open, sites.length]);

  // Places from the IGN geocoder (debounced, only for 3+ characters).
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`https://data.geopf.fr/geocodage/completion/?text=${encodeURIComponent(text)}&type=PositionOfInterest,StreetAddress&maximumResponses=6&bbox=4.8,43.5,7.9,46.6`, { signal: ctl.signal })
        .then((r) => r.json() as Promise<{ results?: Place[] }>)
        .then((j) => setFound({ q: text, list: j.results ?? [] }))
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const results = useMemo<Result[]>(() => {
    const words = norm(q).split(' ').filter(Boolean);
    if (!words.length || !atlas) return [];
    const out: (Result & { s: number })[] = [];
    for (const m of atlas.massifs) {
      const s = score(norm(`${m.shortName} ${m.name}`), words);
      if (s >= 0)
        out.push({
          key: `m:${m.id}`,
          s: s + 4,
          group: 'Massifs',
          title: m.shortName,
          meta: m.region,
          color: '#e2e8f0',
          run: () => {
            useRuntime.getState().set({ feature: null });
            useApp.getState().set({ selectedMassif: m.id });
            showSheet();
            getController()?.flyToBbox(m.bbox, { maxZoom: 11 });
          },
        });
    }
    const shortName = new Map(atlas.massifs.map((m) => [m.id, m.shortName]));
    for (const cat of Object.keys(atlas.features) as FeatureCategory[])
      for (const f of atlas.features[cat]) {
        const p = f.properties;
        const s = score(norm(`${p.name} ${shortName.get(p.massif) ?? ''}`), words);
        if (s < 0) continue;
        out.push({
          key: `f:${p.id}`,
          s: s + 2,
          group: 'Phénomènes et sites cités',
          title: p.name,
          meta: `${CAT_LABEL[cat]} · ${shortName.get(p.massif) ?? ''}`,
          color: cat === 'breezes' ? (BREEZE_COLORS[p.kind ?? ''] ?? BREEZE_COLORS.valley) : CAT_COLOR[cat],
          run: () => {
            const d = getController()?.describe(`atlas:${p.id}`);
            if (d) openDetails(d);
          },
        });
      }
    for (const site of sites) {
      const s = score(norm(`${site.name} ${site.details?.Commune ?? ''}`), words);
      if (s < 0) continue;
      out.push({
        key: `s:${site.id}`,
        s,
        group: 'Sites FFVL',
        title: site.name,
        meta: [site.kind === 'takeoff' ? 'Déco' : site.kind === 'landing' ? 'Atterro' : 'Site', site.altitude ? `${Math.round(site.altitude)} m` : '', site.orientations?.join(' ')].filter(Boolean).join(' · '),
        color: site.kind === 'landing' ? COLORS.landing : COLORS.takeoff,
        run: () => openDetails(siteDetails(site)),
      });
    }
    const grouped = ['Massifs', 'Phénomènes et sites cités', 'Sites FFVL'].flatMap((g) =>
      out
        .filter((r) => r.group === g)
        .sort((a, b) => b.s - a.s)
        .slice(0, g === 'Massifs' ? 4 : 6),
    );
    const places = found.q === q.trim() ? found.list : [];
    const placeResults: Result[] = places.map((p, i) => ({
      key: `p:${i}:${p.fulltext}`,
      group: 'Lieux (IGN)',
      title: p.names?.[0] ?? p.fulltext,
      meta: [p.kind, p.city].filter(Boolean).join(' · '),
      color: '#94a3b8',
      run: () => {
        const c = getController();
        c?.map.flyTo({ center: [p.x, p.y], zoom: 12.5, duration: 1800 });
        void c?.probe(p.x, p.y, true);
      },
    }));
    return [...grouped, ...placeResults];
  }, [q, atlas, sites, found]);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    r.run();
    setOpen(false);
    setQ('');
    input.current?.blur();
  };

  let lastGroup = '';
  return (
    <div className={`searchbox ${open && q ? 'open' : ''}`} ref={box}>
      <label className="search">
        <IconSearch size={16} />
        <input
          ref={input}
          type="search"
          placeholder="Massif, brise, déco, village, sommet…"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') choose(results[sel]);
            else if (e.key === 'Escape') {
              setOpen(false);
              input.current?.blur();
            }
          }}
          aria-label="Rechercher sur la carte"
          aria-expanded={open && results.length > 0}
          aria-controls="search-results"
          role="combobox"
        />
        <kbd className="kbd">/</kbd>
      </label>
      {open && q.trim() && (
        <div className="search-results panel" id="search-results" role="listbox">
          {results.length === 0 && <p className="muted small empty">Aucun résultat pour « {q} ».</p>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.key}>
                {head && <p className="search-group">{head}</p>}
                <button role="option" aria-selected={i === sel} className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => choose(r)}>
                  <span className="dot" style={{ background: r.color }} />
                  <span className="item-name">
                    {r.title}
                    {r.meta && <small>{r.meta}</small>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
