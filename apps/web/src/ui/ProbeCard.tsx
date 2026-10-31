import type { PointForecast } from '@brises/shared';
import { compassFr, describeVector, noonElevation, thermalSeasonFactor } from '@brises/model';
import { useState } from 'react';
import { useApp, useRuntime } from '../state/store';
import { getController, getDataClient } from './controller-ref';
import { startDraft } from './Feedback';
import { fmtHour } from './format';
import { airAtAltitude, fmtAlt } from './air-brief';
import { stabilityLabel } from './Forecast';
import { NearbySources } from './Nearby';
import { ProfileChart } from './ProfileChart';
import { IconClose, IconPlus, IconSun } from './icons';
import { showSheet } from './mobile';

/** Opens the documented hazard (its text and sources). */
function openDocumented(id: string) {
  const d = getController()?.describe(`atlas:${id}`);
  if (!d) return;
  useRuntime.getState().set({ feature: d });
  showSheet();
}

function Arrow({ v, size = 18 }: { v: [number, number]; size?: number }) {
  const d = describeVector(v);
  const to = (d.fromDeg + 180) % 360;
  return (
    <svg className="mini-arrow" width={size} height={size} viewBox="-10 -10 20 20" aria-hidden style={{ opacity: d.speedKmh < 1 ? 0.25 : 1 }}>
      <g transform={`rotate(${to})`}>
        <line x1="0" y1="6" x2="0" y2="-5" />
        <path d="M0,-8 L4,-3 L-4,-3 Z" />
      </g>
    </svg>
  );
}

function Row({ label, v, note }: { label: string; v: [number, number]; note?: string }) {
  const d = describeVector(v);
  return (
    <div className="probe-row">
      <Arrow v={v} />
      <span className="probe-label" title={label}>
        {label}
      </span>
      <span className="probe-val">{d.speedKmh < 1 ? '—' : `${d.from} ${Math.round(d.speedKmh)}`}</span>
      {note && <span className="probe-note">{note}</span>}
    </div>
  );
}

/** Soaring forecast at the probed point for the simulated hour (today or the next days). */
function PointForecastBlock({ lon, lat }: { lon: number; lat: number }) {
  const hour = useApp((s) => s.hour);
  const [state, setState] = useState<{ key: string; hours?: PointForecast[]; elevation?: number; error?: string } | null>(null);
  const month0 = useApp((s) => s.month0);
  const key = `${lon.toFixed(2)},${lat.toFixed(2)}`;
  const load = async () => {
    setState({ key });
    try {
      const w = getDataClient()?.weather();
      if (!w?.pointForecast) throw new Error('aucune source');
      const r = await w.pointForecast(lat, lon);
      setState({ key, hours: r.hours, elevation: r.elevation });
    } catch (e) {
      setState({ key, error: e instanceof Error ? e.message : 'indisponible' });
    }
  };
  if (!state || state.key !== key)
    return (
      <button className="btn ghost small" onClick={() => void load()}>
        <IconSun size={15} /> Prévision du jour ici (Open‑Meteo)
      </button>
    );
  if (state.error) return <p className="muted small">Prévision indisponible ({state.error}).</p>;
  if (!state.hours) return <p className="muted small">Chargement de la prévision…</p>;
  const today = new Date().toISOString().slice(0, 10);
  const h = state.hours.find((x) => x.time.startsWith(today) && x.hour === Math.round(hour)) ?? state.hours[0];
  const apply = () => {
    if (h.synoptic) useApp.getState().set({ synopticFrom: h.synoptic.fromDeg, synopticKmh: h.synoptic.speedKmh, month0: Number(h.time.slice(5, 7)) - 1, day: Number(h.time.slice(8, 10)) });
  };
  return (
    <div className="forecast">
      <p className="forecast-title">
        Prévision AROME {h.time.slice(8, 10)}/{h.time.slice(5, 7)} à {fmtHour(h.hour)}
      </p>
      <div className="forecast-grid">
        <div>
          <span>Plafond estimé</span>
          <b>{h.cloudBaseM ? `${Math.round(h.cloudBaseM / 50) * 50} m` : '—'}</b>
        </div>
        <div>
          <span title="Épaisseur de la couche convective au-dessus du sol (ECMWF IFS)">Couche limite</span>
          <b>{h.boundaryLayerM ? `${Math.round(h.boundaryLayerM / 50) * 50} m sol` : '—'}</b>
        </div>
        <div>
          <span>CAPE</span>
          <b>{h.cape !== undefined ? `${Math.round(h.cape)} J/kg` : '—'}</b>
        </div>
        <div>
          <span title="Altitude de l’isotherme 0 °C (ECMWF IFS)">Isotherme 0°</span>
          <b>{h.freezingLevelM ? `${Math.round(h.freezingLevelM / 100) * 100} m` : '—'}</b>
        </div>
        <div>
          <span title="Moyenne vectorielle 850/700 hPa (Météo-France)">Vent crêtes</span>
          <b>{h.synoptic ? `${compassFr(h.synoptic.fromDeg)} ${h.synoptic.speedKmh} km/h` : '—'}</b>
        </div>
      </div>
      <ProfileChart f={h} elevation={state.elevation ?? 0} month0={month0} />
      {h.synoptic && (
        <button className="link-btn" onClick={apply}>
          Simuler avec ce vent
        </button>
      )}
      <p className="attrib" dangerouslySetInnerHTML={{ __html: getDataClient()?.weather().attribution ?? '' }} />
    </div>
  );
}

