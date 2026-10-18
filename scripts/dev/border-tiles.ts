/**
 * The z12 tiles that the border crosses in IGN's orthophotos: `BORDER_Z12` of
 * apps/web/public/tiles-border.js, which tells the service worker which tiles can hold the white fill
 * of the foreign side (see that file).
 *
 * From z13 IGN answers the foreign land with a blank white tile (always the same size, 1651 bytes) or
 * with nothing, and the tiles across the border hold France in imagery and the rest in that white.
 * The script finds the frontier of the z13 tiles that hold imagery (F) against those that do not (X),
 * then lists the z12 tiles that hold an F tile within `--depth` tiles (8-neighbourhood) of an X tile:
 * the fill of the border follows the footprint of the mosaic in steps, a notch of it may reach a
 * tile or two into France without any tile of its own being blank (measured: none at three tiles, over
 * the whole border from Geneva to Menton).
 *
 * The frontier is traced from a coarse grid of seeds, bisecting where two seeds differ, then followed
 * through the 8-neighbours of every frontier tile until none is left unexplored. Only HEAD requests
 * are made (a status and a length, no image), three at a time, paused when IGN says too many. The
 * answers are kept in .cache/border-tiles.jsonl: a second run asks nothing (delete the file to ask again,
 * when IGN has renewed its imagery). A first run is about 1500 requests for the game's area. The frontier
 * of the seeds' area is one chain (the border and, at sea, the edge of the coastal imagery); the summary
 * says how many pieces it has and where they end.
 *
 *   npx tsx scripts/dev/border-tiles.ts [--write] [--margin 0.2] [--bbox w,s,e,n] [--depth 2] [--par 3] [--gap 120] [--cache file]
 *
 * (From the root of the repository.)
 *
 * --write rewrites the generated block of tiles-border.js; without it only the summary is printed.
 * --margin: degrees added around the game's grid (a pilot at its edge sees past it). --seed lon,lat adds a
 * seed (an enclave the coarse grid could miss; Monaco is one, seeded by default).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEM_BBOX } from '../../packages/model/src/grid-config';

const Z = 13;
/** Size of the blank white tile (the z13 tiles are all 256 x 256). */
const BLANK_BYTES = 1651;
const WMTS = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image%2Fjpeg&TILEMATRIXSET=PM';
const TARGET = 'apps/web/public/tiles-border.js';
const CACHE_DEFAULT = '.cache/border-tiles.jsonl';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const CACHE = arg('cache') ?? CACHE_DEFAULT;
const depth = Number(arg('depth') ?? 2);
const parallel = Number(arg('par') ?? 3);
const gapMs = Number(arg('gap') ?? 120);
const margin = Number(arg('margin') ?? 0.2);
const write = process.argv.includes('--write');
const [west, south, east, north] = (arg('bbox')?.split(',').map(Number) as [number, number, number, number] | undefined) ?? [DEM_BBOX[0] - margin, DEM_BBOX[1] - margin, DEM_BBOX[2] + margin, DEM_BBOX[3] + margin];

const tileOf = (lon: number, lat: number, z: number) => {
  const n = 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: Math.floor(((lon + 180) / 360) * n), y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n) };
};
const lonLatOf = (x: number, y: number, z: number) => {
  const n = 2 ** z;
  return { lon: (x / n) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI };
};
const nw = tileOf(west, north, Z);
const se = tileOf(east, south, Z);
const inBox = (x: number, y: number) => x >= nw.x && x <= se.x && y >= nw.y && y <= se.y;

// ---- HEAD probes -------------------------------------------------------------------------------

/** F: the tile holds imagery (possibly only part of it); X: missing, or the blank white tile. */
type Kind = 'F' | 'X';
const kinds = new Map<string, Kind>();
if (existsSync(CACHE))
  for (const line of readFileSync(CACHE, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const o = JSON.parse(line) as { x: number; y: number; s: number; l: number };
      kinds.set(`${o.x},${o.y}`, o.s === 200 && o.l !== BLANK_BYTES ? 'F' : 'X');
    } catch {
      /* a line cut short by an interrupted run */
    }
  }
