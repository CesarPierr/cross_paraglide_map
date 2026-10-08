/**
 * Compiles the per-sector research JSON files (research_notes/<title>/data/*.json)
 * into a single atlas consumed by the web app (public/data/atlas.json).
 *
 * - merges and namespaces sources, dedupes them by URL;
 * - snaps valley breezes onto the valley floor (least-cost path on the DEM);
 * - parses the free-text hours into an active window;
 * - checks declared altitudes of spots against the DEM;
 * - writes a QA report (docs/DATA_QA.md).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CuratedBreezeInput, CuratedHazardInput } from '@brises/model';
import type { BreezeCondition } from '@brises/shared';
import type { Atlas, AtlasFeature, AtlasFeatureProps, AtlasFigure, AtlasMassif, AtlasSource, AtlasTourPlace, AtlasTourStep, FeatureCategory, ModelRule } from '@brises/shared';
import { analyseTerrain, type Terrain } from '@brises/model';
import { splitAtlas } from '@brises/shared';
import { loadDem } from '@brises/model/node';
import { integrateKk7, kk7Markdown, type Kk7Report } from './kk7';
import { tileSectors } from './tessellation';

const ROOT = process.cwd();
const RESEARCH = join(ROOT, 'research_notes', 'Brises des Alpes françaises', 'data');
/**
 * Second research pass: each of its files is a complete, revised version of the
 * massifs it describes, so a massif defined here replaces the first-pass one with
 * the same id instead of being merged with it. Massifs it does not cover keep
 * their first-pass version.
 */
const SECOND_PASS = join(ROOT, 'research_notes', 'Seconde passe 2026', 'data');
/** `--check`: compile and print the QA warnings without writing the atlas or the report. */
const CHECK_ONLY = process.argv.includes('--check');
/**
 * Extra datasets following the same contract (research_notes/<…>/_schema.md),
 * e.g. a complementary collection: `npm run data:build -- data/extra-collection`
 * or BRISES_DATA_DIRS=dir1:dir2. Massifs sharing an id are merged.
 */
const EXTRA_DIRS = [...process.argv.slice(2).filter((a) => !a.startsWith('--')), ...(process.env.BRISES_DATA_DIRS ?? '').split(':')]
  .filter(Boolean)
  .map((d) => resolve(ROOT, d));

// ---------- Raw research types (lenient: researchers sometimes add fields) ----------
interface RawPoint {
  name?: string;
  lon?: number | null;
  lat?: number | null;
  coord_quality?: string;
}
interface RawItem extends RawPoint {
  id?: string;
  kind?: string;
  description?: string;
  conditions?: string;
  trigger?: string;
  best_hours?: string;
  alt_m?: number | null;
  orientations?: string[];
  wind_dirs?: string[];
  radius_km?: number;
  sources?: string[];
  confidence?: string;
}
interface RawBreeze {
  id: string;
  name: string;
  kind: string;
  waypoints: RawPoint[];
  hours?: string;
  speed_kmh?: { typical?: number | null; max?: number | null } | null;
  season?: string;
  layer_depth_m?: string | number | null;
  /** Optional: condition under which the breeze exists ("canicule", "par vent de nord"…); "" = none. */
  condition?: string | null;
  description?: string;
  confidence?: string;
  sources?: string[];
}
interface RawConvergence {
  id: string;
  name: string;
  geometry?: { type: string; coordinates: unknown } | null;
  when?: string;
  mechanism?: string;
  usage?: string;
  confidence?: string;
  sources?: string[];
}
interface RawRoute {
  id: string;
  name: string;
  waypoints: RawPoint[];
  distance_km?: number | null;
  description?: string;
  sources?: string[];
}
interface RawMassif {
  id: string;
  name: string;
  parent_massif?: string;
  summary?: string;
  bbox?: number[];
  center?: number[];
  breezes?: RawBreeze[];
  convergences?: RawConvergence[];
  hazards?: RawItem[];
  thermal_spots?: RawItem[];
  soaring_spots?: RawItem[];
  takeoffs?: RawItem[];
  landings?: RawItem[];
  synoptic_effects?: { wind: string; effect: string; sources?: string[] }[];
  xc_routes?: RawRoute[];
  tips?: string[];
}
interface RawFile {
  topic: string;
  massifs: RawMassif[];
  sources: { id: string; title?: string; url?: string; publisher?: string; type?: string; notes?: string }[];
  model_rules?: { id: string; topic: string; rule: string; numbers?: unknown; sources?: string[] }[];
  figures?: { id?: string; massif?: string; title?: string; image_url?: string; page_url?: string; pdf_page?: number; publisher?: string; shows?: string; extracted_to?: string[]; sources?: string[] }[];
}

const REGION_LABELS: Record<string, string> = {
  chablais_giffre_arve: 'Haute-Savoie nord',
  annecy_bornes_aravis: 'Annecy, Bornes, Aravis',
  montblanc_beaufortain: 'Mont-Blanc, Val d’Arly, Beaufortain',
  montblanc_beaufortain_tarentaise: 'Mont-Blanc, Beaufortain, Tarentaise',
  tarentaise_vanoise: 'Tarentaise, Vanoise',
  bauges_bourget_combe: 'Bauges, Bourget, Combe de Savoie',
  chartreuse_gresivaudan_belledonne: 'Chartreuse, Grésivaudan, Belledonne',
  bauges_chartreuse_gresivaudan: 'Bauges, Chartreuse, Grésivaudan, Belledonne',
  vercors_grenoble_trieves: 'Grenoble, Vercors, Trièves, Matheysine',
  vercors_trieves_oisans: 'Grenoble, Vercors, Trièves, Oisans',
  oisans_maurienne: 'Oisans, Maurienne, Arves',
  maurienne_brianconnais_ecrins: 'Maurienne, Briançonnais, Écrins',
  brianconnais_ecrins_queyras_ubaye: 'Briançonnais, Écrins, Queyras, Ubaye',
  devoluy_gap_buech_diois: 'Dévoluy, Gapençais, Buëch, Baronnies, Diois',
  hautes_alpes_sud: 'Hautes-Alpes sud, Drôme, Ubaye',
  provence_maritimes: 'Alpes de Haute-Provence, Alpes-Maritimes',
  synoptic_convergences_xc: 'Échelle des Alpes',
};
const REGION_ORDER = Object.keys(REGION_LABELS);

/** Short display names for map labels and lists (the full research name stays in the sheet). */
const SHORT_NAMES: Record<string, string> = {
  'saleve-genevois': 'Salève',
  'arve-faucigny': 'Faucigny – Arve',
  'haut-giffre': 'Giffre',
  chablais: 'Chablais',
  'lac-annecy': 'Lac d’Annecy',
  bornes: 'Bornes',
  aravis: 'Aravis',
  'mont-blanc-chamonix': 'Chamonix – Mont-Blanc',
  'val-montjoie-saint-gervais': 'Val Montjoie',
  'val-arly-megeve': 'Megève – Val d’Arly',
  beaufortain: 'Beaufortain',
  tarentaise: 'Tarentaise',
  vanoise: 'Vanoise',
  'bourget-chambery': 'Bourget – Chambéry',
  'combe-de-savoie': 'Combe de Savoie',
  bauges: 'Bauges',
  chartreuse: 'Chartreuse',
  gresivaudan: 'Grésivaudan',
  belledonne: 'Belledonne',
  'grenoble-cuvette': 'Cuvette grenobloise',
  'vercors-nord': 'Vercors nord',
  'vercors-est-sud': 'Vercors est & sud',
  trieves: 'Trièves',
  matheysine: 'Matheysine – Drac',
  'oisans-grandes-rousses': 'Oisans',
  maurienne: 'Maurienne',
  'haute-maurienne': 'Haute-Maurienne',
  'arves-thabor-galibier': 'Arves – Galibier',
  'brianconnais-guisane': 'Briançonnais',
  'ecrins-vallouise-haute-durance': 'Vallouise – haute Durance',
  devoluy: 'Dévoluy',
  'champsaur-valgaudemar': 'Champsaur',
  'gapencais-ceuse': 'Gapençais – Céüse',
  'buech-laragne-chabre': 'Buëch – Chabre',
  baronnies: 'Baronnies',
  diois: 'Diois',
  'serre-poncon-embrunais': 'Serre-Ponçon',
  queyras: 'Queyras',
  ubaye: 'Ubaye',
  'saint-andre-verdon': 'Saint-André',
  'haut-verdon-allos': 'Haut-Verdon',
  'prealpes-digne-lure': 'Digne – Lure',
  'prealpes-grasse-castellane': 'Préalpes de Grasse',
  'prealpes-nice-var': 'Préalpes de Nice',
  mercantour: 'Mercantour',
  'alpes-francaises': 'Alpes françaises',
};