const fmtNum = (v: number) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');

/** The layered air at the probed altitude: wind of the air mass, layer, ceiling, inversion. */
function AirHere({ elevation, heightAgl }: { elevation: number; heightAgl: number }) {
  const air = useApp((s) => s.air);
  const z = elevation + Math.max(heightAgl, 5);
  if (!air) return <p className="probe-air muted small">Journée type : le même vent météo à toutes les altitudes, pas de plafond imposé.</p>;
  const a = airAtAltitude(air, z, elevation);
  if (!a) return null;
  const d = Math.round(Math.abs(a.toCeiling) / 50) * 50;
  return (
    <section className="probe-air" aria-label="L’air à cette altitude">
      <p className="probe-air-title">L’air à {fmtAlt(z)} m</p>
      <div className="forecast-grid">
        <div>
          <span title="Vent de la masse d’air à cette altitude, avant les effets du relief">Vent de l’air</span>
          <b>{a.wind.kmh < 2 ? 'calme' : `${compassFr(a.wind.fromDeg)} ${Math.round(a.wind.kmh)} km/h`}</b>
        </div>
        <div>
          <span title="Gradient de température de la couche où vous êtes">Couche</span>
          <b>
            {fmtNum(a.lapse)} °C/km · {a.layer}
          </b>
        </div>
        <div>
          <span>{a.cloudBase !== null ? 'Base des cumulus' : 'Plafond thermique'}</span>
          <b>
            {fmtAlt(a.ceiling)} m · {a.toCeiling >= 0 ? `${d} m au-dessus de vous` : `${d} m sous vous`}
          </b>
        </div>
        <div>
          <span>Inversion</span>
          <b>{a.inversion !== null ? `${fmtAlt(a.inversion)} m · ${Math.round((a.inversion - z) / 50) * 50} m au-dessus` : 'aucune sous 4 500 m'}</b>
        </div>
      </div>
    </section>
  );
}

