/**
 * Flight track of the game in IGC format (FAI flight recorder data format), so a flight
 * can be replayed in the usual tools. A simulated track has no security record (G) and
 * is marked as such in its headers.
 */
import { franceUtcOffset } from '@brises/model';

export interface Fix {
  /** French legal time, decimal hours. */
  hour: number;
  lon: number;
  lat: number;
  /** Altitude (m). */
  alt: number;
}

/** Keeps one fix per second of flight. */
export class TrackRecorder {
  fixes: Fix[] = [];
  private lastT = -Infinity;

  /** True when a new fix is due at game time t (s). */
  due(t: number): boolean {
    return t - this.lastT >= 1;
  }

  push(t: number, fix: Fix): void {
    this.lastT = t;
    this.fixes.push(fix);
  }

  clear(): void {
    this.fixes = [];
    this.lastT = -Infinity;
  }
}

const pad = (n: number, w: number) => String(Math.max(0, Math.round(n))).padStart(w, '0');

/** DDMMmmmN / DDDMMmmmE: degrees, minutes with three decimals. */
function coord(v: number, degDigits: number, pos: string, neg: string): string {
  const a = Math.abs(v);
  let deg = Math.floor(a);
  let milli = Math.round((a - deg) * 60000);
  if (milli >= 60000) {
    deg += 1;
    milli -= 60000;
  }
  return `${pad(deg, degDigits)}${pad(milli, 5)}${v < 0 ? neg : pos}`;
}

const alt5 = (m: number) => (m < 0 ? `-${pad(-m, 4)}` : pad(m, 5));

/**
 * The IGC file of a track. Times are UTC, from the legal time of the fixes and the French
 * offset of the date; a flight past midnight keeps counting the hours.
 */
export function toIgc(fixes: Fix[], meta: { year: number; month0: number; day: number; pilot: string; glider: string; site: string }): string {
  const offset = franceUtcOffset(meta.year, meta.month0, meta.day);
  const date = new Date(Date.UTC(meta.year, meta.month0, meta.day));
  const ddmmyy = `${pad(date.getUTCDate(), 2)}${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCFullYear() % 100, 2)}`;
  const clean = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
  const lines = [
    'AXBA001 Brises des Alpes',
    `HFDTEDATE:${ddmmyy},01`,
    `HFPLTPILOTINCHARGE:${clean(meta.pilot)}`,
    `HFGTYGLIDERTYPE:${clean(meta.glider)}`,
    'HFGIDGLIDERID:',
    'HFDTMGPSDATUM:WGS84',
    'HFFTYFRTYPE:Brises des Alpes,simulateur',
    'HFGPSRECEIVER:simulation',
    'HFPRSPRESSALTSENSOR:simulation',
    'HFALGALTGPS:GEO',
    'HFALPALTPRESSURE:ISA',
    `LXBASITE ${clean(meta.site)}`,
    'LXBASIMULATED FLIGHT, NOT A RECORDED FLIGHT',
  ];
  for (const f of fixes) {
    const s = Math.round((((f.hour - offset) % 24) + 24) % 24 * 3600) % 86400;
    const hms = `${pad(Math.floor(s / 3600), 2)}${pad(Math.floor(s / 60) % 60, 2)}${pad(s % 60, 2)}`;
    lines.push(`B${hms}${coord(f.lat, 2, 'N', 'S')}${coord(f.lon, 3, 'E', 'W')}A${alt5(f.alt)}${alt5(f.alt)}`);
  }
  return lines.join('\r\n') + '\r\n';
}