/** Fallback short name: drop the parenthesised details and generic prefixes. */
function shortName(id: string, name: string): string {
  if (SHORT_NAMES[id]) return SHORT_NAMES[id];
  return name
    .split(' (')[0]
    .replace(/^(Massif|Chaîne) (des|du|de la|de l’|de l')\s*/i, '')
    .split(',')[0]
    .trim();
}

/**
 * Splits research-method remarks (how a fact was collected, coordinate caveats)
 * out of the pilot-facing description; they are kept as a discreet note.
 */
export function cleanDescription(text: string | undefined): { text: string; note: string | null } {
  if (!text) return { text: '', note: null };
  const notes: string[] = [];
  let t = text.replace(/\[(?:Source|Sources|Note|NB)[^\]]*\]/gi, (m) => {
    notes.push(m.slice(1, -1));
    return '';
  });
  t = t.replace(/(?:^|\s)(Coordonnées?\s*:[^\n]*?(?:\.|$))/gi, (_m, g: string) => {
    notes.push(g.trim());
    return ' ';
  });
  t = t.replace(/(?:^|\s)((?:Attribution|Extrait|Paraphrase)[^.\n]*(?:incertaine|moteur de recherche|non vérifi)[^.\n]*\.)/gi, (_m, g: string) => {
    notes.push(g.trim());
    return ' ';
  });
  return { text: t.replace(/\s{2,}/g, ' ').trim(), note: notes.length ? notes.join(' ') : null };
}

const qa: string[] = [];

// ---------- Helpers ----------
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const validPoint = <T extends RawPoint>(p: T | undefined): p is T & { lon: number; lat: number } =>
  !!p && isNum(p.lon) && isNum(p.lat) && p.lon > 3 && p.lon < 9 && p.lat > 43 && p.lat < 47;

function confidence(c: string | undefined): 'high' | 'medium' | 'low' {
  return c === 'high' || c === 'medium' ? c : 'low';
}

/** Period words used in the sources, with the [start, end] legal-time window they imply. */
const PERIODS: [RegExp, number, number][] = [
  [/fin de nuit|petit matin|lever du (?:jour|soleil)/g, 5, 9.5],
  [/début de matinée/g, 7, 9.5],
  [/milieu de (?:la )?matinée|mi-matinée/g, 9.5, 11],
  [/fin de (?:la )?matinée/g, 11, 12],
  [/début d.après-midi/g, 13, 15],
  [/milieu d.après-midi|mi-après-midi|plein après-midi/g, 14, 16.5],
  [/fin d.après-midi/g, 16, 19],
  [/après-midi/g, 12.5, 18.5],
  [/mi-journée|(?<!après-)midi/g, 12, 13],
  [/mi-matinée|milieu de matinée|cours de matinée/g, 9.5, 11],
  [/tombée de la nuit|coucher du soleil/g, 20, 21],
  [/fin de journée|soirée|\bsoir\b|(?:très )?tard\b/g, 17, 20.5],
  [/matin|matinée/g, 8, 11.5],
  [/journée|\bde jour\b/g, 11, 18.5],
];

/** Hour token; not a duration ("2 h après", "3 h d'ensoleillement"). */
const HOUR = String.raw`(\d{1,2})\s*h\s*(\d{2})?(?!\s*(?:après|avant|d.enso|de (?:soleil|vol)))`;
/** Peak mentions ("maximum vers 14h-17h", "pic 15h", "forte de 14h à 17h") describe the peak, not the window. */
const PEAK = new RegExp(String.raw`(?:maximum|max\.?|pic|meilleure?s?|(?:très )?forte?s?|soutenue)\s*(?:vers|à|de|entre|:)?\s*[~≈]?\s*${HOUR}(?:\s*(?:-|–|—|à|et)\s*${HOUR})?`, 'g');
const RANGE = new RegExp(String.raw`${HOUR}\s*(?:-|–|—|à|->|→)\s*${HOUR}`, 'g');
const ONSET_WORDS = String.raw`(?:dès|à partir d[eu]|levée|depuis|après|vers|début|s.établit|s.installe)`;
const FROM = new RegExp(String.raw`${ONSET_WORDS}\s*[~≈]?\s*${HOUR}`, 'g');
/** Onset given by a period word: "dès la fin de matinée", "à partir de midi". */
const FROM_PERIOD = new RegExp(
  String.raw`(?:dès|à partir d[eu]|depuis|se met en place|s.installe|en place)\s+(?:en |au )?(?:cours de |la |le |l.|vers )?(fin de matinée|mi-matinée|milieu de matinée|mi-journée|midi|matinée|matin|début d.après-midi|après-midi)`,
);
const PERIOD_ONSET: Record<string, number> = { 'fin de matinée': 11, 'mi-matinée': 10, 'milieu de matinée': 10, 'mi-journée': 12, midi: 12, matinée: 10, matin: 8, "début d'après-midi": 13, 'après-midi': 12.5 };
/** Summer sunrise in the French Alps, legal time (05h45–05h50 at the solstice, rule `cycle-horaire-brise-vallee`). */
const SUMMER_SUNRISE = 5.8;
const LONE = new RegExp(String.raw`(?<![\d,.])${HOUR}(?![\d])`, 'g');

/**
 * Parse the free-text hours of a breeze into a legal-time window: the span of the
 * explicit ranges, onsets ("dès 11h", "dès la fin de matinée"), lone hours and
 * period words, ignoring peak mentions ("maximum vers 14h-17h"). The first clause
 * (before ";") describes the breeze; later ones often describe something else (the
 * evening reversal, the calm morning), so they are only read when the first one
 * gives no window or describes a calm / descending phase. Night kinds cross
 * midnight when the text speaks of the night.
 */
export function parseHours(text: string | undefined, kind: string): [number, number] | null {
  const full = (text ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'");
  const nightKind = kind === 'downvalley' || kind === 'katabatic';
  // Clauses about another phase of the day (calm morning, evening reversal, a mere
  // possibility) do not give the window of the breeze itself.
  const other = nightKind ? /montant|ascendant|(?<!régime )calme|possible/ : /(?<!régime |brise )calme|descendant|redescend|catabatique|possible|pas de brise/;
  if (full.includes(';')) {
    for (const clause of full.split(';')) {
      if (other.test(clause)) continue;
      const w = parseClause(clause, kind);
      if (w) return w;
    }
  }
  return parseClause(full, kind);
}

function parseClause(text: string, kind: string): [number, number] | null {
  let t = text;
  const hm = (h: string, m?: string) => Number(h) + (m ? Number(m) / 60 : 0);
  const ok = (h: number) => h >= 0 && h <= 24;
  t = t.replace(PEAK, ' ');
  let start = Infinity;
  let end = -Infinity;
  const take = (a: number, b: number) => {
    start = Math.min(start, a);
    end = Math.max(end, b);
  };
  let onset = Infinity;
  // "3 h après le lever du soleil", "dès 3 h d'ensoleillement": onset counted from
  // sunrise, ≈ 5h50 legal time in summer (rule `cycle-horaire-brise-vallee`).
  for (const r of t.matchAll(/(\d{1,2})\s*h(?:eures?)?\s*(?:après le lever du (?:soleil|jour)|d.ensoleillement)/g)) {
    onset = Math.min(onset, SUMMER_SUNRISE + Number(r[1]));
    take(onset, onset);
  }
  t = t.replace(/(\d{1,2})\s*h(?:eures?)?\s*(?:après le lever du (?:soleil|jour)|d.ensoleillement)/g, ' ');
  // Explicit ranges. One crossing midnight ("21h-09h") is a night window on its own.
  let ranged = false;
  for (const r of t.matchAll(RANGE)) {
    const a = hm(r[1], r[2]);
    const b = hm(r[3], r[4]);
    if (!ok(a) || !ok(b)) continue;
    // "dès 11h-12h", "levée 11h-13h": the onset happens within that range, the breeze goes on.
    if (new RegExp(`${ONSET_WORDS}\\s*[~≈]?\\s*$`).test(t.slice(Math.max(0, (r.index ?? 0) - 16), r.index))) {
      onset = Math.min(onset, a);
      take(a, b);
      continue;
    }
    if (b < a) return [a, b];
    ranged = true;
    take(a, b);
  }
  t = t.replace(RANGE, ' ');
  for (const r of t.matchAll(FROM)) {
    const a = hm(r[1], r[2]);
    if (!ok(a)) continue;
    onset = Math.min(onset, a);
    take(a, a);
  }
  t = t.replace(FROM, ' ');
  const fp = t.match(FROM_PERIOD);
  if (fp) {
    const a = PERIOD_ONSET[fp[1]] ?? 12;
    onset = Math.min(onset, a);
    take(a, a);
  }
  // Lone hours only when no explicit range is given ("7h-9h, avant les brises de 12h").
  if (!ranged) {
    for (const r of t.matchAll(LONE)) {
      const a = hm(r[1], r[2]);
      if (ok(a)) take(a, a);
    }
  }
  const nightKind = kind === 'downvalley' || kind === 'katabatic';
  const nightWord = /\bnuit|crépuscule|nocturne/.test(t.replace(/tombée de la nuit/g, ''));
  const dayPeriod = /matin|midi|journée/.test(t);
  if (!Number.isFinite(start) && (nightKind || (nightWord && !dayPeriod))) {
    if (/fin de nuit/.test(t) && !/crépuscule/.test(t)) return [4, 9.5];
    // Evening-only drainage ("fin de journée (soirée d'été)") keeps its evening window.
    if (nightWord || /\bmatin/.test(t) || !/soir|fin de journée/.test(t)) return [20.5, 9.5];
  }
  // Span of every period mentioned ("fin de matinée à fin d'après-midi" → 11h-19h).
  // An explicit range is more precise than the period words around it ("en journée,
  // très forte l'après-midi (≈13h-19h)").
  if (!ranged) {
    for (const [re, a, b] of PERIODS) {
      if (re.test(t)) {
        take(a, b);
        t = t.replace(re, ' ');
      }
      re.lastIndex = 0;
    }
    // A day breeze lasting "jusqu'à la nuit".
    if (Number.isFinite(start) && nightWord && !nightKind) end = Math.max(end, 21);
  }
  if (!Number.isFinite(start)) return null;
  if (Number.isFinite(onset)) start = onset;
  // With an onset, early ranges are onset times elsewhere ("vers 11h à Moûtiers, 12h-13h à Bourg").
  if (Number.isFinite(onset) && ranged && end < 14) ranged = false;
  // An onset ("dès 12h") or a lone hour without an explicit end: breezes last until
  // the evening decline (≈ 19h, RULES.valleySchedule).
  if (end <= start || (Number.isFinite(onset) && !ranged)) end = Math.max(end, 19);
  return [start, end];
}

// ---------- Conditional breezes ("seulement par canicule", "par Lombarde"...) ----------
const DIRS: [RegExp, number][] = [
  [/^(?:nord[- ]est|ne)$/i, 45],
  [/^(?:nord[- ]ouest|no|nw)$/i, 315],
  [/^(?:sud[- ]est|se)$/i, 135],
  [/^(?:sud[- ]ouest|so|sw)$/i, 225],
  [/^(?:nord|n)$/i, 0],
  [/^(?:sud|s)$/i, 180],
  [/^(?:est|e)$/i, 90],
  [/^(?:ouest|o|w)$/i, 270],
];
const DIR_TOKEN = String.raw`(?:nord[- ]est|nord[- ]ouest|sud[- ]est|sud[- ]ouest|nord|sud|est|ouest|NE|NO|NW|SE|SO|SW|N|S|E|O|W)`;
/** Named winds of the French Alps: direction they blow from (deg). */
const NAMED_WINDS: [RegExp, number, string][] = [
  [/lombarde/i, 90, 'Lombarde (flux d’est)'],
  [/\bbise\b/i, 45, 'bise (nord-est)'],
  [/mistral/i, 350, 'mistral (nord)'],
  [/foehn|föhn/i, 180, 'foehn (flux de sud)'],
];

function dirDeg(token: string): number | null {
  const parts = token.split(/[/–-](?=[A-Za-z])/).map((p) => p.trim());
  const degs = parts.map((p) => DIRS.find(([re]) => re.test(p))?.[1]).filter((d): d is number => d !== undefined);
  if (!degs.length) return null;
  // Circular mean of "E/SE", "S–SE"...
  const x = degs.reduce((a, d) => a + Math.sin((d * Math.PI) / 180), 0);
  const y = degs.reduce((a, d) => a + Math.cos((d * Math.PI) / 180), 0);
  return Math.round(((Math.atan2(x, y) * 180) / Math.PI + 360) % 360);
}

/** Synoptic wind cited by a text ("par vent de nord", "flux d'E/SE", "bise", "Lombarde"): direction it blows from and speed if given. */
export function windFromText(text: string | undefined): { fromDeg: number; kmh: number | null; label: string; at: number } | null {
  if (!text) return null;
  const kmhM = text.match(/(\d{2,3})\s*km\/h/) ?? null;
  const ndsM = text.match(/(\d{1,3})\s*(?:nds|nœuds|kt)/i);
  const kmh = kmhM ? Number(kmhM[1]) : ndsM ? Math.round(Number(ndsM[1]) * 1.852) : null;
  const dirRe = new RegExp(
    String.raw`(?:vent|flux|situations?|régime)\s+(?:météo\s+|synoptique\s+|de\s+flux\s+)?(?:de\s+secteur\s+|de\s+|d['’]\s*)(${DIR_TOKEN}(?:\s*[/–-]\s*${DIR_TOKEN})*)(?![\w])`,
    'i',
  );
  const m = text.match(dirRe);
  if (m) {
    const d = dirDeg(m[1].replace(/\s+/g, ''));
    const tok = m[1].trim();
    if (d !== null) return { fromDeg: d, kmh, label: `vent météo ${/^[eoEO]/.test(tok) ? 'd’' : 'de '}${tok}`, at: m.index ?? 0 };
  }
  let best: { fromDeg: number; kmh: number | null; label: string; at: number } | null = null;
  for (const [re, deg, label] of NAMED_WINDS) {
    const at = text.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { fromDeg: deg, kmh, label, at };
  }
  return best;
}

/** Every synoptic wind a hazard's conditions cite: the first, and those listed with it ("vent d'ouest ou de nord-est"). */
function windsOf(text: string): { fromDeg: number; kmh: number | null }[] {
  const first = windFromText(text);
  if (!first) return [];
  const out = [{ fromDeg: first.fromDeg, kmh: first.kmh }];
  const more = new RegExp(String.raw`(?:\bou\b|\bet\b|,)\s*(?:par\s+)?(?:(?:vent|flux)\s+)?(?:de\s+|d['’]\s*)(${DIR_TOKEN}(?:\s*[/–-]\s*${DIR_TOKEN})*)(?![\w])`, 'gi');
  for (const m of text.slice(first.at, first.at + 90).matchAll(more)) {
    const d = dirDeg(m[1].replace(/\s+/g, ''));
    if (d !== null && !out.some((o) => Math.abs(((o.fromDeg - d + 540) % 360) - 180) < 30)) out.push({ fromDeg: d, kmh: first.kmh });
  }
  return out;
}

/** Effect a documented hazard shows in the simulation, from its kind (and its words for the unclassified ones). */
function hazardEffect(p: AtlasFeatureProps): CuratedHazardInput['effect'] | null {
  if (p.kind === 'lee-rotor') return 'lee';
  if (p.kind === 'venturi') return 'venturi';
  if (p.kind === 'foehn' || p.kind === 'downdraft' || p.kind === 'landing-turbulence') return 'turbulence';
  if (p.kind === 'other' && /turbul|rouleau|rotor|sous le vent|machine à laver|cisaill|rabattant/i.test(`${p.name} ${p.details?.Conditions ?? ''}`)) return 'turbulence';
  return null;
}

/**
 * Documented hazards tied to a synoptic wind, for the wind model: each one shows its
 * effect where it is reported when the simulated wind matches its conditions. Speeds:
 * "même faible" / "léger" from 5 km/h (full at 12), "fort" from 18 (full at 32), a
 * cited speed from 70 % of it, otherwise from 10 (full at 22). Radius: the one of the
 * sources ("Rayon") within 0.3–1 km (the hazard is where it is reported, not over the whole slope), else 700 m.
 */
export function curatedHazardsOf(hazards: AtlasFeature[]): CuratedHazardInput[] {
  const out: CuratedHazardInput[] = [];
  for (const f of hazards) {
    const p = f.properties;
    const effect = hazardEffect(p);
    const cond = p.details?.Conditions ?? '';
    if (!effect || f.geometry.type !== 'Point' || !cond) continue;
    const t = cond.toLowerCase();
    const rayonKm = Number((p.details?.Rayon ?? '').replace(',', '.').match(/[\d.]+/)?.[0] ?? NaN);
    const radiusM = Number.isFinite(rayonKm) ? Math.min(1000, Math.max(300, rayonKm * 1000)) : 700;
    windsOf(cond).forEach((w, i) => {
      const [minKmh, fullKmh] = w.kmh
        ? [Math.round(0.7 * w.kmh), w.kmh]
        : /faible|léger|leger/.test(t)
          ? [5, 12]
          : /\bfort|soutenu|marqué|violent|rafale|tempête/.test(t)
            ? [18, 32]
            : [10, 22];
      out.push({ id: i ? `${p.id}#${i}` : p.id, name: p.name, effect, coords: [f.geometry.coordinates as [number, number]], radiusM, fromDeg: w.fromDeg, tolDeg: 45, minKmh, fullKmh });
    });
  }
  return out;
}

/** Words that make a condition a mere modulation ("renforcement par canicule", "plus tôt par vent de nord"). */
const MODULATION = /surtout|aussi|parfois|plus tôt|plus tard|renforc|même|toute l.année|comme|souvent|y compris/i;

/**
 * Condition of a documented breeze: the explicit `condition` field of the research
 * JSON when present (an empty string means "unconditional"), else keywords of its
 * name and of the first clause of its hours. Descriptions are not scanned: they
 * cite many winds as context, not as a condition.
 */
export function parseCondition(b: { name?: string; hours?: string; condition?: string | null }): BreezeCondition | null {
  const explicit = typeof b.condition === 'string';
  const texts = explicit
    ? [b.condition!.trim()]
    : [(b.name ?? '').replace(/\([^)]*\)/g, ' '), (b.hours ?? '').split(';')[0]];
  if (explicit && !texts[0]) return null;
  for (const raw of texts) {
    const t = raw.toLowerCase();
    if (!t.trim()) continue;
    const heat = t.search(/fortes? chaleurs?|canicule/);
    if (heat >= 0 && (explicit || !MODULATION.test(t.slice(0, heat)))) return { label: 'par forte chaleur (canicule)', regime: 'heatwave' };
    const winter = t.search(/\ben hiver\b|hivernal|hivernaux|sous inversion/);
    if (winter >= 0 && (explicit || (!MODULATION.test(t.slice(0, winter)) && !/nocturne|nuit/.test(t)))) return { label: 'en hiver, sous inversion', regime: 'winter' };
    const w = windFromText(raw);
    if (w) {
      // Without an explicit field, a wind is a condition only when it heads the text:
      // "Lombarde par le col…", "Flux d'est (…)", "épisodique (situations de flux d'E/SE)", "par vent de nord…".
      const head = t.slice(0, w.at);
      if (explicit || (w.at < 40 && !MODULATION.test(head) && !/brise|journée|après-midi|matin|soir|vers|inverse/.test(head))) {
        // Below ~10 km/h the breezes are pure: a wind-driven flow needs at least that
        // (model rule `seuils-synoptique-vs-brise`, S8).
        const minKmh = w.kmh ?? 10;
        return { label: `par ${w.label} (≥ ${minKmh} km/h)`, wind: { fromDeg: w.fromDeg, minKmh } };
      }
    }
  }
  // An explicit condition the model cannot evaluate: kept, never simulated.
  return explicit ? { label: `si : ${texts[0]}` } : null;
}

const DEFAULT_SPEED: Record<string, number> = {
  valley: 15,
  downvalley: 8,
  slope: 8,
  'plain-to-mountain': 10,
  lake: 12,
  'pass-transfer': 15,
  regional: 10,
  katabatic: 6,
};
const RADIUS: Record<string, number> = {
  valley: 1700,
  downvalley: 1500,
  slope: 900,
  'plain-to-mountain': 5000,
  lake: 2200,
  'pass-transfer': 1400,
  regional: 6000,
  katabatic: 900,
};
const SNAP_KINDS = new Set(['valley', 'downvalley', 'pass-transfer', 'katabatic']);

// ---------- Valley snapping: Dijkstra within a corridor, cost favours the valley floor ----------
class Heap {
  k: number[] = [];
  v: number[] = [];
  push(key: number, val: number) {
    const { k, v } = this;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const { k, v } = this;
    const top: [number, number] = [k[0], v[0]];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= k.length) break;
        if (c + 1 < k.length && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
  get size() {
    return this.k.length;
  }
}

function snapToFloor(t: Terrain, lon: number, lat: number, radiusCells: number): [number, number] {
  const g = t.grid;
  const [x, y] = g.toGrid(lon, lat);
  const ci = Math.floor(x);
  const cj = Math.floor(y);
  let best = -1;
  let bestScore = Infinity;
  for (let dj = -radiusCells; dj <= radiusCells; dj++) {
    for (let di = -radiusCells; di <= radiusCells; di++) {
      const i = ci + di;
      const j = cj + dj;
      if (i < 0 || j < 0 || i >= g.width || j >= g.height) continue;
      const k = j * g.width + i;
      const score = t.z[k] - t.floor[k] + Math.hypot(di, dj) * 4;
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
  }
  return [best % g.width, Math.floor(best / g.width)];
}

function routeAlongFloor(t: Terrain, a: [number, number], b: [number, number]): [number, number][] {
  const g = t.grid;
  const w = g.width;
  const margin = 18;
  const i0 = Math.max(0, Math.min(a[0], b[0]) - margin);
  const i1 = Math.min(w - 1, Math.max(a[0], b[0]) + margin);
  const j0 = Math.max(0, Math.min(a[1], b[1]) - margin);
  const j1 = Math.min(g.height - 1, Math.max(a[1], b[1]) + margin);
  const bw = i1 - i0 + 1;
  const bh = j1 - j0 + 1;
  const dist = new Float64Array(bw * bh).fill(Infinity);
  const prev = new Int32Array(bw * bh).fill(-1);
  const li = (i: number, j: number) => (j - j0) * bw + (i - i0);
  const start = li(a[0], a[1]);
  const goal = li(b[0], b[1]);
  dist[start] = 0;
  const heap = new Heap();
  heap.push(0, start);
  const DX = [1, 1, 0, -1, -1, -1, 0, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];
  while (heap.size) {
    const [d, c] = heap.pop();
    if (c === goal) break;
    if (d > dist[c]) continue;
    const ci = (c % bw) + i0;
    const cj = Math.floor(c / bw) + j0;
    for (let n = 0; n < 8; n++) {
      const ni = ci + DX[n];
      const nj = cj + DY[n];
      if (ni < i0 || nj < j0 || ni > i1 || nj > j1) continue;
      const k = nj * w + ni;
      const rel = Math.max(0, t.z[k] - t.floor[k]);
      const step = (n % 2 ? Math.SQRT2 : 1) * (1 + (rel / 60) ** 2) * (t.water[k] === 1 ? 0.8 : 1);
      const nd = d + step;
      const l = li(ni, nj);
      if (nd < dist[l]) {
        dist[l] = nd;
        prev[l] = c;
        heap.push(nd, l);
      }
    }
  }
  const path: [number, number][] = [];
  let c = goal;
  if (prev[c] < 0 && c !== start) return [a, b];
  while (c >= 0) {
    path.push([(c % bw) + i0, Math.floor(c / bw) + j0]);
    if (c === start) break;
    c = prev[c];
  }
  return path.reverse();
}

function chaikin(pts: [number, number][], iterations: number): [number, number][] {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    if (p.length < 3) return p;
    const out: [number, number][] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, y0] = p[i];
      const [x1, y1] = p[i + 1];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = pts[s];
    const [bx, by] = pts[e];
    const L = Math.hypot(bx - ax, by - ay) || 1e-9;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function densify(coords: [number, number][], stepDeg = 0.01): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / stepDeg));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  out.push(coords[coords.length - 1]);
  return out;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;
/** Breeze paths follow 216 m DEM cells: 4 decimals (≈ 10 m) keep them exact and halve their weight. */
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

function breezePath(t: Terrain, kind: string, wps: (RawPoint & { lon: number; lat: number })[]): [number, number][] {
  const g = t.grid;
  if (!SNAP_KINDS.has(kind)) return densify(wps.map((p) => [p.lon, p.lat] as [number, number])).map(([x, y]) => [round4(x), round4(y)]);
  const cells = wps.map((p) => snapToFloor(t, p.lon, p.lat, 5));
  let path: [number, number][] = [];
  for (let i = 0; i < cells.length - 1; i++) {
    const seg = routeAlongFloor(t, cells[i], cells[i + 1]);
    path = path.concat(i === 0 ? seg : seg.slice(1));
  }
  // Smoothed, then thinned again: chaikin multiplies the points by 8, a 0.2-cell (≈ 40 m)
  // tolerance keeps the drawn shape and the rasterised corridor.
  const smooth = simplify(chaikin(simplify(path, 0.8), 3), 0.2);
  return smooth.map(([i, j]) => [round4(g.colLon(i + 0.5)), round4(g.rowLat(j + 0.5))]);
}

function demAt(t: Terrain, lon: number, lat: number): number | null {
  const g = t.grid;
  if (!g.contains(lon, lat)) return null;
  const [x, y] = g.toGrid(lon, lat);
  return t.z[Math.floor(y) * g.width + Math.floor(x)];
}

/** Nearest cell (within maxM) whose elevation matches `alt`, with a mild distance penalty. */
function relocateByAltitude(t: Terrain, lon: number, lat: number, alt: number, maxM: number) {
  const g = t.grid;
  const [x, y] = g.toGrid(lon, lat);
  const cell = g.cellM[Math.floor(y)];
  const r = Math.ceil(maxM / cell);
  let best: { lon: number; lat: number; delta: number; distM: number; score: number } | null = null;
  for (let dj = -r; dj <= r; dj++) {
    for (let di = -r; di <= r; di++) {
      const d = Math.hypot(di, dj) * cell;
      if (d > maxM) continue;
      const i = Math.floor(x) + di;
      const j = Math.floor(y) + dj;
      if (i < 0 || j < 0 || i >= g.width || j >= g.height) continue;
      const delta = t.z[j * g.width + i] - alt;
      const score = Math.abs(delta) + d * 0.08;
      if (!best || score < best.score) best = { lon: g.colLon(i + 0.5), lat: g.rowLat(j + 0.5), delta, distM: Math.round(d), score };
    }
  }
  return best;
}

// ---------- Written guided visits ----------
const VISITS = join(ROOT, 'research_notes', 'Seconde passe 2026', 'visites');
const WIND_DEG: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, SW: 225, O: 270, W: 270, NO: 315, NW: 315 };

