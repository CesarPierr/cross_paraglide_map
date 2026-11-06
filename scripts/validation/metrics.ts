/**
 * Scores of a run: speed bias and RMSE, vector RMSE, direction error, flyable-class hit
 * rate, by setting × situation × region. Pure functions over the sample arrays.
 */
import { HOURS, type BenchDay, type BenchStation, type Bundle } from './common';
import { CHANNELS, EXTRAS, VARIANTS, type RunMeta } from './evaluate';

export const KMH = 3.6;
/** Scored predictions: the model's variants, AROME's raw 10 m wind and the sounding's wind at the station. */
export const PREDICTORS = ['layers', 'ridge', 'arome10', 'sounding', 'centre', 'envelope', 'noBreeze', 'breeze50', 'calm', 'noAtlas', 'noHazard'] as const;
export type Predictor = (typeof PREDICTORS)[number];
export const SITUATIONS = ['brise-matin', 'brise-aprem', 'calme-couvert', 'modere', 'fort', 'stable'] as const;
export const SETTINGS = ['fond', 'pente', 'sommet', 'plaine', 'balise'] as const;
/** Flyable classes pilots use (km/h). */
const CLASS_LIMITS = [15, 25];
/** Direction is scored for observed winds of at least this speed (m/s). */
const DIR_MIN_OBS = 2;

export function situationOf(day: BenchDay, hour: number, ridgeKmh: number, cloud: number): (typeof SITUATIONS)[number] {
  if (day.klass === 'stable' && ridgeKmh < 20) return 'stable';
  if (ridgeKmh >= 40) return 'fort';
  if (ridgeKmh >= 20) return 'modere';
  if (cloud >= 0.6) return 'calme-couvert';
  return hour <= 12 ? 'brise-matin' : 'brise-aprem';
}

export interface Sample {
  st: number;
  d: number;
  h: number;
  /** Observed speed and vector (m/s), gust. */
  ff: number;
  ou: number;
  ov: number;
  situation: (typeof SITUATIONS)[number];
  pred: Record<Predictor, [number, number] | null>;
  up: [number, number];
  /** Sounding wind at the station, model's synoptic part (m/s). */
  air: [number, number];
  syn: [number, number];
  total: [number, number];
  belowGround: number;
  breezeWeight: number;
}

const vec = (fromDeg: number, speed: number): [number, number] => [-Math.sin((fromDeg * Math.PI) / 180) * speed, -Math.cos((fromDeg * Math.PI) / 180) * speed];

export function loadSamples(bundle: Bundle, data: Float32Array, meta: RunMeta): Sample[] {
  const out: Sample[] = [];
  const nD = bundle.days.length;
  const nH = HOURS.length;
  const iX = (x: (typeof EXTRAS)[number]) => VARIANTS.length * 2 + EXTRAS.indexOf(x);
  bundle.stations.forEach((st, s) => {
    const axis = meta.axis[st.id] ?? [0, 0];
    const up: [number, number] = [-axis[0], -axis[1]];
    bundle.days.forEach((day, d) => {
      HOURS.forEach((hour, h) => {
        const o = bundle.obs[st.id]?.[day.date]?.[h];
        if (!o) return;
        const at = ((s * nD + d) * nH + h) * CHANNELS;
        const lay = data[at];
        if (!Number.isFinite(lay)) return;
        const [ou, ov] = vec(o[1], o[0]);
        const pred = {} as Sample['pred'];
        VARIANTS.forEach((v, i) => {
          const a = data[at + i * 2];
          const b = data[at + i * 2 + 1];
          (pred as Record<string, [number, number] | null>)[v] = Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
        });
        const a10 = bundle.arome[st.id]?.[day.date]?.[h];
        pred.arome10 = a10 ? vec(a10[1], a10[0]) : null;
        const air: [number, number] = [data[at + iX('airU')], data[at + iX('airV')]];
        pred.sounding = air;
        out.push({
          st: s,
          d,
          h,
          ff: o[0],
          ou,
          ov,
          situation: situationOf(day, hour, data[at + iX('ridgeKmh')], data[at + iX('cloud')]),
          pred,
          up,
          air,
          syn: [data[at + iX('synU')], data[at + iX('synV')]],
          total: pred.layers!,
          belowGround: data[at + iX('belowGround')],
          breezeWeight: data[at + iX('breezeWeight')],
        });
      });
    });
  });
  return out;
}

