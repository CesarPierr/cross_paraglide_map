/**
 * "Présente-moi ce massif": a guided visit of the schema massif, one idea per
 * step. Chapters: overview, breezes of the day, where it climbs by time of
 * day, key climbs, classic routes walked point by point, hazards, take-offs,
 * synoptic wind, transitions. Each step moves the camera, sets the schema's
 * time slot and pulses the place it talks about; "Approfondir" opens the full
 * sourced detail. Built from the atlas only.
 */
import type { Atlas, AtlasFeature, AtlasFeatureProps, AtlasMassif, AtlasTourPlace, FeatureCategory } from '@brises/shared';
import { Marker } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { activeInSlot, thermalRole } from '../map/modules/schema';
import { SCHEMA_PHASES, useApp, useRuntime, type SchemaPhase } from '../state/store';
import { getController } from './controller-ref';
import { isMobileNow, sheetHeight, SheetHandle, showSheet, useIsMobile, useSheet } from './mobile';

type LngLat = [number, number];
interface Line {
  text: string;
  /** Atlas feature id: the line opens its sheet (and its sources). */
  id?: string;
  /** Global source ids behind this sentence (shown as small numbered references). */
  src?: string[];
}
interface Step {
  chapter: string;
  title: string;
  /** One or two short sentences. */
  lead: string;
  lines?: Line[];
  /** Shown on "Approfondir". */
  more?: Line[];
  sourceIds?: string[];
  bbox?: [number, number, number, number];
  point?: LngLat;
  zoom?: number;
  phase?: SchemaPhase;
  /** Synoptic wind simulated during the step (regular effects of a wind direction). */
  wind?: { fromDeg: number; kmh: number };
  /** Sources of the lead sentence. */
  leadSrc?: string[];
  /** Atlas items the step talks about: highlighted on the schema. */
  ids?: string[];
  /** Places the text names: pinned on the map, highlighted in the text. */
  places?: AtlasTourPlace[];
  focus: LngLat[];
}

const srcOf = (p: { sources: string }) => p.sources.split(',').filter(Boolean);

/** Direction of a synoptic label ("Ouest", "NO", "Bise", "Lombarde"…), degrees the wind comes from. */
export function windFromLabel(label: string): number | null {
  const t = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  const named: [RegExp, number][] = [
    [/bise/, 45],
    [/mistral/, 340],
    [/lombarde/, 80],
    [/foehn|fohn|vent du sud/, 180],
    [/nord[- ]?ouest|\bno\b|\bnw\b/, 315],
    [/nord[- ]?est|\bne\b/, 45],
    [/sud[- ]?ouest|\bso\b|\bsw\b/, 225],
    [/sud[- ]?est|\bse\b/, 135],
    [/nord|\bn\b/, 0],
    [/ouest|\bo\b|\bw\b/, 270],
    [/\best\b|\be\b/, 90],
    [/sud|\bs\b/, 180],
  ];
  for (const [re, deg] of named) if (re.test(t)) return deg;
  return null;
}