let requests = 0;
let pausedUntil = 0;
let lastStart = 0;
let active = 0;
const waiting: (() => void)[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function probe(x: number, y: number): Promise<{ s: number; l: number }> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    await sleep(Math.max(0, pausedUntil - Date.now(), lastStart + gapMs - Date.now()));
    lastStart = Date.now();
    requests++;
    let res: Response;
    try {
      res = await fetch(`${WMTS}&TILEMATRIX=${Z}&TILEROW=${y}&TILECOL=${x}`, { method: 'HEAD' });
    } catch {
      await sleep(1000 * attempt);
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const wait = Number(res.headers.get('retry-after')) || 10 * attempt;
      console.error(`  IGN answers ${res.status}: pausing ${wait} s`);
      pausedUntil = Date.now() + wait * 1000;
      continue;
    }
    // IGN answers a HEAD for a missing tile with 400 (a GET says 404, "No data found").
    if (res.status === 400 || res.status === 404) return { s: 404, l: 0 };
    if (res.status === 200) {
      const l = Number(res.headers.get('content-length'));
      if (l > 0) return { s: 200, l };
      // No length: fetch the tile itself.
      const get = await fetch(`${WMTS}&TILEMATRIX=${Z}&TILEROW=${y}&TILECOL=${x}`);
      return get.status === 200 ? { s: 200, l: (await get.arrayBuffer()).byteLength } : { s: 404, l: 0 };
    }
    await sleep(1000 * attempt);
  }
  throw new Error(`tile ${Z}/${x}/${y}: IGN does not answer`);
}

async function kindOf(x: number, y: number): Promise<Kind> {
  const k = `${x},${y}`;
  const known = kinds.get(k);
  if (known) return known;
  while (active >= parallel) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    const again = kinds.get(k);
    if (again) return again;
    const o = await probe(x, y);
    mkdirSync(dirname(CACHE), { recursive: true });
    appendFileSync(CACHE, `${JSON.stringify({ x, y, ...o })}\n`);
    const kind: Kind = o.s === 200 && o.l !== BLANK_BYTES ? 'F' : 'X';
    kinds.set(k, kind);
    return kind;
  } finally {
    active--;
    waiting.shift()?.();
  }
}

// ---- The frontier -----------------------------------------------------------------------------

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const known = (x: number, y: number) => kinds.get(`${x},${y}`);
/** A tile whose class differs from a known neighbour's. */
const onFrontier = (x: number, y: number) => {
  const k = known(x, y);
  return k !== undefined && N8.some(([dx, dy]) => known(x + dx, y + dy) !== undefined && known(x + dx, y + dy) !== k);
};

console.log(`z${Z} tiles x ${nw.x}..${se.x}, y ${nw.y}..${se.y} (${(se.x - nw.x + 1) * (se.y - nw.y + 1)}), ${CACHE}: ${kinds.size} answers kept`);

// Seeds on a coarse grid, and where two neighbouring seeds differ the frontier between them, by bisection.
const STRIDE = 8;
const gx: number[] = [];
const gy: number[] = [];
for (let x = nw.x; x <= se.x; x += STRIDE) gx.push(x);
for (let y = nw.y; y <= se.y; y += STRIDE) gy.push(y);
if (gx.at(-1) !== se.x) gx.push(se.x);
if (gy.at(-1) !== se.y) gy.push(se.y);
await Promise.all(gy.flatMap((y) => gx.map((x) => kindOf(x, y))));
const queue: [number, number][] = [];
let transitions = 0;
async function bisect(a: [number, number], b: [number, number]) {
  const ka = await kindOf(...a);
  while (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 1) {
    const mid: [number, number] = [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)];
    if ((await kindOf(...mid)) === ka) a = mid;
    else b = mid;
  }
  transitions++;
  queue.push(a, b);
}
for (let j = 0; j < gy.length; j++)
  for (let i = 0; i < gx.length; i++) {
    const k = known(gx[i], gy[j]);
    if (i + 1 < gx.length && known(gx[i + 1], gy[j]) !== k) await bisect([gx[i], gy[j]], [gx[i + 1], gy[j]]);
    if (j + 1 < gy.length && known(gx[i], gy[j + 1]) !== k) await bisect([gx[i], gy[j]], [gx[i], gy[j + 1]]);
  }
// Enclaves a coarse grid can miss: a seed with a neighbour of the other class starts a frontier of its own.
const extra = (process.argv.flatMap((a, i) => (a === '--seed' ? [process.argv[i + 1]] : [])) as string[]).concat('7.42,43.74');
for (const s of extra) {
  const [lon, lat] = s.split(',').map(Number);
  const t = tileOf(lon, lat, Z);
  if (inBox(t.x, t.y)) queue.push([t.x, t.y]);
}
console.log(`seeds ${gx.length} x ${gy.length}, ${transitions} crossings of the frontier found between them, ${requests} requests`);

// Follow the frontier: every tile of it gets its 8 neighbours classified, and those on the frontier are followed in turn.
const expanded = new Set<string>();
async function expand(x: number, y: number) {
  const k = `${x},${y}`;
  if (expanded.has(k)) return;
  expanded.add(k);
  await Promise.all(N8.filter(([dx, dy]) => inBox(x + dx, y + dy)).map(([dx, dy]) => kindOf(x + dx, y + dy)));
  for (const [dx, dy] of N8) if (inBox(x + dx, y + dy) && !expanded.has(`${x + dx},${y + dy}`) && onFrontier(x + dx, y + dy)) queue.push([x + dx, y + dy]);
}
for (;;) {
  while (queue.length) await Promise.all(queue.splice(0, 6).map(([x, y]) => expand(x, y)));
  // Closure: no tile of the frontier is left unexplored.
  for (const k of kinds.keys()) {
    const [x, y] = k.split(',').map(Number);
    if (inBox(x, y) && !expanded.has(k) && onFrontier(x, y)) queue.push([x, y]);
  }
  if (!queue.length) break;
}
const frontier = [...expanded].filter((k) => onFrontier(...(k.split(',').map(Number) as [number, number])));