export interface Score {
  n: number;
  obs: number;
  mod: number;
  bias: number;
  rmse: number;
  vrmse: number;
  dir: number | null;
  hit: number;
  slope: number;
  r: number;
  /** Winds above 25 km/h: probability of detection and false-alarm ratio. */
  pod25: number | null;
  far25: number | null;
}

const classOf = (kmh: number) => (kmh <= CLASS_LIMITS[0] ? 0 : kmh <= CLASS_LIMITS[1] ? 1 : 2);
const r2 = (x: number) => Math.round(x * 100) / 100;

export function score(samples: Sample[], p: Predictor): Score | null {
  let n = 0;
  let so = 0;
  let sm = 0;
  let se2 = 0;
  let sv2 = 0;
  let dirN = 0;
  let dirS = 0;
  let hit = 0;
  let smo = 0;
  let smm = 0;
  let soo = 0;
  let hits25 = 0;
  let obs25 = 0;
  let mod25 = 0;
  for (const s of samples) {
    const v = s.pred[p];
    if (!v || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) continue;
    const m = Math.hypot(v[0], v[1]);
    const mk = m * KMH;
    const ok = s.ff * KMH;
    n++;
    so += ok;
    sm += mk;
    se2 += (mk - ok) ** 2;
    sv2 += ((v[0] - s.ou) ** 2 + (v[1] - s.ov) ** 2) * KMH * KMH;
    if (classOf(mk) === classOf(ok)) hit++;
    smo += mk * ok;
    smm += mk * mk;
    soo += ok * ok;
    if (ok > 25) obs25++;
    if (mk > 25) mod25++;
    if (ok > 25 && mk > 25) hits25++;
    if (s.ff >= DIR_MIN_OBS && m > 0.05) {
      const dot = (v[0] * s.ou + v[1] * s.ov) / (m * s.ff);
      dirS += (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
      dirN++;
    }
  }
  if (n === 0) return null;
  const cov = smo / n - (so / n) * (sm / n);
  const vo = soo / n - (so / n) ** 2;
  const vm = smm / n - (sm / n) ** 2;
  return {
    n,
    obs: r2(so / n),
    mod: r2(sm / n),
    bias: r2((sm - so) / n),
    rmse: r2(Math.sqrt(se2 / n)),
    vrmse: r2(Math.sqrt(sv2 / n)),
    dir: dirN >= 10 ? Math.round(dirS / dirN) : null,
    hit: r2(hit / n),
    slope: r2(smm > 0 ? smo / smm : NaN),
    r: r2(vo > 0 && vm > 0 ? cov / Math.sqrt(vo * vm) : NaN),
    pod25: obs25 >= 10 ? r2(hits25 / obs25) : null,
    far25: mod25 >= 10 ? r2(1 - hits25 / mod25) : null,
  };
}

export interface GroupRow {
  key: Record<string, string>;
  n: number;
  scores: Partial<Record<Predictor, Score>>;
}

export function groupBy(samples: Sample[], keyOf: (s: Sample) => Record<string, string> | null, predictors: readonly Predictor[] = PREDICTORS): GroupRow[] {
  const groups = new Map<string, { key: Record<string, string>; list: Sample[] }>();
  for (const s of samples) {
    const key = keyOf(s);
    if (!key) continue;
    const id = JSON.stringify(key);
    let g = groups.get(id);
    if (!g) {
      g = { key, list: [] };
      groups.set(id, g);
    }
    g.list.push(s);
  }
  return [...groups.values()].map((g) => {
    const scores: GroupRow['scores'] = {};
    for (const p of predictors) {
      const v = score(g.list, p);
      if (v) scores[p] = v;
    }
    return { key: g.key, n: g.list.length, scores };
  });
}

/** Deterministic generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Percentile interval (5–95 %) of a statistic, resampling whole days: the hours and stations
 * of one day share its weather and are not independent.
 */
export function bootstrapDays(samples: Sample[], stat: (list: Sample[]) => number, R = 400, seed = 12345): [number, number] {
  const byDay = new Map<number, Sample[]>();
  for (const s of samples) byDay.set(s.d, [...(byDay.get(s.d) ?? []), s]);
  const days = [...byDay.values()];
  if (days.length < 3) return [NaN, NaN];
  const rand = rng(seed);
  const vals: number[] = [];
  for (let i = 0; i < R; i++) {
    const list: Sample[] = [];
    for (let j = 0; j < days.length; j++) {
      const chosen = days[Math.floor(rand() * days.length)];
      for (const s of chosen) list.push(s);
    }
    const v = stat(list);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  return [r2(vals[Math.floor(0.05 * vals.length)]), r2(vals[Math.floor(0.95 * vals.length)])];
}

const speedOf = (v: [number, number] | null) => (v ? Math.hypot(v[0], v[1]) * KMH : NaN);
export function biasOf(list: Sample[], p: Predictor): number {
  let a = 0;
  let n = 0;
  for (const s of list) {
    const m = speedOf(s.pred[p]);
    if (!Number.isFinite(m)) continue;
    a += m - s.ff * KMH;
    n++;
  }
  return n ? a / n : NaN;
}
export function rmseOf(list: Sample[], p: Predictor): number {
  let a = 0;
  let n = 0;
  for (const s of list) {
    const m = speedOf(s.pred[p]);
    if (!Number.isFinite(m)) continue;
    a += (m - s.ff * KMH) ** 2;
    n++;
  }
  return n ? Math.sqrt(a / n) : NaN;
}

/** Least-squares slope of y on x, both around their means. */
function slopeOf(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  return sxx > 0 ? sxy / sxx : NaN;
}

const upOf = (s: Sample, v: [number, number]) => v[0] * s.up[0] + v[1] * s.up[1];

/**
 * Along-valley budget at valley-floor stations (positive = up-valley), km/h: observed, AROME
 * 10 m, the sounding at the station's altitude, what the model keeps of it, its own breezes.
 * `keep` = slope of the model's synoptic part on the sounding wind: what the model passes on.
 * `found` = slope of the observed wind on the sounding wind: what the sounding wind really
 * explains. keep > found with a positive bias is the signature of a double count.
 */
export function valleyBudget(list: Sample[]) {
  const ok = list.filter((s) => Number.isFinite(s.air[0]) && Number.isFinite(s.syn[0]));
  const n = ok.length;
  if (n === 0) return null;
  const mean = (f: (s: Sample) => number) => r2((ok.reduce((a, s) => a + f(s), 0) / n) * KMH);
  const air = ok.map((s) => upOf(s, s.air));
  const syn = ok.map((s) => upOf(s, s.syn));
  const obs = ok.map((s) => upOf(s, [s.ou, s.ov]));
  const arome = ok.filter((s) => s.pred.arome10);
  return {
    n,
    obsUp: mean((s) => upOf(s, [s.ou, s.ov])),
    aromeUp: arome.length ? r2((arome.reduce((a, s) => a + upOf(s, s.pred.arome10!), 0) / arome.length) * KMH) : null,
    soundingUp: mean((s) => upOf(s, s.air)),
    synopticUp: mean((s) => upOf(s, s.syn)),
    breezeUp: mean((s) => upOf(s, [s.total[0] - s.syn[0], s.total[1] - s.syn[1]])),
    totalUp: mean((s) => upOf(s, s.total)),
    keep: r2(slopeOf(air, syn)),
    found: r2(slopeOf(air, obs)),
    belowGroundShare: r2(ok.reduce((a, s) => a + (s.belowGround > 0 ? 1 : 0), 0) / n),
    meanSoundingSpeed: mean((s) => Math.hypot(s.air[0], s.air[1])),
    meanSynopticSpeed: mean((s) => Math.hypot(s.syn[0], s.syn[1])),
  };
}

export interface Results {
  rev: string;
  created: string;
  bench: { days: number; stations: number; samples: number; bySetting: Record<string, number>; byRegion: Record<string, number>; dayList: BenchDay[]; situationSamples: Record<string, number> };
  overall: GroupRow[];
  settingSituation: GroupRow[];
  regionSituation: GroupRow[];
  dayLabel: GroupRow[];
  folds: GroupRow[];
  valleySize: GroupRow[];
  diurnal: { setting: string; hour: number; n: number; obs: number; layers: number; ridge: number; arome10: number; calm: number; envelope: number; noAtlas: number }[];
  budget: { group: string; situation: string; budget: NonNullable<ReturnType<typeof valleyBudget>> }[];
  doubleCount: Record<string, unknown>;
  stations: { id: string; name: string; setting: string; region: string; massif: string; alti: number; zCell: number; rel: number; depth: number; n: number; layers: Score | null; ridge: Score | null; arome10: Score | null }[];
}

export function buildResults(rev: string, bundle: Bundle, samples: Sample[]): Results {
  const st = bundle.stations;
  const days = bundle.days;
  const count = (keys: string[]) => keys.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});
  const floor = samples.filter((s) => st[s.st].setting === 'fond');
  const bigFloor = floor.filter((s) => st[s.st].valley >= 0.5);
  const key = samples.filter((s) => s.situation === 'brise-aprem' && st[s.st].setting === 'fond');
  const ci = (list: Sample[], p: Predictor) => ({ bias: r2(biasOf(list, p)), biasCi: bootstrapDays(list, (l) => biasOf(l, p)), rmse: r2(rmseOf(list, p)), rmseCi: bootstrapDays(list, (l) => rmseOf(l, p)) });
  const diffCi = (list: Sample[], a: Predictor, b: Predictor) => ({ diff: r2(biasOf(list, a) - biasOf(list, b)), ci: bootstrapDays(list, (l) => biasOf(l, a) - biasOf(l, b)), rmseDiff: r2(rmseOf(list, a) - rmseOf(list, b)), rmseCi: bootstrapDays(list, (l) => rmseOf(l, a) - rmseOf(l, b)) });
  const doubleCount: Record<string, unknown> = {};
  for (const [name, list] of [
    ['fond|brise-aprem', key],
    ['grand-fond|brise-aprem', key.filter((s) => st[s.st].valley >= 0.5)],
    ['fond|brise-matin', floor.filter((s) => s.situation === 'brise-matin')],
    ['fond|modere', floor.filter((s) => s.situation === 'modere')],
    ['fond|fort', floor.filter((s) => s.situation === 'fort')],
    ['pente|brise-aprem', samples.filter((s) => s.situation === 'brise-aprem' && st[s.st].setting === 'pente')],
    ['sommet|brise-aprem', samples.filter((s) => s.situation === 'brise-aprem' && st[s.st].setting === 'sommet')],
    ['plaine|brise-aprem', samples.filter((s) => s.situation === 'brise-aprem' && st[s.st].setting === 'plaine')],
  ] as [string, Sample[]][]) {
    doubleCount[name] = {
      n: list.length,
      obs: score(list, 'layers')?.obs ?? null,
      layers: ci(list, 'layers'),
      ridge: ci(list, 'ridge'),
      arome10: ci(list, 'arome10'),
      envelope: ci(list, 'envelope'),
      noBreeze: ci(list, 'noBreeze'),
      breeze50: ci(list, 'breeze50'),
      calm: ci(list, 'calm'),
      noAtlas: ci(list, 'noAtlas'),
      noHazard: ci(list, 'noHazard'),
      layersMinusRidge: diffCi(list, 'layers', 'ridge'),
      layersMinusEnvelope: diffCi(list, 'layers', 'envelope'),
      layersMinusCentre: diffCi(list, 'layers', 'centre'),
    };
  }
  const diurnal: Results['diurnal'] = [];
  for (const setting of SETTINGS) {
    for (let h = 0; h < HOURS.length; h++) {
      const list = samples.filter((s) => st[s.st].setting === setting && s.h === h && (s.situation === 'brise-matin' || s.situation === 'brise-aprem'));
      if (!list.length) continue;
      const m = (p: Predictor) => {
        const vals = list.map((s) => speedOf(s.pred[p])).filter(Number.isFinite);
        return r2(vals.reduce((a, b) => a + b, 0) / vals.length);
      };
      diurnal.push({ setting, hour: HOURS[h], n: list.length, obs: r2((list.reduce((a, s) => a + s.ff, 0) / list.length) * KMH), layers: m('layers'), ridge: m('ridge'), arome10: m('arome10'), calm: m('calm'), envelope: m('envelope'), noAtlas: m('noAtlas') });
    }
  }
  const budget: Results['budget'] = [];
  for (const situation of SITUATIONS) {
    for (const [group, list] of [
      ['fond', floor],
      ['grand-fond', bigFloor],
    ] as [string, Sample[]][]) {
      const b = valleyBudget(list.filter((s) => s.situation === situation));
      if (b) budget.push({ group, situation, budget: b });
    }
  }
  const brief = (id: number, p: Predictor) => score(samples.filter((s) => s.st === id), p);
  return {
    rev,
    created: new Date().toISOString().slice(0, 10),
    bench: {
      days: days.length,
      stations: st.length,
      samples: samples.length,
      bySetting: count(st.map((s) => s.setting)),
      byRegion: count(st.map((s) => s.region)),
      dayList: days,
      situationSamples: count(samples.map((s) => s.situation)),
    },
    overall: groupBy(samples, (s) => ({ situation: s.situation })),
    settingSituation: groupBy(samples, (s) => ({ setting: st[s.st].setting, situation: s.situation })),
    regionSituation: groupBy(samples, (s) => ({ region: st[s.st].region, situation: s.situation }), ['layers', 'ridge', 'arome10']),
    dayLabel: groupBy(samples, (s) => ({ label: days[s.d].label.replace(/^brise-\d+$/, 'brise') }), ['layers', 'ridge', 'arome10', 'envelope']),
    folds: groupBy(samples, (s) => ({ fold: days[s.d].fold, setting: st[s.st].setting, situation: s.situation }), ['layers', 'arome10']),
    valleySize: groupBy(
      floor,
      (s) => {
        const v = st[s.st].valley;
        return { taille: v >= 0.5 ? 'grande (valley ≥ 0,5)' : v >= 0.2 ? 'moyenne (0,2–0,5)' : 'petite (< 0,2)', situation: s.situation };
      },
      ['layers', 'ridge', 'arome10', 'envelope', 'breeze50', 'noBreeze', 'noAtlas'],
    ),
    diurnal,
    budget,
    doubleCount,
    stations: st.map((b: BenchStation, i) => ({ id: b.id, name: b.name, setting: b.setting, region: b.region, massif: b.massif, alti: b.alti, zCell: b.zCell, rel: b.rel, depth: b.env - b.floor, n: samples.filter((s) => s.st === i).length, layers: brief(i, 'layers'), ridge: brief(i, 'ridge'), arome10: brief(i, 'arome10') })),
  };
}

