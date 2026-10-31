/**
 * « Situation » of the simulation panel: the day (forecast or by hand), the hour, one line
 * of briefing on the air, its vertical profile over the place read, and what happens now
 * in the view (documented breezes, convergences and hazards whose conditions match).
 */
import { valleyPhaseAt, type StabilityPreset } from '@brises/model';
import { useMemo } from 'react';
import { BREEZE_COLORS, COLORS } from '../map/palette';
import { modelParams } from '../map/modules/wind';
import { useApp, useRuntime, type AppState } from '../state/store';
import { airSynthesis, happeningNow, morningInversion, type NowItem } from './air-brief';
import { getController } from './controller-ref';
import { dayDate, DayPicker, ForecastStrip, isoDay, usePlace } from './Forecast';
import { fmtHour, MONTHS } from './format';
import { showSheet } from './mobile';
import { AirColumnChart } from './ProfileChart';

/** Typical days, by hand: wind « aux crêtes », air mass, optional inversion. */
const DAYS: { label: string; hint: string; set: Partial<AppState> }[] = [
  {
    label: 'Belle journée d’été instable',
    hint: 'Juillet, NO faible, air instable : cumulus vers 2 800 m, bons thermiques, brises établies.',
    set: { month0: 6, day: 15, synopticFrom: 315, synopticKmh: 10, stability: 'instable', inversionM: null },
  },
  {
    label: 'Ciel bleu stable',
    hint: 'Air stable sous une inversion à 1 800 m : thermiques bleus, faibles et bas, brises préservées.',
    set: { synopticFrom: 0, synopticKmh: 5, stability: 'stable', inversionM: 1800 },
  },
  {
    label: 'Vent de nord fort',
    hint: 'Nord 35 km/h aux crêtes, air froid instable : brises écrasées, sous le vent turbulent au sud des reliefs.',
    set: { synopticFrom: 0, synopticKmh: 35, stability: 'instable', inversionM: null },
  },
  {
    label: 'Foehn',
    hint: 'Sud 45 km/h au-dessus d’air stable : rotors et rafales au nord des crêtes. La descente du foehn elle-même n’est pas simulée.',
    set: { synopticFrom: 180, synopticKmh: 45, stability: 'stable', inversionM: null },
  },
];

const STABILITIES: { key: StabilityPreset; label: string; hint: string }[] = [
  { key: 'stable', label: 'Stable', hint: 'Thermiques faibles et bas, brises préservées sous le vent d’altitude' },
  { key: 'standard', label: 'Standard', hint: 'Journée type du modèle (6,5 °C/km)' },
  { key: 'instable', label: 'Instable', hint: 'Bons thermiques, cumulus, le vent d’altitude descend dans les vallées' },
];

const matches = (s: AppState, set: Partial<AppState>) => (Object.keys(set) as (keyof AppState)[]).every((k) => k === 'day' || s[k] === set[k]);

