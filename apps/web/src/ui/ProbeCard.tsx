import type { PointForecast } from '@brises/shared';
import { compassFr, describeVector } from '@brises/model';
import { useState } from 'react';
import { useApp, useRuntime } from '../state/store';
import { getController, getDataClient } from './controller-ref';
import { startDraft } from './Feedback';
import { fmtHour } from './format';
import { NearbySources } from './Nearby';
import { ProfileChart } from './ProfileChart';
import { IconClose, IconPlus, IconSun } from './icons';

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

/** The probe, shown as a sheet in the left panel (bottom sheet on phones). */
export function ProbeSheet() {
  const probe = useRuntime((r) => r.probe);
  const { heightMode, heightAgl, heightAsl, synopticKmh } = useApp();
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
  const exposure =
    synopticKmh < 3
      ? { tone: '', text: 'Pas de vent météo : seules les brises thermiques jouent.' }
      : c.lee > 0.35
        ? { tone: 'bad', text: `Sous le vent (abri ${Math.round(c.shelterDeg)}°) : air freiné, rabattant${synopticKmh > 15 ? ', risque de rotors' : ''}.` }
        : c.dynamicLift > 0.6
          ? { tone: 'ok', text: `Au vent : air forcé à monter (~${c.dynamicLift.toFixed(1)} m/s), soaring possible.` }
          : c.venturi > 0.4
            ? { tone: 'warn', text: 'Venturi : vent canalisé et accéléré entre les reliefs.' }
            : { tone: '', text: 'Exposition neutre au vent météo.' };
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
          <p className={`probe-exposure ${exposure.tone}`}>{exposure.text}</p>
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
        </>
      )}
      <AirspacesHere lon={probe.lon} lat={probe.lat} />
      <NearbySources lon={probe.lon} lat={probe.lat} />
      <PointForecastBlock lon={probe.lon} lat={probe.lat} />
      <button className="link-btn add-here" onClick={() => startDraft({ kind: 'new', points: [[probe.lon, probe.lat]] })}>
        <IconPlus size={14} /> Signaler un phénomène ici
      </button>
    </div>
  );
}