const clean = (t: string | undefined) =>
  (t ?? '')
    .replace(/\[[^\]]*:S?\d+[^\]]*\]|\[S\d+(?:\s*,\s*S\d+)*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const sentences = (t: string | undefined, n: number, max: number) => {
  const c = clean(t);
  const parts = c.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [c];
  const out = parts.slice(0, n).join('').trim();
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
};

/** Waypoint names sometimes carry coordinates ("(point DMS 45°18'41\"N …)"): keep the place name. */
export const cleanPlace = (n: string) =>
  n
    .replace(/\s*\((?:[^()]*\b(?:DMS|°|coord|lat|lon)\b[^()]*|[^()]*\d+°[^()]*)\)/gi, '')
    .replace(/\s*\d+°\d+['’]\d+(?:[.,]\d+)?["”]?\s*[NS]\s*\d+°\d+['’]\d+(?:[.,]\d+)?["”]?\s*[EOW]/g, '')
    .trim();

const coordsOf = (f: AtlasFeature): LngLat[] => (f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates);

function boxOf(points: LngLat[], pad = 0.02): [number, number, number, number] | undefined {
  if (!points.length) return undefined;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

const km = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * 111.32 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110.57);

const CONF_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const ROLE_RANK: Record<string, number> = { plafond: 0, relance: 1, déclencheur: 2 };
const KIND_FR: Record<string, string> = {
  valley: 'brise de vallée',
  downvalley: 'brise descendante',
  slope: 'brise de pente',
  'plain-to-mountain': 'aspiration de la plaine',
  lake: 'brise de lac',
  'pass-transfer': 'transfert par un col',
  regional: 'brise régionale',
  katabatic: 'écoulement catabatique',
};

/** When does a thermal work, from its documented hours. */
function dayPart(p: AtlasFeatureProps): 'matin' | 'après-midi' | 'soir' | null {
  const h = (p.details?.Heures ?? '').toLowerCase();
  if (/soir|fin de journée|restitution/.test(h)) return 'soir';
  if (/matin|dès (8|9|10)h|\b(8|9|10)h/.test(h)) return 'matin';
  if (/après-midi|midi|1[2-7]h/.test(h)) return 'après-midi';
  return null;
}

/** A written visit (research_notes/…/visites): narration tied to atlas items. */
/** Camera frame of a written step: the whole sector, or its items and named places together. */
function frameOf(wholeSector: boolean, feats: AtlasFeature[], places: AtlasTourPlace[], m: AtlasMassif): Pick<Step, 'bbox' | 'point' | 'zoom'> {
  const named = places.map((p): LngLat => [p.lon, p.lat]);
  const pts: LngLat[] = [...feats.flatMap(coordsOf), ...named];
  // The whole sector and the surroundings its text names (the camera clamps to the sector ±25 %).
  if (wholeSector || !pts.length) return { bbox: boxOf([[m.bbox[0], m.bbox[1]], [m.bbox[2], m.bbox[3]], ...named], 0) ?? m.bbox };
  if (pts.length === 1) return { point: pts[0], zoom: 12.3 };
  return { bbox: boxOf(pts, 0.02) };
}

function writtenTour(atlas: Atlas, m: AtlasMassif): Step[] | null {
  const steps = atlas.tours?.[m.id];
  if (!steps?.length) return null;
  const byId = new Map(Object.values(atlas.features).flatMap((list) => list.map((f) => [f.properties.id, f] as const)));
  // The visited massif itself is the whole frame, not a pin in its middle.
  const own = (places?: AtlasTourPlace[]) => places?.filter((p) => !(p.kind === 'massif' && p.label === m.shortName));
  return steps.map((st) => {
    const feats = st.features.map((id) => byId.get(id)).filter((f): f is AtlasFeature => !!f);
    return {
      chapter: st.chapter,
      title: st.title,
      lead: st.text,
      leadSrc: st.sources,
      ids: st.features,
      more: feats.map((f) => ({ text: `${f.properties.name}${f.properties.description ? ` — ${sentences(f.properties.description, 1, 200)}` : ''}`, id: f.properties.id, src: srcOf(f.properties) })),
      sourceIds: st.sources,
      places: own(st.places),
      // The frame holds the items and the places the text names, so a reader new to the area sees where they are.
      ...frameOf(st.view === 'massif', feats, own(st.places) ?? [], m),
      phase: st.phase,
      wind: st.wind ? { fromDeg: st.wind.fromDeg, kmh: st.wind.kmh } : undefined,
      focus: [],
    };
  });
}

export function buildTour(atlas: Atlas, m: AtlasMassif): Step[] {
  const written = writtenTour(atlas, m);
  if (written) return written;
  const own = (cat: FeatureCategory) => atlas.features[cat].filter((f) => f.properties.massif === m.id);
  const thermals = own('thermals');
  const hazards = own('hazards');
  const steps: Step[] = [];
  const near = (p: LngLat, list: AtlasFeature[], maxKm: number) => list.filter((f) => coordsOf(f).some((c) => km(c, p) <= maxKm));

  // 1. Overview
  steps.push({
    chapter: 'Vue d’ensemble',
    title: m.shortName,
    lead: sentences(m.summary, 2, 240) || 'Secteur encore peu documenté.',
    leadSrc: m.sources.slice(0, 3),
    more: [{ text: clean(m.summary), src: m.sources.slice(0, 3) }, ...m.tips.map((t) => ({ text: `Conseil : ${clean(t)}` }))],
    sourceIds: m.sources,
    bbox: m.bbox,
    focus: [],
  });

  // 2. Breezes: morning then afternoon, the strongest first, one step per slot.
  const breezes = own('breezes');
  const slot = (k: SchemaPhase) => SCHEMA_PHASES.find((p) => p.key === k)!.hours;
  for (const [k, title] of [
    ['morning', 'Le matin'],
    ['afternoon', 'L’après-midi'],
    ['evening', 'En fin de journée'],
  ] as const) {
    const active = breezes
      .filter((f) => activeInSlot(f.properties.windowStart, f.properties.windowEnd, slot(k)))
      .sort((a, b) => (b.properties.speedKmh ?? 0) - (a.properties.speedKmh ?? 0));
    if (!active.length) continue;
    const top = active[0].properties;
    steps.push({
      chapter: 'Brises',
      title,
      lead: `${top.name} : ${KIND_FR[top.kind ?? ''] ?? 'brise'}${top.speedKmh ? ` d’environ ${top.speedKmh} km/h` : ''}${top.details?.Trajet ? `, ${top.details.Trajet.split(' → ').slice(0, 1)} vers ${top.details.Trajet.split(' → ').slice(-1)}` : ''}.`,
      leadSrc: srcOf(top),
      lines: active.slice(1, 4).map((f) => ({ text: `${f.properties.name}${f.properties.speedKmh ? ` · ${f.properties.speedKmh} km/h` : ''}`, id: f.properties.id, src: srcOf(f.properties) })),
      more: active.map((f) => ({ text: `${f.properties.name} — ${sentences(f.properties.description, 2, 260)}`, id: f.properties.id, src: srcOf(f.properties) })),
      sourceIds: active.flatMap((f) => srcOf(f.properties)),
      bbox: boxOf(active.slice(0, 3).flatMap(coordsOf), 0.02) ?? m.bbox,
      ids: active.slice(0, 4).map((f) => f.properties.id),
      phase: k,
      focus: [],
    });
  }
  const convergences = own('convergences');
  for (const c of convergences.slice(0, 2)) {
    const p = c.properties;
    steps.push({
      chapter: 'Brises',
      title: `Convergence · ${p.name}`,
      lead: sentences(p.description, 1, 200) || 'Ligne où les brises se rencontrent et font monter l’air.',
      leadSrc: srcOf(p),
      lines: p.details?.Quand ? [{ text: `Quand : ${p.details.Quand}` }] : undefined,
      more: [{ text: clean(p.description), id: p.id, src: srcOf(p) }],
      sourceIds: p.sources.split(',').filter(Boolean),
      bbox: boxOf(coordsOf(c), 0.03),
      ids: [p.id],
      phase: 'afternoon',
      focus: coordsOf(c).slice(0, 1),
    });
  }

  // 3. Where it climbs, by time of day (faces working in the morning, afternoon, evening).
  if (thermals.length >= 3) {
    const groups: [string, AtlasFeature[]][] = (['matin', 'après-midi', 'soir'] as const).map((part) => [part, thermals.filter((t) => dayPart(t.properties) === part)]);
    const lines = groups.filter(([, l]) => l.length).map(([part, l]) => ({ text: `${part[0].toUpperCase()}${part.slice(1)} : ${l.slice(0, 4).map((t) => t.properties.name).join(', ')}` }));
    if (lines.length)
      steps.push({
        chapter: 'Thermiques',
        title: 'Où ça monte selon l’heure',
        lead: 'Les faces au soleil s’allument les unes après les autres : est le matin, sud à midi, ouest en fin de journée.',
        lines,
        more: thermals.map((t) => ({ text: [t.properties.name, t.properties.details?.Heures, sentences(t.properties.description, 1, 160)].filter(Boolean).join(' · '), id: t.properties.id, src: srcOf(t.properties) })),
        sourceIds: thermals.flatMap((t) => srcOf(t.properties)),
        bbox: boxOf(thermals.flatMap(coordsOf), 0.03),
        ids: thermals.map((t) => t.properties.id),
        focus: [],
      });
  }

  // 4. Key climbs, one per step: ceilings and relaunch points first.
  const rank = (p: AtlasFeatureProps) => ROLE_RANK[thermalRole(p.description) ?? ''] ?? 3;
  const keyThermals = thermals
    .slice()
    .sort((a, b) => rank(a.properties) - rank(b.properties) || (CONF_RANK[a.properties.confidence ?? 'medium'] ?? 1) - (CONF_RANK[b.properties.confidence ?? 'medium'] ?? 1))
    .slice(0, 6);
  for (const t of keyThermals) {
    const p = t.properties;
    const at = coordsOf(t)[0];
    const role = thermalRole(p.description);
    const hz = near(at, hazards, 2);
    steps.push({
      chapter: 'Thermiques',
      title: `${role ? `${role[0].toUpperCase()}${role.slice(1)}` : 'Thermique'} · ${p.name}`,
      lead: sentences(p.description, 1, 200),
      leadSrc: srcOf(p),
      lines: [p.details?.Heures && { text: `Quand : ${p.details.Heures}` }, p.details?.Déclencheur && { text: `Déclencheur : ${p.details.Déclencheur}` }].filter(Boolean) as Line[],
      more: [
        { text: clean(p.description), id: p.id, src: srcOf(p) },
        ...(p.details?.Altitude ? [{ text: `Altitude : ${p.details.Altitude}` }] : []),
        ...hz.map((h) => ({ text: `Attention à proximité : ${h.properties.name}`, id: h.properties.id, src: srcOf(h.properties) })),
      ],
      sourceIds: p.sources.split(',').filter(Boolean),
      point: at,
      zoom: 12.4,
      ids: [p.id, ...hz.map((h) => h.properties.id)],
      phase: dayPart(p) === 'matin' ? 'morning' : dayPart(p) === 'soir' ? 'evening' : 'afternoon',
      focus: [at],
    });
  }

  // 5. Classic routes, walked waypoint by waypoint with the climbs met on the way.
  const [w, s, e, n] = m.bbox;
  const inside = ([x, y]: LngLat) => x >= w && x <= e && y >= s && y <= n;
  // Local classic routes first: most of their points inside the sector, then the longer crosses.
  const share = (r: AtlasFeature) => coordsOf(r).filter(inside).length / coordsOf(r).length;
  const routes = atlas.features.routes
    .filter((r) => coordsOf(r).filter(inside).length >= 2)
    .sort((a, b) => Number(share(b) >= 0.7) - Number(share(a) >= 0.7) || Number(b.properties.massif === m.id) - Number(a.properties.massif === m.id) || coordsOf(b).length - coordsOf(a).length)
    .slice(0, 1);
  for (const r of routes) {
    const p = r.properties;
    const pts = coordsOf(r);
    const names = (p.details?.Points ?? '').split(' → ').map(cleanPlace);
    steps.push({
      chapter: 'Cheminements',
      title: p.name,
      lead: sentences(p.description, 2, 230) || `${pts.length} points de passage${p.details?.Distance ? `, ${p.details.Distance}` : ''}.`,
      leadSrc: srcOf(p),
      more: [{ text: clean(p.description), id: p.id, src: srcOf(p) }],
      sourceIds: p.sources.split(',').filter(Boolean),
      bbox: boxOf(pts.filter(inside).length >= 2 ? pts.filter(inside) : pts, 0.03),
      ids: [p.id],
      focus: [],
    });
    pts.slice(0, 6).forEach((pt, i) => {
      const th = near(pt, thermals, 1.5)[0];
      const hz = near(pt, hazards, 1.5)[0];
      steps.push({
        chapter: 'Cheminements',
        title: `${i + 1}. ${names[i] || 'Point de passage'}`,
        lead: th ? `On y raccroche : ${th.properties.name}${th.properties.details?.Heures ? ` (${th.properties.details.Heures})` : ''}.` : i === 0 ? 'Départ du cheminement.' : i === pts.length - 1 ? 'Fin du cheminement.' : 'Transition vers le point suivant.',
        leadSrc: th ? srcOf(th.properties) : srcOf(p),
        lines: hz ? [{ text: `Attention : ${hz.properties.name}`, id: hz.properties.id, src: srcOf(hz.properties) }] : undefined,
        more: th ? [{ text: clean(th.properties.description), id: th.properties.id, src: srcOf(th.properties) }] : undefined,
        sourceIds: (th ?? r).properties.sources.split(',').filter(Boolean),
        point: pt,
        zoom: 11.6,
        ids: [p.id, ...(th ? [th.properties.id] : []), ...(hz ? [hz.properties.id] : [])],
        phase: 'afternoon',
        focus: [pt],
      });
    });
  }

  // 6. Hazards, one per step.
  hazards.slice(0, 3).forEach((h, i) => {
    const p = h.properties;
    steps.push({
      chapter: 'Pièges',
      title: p.name,
      lead: sentences(p.details?.Conditions || p.description, 1, 200),
      leadSrc: srcOf(p),
      more: [
        { text: clean(p.description), id: p.id, src: srcOf(p) },
        ...(i === 0 ? hazards.slice(3).map((o) => ({ text: `${o.properties.name} : ${sentences(o.properties.details?.Conditions || o.properties.description, 1, 150)}`, id: o.properties.id, src: srcOf(o.properties) })) : []),
      ],
      sourceIds: p.sources.split(',').filter(Boolean),
      point: coordsOf(h)[0],
      zoom: 12,
      ids: [p.id],
      focus: [coordsOf(h)[0]],
    });
  });

  // 7. Take-offs and landings.
  const takeoffs = own('takeoffs').slice(0, 4);
  const landings = own('landings').slice(0, 3);
  if (takeoffs.length)
    steps.push({
      chapter: 'Décoller et poser',
      title: 'Décoller et poser',
      lead: `${takeoffs.length} décollage${takeoffs.length > 1 ? 's' : ''} cité${takeoffs.length > 1 ? 's' : ''} par les sources${landings.length ? `, ${landings.length} atterrissage${landings.length > 1 ? 's' : ''}` : ''}.`,
      lines: [
        ...takeoffs.map((t) => ({ text: [t.properties.name, t.properties.details?.Orientation].filter(Boolean).join(' · '), id: t.properties.id })),
        ...landings.map((l) => ({ text: `Atterro : ${l.properties.name}`, id: l.properties.id })),
      ],
      bbox: boxOf([...takeoffs, ...landings].flatMap(coordsOf), 0.03),
      ids: [...takeoffs, ...landings].map((f) => f.properties.id),
      focus: [],
    });

  // 8. Synoptic wind: one step per documented regular effect, simulated on the map.
  for (const x of m.synoptic.slice(0, 6)) {
    const from = windFromLabel(x.wind);
    const word = x.wind.toLowerCase().split(/[\s(]/)[0];
    const related = hazards.filter((h) => (h.properties.details?.Conditions ?? '').toLowerCase().includes(word));
    steps.push({
      chapter: 'Vent météo',
      title: `Par ${x.wind.toLowerCase().startsWith('vent') ? x.wind.toLowerCase() : `vent de ${x.wind}`}`,
      lead: sentences(x.effect, 2, 240),
      leadSrc: x.sources,
      lines: related.slice(0, 3).map((h) => ({ text: `Attention : ${h.properties.name}`, id: h.properties.id, src: srcOf(h.properties) })),
      more: [{ text: clean(x.effect), src: x.sources }],
      sourceIds: x.sources,
      bbox: m.bbox,
      phase: 'afternoon',
      wind: from === null ? undefined : { fromDeg: from, kmh: /fort|violent|> ?3\d/i.test(x.effect) ? 35 : 25 },
      ids: related.map((h) => h.properties.id),
      focus: [],
    });
  }

  // 9. Transitions towards the neighbours.
  const neighbourRoutes = atlas.features.routes.filter((r) => coordsOf(r).some(inside) && coordsOf(r).some((c) => !inside(c))).slice(0, 4);
  if (neighbourRoutes.length) {
    const neighbours = new Set<string>();
    for (const r of neighbourRoutes)
      for (const pt of coordsOf(r))
        for (const o of atlas.massifs) if (o.id !== m.id && o.id !== 'alpes-francaises' && pt[0] >= o.bbox[0] && pt[0] <= o.bbox[2] && pt[1] >= o.bbox[1] && pt[1] <= o.bbox[3]) neighbours.add(o.shortName);
    steps.push({
      chapter: 'Transitions',
      title: 'Vers les autres massifs',
      lead: neighbours.size ? `Les itinéraires documentés relient ${m.shortName} à ${[...neighbours].slice(0, 5).join(', ')}.` : 'Itinéraires documentés qui sortent du secteur.',
      lines: neighbourRoutes.map((r) => ({ text: [r.properties.name, r.properties.details?.Distance].filter(Boolean).join(' · '), id: r.properties.id })),
      bbox: m.bbox,
      ids: neighbourRoutes.map((r) => r.properties.id),
      focus: [],
    });
  }
  return steps;
}

function openFeature(id: string) {
  const d = getController()?.describe(`atlas:${id}`);
  if (!d) return;
  useRuntime.getState().set({ feature: d });
  showSheet();
}

const REPO_BLOB = 'https://github.com/CesarPierr/cross_paraglide_map/blob/main/';
const PHASE_HOUR: Record<SchemaPhase, number> = { morning: 9.5, midday: 12.5, afternoon: 15, evening: 19 };
/** What the simulation shows during a step, in words. */
const PHASE_LABEL: Record<SchemaPhase, string> = { morning: 'matin, 9h30', midday: 'midi, 12h30', afternoon: 'après-midi, 15h', evening: 'soir, 19h' };

/** Numbers the sources of a step in reading order (lead, lines, details, rest). */
function numberSources(step: Step): string[] {
  const order = [...(step.leadSrc ?? []), ...(step.lines ?? []).flatMap((l) => l.src ?? []), ...(step.more ?? []).flatMap((l) => l.src ?? []), ...(step.sourceIds ?? [])];
  return [...new Set(order)];
}

function Refs({ ids, order, atlas }: { ids?: string[]; order: string[]; atlas: Atlas }) {
  const list = [...new Set(ids ?? [])].filter((id) => atlas.sources[id]).slice(0, 3);
  if (!list.length) return null;
  return (
    <sup className="refs">
      {list.map((id) => {
        const src = atlas.sources[id];
        const n = order.indexOf(id) + 1;
        return (
          <a key={id} href={src.url} target="_blank" rel="noopener noreferrer" title={`${src.publisher ? `${src.publisher} — ` : ''}${src.title}`}>
            {n}
          </a>
        );
      })}
    </sup>
  );
}

/** Text with the places it names as highlighted words: tap one to see it pulse on the map. */
function PlaceText({ text, places, onPick }: { text: string; places?: AtlasTourPlace[]; onPick: (p: AtlasTourPlace, move?: boolean) => void }) {
  if (!places?.length) return <>{text}</>;
  const byName = new Map(places.map((p) => [p.name, p]));
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?<![\\p{L}\\-])(${names.join('|')})(?![\\p{L}\\-])`, 'u');
  return (
    <>
      {text.split(re).map((part, i) => {
        const pl = i % 2 === 1 ? byName.get(part) : undefined;
        return pl ? (
          <button key={i} className="place-ref" onClick={() => onPick(pl)} onMouseEnter={() => onPick(pl, false)} title={pl.label}>
            {part}
          </button>
        ) : (
          part
        );
      })}
    </>
  );
}

export function MassifTour() {
  const { tourStep, schemaMassif, schema3d, set } = useApp();
  const atlas = useRuntime((r) => r.atlas);
  const massif = atlas?.massifs.find((m) => m.id === schemaMassif);
  const steps = useMemo(() => (atlas && massif ? buildTour(atlas, massif) : []), [atlas, massif]);
  const step = tourStep !== null ? steps[tourStep] : undefined;
  const [deeper, setDeeper] = useState<number | null>(null);
  const active = tourStep !== null;
  // Each step starts at its top (on a phone the sheet would stay scrolled to the previous step's end).
  const card = useRef<HTMLDivElement>(null);
  /** Pins of the places named by the current step, by name as written. */
  const pins = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    card.current?.scrollTo({ top: 0 });
  }, [tourStep]);
  const mobile = useIsMobile();
  // Phone: the visit is the bottom sheet; the camera frames the map above it.
  const snap = useSheet((x) => x.snap);
  useEffect(() => {
    if (active && isMobileNow()) useSheet.getState().setSnap('half');
  }, [active]);

  // The visit drives the simulation (hour, synoptic wind); the user's settings come back at the end.
  useEffect(() => {
    if (!active) return;
    const s0 = useApp.getState();
    const saved = { hour: s0.hour, synopticFrom: s0.synopticFrom, synopticKmh: s0.synopticKmh, playing: s0.playing };
    useApp.getState().set({ playing: false });
    return () => useApp.getState().set(saved);
  }, [active]);

  // Camera, time slot, wind, highlight and pulsing markers of the current step.
  useEffect(() => {
    const c = getController();
    const map = c?.map;
    if (!step || !map || !massif) return;
    const patch: Partial<ReturnType<typeof useApp.getState>> = {};
    if (step.phase) Object.assign(patch, { schemaPhase: step.phase, hour: PHASE_HOUR[step.phase] });
    Object.assign(patch, step.wind ? { synopticFrom: step.wind.fromDeg, synopticKmh: step.wind.kmh } : { synopticKmh: 0 });
    useApp.getState().set(patch);
    c.highlightSchema(step.ids ?? []);
    const pad = isMobileNow() ? { top: 24, bottom: sheetHeight(snap, true) + 16, left: 20, right: 20 } : { top: 100, bottom: 290, left: 400, right: 60 };
    const pitch = schema3d ? 50 : 0;
    // Steady moves: ease (no fly-out arc), framed inside the sector.
    const [w, s, e, n] = massif.bbox;
    const mw = (e - w) * 0.25;
    const mh = (n - s) * 0.25;
    const clamp = (b: [number, number, number, number]): [number, number, number, number] => {
      const r: [number, number, number, number] = [Math.max(b[0], w - mw), Math.max(b[1], s - mh), Math.min(b[2], e + mw), Math.min(b[3], n + mh)];
      return r[0] < r[2] && r[1] < r[3] ? r : massif.bbox;
    };
    if (step.point) map.easeTo({ center: step.point, zoom: step.zoom ?? 12.3, pitch, duration: 1100, padding: pad, essential: true });
    else {
      const b = clamp(step.bbox ?? massif.bbox);
      const cam = map.cameraForBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        // Absolute: the margins replace the map's own (else they add up with the previous move's and the fit fails).
        { padding: pad, maxZoom: 12.5, absolutePadding: true },
      );
      if (cam) map.easeTo({ ...cam, pitch, bearing: map.getBearing(), duration: 1100, essential: true });
    }
    const markers = step.focus.slice(0, 6).map((p) => {
      const el = document.createElement('div');
      el.className = 'tour-focus';
      return new Marker({ element: el }).setLngLat(p).addTo(map);
    });
    // The places the text names, pinned with their name, one after the other in reading order.
    pins.current.clear();
    const placeMarkers = (step.places ?? []).map((pl, i) => {
      // MapLibre positions the outer element with a transform: the appear animation runs on the inner one.
      const root = document.createElement('div');
      const el = document.createElement('div');
      el.className = 'tour-place';
      el.style.animationDelay = `${0.15 + i * 0.12}s`;
      const dot = document.createElement('i');
      const label = document.createElement('span');
      label.textContent = pl.name;
      label.title = pl.label;
      el.append(dot, label);
      root.append(el);
      pins.current.set(pl.name, el);
      return new Marker({ element: root, anchor: 'left', offset: [-6, 0] }).setLngLat([pl.lon, pl.lat]).addTo(map);
    });
    return () => [...markers, ...placeMarkers].forEach((mk) => mk.remove());
  }, [step, schema3d, massif, snap]);

  /** A place word tapped in the text: its pin pulses, and the map brings it into view if needed. */
  const pick = (pl: AtlasTourPlace, move = true) => {
    for (const [name, el] of pins.current) el.classList.toggle('on', name === pl.name);
    const map = getController()?.map;
    if (move && map && !map.getBounds().contains([pl.lon, pl.lat])) map.easeTo({ center: [pl.lon, pl.lat], duration: 700 });
  };

  // Highlight cleared when the visit ends.
  useEffect(() => {
    if (!active) getController()?.highlightSchema([]);
  }, [active]);

  if (!step || tourStep === null || !atlas || !massif) return null;
  const go = (i: number) => {
    setDeeper(null);
    set({ tourStep: i });
  };
  const last = tourStep === steps.length - 1;
  const chapters = [...new Set(steps.map((x) => x.chapter))];
  const open = deeper === tourStep;
  const order = numberSources(step).filter((id) => atlas.sources[id]);
  const dossier = tourStep === 0 ? atlas.dossiers?.[massif.id] : undefined;
  const chapterTabs = (
    <div className="tour-chapters" role="tablist" aria-label="Chapitres">
      {chapters.map((c) => (
        <button key={c} role="tab" aria-selected={c === step.chapter} className={c === step.chapter ? 'on' : ''} onClick={() => go(steps.findIndex((x) => x.chapter === c))}>
          {c}
        </button>
      ))}
    </div>
  );
  const quit = () => set({ tourStep: null });
  return (
    <div ref={card} className="tour panel" role="dialog" aria-label={`Présentation : ${massif.shortName}`}>
      {mobile ? (
        <>
          <SheetHandle visit onClose={quit} closeLabel="Quitter la présentation">
            <span className="tour-massif">{massif.shortName}</span>
          </SheetHandle>
          {chapterTabs}
        </>
      ) : (
        <div className="tour-head">
          {chapterTabs}
          <button className="icon-btn ghost" aria-label="Quitter la présentation" onClick={quit}>
            ×
          </button>
        </div>
      )}
      <h3>{step.title}</h3>
      {(step.phase || step.wind) && (
        <p className="tour-sim">
          {step.phase && <span>{PHASE_LABEL[step.phase]}</span>}
          {step.wind ? <span>vent météo {Math.round(step.wind.kmh)} km/h : regardez les flux sur la carte</span> : <span>air calme, brises seules</span>}
        </p>
      )}
      {step.lead && (
        <p className="tour-lead">
          <PlaceText text={step.lead} places={step.places} onPick={pick} />
          <Refs ids={step.leadSrc} order={order} atlas={atlas} />
        </p>
      )}
      {step.lines && step.lines.length > 0 && (
        <ul className="tour-lines">
          {step.lines.map((l, i) => (
            <li key={i}>
              {l.id ? <button onClick={() => openFeature(l.id!)}>{l.text}</button> : l.text}
              <Refs ids={l.src} order={order} atlas={atlas} />
            </li>
          ))}
        </ul>
      )}
      {step.more && step.more.length > 0 && (
        <button className="disclosure-btn" onClick={() => setDeeper(open ? null : tourStep)} aria-expanded={open}>
          {open ? 'Moins de détails' : `Approfondir${step.more.length > 2 ? ` (${step.more.length})` : ''}`}
        </button>
      )}
      {open && (
        <div className="tour-more">
          {step.more?.map((l, i) => (
            <p key={i}>
              {l.id ? (
                <button className="link-btn inline" onClick={() => openFeature(l.id!)}>
                  {l.text}
                </button>
              ) : (
                l.text
              )}
              <Refs ids={l.src} order={order} atlas={atlas} />
            </p>
          ))}
          {dossier && (
            <p>
              <a href={`${REPO_BLOB}${encodeURI(dossier)}`} target="_blank" rel="noopener noreferrer">
                Dossier de recherche du secteur
              </a>{' '}
              : sources lues, changements, lacunes.
            </p>
          )}
        </div>
      )}
      {order.length > 0 && (
        <ol className="tour-srcs">
          {order.slice(0, 6).map((id) => {
            const src = atlas.sources[id];
            return (
              <li key={id}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" title={src.title}>
                  {src.publisher || src.title}
                </a>
              </li>
            );
          })}
          {order.length > 6 && <li className="more">+{order.length - 6}</li>}
        </ol>
      )}
      <div className="tour-nav">
        <span className="tour-count">
          {tourStep + 1}/{steps.length}
        </span>
        <div className="tour-bar" aria-hidden>
          <i style={{ width: `${((tourStep + 1) / steps.length) * 100}%` }} />
        </div>
        <button className="btn small ghost" disabled={tourStep === 0} onClick={() => go(tourStep - 1)} aria-label="Étape précédente">
          {mobile ? '‹' : 'Précédent'}
        </button>
        <button className="btn small primary" onClick={() => (last ? quit() : go(tourStep + 1))}>
          {last ? 'Terminer' : 'Suivant'}
        </button>
      </div>
    </div>
  );
}
