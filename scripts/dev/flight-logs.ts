/**
 * The players' flight logs (apps/web/src/game/flight-log.ts), read back from the API's
 * moderation endpoints and diagnosed: per flight the day, the options, the device, how it
 * went (climbs and what carried them, incidents, messages, errors, frame rate) and, for a
 * flight that ended badly, its last seconds. Anomalies are flagged: position jumps, the
 * pilot under the ground, a low frame rate, page errors, non-finite states.
 *
 *   npx tsx scripts/dev/flight-logs.ts                     # the 30 latest flights on dev-vm
 *   npx tsx scripts/dev/flight-logs.ts --limit 100 --takeoff hilaire --since 2026-10-01
 *   npx tsx scripts/dev/flight-logs.ts --id <uuid> [--json out.json] [--csv out.csv]
 *   npx tsx scripts/dev/flight-logs.ts --url http://localhost:8080   # local API, ADMIN_TOKEN from the environment
 *
 * On the VM the request runs inside the API's container with its own token: the token is
 * never printed nor passed on the command line.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { FLIGHT_LOG_COLUMNS, type FlightLogEvent } from '../../packages/shared/src/flight-log';

const args = process.argv.slice(2);
const opt = (k: string, d = '') => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const vm = opt('--vm', 'dev-vm');
const url = opt('--url');
const dir = opt('--dir', '~/brises-des-alpes');

interface Flight {
  id: string;
  createdAt: string;
  updatedAt: string;
  client: string;
  build: string;
  takeoffId: string;
  takeoffName: string;
  scenario: Record<string, number | string | boolean | null>;
  options: Record<string, number | string | boolean | null>;
  device: Record<string, number | string | boolean | null>;
  userAgent: string | null;
  ended: Record<string, number | string | boolean | null> | null;
  samples: number;
  events: number;
  rows?: number[][];
  log?: FlightLogEvent[];
}

async function get<T>(path: string): Promise<T> {
  if (url) {
    const r = await fetch(`${url.replace(/\/$/, '')}/api${path}`, { headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN ?? ''}` } });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return (await r.json()) as T;
  }
  if (!/^[\w./?=&%:-]+$/.test(path)) throw new Error(`chemin refusé : ${path}`);
  const inner = `wget -qO- --header "Authorization: Bearer $ADMIN_TOKEN" 'http://127.0.0.1:8080/api${path}'`;
  const out = execFileSync('ssh', [vm, `cd ${dir} && docker compose exec -T api sh -c ${JSON.stringify(inner)}`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return JSON.parse(out) as T;
}

const C = Object.fromEntries(FLIGHT_LOG_COLUMNS.map((c, i) => [c, i])) as Record<(typeof FLIGHT_LOG_COLUMNS)[number], number>;
const pct = (v: number[], q: number) => (v.length ? [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(v.length * q))] : NaN);
const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN);
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const mmss = (s: number) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`;

function header(f: Flight): string {
  const s = f.scenario;
  const o = f.options;
  const d = f.device;
  const day = `${String(s.hour ?? '').slice(0, 5)} h, mois ${Number(s.month0 ?? 0) + 1}, vent ${s.windKmh} km/h du ${Math.round(Number(s.windFrom))}°, instabilité ${s.instability}${s.randomWeather ? ' (aléatoire)' : ''}`;
  const end = f.ended ? `${f.ended.kind}${f.ended.reason ? ` (${f.ended.reason})` : ''}` : 'pas de fin reçue';
  return `${f.createdAt.slice(0, 16).replace('T', ' ')}  ${f.takeoffName}  [${f.id.slice(0, 8)} joueur ${f.client.slice(0, 6)} build ${f.build}]\n  ${day} · EN-${o.wing} ${o.mass} kg, départ ${o.start}, vue ${o.view}${o.school ? ', école' : ''}${o.challenge ? `, défi ${o.challenge}` : ''}${o.multi ? ', multijoueur' : ''} · écran ${d.w}×${d.h}${d.touch ? ' tactile' : ''} ${d.gpu ?? ''}\n  ${f.samples} lignes (${mmss((f.samples * 0.5) | 0)}), ${f.events} évènements, fin : ${end}`;
}

/** The diagnosis of one flight. */
function diagnose(f: Flight): string[] {
  const rows = f.rows ?? [];
  const log = f.log ?? [];
  const out: string[] = [];
  if (!rows.length) return ['  (aucune ligne)'];
  const air = rows.filter((r) => r[C.phase] === 0);
  const z0 = rows[0][C.z];
  const zMax = Math.max(...rows.map((r) => r[C.z]));
  // Best mean climb over 30 s, and what carried the pilot while climbing.
  let best = -Infinity;
  for (let i = 0, j = 0; i < air.length; i++) {
    while (air[i][C.t] - air[j][C.t] > 30) j++;
    if (air[i][C.t] - air[j][C.t] >= 25) best = Math.max(best, (air[i][C.z] - air[j][C.z]) / (air[i][C.t] - air[j][C.t]));
  }
  const climbing = air.filter((r) => r[C.vz] > 0.5);
  const part = (k: keyof typeof C) => f1(mean(climbing.map((r) => r[C[k]])));
  out.push(`  vol : ${mmss(air.length * 0.5)} en l'air, altitude max ${Math.round(zMax)} m (${zMax - z0 >= 0 ? '+' : ''}${Math.round(zMax - z0)} m / départ), meilleure montée sur 30 s ${f1(best)} m/s, ${Math.round((100 * climbing.length) / Math.max(1, air.length))} % du temps à monter`);
  if (climbing.length) out.push(`  quand ça monte (> 0,5 m/s) : air ${part('airW')} m/s = relief ${part('relief')} + brise ${part('anabatic')} / panache ${part('plume')} + masse d'air ${part('thermal')} + rafales ${part('gust')} ; σw ${part('sigmaW')}`);
  const fps = rows.map((r) => r[C.fps]).filter((v) => v > 0);
  const kinds = new Map<string, number>();
  for (const e of log) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
  const incidents = [...kinds].filter(([k]) => !['message', 'end', 'view', 'liftoff'].includes(k));
  out.push(`  images/s médiane ${f1(pct(fps, 0.5))}, 5 % ${f1(pct(fps, 0.05))} · incidents : ${incidents.length ? incidents.map(([k, n]) => `${k} ×${n}`).join(', ') : 'aucun'} · vues : ${(kinds.get('view') ?? 0) + 1}`);
  // Anomalies.
  const flags: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const dt = rows[i][C.t] - rows[i - 1][C.t];
    const d = Math.hypot(rows[i][C.x] - rows[i - 1][C.x], rows[i][C.y] - rows[i - 1][C.y], rows[i][C.z] - rows[i - 1][C.z]);
    if (dt > 0 && d / dt > 60) flags.push(`saut de ${Math.round(d)} m à t=${rows[i][C.t]} s`);
    if (rows[i][C.phase] === 0 && rows[i][C.agl] < -2) flags.push(`sous le sol de ${f1(-rows[i][C.agl])} m à t=${rows[i][C.t]} s`);
  }
  if (pct(fps, 0.5) < 25) flags.push(`images/s faibles (médiane ${f1(pct(fps, 0.5))})`);
  for (const e of log.filter((e) => e.kind === 'error')) flags.push(`erreur t=${e.t} s : ${e.text}`);
  if (flags.length) out.push(`  ⚠ ${flags.slice(0, 12).join('\n  ⚠ ')}${flags.length > 12 ? `\n  ⚠ … ${flags.length - 12} de plus` : ''}`);
  // Messages shown, in order (repeats counted).
  const msgs: [string, number, number][] = [];
  for (const e of log.filter((e) => e.kind === 'message')) {
    const last = msgs[msgs.length - 1];
    if (last && last[0] === e.text) last[2]++;
    else msgs.push([e.text ?? '', e.t, 1]);
  }
  if (msgs.length) out.push(`  messages : ${msgs.slice(-8).map(([m, t, n]) => `[${Math.round(t)} s] ${m}${n > 1 ? ` ×${n}` : ''}`).join(' · ')}`);
  // The last seconds of a flight that ended badly.
  const k = f.ended?.kind;
  if (k === 'crash' || k === 'hard' || k === 'launch') {
    const tEnd = rows[rows.length - 1][C.t];
    out.push(`  dernières secondes (${k}${f.ended?.reason ? ` : ${f.ended.reason}` : ''}, chute ${f.ended?.vz ?? '?'} m/s, sol ${f.ended?.groundKmh ?? '?'} km/h) :`);
    out.push('     t   sol   vz  vitesse incl. tang. freins G/D fermeture  air = relief+brise/panache+masse+rafale  vue img/s');
    for (const r of rows.filter((r) => r[C.t] >= tEnd - 10)) {
      out.push(
        `   ${f1(r[C.t] - tEnd).padStart(5)} ${f1(r[C.agl]).padStart(5)} ${f1(r[C.vz]).padStart(5)} ${f1(r[C.airspeed] * 3.6).padStart(5)} km/h ${f1(r[C.bank]).padStart(5)}° ${f1(r[C.pitch]).padStart(5)}° ${r[C.brakeL].toFixed(2)}/${r[C.brakeR].toFixed(2)} ${f1(r[C.collapse] + r[C.frontal]).padStart(5)}      ${f1(r[C.airW]).padStart(5)} = ${f1(r[C.relief])}+${f1(Math.max(r[C.anabatic], r[C.plume]))}+${f1(r[C.thermal])}+${f1(r[C.gust])}  ${r[C.view] ? '3e' : '1re'} ${Math.round(r[C.fps])}`,
      );
    }
  }
  return out;
}

const id = opt('--id');
if (id) {
  const f = await get<Flight>(`/admin/game/flights/${id}`);
  console.log(header(f));
  for (const l of diagnose(f)) console.log(l);
  const json = opt('--json');
  if (json) writeFileSync(json, JSON.stringify(f));
  const csv = opt('--csv');
  if (csv) writeFileSync(csv, [FLIGHT_LOG_COLUMNS.join(','), ...(f.rows ?? []).map((r) => r.join(','))].join('\n'));
} else {
  const q = new URLSearchParams({ limit: opt('--limit', '30') });
  for (const k of ['client', 'takeoff', 'since']) if (opt(`--${k}`)) q.set(k, opt(`--${k}`));
  const list = await get<Flight[]>(`/admin/game/flights?${q}`);
  console.log(`${list.length} vols`);
  const details = Number(opt('--details', '10'));
  for (const [i, f] of list.entries()) {
    console.log(`\n${header(f)}`);
    if (i < details && f.samples > 0) for (const l of diagnose(await get<Flight>(`/admin/game/flights/${f.id}`))) console.log(l);
  }
}