// ---- The zone: tiles with imagery within `depth` tiles of a missing one --------------------------

const ring = new Map<string, number>(); // F tile -> its distance (in tiles) to the nearest X tile
let last: string[] = [];
for (const k of frontier) {
  const [x, y] = k.split(',').map(Number);
  if (known(x, y) === 'F' && inBox(x, y)) {
    ring.set(k, 1);
    last.push(k);
  }
}
for (let d = 2; d <= depth; d++) {
  const next: string[] = [];
  for (const k of last) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of N8) {
      const nk = `${x + dx},${y + dy}`;
      if (!inBox(x + dx, y + dy) || ring.has(nk) || (await kindOf(x + dx, y + dy)) !== 'F') continue;
      ring.set(nk, d);
      next.push(nk);
    }
  }
  last = next;
}
const rows = new Map<number, Set<number>>();
for (const k of ring.keys()) {
  const [x, y] = k.split(',').map(Number);
  const set = rows.get(y >> 1) ?? new Set<number>();
  set.add(x >> 1);
  rows.set(y >> 1, set);
}
const z12 = [...rows.values()].reduce((n, r) => n + r.size, 0);

// ---- Summary ------------------------------------------------------------------------------------

// The pieces of the frontier (8-connected): the border from the Jura to the sea should be one.
const seen = new Set<string>();
const onChain = new Set(frontier);
const pieces: { tiles: number; lon: [number, number]; lat: [number, number] }[] = [];
for (const k of frontier) {
  if (seen.has(k)) continue;
  const stack = [k];
  seen.add(k);
  const piece = { tiles: 0, lon: [180, -180] as [number, number], lat: [90, -90] as [number, number] };
  while (stack.length) {
    const [x, y] = stack.pop()!.split(',').map(Number);
    piece.tiles++;
    const p = lonLatOf(x + 0.5, y + 0.5, Z);
    piece.lon = [Math.min(piece.lon[0], p.lon), Math.max(piece.lon[1], p.lon)];
    piece.lat = [Math.min(piece.lat[0], p.lat), Math.max(piece.lat[1], p.lat)];
    for (const [dx, dy] of N8) {
      const nk = `${x + dx},${y + dy}`;
      if (!seen.has(nk) && onChain.has(nk)) {
        seen.add(nk);
        stack.push(nk);
      }
    }
  }
  pieces.push(piece);
}
const f = (p: [number, number]) => `${p[0].toFixed(2)}..${p[1].toFixed(2)}`;
console.log(`frontier: ${frontier.length} z${Z} tiles in ${pieces.length} piece(s)`);
for (const p of pieces) console.log(`  ${p.tiles} tiles, lon ${f(p.lon)}, lat ${f(p.lat)}`);
console.log(`zone: ${ring.size} tiles with imagery within ${depth} of a missing one (${[...new Set(ring.values())].sort().map((d) => `${[...ring.values()].filter((v) => v === d).length} at ${d}`).join(', ')}) in ${z12} z12 tiles`);
console.log(`${requests} requests`);

// The block sits inside the file's function: every line but the first is indented by two spaces.
const block = [
  '/* BEGIN GENERATED: BORDER_Z12 (scripts/dev/border-tiles.ts) */',
  `// z12 tiles ({y: [x...]}) holding a z13 tile with imagery within ${depth} tiles of one without: ${z12} tiles around a frontier of ${frontier.length} z13 tiles,`,
  `// in ${west.toFixed(2)}, ${south.toFixed(2)} to ${east.toFixed(2)}, ${north.toFixed(2)} (west, south, east, north).`,
  'const BORDER_Z12 = {',
  ...[...rows.keys()].sort((a, b) => a - b).map((y) => `  ${y}: [${[...rows.get(y)!].sort((a, b) => a - b).join(', ')}],`),
  '};',
  '/* END GENERATED */',
].join('\n  ');
if (write) {
  const text = readFileSync(TARGET, 'utf8');
  const a = text.indexOf('/* BEGIN GENERATED: BORDER_Z12');
  const b = text.indexOf('/* END GENERATED */');
  if (a < 0 || b < a) throw new Error(`${TARGET}: the generated block is not there`);
  writeFileSync(TARGET, text.slice(0, a) + block + text.slice(b + '/* END GENERATED */'.length));
  console.log(`${TARGET} written`);
}
