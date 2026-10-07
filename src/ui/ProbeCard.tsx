import { describeVector } from '../model/field';
import { compassFr } from '../model/grid';
import { useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';

function Arrow({ v }: { v: [number, number] }) {
  const d = describeVector(v);
  const to = (d.fromDeg + 180) % 360;
  return (
    <svg className="mini-arrow" viewBox="-10 -10 20 20" aria-hidden style={{ opacity: d.speedKmh < 1 ? 0.25 : 1 }}>
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
      <span className="probe-label">{label}</span>
      <span className="probe-val">{d.speedKmh < 1 ? '—' : `${d.from} ${Math.round(d.speedKmh)} km/h`}</span>
      {note && <span className="probe-note">{note}</span>}
    </div>
  );
}

export function ProbeCard() {
  const probe = useRuntime((r) => r.probe);
  const { heightMode, heightAgl, heightAsl, synopticKmh } = useApp();
  if (!probe) return null;
  const { result } = probe;
  const c = result.cell;
  const close = () => getController()?.clearProbe();
  if (!c)
    return (
      <div className="probe-card panel">
        <button className="close" onClick={close} aria-label="Fermer">
          ×
        </button>
        <p>Point hors de la zone simulée (Alpes françaises).</p>
      </div>
    );
  const total = describeVector(c.total);
  const conv = result.convergence ?? 0;
  const exposure =
    synopticKmh < 3
      ? 'Pas de vent météo : seules les brises jouent.'
      : c.lee > 0.35
        ? `Sous le vent (abri de ${Math.round(c.shelterDeg)}°) : air freiné, rabattant et turbulent${synopticKmh > 15 ? ' — risque de rotors' : ''}.`
        : c.dynamicLift > 0.6
          ? `Au vent : l’air est forcé de monter (~${c.dynamicLift.toFixed(1)} m/s) — zone de soaring potentielle.`
          : c.venturi > 0.4
            ? 'Effet venturi : vent canalisé et accéléré entre les reliefs.'
            : 'Exposition neutre au vent météo.';
  const heightTxt = heightMode === 'agl' ? `${heightAgl} m sol` : `${heightAsl} m (soit ${Math.round(c.heightAgl)} m sol)`;
  return (
    <div className="probe-card panel" aria-live="polite">
      <button className="close" onClick={close} aria-label="Fermer la sonde">
        ×
      </button>
      <h3>Vent estimé ici</h3>
      <p className="probe-coords">
        {probe.lat.toFixed(4)}° N, {probe.lon.toFixed(4)}° E · sol {Math.round(c.elevation)} m · pente {Math.round(c.slopeDeg)}°
        {c.slopeDeg > 4 ? ` face ${compassFr(c.aspectDeg)}` : ''} · soleil {Math.round(c.insolation * 100)} %
      </p>
      {c.underground ? (
        <p className="warn">L’altitude choisie est sous le relief à cet endroit.</p>
      ) : (
        <>
          <div className="probe-total">
            <Arrow v={c.total} />
            <div>
              <b>
                {total.speedKmh < 1 ? 'Calme' : `${total.from} · ${Math.round(total.speedKmh)} km/h`}
              </b>
              <small>à {heightTxt}</small>
            </div>
          </div>
          <div className="probe-rows">
            <Row label="Brise de pente" v={c.slope} />
            <Row label="Brise de vallée (relief)" v={c.valley} note={c.curatedWeight > 0.5 ? 'remplacée localement' : undefined} />
            {result.curatedName && <Row label={`Connue : ${result.curatedName}`} v={c.curated} note={`poids ${Math.round(c.curatedWeight * 100)} %`} />}
            <Row label="Plaine / lac / mer" v={c.regional} />
            <Row label="Vent météo après relief" v={c.synoptic} note={c.channelling > 0.3 ? 'canalisé par la vallée' : undefined} />
          </div>
          <p className="probe-exposure">{exposure}</p>
          <div className="probe-meters">
            <div>
              <span>Thermique</span>
              <meter min={0} max={1} value={c.thermal} />
            </div>
            <div>
              <span>Convergence</span>
              <b className={conv > 0.15 ? 'pos' : conv < -0.25 ? 'neg' : ''}>{conv > 0 ? '+' : ''}{conv.toFixed(1)} m/s</b>
            </div>
            <div>
              <span>Turbulence</span>
              <meter min={0} max={1} value={c.turbulence} low={0.3} high={0.6} optimum={0} />
            </div>
          </div>
          <p className="hint">Position dans la vallée : {Math.round(Math.min(1, Math.max(0, c.valleyLevel)) * 100)} % de la profondeur ({Math.round(c.valleyDepth)} m).</p>
        </>
      )}
    </div>
  );
}
