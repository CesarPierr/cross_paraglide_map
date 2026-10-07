/**
 * Emagram-lite: environment temperature and dew point by altitude, the rising
 * thermal parcel, cloud base / thermal top, and wind arrows per level.
 */
import { estimateThermals, type PointForecast } from '@brises/shared';
import { compassFr } from '@brises/model';

const W = 300;
const H = 210;
const PAD = { l: 34, r: 74, t: 8, b: 20 };

export function ProfileChart({ f, elevation, month0 }: { f: PointForecast; elevation: number; month0: number }) {
  const prof = (f.profile ?? []).filter((p) => p.heightM >= elevation - 30).sort((a, b) => a.heightM - b.heightM);
  if (prof.length < 3 || f.temperature2m === undefined || f.dewpoint2m === undefined) return null;
  const est = estimateThermals(prof, { elevationM: elevation, temperature: f.temperature2m, dewpoint: f.dewpoint2m, cloudCover: f.cloudCover, month0 });
  const zMin = Math.floor(elevation / 500) * 500;
  const zMax = Math.min(6000, Math.max(prof[prof.length - 1].heightM, est.thermalTopM + 800));
  const temps = [f.temperature2m, f.dewpoint2m, ...prof.flatMap((p) => [p.temperature, p.dewpoint ?? p.temperature])];
  const tMin = Math.floor(Math.min(...temps) / 5) * 5 - 2;
  const tMax = Math.ceil(Math.max(...temps, f.temperature2m + 2) / 5) * 5;
  const x = (t: number) => PAD.l + ((t - tMin) / (tMax - tMin)) * (W - PAD.l - PAD.r);
  const y = (z: number) => H - PAD.b - ((z - zMin) / (zMax - zMin)) * (H - PAD.t - PAD.b);
  const env = [{ z: elevation, t: f.temperature2m }, ...prof.map((p) => ({ z: p.heightM, t: p.temperature }))];
  const dew = [{ z: elevation, t: f.dewpoint2m }, ...prof.filter((p) => p.dewpoint !== undefined).map((p) => ({ z: p.heightM, t: p.dewpoint! }))];
  const path = (pts: { z: number; t: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.z).toFixed(1)}`).join('');
  // Parcel: dry adiabat to the cloud base (or thermal top), then moist.
  const t0 = f.temperature2m + 1.5;
  const base = est.cloudBaseM ?? est.thermalTopM;
  const parcel = [
    { z: elevation, t: t0 },
    { z: base, t: t0 - ((base - elevation) / 1000) * 9.8 },
    ...(est.cloudBaseM ? [{ z: Math.min(zMax, base + 1500), t: t0 - ((base - elevation) / 1000) * 9.8 - 1.5 * 6 }] : []),
  ];
  const ticksZ: number[] = [];
  for (let z = Math.ceil(zMin / 1000) * 1000; z <= zMax; z += 1000) ticksZ.push(z);
  const quality = { nul: 'nul', faible: 'faible', moyen: 'moyen', bon: 'bon', fort: 'fort' }[est.quality];
  return (
    <figure className="profile">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Profil vertical : température, point de rosée et vent par altitude">
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} className="pf-bg" />
        {ticksZ.map((z) => (
          <g key={z}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(z)} y2={y(z)} className="pf-grid" />
            <text x={PAD.l - 4} y={y(z) + 3} className="pf-axis" textAnchor="end">
              {z / 1000}k
            </text>
          </g>
        ))}
        <rect x={PAD.l} y={y(elevation)} width={W - PAD.l - PAD.r} height={H - PAD.b - y(elevation)} className="pf-ground" />
        {est.depthM > 0 && <rect x={PAD.l} y={y(est.thermalTopM)} width={W - PAD.l - PAD.r} height={y(elevation) - y(est.thermalTopM)} className="pf-thermal" />}
        {est.cloudBaseM && <line x1={PAD.l} x2={W - PAD.r} y1={y(est.cloudBaseM)} y2={y(est.cloudBaseM)} className="pf-base" />}
        <path d={path(dew)} className="pf-dew" />
        <path d={path(env)} className="pf-temp" />
        <path d={path(parcel)} className="pf-parcel" />
        {prof.map((p) => {
          const to = (p.windFromDeg + 180) % 360;
          return (
            <g key={p.pressure} transform={`translate(${W - PAD.r + 14},${y(p.heightM)})`}>
              <g transform={`rotate(${to})`}>
                <line y1={5} y2={-5} className="pf-wind" />
                <path d="M0,-8 L3.5,-3 L-3.5,-3 Z" className="pf-wind-head" />
              </g>
              <text x={12} y={3} className="pf-wind-txt">
                {compassFr(p.windFromDeg)} {Math.round(p.windKmh)}
              </text>
            </g>
          );
        })}
        <text x={x(tMin) + 2} y={H - 5} className="pf-axis">
          {tMin}°
        </text>
        <text x={x(tMax) - 2} y={H - 5} className="pf-axis" textAnchor="end">
          {tMax}°
        </text>
      </svg>
      <figcaption>
        <span>
          <i className="sw temp" /> température
        </span>
        <span>
          <i className="sw dew" /> rosée
        </span>
        <span>
          <i className="sw parcel" /> bulle
        </span>
        <span>
          Thermiques <b>{quality}</b>
          {est.depthM > 0 ? ` · ≈${est.climb.toFixed(1)} m/s · ${est.cumulus ? 'base' : 'plafond'} ${Math.round(est.thermalTopM / 50) * 50} m` : ''}
        </span>
      </figcaption>
    </figure>
  );
}