/** Places of the gazetteer named in a text, in reading order; the longest name wins where names overlap. */
export function placesIn(text: string, known: Record<string, { lon: number; lat: number; label: string; kind?: string; massifs?: string[] }>): AtlasTourPlace[] {
  const names = Object.keys(known).sort((a, b) => b.length - a.length);
  if (!names.length) return [];
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\-])(?:${names.map(esc).join('|')})(?![\\p{L}\\-])`, 'gu');
  const out: AtlasTourPlace[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    const k = known[m[0]];
    const key = `${k.lon},${k.lat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: m[0], label: k.label, lon: k.lon, lat: k.lat, ...(k.kind ? { kind: k.kind } : {}), ...(k.massifs?.length ? { massifs: k.massifs } : {}) });
  }
  return out;
}

function readTours(rawToFeature: Map<string, string>, massifs: AtlasMassif[], features: Record<FeatureCategory, AtlasFeature[]>): Record<string, AtlasTourStep[]> {
  const out: Record<string, AtlasTourStep[]> = {};
  if (!existsSync(VISITS)) return out;
  const byId = new Map(Object.values(features).flatMap((list) => list.map((f) => [f.properties.id, f] as const)));
  // Places named by the visits, located once by scripts/research/visit_places.py (massif → name → place).
  const lieuxFile = join(VISITS, '_lieux.json');
  const lieux = existsSync(lieuxFile) ? (JSON.parse(readFileSync(lieuxFile, 'utf8')) as Record<string, Record<string, { lon: number; lat: number; label: string; kind?: string; massifs?: string[] }>>) : {};
  for (const file of readdirSync(VISITS).filter((f) => f.endsWith('.json') && !f.startsWith('_'))) {
    const raw = JSON.parse(readFileSync(join(VISITS, file), 'utf8')) as {
      massif: string;
      steps: { chapter: string; title: string; text: string; focus?: string[]; phase?: AtlasTourStep['phase']; wind?: { from: string; kmh: number }; view?: AtlasTourStep['view'] }[];
    };
    if (!massifs.some((m) => m.id === raw.massif)) {
      qa.push(`visite ${file} : secteur inconnu ${raw.massif}`);
      continue;
    }
    out[raw.massif] = raw.steps.map((st) => {
      const ids = (st.focus ?? [])
        .map((ref) => {
          const id = rawToFeature.get(ref.includes('/') ? ref : `${raw.massif}/${ref}`);
          if (!id) qa.push(`visite ${raw.massif} : élément introuvable « ${ref} » (étape « ${st.title} »)`);
          return id;
        })
        .filter((x): x is string => !!x);
      const sources = [...new Set(ids.flatMap((id) => (byId.get(id)?.properties.sources ?? '').split(',').filter(Boolean)))];
      const deg = st.wind ? WIND_DEG[st.wind.from.toUpperCase()] : undefined;
      const places = placesIn(`${st.title}\n${st.text}`, lieux[raw.massif] ?? {});
      return {
        chapter: st.chapter,
        title: st.title,
        text: st.text,
        features: ids,
        sources,
        ...(places.length ? { places } : {}),
        ...(st.phase ? { phase: st.phase } : {}),
        ...(st.wind && deg !== undefined ? { wind: { fromDeg: deg, kmh: st.wind.kmh } } : {}),
        ...(st.view ? { view: st.view } : {}),
      };
    });
  }
  return out;
}