/** The air by hand: typical days, stability, inversion. */
function ManualAir() {
  const s = useApp();
  return (
    <div className="manual-air">
      <div className="chips compact day-presets" role="group" aria-label="Journées types">
        {DAYS.map((d) => (
          <button key={d.label} className={`chip ${matches(s, d.set) ? 'active' : ''}`} title={d.hint} onClick={() => s.set({ ...d.set, forecastDay: null })}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="air-row">
        <div className="seg small" role="radiogroup" aria-label="Stabilité de l’air">
          {STABILITIES.map((o) => (
            <button key={o.key} role="radio" aria-checked={s.stability === o.key} className={s.stability === o.key ? 'on' : ''} title={o.hint} onClick={() => s.set({ stability: o.key })}>
              {o.label}
            </button>
          ))}
        </div>
        <label className="toggle inv-toggle">
          <input type="checkbox" checked={s.inversionM !== null} onChange={() => s.set({ inversionM: s.inversionM === null ? 1400 : null })} />
          <span className="switch" aria-hidden />
          <span>Inversion</span>
        </label>
      </div>
      {s.inversionM !== null && (
        <label className="field">
          <span>
            Inversion à <b>{s.inversionM.toLocaleString('fr-FR')} m</b>
          </span>
          <input type="range" min={600} max={3000} step={100} value={s.inversionM} onChange={(e) => s.set({ inversionM: Number(e.target.value) })} aria-label="Altitude de l’inversion" />
          <small className="hint">Thermiques et brises plafonnent dessous ; la vallée sous l’inversion reste abritée du vent d’altitude.</small>
        </label>
      )}
    </div>
  );
}

const KIND: Record<NowItem['kind'], { label: string; color: string }> = {
  hazard: { label: 'Danger', color: COLORS.hazard },
  breeze: { label: 'Brise', color: BREEZE_COLORS.valley },
  convergence: { label: 'Convergence', color: COLORS.convergence },
};

function openFeature(id: string) {
  const d = getController()?.describe(`atlas:${id}`);
  if (!d) return;
  useRuntime.getState().set({ feature: d });
  showSheet();
}

const NOW_MAX = 6;

/** The phase of the day's breezes, in one sentence. */
function phaseLine(hour: number, day: boolean): string {
  if (!day) return 'Nuit : brises descendantes, air stable en vallée.';
  if (hour < 10.5) return 'Matin : les pentes au soleil s’activent, les vallées basculent vers la brise montante.';
  if (hour < 12.5) return 'Fin de matinée : brises montantes en place, les grandes vallées forcissent.';
  if (hour < 17.5) return 'Après-midi : brises de vallée établies, convergences actives sur les crêtes.';
  return 'Fin de journée : les brises faiblissent, restitution sur les faces ouest, bascule vers la brise descendante au coucher.';
}

/** What happens now in the view, with a tap to show each item. */
function HappeningNow({ bbox }: { bbox: [number, number, number, number] | null }) {
  const s = useApp();
  const atlas = useRuntime((r) => r.atlas);
  const solarHour = useRuntime((r) => r.solarHour);
  const sun = useRuntime((r) => r.sun);
  const params = modelParams(s);
  const key = `${s.hour.toFixed(2)}|${s.synopticFrom}|${s.synopticKmh}|${s.heatwave}|${s.month0}|${s.lapseRate}|${s.air?.cloud ?? ''}|${bbox?.join(',')}|${solarHour}`;
  const items = useMemo(
    () => (atlas && bbox && solarHour !== null ? happeningNow(atlas, params, valleyPhaseAt(solarHour), bbox) : []),
    // `params` follows `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atlas, key],
  );
  return (
    <div className="now">
      <p className="now-title">Ce qui se passe maintenant</p>
      <p className="now-phase">{phaseLine(s.hour, !!sun && sun.elevation > 3)}</p>
      {items.length === 0 ? (
        <p className="muted small">Aucun phénomène documenté actif dans la vue à cette heure.</p>
      ) : (
        <ul className="now-list">
          {items.slice(0, NOW_MAX).map((it) => (
            <li key={`${it.kind}:${it.id}`}>
              <button className="nearby-item" onClick={() => openFeature(it.id)} title="Voir la fiche et ses sources">
                <span className="dot" style={{ background: KIND[it.kind].color }} />
                <span className="nearby-name">{it.name}</span>
                <span className="nearby-km">{it.detail}</span>
              </button>
            </li>
          ))}
          {items.length > NOW_MAX && <li className="muted small now-more">+ {items.length - NOW_MAX} autres dans la vue : zoomez pour les voir.</li>}
        </ul>
      )}
    </div>
  );
}

/** Day, hour, the air in one line, its profile over the place, what happens now. */
export function Situation() {
  const s = useApp();
  const forecast = useRuntime((r) => r.forecast);
  const place = usePlace();
  const morning =
    s.forecastDay !== null && forecast?.status === 'ready' ? morningInversion(forecast.hours, isoDay(dayDate(s.forecastDay)), place.groundM) : null;
  const brief = airSynthesis({ air: s.air, lapseRate: s.lapseRate, groundM: place.groundM, ridge: { fromDeg: s.synopticFrom, kmh: s.synopticKmh }, morning });
  const readZ = s.heightMode === 'asl' ? s.heightAsl : place.groundM + s.heightAgl;
  const dayLabel =
    s.forecastDay !== null
      ? `${['Aujourd’hui', 'Demain', 'Après-demain'][s.forecastDay]} ${dayDate(s.forecastDay).getDate()} ${MONTHS[dayDate(s.forecastDay).getMonth()]}`
      : `${s.day} ${MONTHS[s.month0]}, à la main`;
  return (
    <section className="situation" aria-label="Situation">
      <DayPicker />
      <p className="situation-head">
        {dayLabel} · {fmtHour(Math.round(s.hour * 4) / 4)}
      </p>
      <p className="situation-brief">{brief}.</p>
      {s.forecastDay !== null ? <ForecastStrip /> : <ManualAir />}
      {s.air ? (
        <AirColumnChart air={s.air} groundM={place.groundM} readZ={readZ} />
      ) : (
        <p className="hint">Journée type du modèle : même vent à toutes les altitudes, pas de plafond imposé. Une stabilité, une inversion ou une prévision donnent un profil par couches.</p>
      )}
      <p className="hint place">
        Profil sur : {place.where}
        {s.forecastDay !== null ? ' · prévision Open-Meteo (AROME/ARPEGE), niveaux 950 à 500 hPa' : ''}.
      </p>
      <HappeningNow bbox={place.bbox} />
    </section>
  );
}