/** Airspaces above the probed point (only when an airspace family is shown). */
function AirspacesHere({ lon, lat }: { lon: number; lat: number }) {
  useApp((s) => s.layers.airspace || s.layers.airspaceProtect || s.layers.airspaceActivity);
  const zones = getController()?.airspacesAt(lon, lat) ?? [];
  if (!zones.length) return null;
  return (
    <section className="nearby">
      <p className="nearby-title">Espaces aériens au-dessus de ce point</p>
      <ul>
        {zones.slice(0, 5).map((z) => (
          <li key={z.id}>
            <button
              className="nearby-item"
              onClick={() => {
                const d = getController()?.describe(`airspace:${z.id}`);
                if (d) useRuntime.getState().set({ feature: d });
              }}
            >
              <span className="nearby-name">{z.name}</span>
              <span className="nearby-km">
                {z.floor.replace(/ \(.*\)/, '')} → {z.ceiling.replace(/ \(.*\)/, '')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Why the thermal is what it is here, in the model's terms (field.ts), or null. */
function thermalReasons(
  c: { thermal: number; insolation: number; coldPool: number; onset: number; restitution: boolean; lee: number; ceilingM: number; elevation: number; heightAgl: number },
  s: { synopticKmh: number; lapseRate: number | null; month0: number; day: number },
): string[] {
  const out: string[] = [];
  if (Number.isFinite(c.ceilingM) && c.elevation + Math.max(c.heightAgl, 5) > c.ceilingM) out.push('Au-dessus du plafond thermique : pas de thermique à cette altitude.');
  else if (Number.isFinite(c.ceilingM) && c.ceilingM - c.elevation < 150) out.push('Couche convective trop mince au-dessus de ce sol : l’air stable bloque les thermiques.');
  else if (c.restitution && c.thermal > 0.02) out.push('Restitution : la pente, passée à l’ombre, rend la chaleur de la journée, d’où une ascendance douce.');
  else if (c.insolation < 0.05 && c.thermal < 0.05) out.push('À l’ombre à cette heure : pas de thermique ici.');
  else if (c.coldPool > 0.5 && c.onset < 0.9) out.push('Fond de vallée encore sous l’inversion du matin : les thermiques en sortent plus tard que sur les pentes.');
  else if (c.onset < 0.9) out.push('Pente pas encore assez chauffée : les thermiques démarrent après une à trois heures de plein soleil.');
  if (c.lee > 0.35 && s.synopticKmh > 10) out.push('Sous le vent : thermiques hachés par le rotor et l’air qui descend.');
  if (s.lapseRate !== null) out.push(`Prévision : ${s.lapseRate.toLocaleString('fr-FR')} °C/km entre 1500 et 3000 m, ${stabilityLabel(s.lapseRate)}.`);
  if (thermalSeasonFactor(noonElevation(s.month0, s.day, 45)) < 0.85) out.push('Soleil bas de la saison : thermiques plus faibles qu’en été.');
  return out;
}

/** The probe, shown as a sheet in the left panel (bottom sheet on phones). */
export function ProbeSheet() {
  const probe = useRuntime((r) => r.probe);
  const { heightMode, heightAgl, heightAsl, synopticKmh, uiMode, lapseRate, month0, day } = useApp();
  if (!probe) return null;
  const c = probe.result;
  const close = () => getController()?.clearProbe();
  if (!c)
    return (
      <div className="probe-card sheet">
        <button className="close" onClick={close} aria-label="Fermer">
          <IconClose size={16} />
        </button>
        <p>Point hors de la zone simulée (Alpes françaises).</p>
      </div>
    );
  const total = describeVector(c.total);
  const conv = c.convergence ?? 0;
  // A hazard the sources report for this wind outranks the relief model's reading.
  const documented = c.hazardName && c.hazardId && c.hazardWeight > 0.3 ? { name: c.hazardName, id: c.hazardId.split('#')[0] } : null;
  const exposure =
    synopticKmh < 3
      ? documented
        ? { tone: 'bad', text: 'Danger documenté dans ces conditions :' }
        : { tone: '', text: 'Pas de vent météo : seules les brises thermiques jouent.' }
      : documented
        ? { tone: 'bad', text: 'Danger documenté dans ces conditions :' }
        : c.lee > 0.35
        ? { tone: 'bad', text: `Sous le vent (abri ${Math.round(c.shelterDeg)}°) : air freiné, rabattant${synopticKmh > 15 ? ', risque de rotors' : ''}.` }
        : c.dynamicLift > 0.6
          ? { tone: 'ok', text: `Au vent : air forcé à monter (~${c.dynamicLift.toFixed(1)} m/s), soaring possible.` }
          : c.venturi > 0.4
            ? { tone: 'warn', text: 'Venturi : vent canalisé et accéléré entre les reliefs.' }
            : { tone: '', text: 'Exposition neutre au vent météo.' };
  const reasons = thermalReasons(c, { synopticKmh, lapseRate, month0, day });
  const heightTxt = heightMode === 'agl' ? `${heightAgl} m sol` : `${heightAsl} m (${Math.max(0, Math.round(c.heightAgl))} m sol)`;
  return (
    <div className="probe-card sheet" aria-live="polite">
      <button className="close" onClick={close} aria-label="Fermer la sonde">
        <IconClose size={16} />
      </button>
      <p className="eyebrow">Sonde · {heightTxt}</p>
      {c.underground ? (
        <p className="note">L’altitude choisie est sous le relief à cet endroit.</p>
      ) : (
        <>
          <div className="probe-total">
            <Arrow v={c.total} size={40} />
            <div>
              <b>{total.speedKmh < 1 ? 'Calme' : `${total.from} · ${Math.round(total.speedKmh)} km/h`}</b>
              <small>
                sol {Math.round(c.elevation)} m · pente {Math.round(c.slopeDeg)}°{c.slopeDeg > 4 ? ` face ${compassFr(c.aspectDeg)}` : ''} · soleil {Math.round(c.insolation * 100)} %
              </small>
            </div>
          </div>
          <div className="probe-rows">
            <Row label="Brise de pente" v={c.slope} />
            <Row label="Brise de vallée (relief)" v={c.valley} note={c.curatedWeight > 0.5 ? 'remplacée par la brise documentée' : undefined} />
            {c.curatedName && <Row label={c.curatedName} v={c.curated} note={`brise documentée · poids ${Math.round(c.curatedWeight * 100)} %`} />}
            <Row label="Plaine · lac · mer" v={c.regional} />
            <Row label="Vent météo après relief" v={c.synoptic} note={c.channelling > 0.3 ? 'canalisé par la vallée' : undefined} />
          </div>
          <AirHere elevation={c.elevation} heightAgl={c.heightAgl} />
          <p className={`probe-exposure ${exposure.tone}`}>
            {exposure.text}
            {documented && (
              <>
                {' '}
                <button className="link-btn inline" onClick={() => openDocumented(documented.id)}>
                  {documented.name}
                </button>
              </>
            )}
          </p>
          <div className="probe-meters">
            <div>
              <span>Thermique</span>
              <meter min={0} max={1} value={c.thermal} />
            </div>
            <div>
              <span>Convergence</span>
              <b className={conv > 0.15 ? 'pos' : conv < -0.25 ? 'neg' : ''}>
                {conv > 0 ? '+' : ''}
                {conv.toFixed(1)} m/s
              </b>
            </div>
            <div>
              <span>Turbulence</span>
              <meter min={0} max={1} value={c.turbulence} low={0.3} high={0.6} optimum={0} />
            </div>
          </div>
          {reasons.length > 0 && (
            <ul className="probe-why">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <AirspacesHere lon={probe.lon} lat={probe.lat} />
      {uiMode === 'simulate' ? (
        // Simulating, the wind comes first: what the sources say is one tap away.
        <details className="probe-sources">
          <summary>Ce que disent les sources ici</summary>
          <NearbySources lon={probe.lon} lat={probe.lat} />
        </details>
      ) : (
        <NearbySources lon={probe.lon} lat={probe.lat} />
      )}
      <PointForecastBlock lon={probe.lon} lat={probe.lat} />
      <button className="link-btn add-here" onClick={() => startDraft({ kind: 'new', points: [[probe.lon, probe.lat]] })}>
        <IconPlus size={14} /> Signaler un phénomène ici
      </button>
    </div>
  );
}