const fmt = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(d).replace('.', ','));
const sign = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? '–' : `${x > 0 ? '+' : ''}${x.toFixed(d).replace('.', ',')}`);

const order = (a: string, list: readonly string[]) => {
  const i = list.indexOf(a);
  return i < 0 ? 99 : i;
};

/** Markdown table: bias / RMSE / hit per predictor for each row. */
export function tableBySetting(rows: GroupRow[], predictors: readonly Predictor[], keyA: string, keyB: string): string {
  const head = `| ${keyA} | ${keyB} | n | obs km/h | ${predictors.map((p) => `${p} biais / RMSE / vect. / dir / ok`).join(' | ')} |`;
  const sep = `|---|---|--:|--:|${predictors.map(() => '--:').join('|')}|`;
  const body = [...rows]
    .sort((a, b) => order(a.key[keyA], SETTINGS) - order(b.key[keyA], SETTINGS) || a.key[keyA].localeCompare(b.key[keyA]) || order(a.key[keyB], SITUATIONS) - order(b.key[keyB], SITUATIONS))
    .filter((r) => r.n >= 12)
    .map((r) => {
      const anyScore = r.scores[predictors[0]];
      const cells = predictors.map((p) => {
        const s = r.scores[p];
        return s ? `${sign(s.bias)} / ${fmt(s.rmse)} / ${fmt(s.vrmse)} / ${s.dir ?? '–'}° / ${Math.round(s.hit * 100)} %` : '–';
      });
      return `| ${r.key[keyA]} | ${r.key[keyB]} | ${r.n} | ${fmt(anyScore?.obs)} | ${cells.join(' | ')} |`;
    });
  return [head, sep, ...body].join('\n');
}

