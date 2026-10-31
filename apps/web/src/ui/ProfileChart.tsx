/**
 * Emagram-lite: environment temperature and dew point by altitude, the rising
 * thermal parcel, cloud base / thermal top, and wind arrows per level.
 */
import { estimateThermals, type PointForecast } from '@brises/shared';
import { airLayers, compassFr, convectiveLayer, packed, packedTemp, packedWind, RULES, windFromDeg, type AirColumn } from '@brises/model';
import { fmtAlt } from './air-brief';

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

const AW = 300;
const AH = 196;
const AP = { l: 30, r: 92, t: 8, b: 16 };

const toneOf = (lapse: number) => (lapse <= RULES.air.inversionLapse ? 'inv' : lapse < RULES.air.stableLapse ? 'stable' : lapse >= 8 ? 'unstable' : 'std');

/**
 * Compact vertical profile of the simulated air mass (air.ts): temperature by altitude
 * coloured by the stability of each layer, stable layers and inversions as bands, the
 * convective layer over the place shaded up to its ceiling, the cumulus base, the wind
 * by level, and the altitude read by the map.
 */
export function AirColumnChart({ air, groundM, readZ }: { air: AirColumn; groundM: number; readZ?: number }) {
  const p = packed(air);
  const cl = convectiveLayer(air, groundM);
  if (!p || !cl) return null;
  const zMin = Math.max(0, Math.floor((groundM - 250) / 500) * 500);
  const zMax = Math.min(6000, Math.max(4500, Math.ceil((cl.ceiling + 700) / 500) * 500));
  const pts: number[] = [zMin];
  for (let i = 0; i < p.n; i++) if (p.z[i] > zMin && p.z[i] < zMax) pts.push(p.z[i]);
  pts.push(zMax);
  const temps = pts.map((z) => packedTemp(p, z));
  const tGround = packedTemp(p, groundM) + RULES.air.parcelExcess;
  const tMin = Math.floor(Math.min(...temps) / 5) * 5;
  const tMax = Math.ceil(Math.max(...temps, tGround) / 5) * 5;
  const x = (t: number) => AP.l + ((t - tMin) / Math.max(1, tMax - tMin)) * (AW - AP.l - AP.r);
  const y = (z: number) => AH - AP.b - ((z - zMin) / (zMax - zMin)) * (AH - AP.t - AP.b);
  const xr = AW - AP.r;
  const ticks: number[] = [];
  for (let z = Math.ceil(zMin / 1000) * 1000; z <= zMax; z += 1000) ticks.push(z);
  const layers = airLayers(air).filter((L) => L.top > zMin && L.base < zMax && L.lapse < RULES.air.stableLapse);
  // Wind every 500 m (1000 m on a tall chart), read in the column like the model does.
  const wStep = zMax - zMin > 4000 ? 1000 : 500;
  const windZ: number[] = [];
  for (let z = Math.ceil((Math.max(zMin, groundM) + 100) / wStep) * wStep; z < zMax; z += wStep) windZ.push(z);
  const dryEnd = Math.min(cl.dryTop, zMax);
  const label = cl.cloudBase !== null ? `base ${fmtAlt(cl.cloudBase)}` : cl.depth < 150 ? 'pas de thermique' : `plafond ${fmtAlt(cl.ceiling)}`;
  return (
    <figure className="air-chart">
      <svg viewBox={`0 0 ${AW} ${AH}`} role="img" aria-label={`Profil de l’air : ${label} m, couches stables et vent par altitude`}>
        <rect x={AP.l} y={AP.t} width={xr - AP.l} height={AH - AP.t - AP.b} className="ac-bg" />
        {layers.map((L) => (
          <rect key={L.base} x={AP.l} y={y(Math.min(L.top, zMax))} width={xr - AP.l} height={y(Math.max(L.base, zMin)) - y(Math.min(L.top, zMax))} className={`ac-band ${toneOf(L.lapse)}`} />
        ))}
        {cl.depth > 0 && <rect x={AP.l} y={y(Math.min(cl.ceiling, zMax))} width={xr - AP.l} height={y(groundM) - y(Math.min(cl.ceiling, zMax))} className="ac-conv" />}
        {ticks.map((z) => (
          <g key={z}>
            <line x1={AP.l} x2={xr} y1={y(z)} y2={y(z)} className="ac-grid" />
            <text x={AP.l - 4} y={y(z) + 3} className="ac-axis" textAnchor="end">
              {z / 1000}k
            </text>
          </g>
        ))}
        <rect x={AP.l} y={y(groundM)} width={xr - AP.l} height={AH - AP.b - y(groundM)} className="ac-ground" />
        {pts.slice(1).map((z, i) => {
          const z0 = pts[i];
          const lapse = ((packedTemp(p, z0) - packedTemp(p, z)) / (z - z0)) * 1000;
          return <line key={z} x1={x(packedTemp(p, z0))} y1={y(z0)} x2={x(packedTemp(p, z))} y2={y(z)} className={`ac-temp ${toneOf(lapse)}`} />;
        })}
        <line x1={x(tGround)} y1={y(groundM)} x2={x(tGround - (RULES.air.dryLapse * (dryEnd - groundM)) / 1000)} y2={y(dryEnd)} className="ac-parcel" />
        {cl.depth > 0 && cl.ceiling < zMax && (
          <g>
            <line x1={AP.l} x2={xr} y1={y(cl.ceiling)} y2={y(cl.ceiling)} className={cl.cloudBase !== null ? 'ac-base' : 'ac-top'} />
            <text x={xr - 3} y={y(cl.ceiling) - 3} className="ac-label" textAnchor="end">
              {cl.cloudBase !== null ? '☁ ' : ''}
              {label} m
            </text>
          </g>
        )}
        {readZ !== undefined && readZ > zMin && readZ < zMax && (
          <g className="ac-read">
            <line x1={AP.l} x2={xr} y1={y(readZ)} y2={y(readZ)} />
            <path d={`M${AP.l},${y(readZ)} l-6,-4 v8 z`} />
          </g>
        )}
        {windZ.map((z) => {
          const [u, v] = packedWind(p, z);
          const kmh = Math.hypot(u, v) * 3.6;
          const from = windFromDeg(u, v);
          return (
            <g key={z} transform={`translate(${xr + 12},${y(z)})`}>
              <g transform={`rotate(${(from + 180) % 360})`} opacity={kmh < 2 ? 0.3 : 1}>
                <line y1={5} y2={-5} className="pf-wind" />
                <path d="M0,-8 L3.5,-3 L-3.5,-3 Z" className="pf-wind-head" />
              </g>
              <text x={11} y={3} className="pf-wind-txt">
                {kmh < 2 ? 'calme' : `${compassFr(from)} ${Math.round(kmh)}`}
              </text>
            </g>
          );
        })}
        <text x={AP.l + 2} y={AH - 4} className="ac-axis">
          {tMin}°
        </text>
        <text x={xr - 2} y={AH - 4} className="ac-axis" textAnchor="end">
          {tMax}°
        </text>
      </svg>
      <figcaption>
        <span>
          <i className="sw conv" /> couche convective
        </span>
        <span>
          <i className="sw stable" /> couche stable
        </span>
        <span>
          <i className="sw inv" /> inversion
        </span>
        <span>
          <i className="sw read" /> lecture
        </span>
      </figcaption>
    </figure>
  );
}