// ---------- Main ----------
function main() {
  const { grid, elevation } = loadDem(ROOT);
  const terrain = analyseTerrain(grid, elevation);

  const readRaw = (dir: string, file: string): RawFile | null => {
    try {
      return JSON.parse(readFileSync(join(dir, file), 'utf8')) as RawFile;
    } catch (e) {
      qa.push(`${file}: JSON illisible (${(e as Error).message})`);
      return null;
    }
  };
  const regionRank = (file: string) => {
    const i = REGION_ORDER.indexOf(file.replace('.json', ''));
    return i < 0 ? REGION_ORDER.length : i;
  };
  const listJson = (dir: string) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          // Region batches first (they create the sectors), then the cross-cutting files that only add to them.
          .sort((a, b) => regionRank(a) - regionRank(b) || a.localeCompare(b))
          .map((f) => ({ dir, file: f }))
      : [];
  const secondPass = listJson(SECOND_PASS);
  const superseded = new Set(secondPass.flatMap(({ dir, file }) => (readRaw(dir, file)?.massifs ?? []).map((m) => m.id)));
  const files = [...listJson(RESEARCH), ...secondPass, ...EXTRA_DIRS.flatMap(listJson)];
  const slugs = new Set<string>();

  const sources: Record<string, AtlasSource> = {};
  const urlToId = new Map<string, string>();
  const massifs: AtlasMassif[] = [];
  const features: Record<FeatureCategory, AtlasFeature[]> = {
    breezes: [],
    convergences: [],
    hazards: [],
    thermals: [],
    soaring: [],
    takeoffs: [],
    landings: [],
    routes: [],
  };
  const curated: CuratedBreezeInput[] = [];
  const rules: ModelRule[] = [];
  const figures: AtlasFigure[] = [];
  const dossiers: Record<string, string> = {};
  /** `${massif}/${raw item id}` → atlas feature id (ids get a suffix when they collide). */
  const rawToFeature = new Map<string, string>();
  const usedIds = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  };

  // Verified positions (research_notes/…/positions/corrections.json) override the researched ones.
  const positionsFile = join(ROOT, 'research_notes', 'Seconde passe 2026', 'positions', 'corrections.json');
  const positions = new Map(
    Object.entries(existsSync(positionsFile) ? (JSON.parse(readFileSync(positionsFile, 'utf8')) as { corrections: Record<string, { lon: number; lat: number; method: string }> }).corrections : {}),
  );
  const positionsUsed = new Set<string>();

  for (const { dir, file } of files) {
    const parsed = readRaw(dir, file);
    if (!parsed) continue;
    // First-pass massifs revised by the second pass are dropped, not merged.
    const raw = dir === RESEARCH ? { ...parsed, massifs: parsed.massifs.filter((m) => !superseded.has(m.id)) } : parsed;
    if (!raw.massifs.length && parsed.massifs.length) continue;
    const base = file.replace('.json', '');
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
    slugs.add(slug);
    const region = REGION_LABELS[base] ?? base;
    // Sources: namespace ids, dedupe by URL.
    const local = new Map<string, string>();
    for (const s of raw.sources ?? []) {
      const url = s.url?.trim();
      const existing = url ? urlToId.get(url) : undefined;
      if (existing) {
        local.set(s.id, existing);
        continue;
      }
      const gid = `${slug}:${s.id}`;
      sources[gid] = { id: gid, title: s.title ?? url ?? s.id, url, publisher: s.publisher, type: s.type, notes: s.notes };
      if (url) urlToId.set(url, gid);
      local.set(s.id, gid);
    }
    const mapSources = (ids: string[] | undefined) =>
      (ids ?? []).map((i) => {
        const g = local.get(i);
        if (!g) qa.push(`${slug}: source inconnue ${i}`);
        return g ?? i;
      });
    // Inline citations "[S3]" in free text → global ids are kept readable as-is; the panel resolves them per region.
    for (const r of raw.model_rules ?? []) rules.push({ id: r.id, topic: r.topic, rule: r.rule, numbers: r.numbers, sources: mapSources(r.sources) });

    for (const m of raw.massifs) {
      // A massif already described by another file is completed, not duplicated.
      const previous = massifs.find((x) => x.id === m.id);
      const mid = previous ? previous.id : uniqueId(m.id);
      const items: AtlasMassif['items'] = previous?.items ?? { breezes: [], convergences: [], hazards: [], thermals: [], soaring: [], takeoffs: [], landings: [], routes: [] };
      const allCoords: [number, number][] = [];
      const massifSources = new Set<string>();
      const push = (cat: FeatureCategory, f: AtlasFeature) => {
        const base = f.properties.id.replace(/-\d+$/, '');
        if (!rawToFeature.has(base)) rawToFeature.set(base, f.properties.id);
        rawToFeature.set(f.properties.id, f.properties.id);
        features[cat].push(f);
        items[cat].push(f.properties.id);
        f.properties.sources.split(',').filter(Boolean).forEach((s) => massifSources.add(s));
        if (f.geometry.type === 'Point') allCoords.push(f.geometry.coordinates);
        else allCoords.push(...f.geometry.coordinates);
      };

      for (const b of m.breezes ?? []) {
        const wps = (b.waypoints ?? []).filter(validPoint);
        if (wps.length < 2) {
          qa.push(`${mid}: brise « ${b.name} » ignorée (moins de 2 points valides)`);
          continue;
        }
        const id = uniqueId(`${mid}/${b.id}`);
        const coords = breezePath(terrain, b.kind, wps);
        const window = parseHours(b.hours, b.kind);
        const condition = parseCondition(b);
        if (condition && !condition.wind && !condition.regime) qa.push(`${mid}: brise « ${b.name} » : condition non interprétable par le modèle (« ${condition.label} »), jamais simulée`);
        const typical = b.speed_kmh?.typical ?? null;
        const speed = typical ?? (b.speed_kmh?.max ? b.speed_kmh.max * 0.6 : DEFAULT_SPEED[b.kind] ?? 12);
        const conf = confidence(b.confidence);
        const quality = wps.every((p) => p.coord_quality === 'source') ? 'source' : wps.some((p) => p.coord_quality === 'source') ? 'mixed' : 'approx';
        const clean = cleanDescription(b.description);
        const props: AtlasFeatureProps = {
          id,
          category: 'breezes',
          massif: mid,
          name: b.name,
          kind: b.kind,
          description: clean.text,
          confidence: conf,
          sources: mapSources(b.sources).join(','),
          coordQuality: quality,
          windowStart: window?.[0],
          windowEnd: window?.[1],
          speedKmh: Math.round(speed),
          ...(condition
            ? { condition: condition.label, ...(condition.wind ? { conditionWindFrom: condition.wind.fromDeg, conditionWindKmh: condition.wind.minKmh } : {}) }
            : {}),
          details: {
            ...(condition ? { Condition: `seulement ${condition.label}` } : {}),
            ...(b.hours ? { Horaires: b.hours } : {}),
            ...(b.speed_kmh && (b.speed_kmh.typical || b.speed_kmh.max)
              ? { Force: `${b.speed_kmh.typical ?? '?'} km/h typique${b.speed_kmh.max ? `, ${b.speed_kmh.max} km/h max` : ''}` }
              : { Force: `non documentée (valeur par défaut du modèle : ${Math.round(speed)} km/h)` }),
            ...(b.season ? { Saison: b.season } : {}),
            ...(b.layer_depth_m ? { Épaisseur: String(b.layer_depth_m) } : {}),
            Trajet: wps.map((p) => p.name).filter(Boolean).join(' → '),
            ...(clean.note ? { 'Note de collecte': clean.note } : {}),
          },
        };
        push('breezes', { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: props });
        curated.push({
          id,
          name: b.name,
          kind: b.kind,
          speedMs: speed / 3.6,
          window,
          ...(condition ? { condition } : {}),
          coords,
          radiusM: RADIUS[b.kind] ?? 1500,
          strength: conf === 'high' ? 1 : conf === 'medium' ? 0.85 : 0.55,
        });
      }

      for (const c of m.convergences ?? []) {
        const g = c.geometry;
        let geometry: AtlasFeature['geometry'] | null = null;
        if (g?.type === 'LineString' && Array.isArray(g.coordinates)) {
          const cs = (g.coordinates as number[][]).filter((p) => validPoint({ lon: p[0], lat: p[1] })).map((p) => [p[0], p[1]] as [number, number]);
          if (cs.length >= 2) geometry = { type: 'LineString', coordinates: cs };
          else if (cs.length === 1) geometry = { type: 'Point', coordinates: cs[0] };
        } else if (g?.type === 'Point' && Array.isArray(g.coordinates)) {
          const p = g.coordinates as number[];
          if (validPoint({ lon: p[0], lat: p[1] })) geometry = { type: 'Point', coordinates: [p[0], p[1]] };
        }
        if (!geometry) {
          qa.push(`${mid}: convergence « ${c.name} » sans géométrie exploitable`);
          continue;
        }
        // Hours of the convergence, so the map shows it when it is active.
        const when = parseHours(c.when, 'valley');
        push('convergences', {
          type: 'Feature',
          geometry,
          properties: {
            id: uniqueId(`${mid}/${c.id}`),
            category: 'convergences',
            massif: mid,
            name: c.name,
            ...(when ? { windowStart: when[0], windowEnd: when[1] } : {}),
            description: [c.mechanism, c.usage].filter(Boolean).join('\n\n'),
            confidence: confidence(c.confidence),
            sources: mapSources(c.sources).join(','),
            details: { ...(c.when ? { Quand: c.when } : {}) },
          },
        });
      }

      const pointCat = (cat: FeatureCategory, list: RawItem[] | undefined, extra: (it: RawItem) => Record<string, string>) => {
        for (const it of list ?? []) {
          if (!validPoint(it)) {
            qa.push(`${mid}: ${cat} « ${it.name} » sans coordonnées valides`);
            continue;
          }
          const verified = positions.get(`${mid}/${it.id}`);
          if (verified) positionsUsed.add(`${mid}/${it.id}`);
          let lon = verified?.lon ?? it.lon;
          let lat = verified?.lat ?? it.lat;
          let dem = demAt(terrain, lon, lat);
          let altDelta = dem !== null && isNum(it.alt_m) ? Math.round(dem - it.alt_m) : undefined;
          let moved = false;
          if (!verified && altDelta !== undefined && Math.abs(altDelta) > 250 && it.coord_quality !== 'source' && isNum(it.alt_m)) {
            // Approximate position clearly at the wrong altitude: move it to the nearest
            // terrain at the declared altitude (the coarse DEM flattens summits by ~100-200 m).
            const fixed = relocateByAltitude(terrain, lon, lat, it.alt_m, 2500);
            if (fixed && Math.abs(fixed.delta) < Math.abs(altDelta) * 0.5) {
              qa.push(`${mid}: ${cat} « ${it.name} » recalé de ${fixed.distM} m (altitude déclarée ${it.alt_m} m, MNT ${Math.round(dem!)} m → ${Math.round(it.alt_m + fixed.delta)} m)`);
              lon = fixed.lon;
              lat = fixed.lat;
              dem = it.alt_m + fixed.delta;
              altDelta = Math.round(fixed.delta);
              moved = true;
            }
          }
          if (!moved && altDelta !== undefined && Math.abs(altDelta) > 300)
            qa.push(`${mid}: ${cat} « ${it.name} » altitude déclarée ${it.alt_m} m, MNT ${Math.round(dem!)} m (écart ${altDelta} m, coord ${it.coord_quality ?? '?'})`);
          const details = extra(it);
          const clean = cleanDescription(it.description);
          if (clean.note) details['Note de collecte'] = clean.note;
          if (verified) details['Position'] = `vérifiée : ${verified.method}`;
          else if (moved) details['Position'] = 'approximative, recalée sur l’altitude déclarée';
          else if (it.coord_quality !== 'source') details['Position'] = 'approximative';
          push(cat, {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [round5(lon), round5(lat)] },
            properties: {
              id: uniqueId(`${mid}/${it.id ?? it.name}`),
              category: cat,
              massif: mid,
              name: it.name ?? '',
              kind: it.kind,
              description: clean.text,
              confidence: it.confidence ? confidence(it.confidence) : undefined,
              sources: mapSources(it.sources).join(','),
              coordQuality: verified || it.coord_quality === 'source' ? 'source' : 'approx',
              altDelta,
              details,
            },
          });
        }
      };
      pointCat('hazards', m.hazards, (it) => ({ ...(it.conditions ? { Conditions: it.conditions } : {}), ...(it.radius_km ? { Rayon: `${it.radius_km} km` } : {}) }));
      pointCat('thermals', m.thermal_spots, (it) => ({
        ...(it.alt_m ? { Altitude: `${it.alt_m} m` } : {}),
        ...(it.best_hours ? { Heures: it.best_hours } : {}),
        ...(it.trigger ? { Déclencheur: it.trigger } : {}),
      }));
      pointCat('soaring', m.soaring_spots, (it) => ({ ...(it.wind_dirs?.length ? { Vents: it.wind_dirs.join(', ') } : {}) }));
      pointCat('takeoffs', m.takeoffs, (it) => ({
        ...(it.alt_m ? { Altitude: `${it.alt_m} m` } : {}),
        ...(it.orientations?.length ? { Orientation: it.orientations.join(', ') } : {}),
      }));
      pointCat('landings', m.landings, (it) => ({ ...(it.alt_m ? { Altitude: `${it.alt_m} m` } : {}) }));

      for (const r of m.xc_routes ?? []) {
        const wps = (r.waypoints ?? []).filter(validPoint);
        if (wps.length < 2) {
          qa.push(`${mid}: itinéraire « ${r.name} » ignoré (moins de 2 points)`);
          continue;
        }
        // A sharp turn back at a point placed by estimate is often a misplaced point (the
        // Manival of the Saint-Eynard route sat 4 km south of its combe): to check.
        for (let i = 1; i < wps.length - 1; i++) {
          if (wps[i].coord_quality !== 'approx') continue;
          const ux = (wps[i].lon - wps[i - 1].lon) * 78;
          const uy = (wps[i].lat - wps[i - 1].lat) * 111;
          const vx = (wps[i + 1].lon - wps[i].lon) * 78;
          const vy = (wps[i + 1].lat - wps[i].lat) * 111;
          const lu = Math.hypot(ux, uy);
          const lv = Math.hypot(vx, vy);
          if (lu > 0.3 && lv > 0.3 && Math.min(lu, lv) < 8 && (ux * vx + uy * vy) / (lu * lv) < -0.87)
            qa.push(`${mid}: itinéraire « ${r.name} » : demi-tour à « ${wps[i].name ?? i} », position estimée (à vérifier, sauf balise de demi-tour voulue)`);
        }
        push('routes', {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: wps.map((p) => [round5(p.lon), round5(p.lat)]) },
          properties: {
            id: uniqueId(`${mid}/${r.id}`),
            category: 'routes',
            massif: mid,
            name: r.name,
            description: r.description ?? '',
            sources: mapSources(r.sources).join(','),
            details: {
              ...(r.distance_km ? { Distance: `${r.distance_km} km` } : {}),
              Points: wps.map((p) => p.name).filter(Boolean).join(' → '),
            },
          },
        });
      }

      // Geometry of the massif: declared bbox if sane, else the extent of its features.
      let bbox = (m.bbox && m.bbox.length === 4 && m.bbox.every(isNum) ? m.bbox : null) as [number, number, number, number] | null;
      if (bbox && (bbox[0] >= bbox[2] || bbox[1] >= bbox[3] || !validPoint({ lon: bbox[0], lat: bbox[1] }))) bbox = null;
      if (!bbox && allCoords.length) {
        const xs = allCoords.map((c) => c[0]);
        const ys = allCoords.map((c) => c[1]);
        bbox = [Math.min(...xs) - 0.03, Math.min(...ys) - 0.03, Math.max(...xs) + 0.03, Math.max(...ys) + 0.03];
      }
      if (!bbox) bbox = [5, 44, 7.5, 46.3];
      const center = (m.center && m.center.length === 2 && validPoint({ lon: m.center[0], lat: m.center[1] })
        ? m.center
        : [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]) as [number, number];
      const synoptic = (m.synoptic_effects ?? []).map((s) => ({ wind: s.wind, effect: s.effect, sources: mapSources(s.sources) }));
      synoptic.forEach((s) => s.sources.forEach((x) => massifSources.add(x)));
      const tips = (m.tips ?? []).map((tip) => tip.replace(/\[(S\d+(?:\s*,\s*S\d+)*)\]/g, (_, g: string) => `[${g.split(/\s*,\s*/).map((s) => local.get(s) ?? s).join(', ')}]`));
      if (previous) {
        if (m.summary && !previous.summary.includes(m.summary)) previous.summary = [previous.summary, m.summary].filter(Boolean).join('\n\n');
        previous.tips.push(...tips.filter((t) => !previous.tips.includes(t)));
        previous.synoptic.push(...synoptic);
        previous.sources = [...new Set([...previous.sources, ...massifSources])].filter((s) => sources[s]);
        if (!m.bbox) continue;
        const b = previous.bbox;
        previous.bbox = [Math.min(b[0], bbox[0]), Math.min(b[1], bbox[1]), Math.max(b[2], bbox[2]), Math.max(b[3], bbox[3])].map((v) => Math.round(v * 1e4) / 1e4) as typeof b;
        continue;
      }
      const notes = join(dir, '..', `${base}.md`);
      if (existsSync(notes)) dossiers[mid] = relative(ROOT, notes);
      massifs.push({
        id: mid,
        name: m.name,
        shortName: shortName(mid, m.name),
        region,
        parent: m.parent_massif,
        summary: m.summary ?? '',
        bbox: bbox.map((v) => Math.round(v * 1e4) / 1e4) as [number, number, number, number],
        center: [Math.round(center[0] * 1e4) / 1e4, Math.round(center[1] * 1e4) / 1e4],
        // Inline [S#] references are region-local: rewritten to global ids above.
        tips,
        synoptic,
        items,
        sources: [...massifSources].filter((s) => sources[s]),
      });
    }

    // Annotated figures: linked from the sheets, with the features drawn from them.
    for (const fig of raw.figures ?? []) {
      const massif = massifs.find((x) => x.id === fig.massif);
      if (!fig.page_url && !fig.image_url) {
        qa.push(`${slug}: figure « ${fig.title} » sans URL`);
        continue;
      }
      if (!massif) {
        qa.push(`${slug}: figure « ${fig.title} » rattachée à un secteur inconnu (${fig.massif})`);
        continue;
      }
      const ids = (fig.extracted_to ?? []).map((raw) => rawToFeature.get(`${massif.id}/${raw}`));
      if (ids.some((x) => !x)) qa.push(`${slug}: figure « ${fig.title} » cite des éléments introuvables`);
      figures.push({
        id: `${slug}:${fig.id ?? figures.length + 1}`,
        massif: massif.id,
        title: fig.title ?? 'Figure',
        imageUrl: fig.image_url || undefined,
        pageUrl: fig.page_url || fig.image_url!,
        pdfPage: fig.pdf_page,
        publisher: fig.publisher,
        shows: fig.shows ?? '',
        features: ids.filter((x): x is string => !!x),
        sources: mapSources(fig.sources),
      });
    }
  }

  for (const key of positions.keys()) if (!positionsUsed.has(key)) qa.push(`position vérifiée pour un élément introuvable : ${key}`);

  // Written guided visits: steps tied to atlas items (their sources back the narration).
  const tours = readTours(rawToFeature, massifs, features);

  // Sector outlines: the Alpine area cut into contiguous blocks, each place going to the sector of its
  // nearest documented item (scripts/tessellation.ts): no holes, no overlaps.
  const deps = JSON.parse(readFileSync(join(ROOT, 'research_notes', 'Seconde passe 2026', 'sources', 'territoire', 'departements_alpes.geojson'), 'utf8')) as { features: { geometry: { type: string; coordinates: unknown } }[] };
  const tiling = tileSectors(massifs, features, deps.features);
  console.log(`secteurs : ${tiling.sectors} blocs jointifs, ${tiling.cells} cellules, ${tiling.reassigned} cellules rattachées à leur voisin`);

  // Thermal hotspots measured from GPS tracks: confirm, place and complete the documented
  // thermals (after the outlines, which stay those of the researched items).
  const kk7 = integrateKk7({
    dir: join(ROOT, 'research_notes', 'Seconde passe 2026', 'sources', 'kk7'),
    massifs,
    features,
    sources,
    uniqueId,
    altitude: (lon, lat) => demAt(terrain, lon, lat) ?? undefined,
  });

  // Number the features (MapLibre feature-state needs numeric ids).
  let fid = 1;
  for (const cat of Object.keys(features) as FeatureCategory[]) for (const f of features[cat]) f.id = fid++;

  const atlas: Atlas = {
    generatedAt: new Date().toISOString(),
    massifs,
    regions: REGION_ORDER.map((k) => REGION_LABELS[k]).filter((r) => massifs.some((m) => m.region === r)),
    sources,
    features,
    curated,
    curatedHazards: curatedHazardsOf(features.hazards),
    rules,
    figures,
    dossiers,
    tours,
    stats: {
      massifs: massifs.length,
      sources: Object.keys(sources).length,
      ...Object.fromEntries(Object.entries(features).map(([k, v]) => [k, v.length])),
      figures: figures.length,
    },
  };
  if (CHECK_ONLY) {
    console.log(atlas.stats);
    console.log(qa.map((q) => `- ${q}`).join('\n') || 'aucune alerte');
    return;
  }
  writeFileSync(join(ROOT, 'apps', 'web', 'public', 'data', 'atlas.json'), JSON.stringify(atlas));
  // Static mode loads the light core first and the text right after (see packages/shared/src/atlas-split.ts).
  const { core, text } = splitAtlas(atlas);
  writeFileSync(join(ROOT, 'apps', 'web', 'public', 'data', 'atlas-core.json'), JSON.stringify(core));
  writeFileSync(join(ROOT, 'apps', 'web', 'public', 'data', 'atlas-text.json'), JSON.stringify(text));
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(
    join(ROOT, 'docs', 'DATA_QA.md'),
    `# Contrôle qualité des données de recherche\n\nGénéré par \`npm run data:build\` le ${atlas.generatedAt.slice(0, 10)}.\n\n` +
      `## Volumes\n\n${Object.entries(atlas.stats)
        .map(([k, v]) => `- ${k} : ${v}`)
        .join('\n')}\n\n## Points à vérifier (${qa.length})\n\n${qa.map((q) => `- ${q}`).join('\n')}\n`,
  );
  if (kk7) writeFileSync(join(ROOT, 'docs', 'KK7_CROISEMENT.md'), kk7Markdown(kk7, massifs, atlas.generatedAt.slice(0, 10)));
  console.log(atlas.stats, `${qa.length} QA warnings`, kk7 ? kk7Summary(kk7) : '');
}

function kk7Summary(r: Kk7Report): string {
  return `kk7 : ${r.matched} thermiques confirmés (${r.moved.length} recalés), ${r.added} points chauds ajoutés, ${r.far.length} thermiques loin de tout point chaud`;
}

// Run only when executed directly (the helpers above are unit-tested).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