export function printReport(r: Results): string {
  const out: string[] = [];
  out.push(`# Banc de rétro-prévision, révision ${r.rev}`);
  out.push(`${r.bench.days} jours, ${r.bench.stations} postes, ${r.bench.samples} échantillons. Postes par cadre : ${JSON.stringify(r.bench.bySetting)}. Échantillons par situation : ${JSON.stringify(r.bench.situationSamples)}.\n`);
  out.push('## Cadre × situation, biais / RMSE vitesse / RMSE vectoriel (km/h) / direction / classes\n');
  out.push(tableBySetting(r.settingSituation, ['layers', 'ridge', 'arome10'], 'setting', 'situation'));
  out.push('\n## Variantes de diagnostic (mêmes échantillons)\n');
  out.push(tableBySetting(r.settingSituation, ['envelope', 'noBreeze', 'calm', 'centre', 'sounding'], 'setting', 'situation'));
  out.push('\n## Fond de vallée, composante le long de la vallée (km/h, + = vers l’amont)\n');
  out.push('| groupe | situation | n | obs | AROME 10 m | sondage à l’altitude | part synoptique modèle | brises modèle | total modèle | conservé | trouvé | sous le sol AROME | vit. sondage | vit. synoptique modèle |');
  out.push('|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
  for (const b of r.budget) {
    const v = b.budget;
    out.push(`| ${b.group} | ${b.situation} | ${v.n} | ${sign(v.obsUp)} | ${sign(v.aromeUp)} | ${sign(v.soundingUp)} | ${sign(v.synopticUp)} | ${sign(v.breezeUp)} | ${sign(v.totalUp)} | ${fmt(v.keep, 2)} | ${fmt(v.found, 2)} | ${Math.round(v.belowGroundShare * 100)} % | ${fmt(v.meanSoundingSpeed)} | ${fmt(v.meanSynopticSpeed)} |`);
  }
  out.push('\n## Double compte : biais et écarts avec intervalle 5–95 % (rééchantillonnage des jours)\n');
  out.push('| cas | n | obs | couches biais [IC] | crêtes biais [IC] | AROME 10 m biais [IC] | enveloppe biais | sans brises biais | couches − crêtes biais [IC] | couches − crêtes RMSE [IC] | couches − enveloppe RMSE [IC] | couches − sondage centre RMSE [IC] |');
  out.push('|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
  type DC = { n: number; obs: number; layers: { bias: number; biasCi: number[] }; ridge: { bias: number; biasCi: number[] }; arome10: { bias: number; biasCi: number[] }; envelope: { bias: number }; noBreeze: { bias: number }; layersMinusRidge: { diff: number; ci: number[]; rmseDiff: number; rmseCi: number[] }; layersMinusEnvelope: { rmseDiff: number; rmseCi: number[] }; layersMinusCentre: { rmseDiff: number; rmseCi: number[] } };
  const ci = (c: number[]) => `[${sign(c[0])} ; ${sign(c[1])}]`;
  for (const [name, raw] of Object.entries(r.doubleCount)) {
    const d = raw as DC;
    if (!d.n) continue;
    out.push(`| ${name} | ${d.n} | ${fmt(d.obs)} | ${sign(d.layers.bias)} ${ci(d.layers.biasCi)} | ${sign(d.ridge.bias)} ${ci(d.ridge.biasCi)} | ${sign(d.arome10.bias)} ${ci(d.arome10.biasCi)} | ${sign(d.envelope.bias)} | ${sign(d.noBreeze.bias)} | ${sign(d.layersMinusRidge.diff)} ${ci(d.layersMinusRidge.ci)} | ${sign(d.layersMinusRidge.rmseDiff)} ${ci(d.layersMinusRidge.rmseCi)} | ${sign(d.layersMinusEnvelope.rmseDiff)} ${ci(d.layersMinusEnvelope.rmseCi)} | ${sign(d.layersMinusCentre.rmseDiff)} ${ci(d.layersMinusCentre.rmseCi)} |`);
  }
  out.push('\n## Journée de brise, vitesse moyenne par heure (km/h)\n');
  out.push('| cadre | heure | n | obs | couches | crêtes | AROME 10 m | brises seules | enveloppe | sans atlas |');
  out.push('|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
  for (const d of r.diurnal) out.push(`| ${d.setting} | ${d.hour} h | ${d.n} | ${fmt(d.obs)} | ${fmt(d.layers)} | ${fmt(d.ridge)} | ${fmt(d.arome10)} | ${fmt(d.calm)} | ${fmt(d.envelope)} | ${fmt(d.noAtlas)} |`);
  out.push('\n## Fond de vallée par taille de vallée\n');
  out.push(tableBySetting(r.valleySize, ['layers', 'ridge', 'arome10', 'envelope', 'breeze50', 'noBreeze', 'noAtlas'], 'taille', 'situation'));
  out.push('\n## Atlas : avec, sans dangers, sans rien\n');
  out.push(tableBySetting(r.settingSituation, ['layers', 'noHazard', 'noAtlas'], 'setting', 'situation'));
  out.push('\n## Postes les plus mal rendus (RMSE vitesse, couches)\n');
  out.push('| poste | cadre | région | alt. | n | biais | RMSE | AROME 10 m biais / RMSE |');
  out.push('|---|---|---|--:|--:|--:|--:|--:|');
  for (const s of [...r.stations].sort((a, b) => (b.layers?.rmse ?? 0) - (a.layers?.rmse ?? 0)).slice(0, 15)) out.push(`| ${s.name} | ${s.setting} | ${s.region} | ${s.alti} | ${s.n} | ${sign(s.layers?.bias)} | ${fmt(s.layers?.rmse)} | ${sign(s.arome10?.bias)} / ${fmt(s.arome10?.rmse)} |`);
  out.push('\n## Région × situation\n');
  out.push(tableBySetting(r.regionSituation, ['layers', 'ridge', 'arome10'], 'region', 'situation'));
  out.push('\n## Type de journée\n');
  out.push(
    tableBySetting(
      r.dayLabel.map((x) => ({ ...x, key: { label: x.key.label, tout: '' } })),
      ['layers', 'ridge', 'arome10', 'envelope'],
      'label',
      'tout',
    ),
  );
  return out.join('\n');
}

/** Difference table between two results of the same bench (A − B; negative RMSE = A better). */
export function printCompare(a: Results, b: Results, samplesA: Sample[], samplesB: Sample[], bundle: Bundle): string {
  const out: string[] = [];
  out.push(`# Comparaison : ${a.rev} (A) contre ${b.rev} (B)`);
  out.push('Écarts A − B sur le modèle tel que l’app l’utilise (couches). RMSE négatif : A meilleur. IC 5–95 % par rééchantillonnage des jours.\n');
  out.push('| cadre | situation | n | biais A | biais B | Δ|biais| | RMSE A | RMSE B | ΔRMSE [IC] | Δvect. | Δdir | Δclasses | pli A ΔRMSE | pli B ΔRMSE |');
  out.push('|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
  const st = bundle.stations;
  // Paired resampling needs the same samples in both runs: indexed by station, day, hour.
  const id = (s: Sample) => `${s.st}|${s.d}|${s.h}`;
  const bMap = new Map(samplesB.map((s) => [id(s), s]));
  const rows = [...a.settingSituation].sort((x, y) => order(x.key.setting, SETTINGS) - order(y.key.setting, SETTINGS) || order(x.key.situation, SITUATIONS) - order(y.key.situation, SITUATIONS));
  for (const row of rows) {
    const other = b.settingSituation.find((x) => x.key.setting === row.key.setting && x.key.situation === row.key.situation);
    const A = row.scores.layers;
    const B = other?.scores.layers;
    if (!A || !B || row.n < 12) continue;
    const list = samplesA.filter((s) => st[s.st].setting === row.key.setting && s.situation === row.key.situation && bMap.has(id(s)));
    const paired = (l: Sample[]) => {
      let sa = 0;
      let sb = 0;
      let n = 0;
      for (const s of l) {
        const o = bMap.get(id(s))!;
        const ma = speedOf(s.pred.layers);
        const mb = speedOf(o.pred.layers);
        if (!Number.isFinite(ma) || !Number.isFinite(mb)) continue;
        sa += (ma - s.ff * KMH) ** 2;
        sb += (mb - s.ff * KMH) ** 2;
        n++;
      }
      return n ? Math.sqrt(sa / n) - Math.sqrt(sb / n) : NaN;
    };
    const c = bootstrapDays(list, paired, 300);
    const fold = (f: string) => paired(list.filter((s) => bundle.days[s.d].fold === f));
    out.push(
      `| ${row.key.setting} | ${row.key.situation} | ${row.n} | ${sign(A.bias)} | ${sign(B.bias)} | ${sign(Math.abs(A.bias) - Math.abs(B.bias))} | ${fmt(A.rmse)} | ${fmt(B.rmse)} | ${sign(A.rmse - B.rmse, 2)} [${sign(c[0], 2)} ; ${sign(c[1], 2)}] | ${sign(A.vrmse - B.vrmse, 2)} | ${A.dir != null && B.dir != null ? sign(A.dir - B.dir, 0) : '–'} | ${sign((A.hit - B.hit) * 100, 0)} pt | ${sign(fold('A'), 2)} | ${sign(fold('B'), 2)} |`,
    );
  }
  return out.join('\n');
}
