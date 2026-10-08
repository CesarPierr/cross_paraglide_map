/**
 * Forecast mode of the simulation: the synoptic wind of today, tomorrow or the day
 * after, hour by hour, at ridge level (mean of 850 and 700 hPa, AROME/ARPEGE via the
 * weather provider) around the centre of the view. The map follows the time bar (and
 * its animation) through the forecast hours, and the forecast follows the view when
 * it moves more than 20 km. Setting the wind by hand leaves the forecast.
 */
import { compassFr } from '@brises/model';
import { useEffect } from 'react';
import { useApp, useRuntime } from '../state/store';
import { getController, getDataClient } from './controller-ref';
import { MONTHS } from './format';

/** Distance (km) the view may move before the forecast is taken again. */
const REFETCH_KM = 20;

const dayDate = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => Math.hypot((a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * 111.32);

async function fetchForecast(lat: number, lon: number): Promise<void> {
  const w = getDataClient()?.weather();
  if (!w) return;
  const rt = useRuntime.getState();
  rt.set({ forecast: { lat, lon, hours: rt.forecast?.hours ?? [], status: 'loading' } });
  try {
    const hours = await w.synoptic(lat, lon);
    useRuntime.getState().set({ forecast: { lat, lon, hours, status: 'ready' } });
  } catch (e) {
    useRuntime.getState().set({ forecast: { lat, lon, hours: [], status: 'error', message: e instanceof Error ? e.message : String(e) } });
  }
}

/** The forecast hour matching the simulated date and hour, if any. */
function forecastAt(hours: { time: string }[], day: number, hour: number) {
  const prefix = `${iso(dayDate(day))}T${String(Math.min(23, Math.round(hour))).padStart(2, '0')}`;
  return hours.find((h) => h.time.startsWith(prefix)) as (typeof hours)[number] | undefined;
}

/** Keeps the simulated wind on the forecast while a forecast day is chosen. Mounted once. */
export function useForecastSync(): void {
  const forecastDay = useApp((s) => s.forecastDay);
  const hour = useApp((s) => s.hour);
  const forecast = useRuntime((r) => r.forecast);

  // Taken when a day is chosen, and again when the view has moved away.
  useEffect(() => {
    if (forecastDay === null) return;
    const map = getController()?.map;
    if (!map) return;
    const check = () => {
      const c = map.getCenter();
      const f = useRuntime.getState().forecast;
      if (!f || f.status === 'error' || km({ lat: c.lat, lon: c.lng }, f) > REFETCH_KM) void fetchForecast(c.lat, c.lng);
    };
    check();
    let t = 0;
    const onMove = () => {
      window.clearTimeout(t);
      t = window.setTimeout(check, 800);
    };
    map.on('moveend', onMove);
    return () => {
      window.clearTimeout(t);
      map.off('moveend', onMove);
    };
  }, [forecastDay]);

  // The wind of the forecast hour.
  useEffect(() => {
    if (forecastDay === null || !forecast || forecast.status !== 'ready') return;
    const h = forecastAt(forecast.hours, forecastDay, hour) as { fromDeg: number; speedKmh: number } | undefined;
    if (!h) return;
    const s = useApp.getState();
    if (s.synopticFrom !== h.fromDeg || s.synopticKmh !== h.speedKmh) s.set({ synopticFrom: h.fromDeg, synopticKmh: h.speedKmh });
  }, [forecastDay, forecast, hour]);
}

/** Chooses the forecast day (or the wind by hand), and shows the day hour by hour. */
export function ForecastBlock() {
  const { forecastDay, hour, set } = useApp();
  const forecast = useRuntime((r) => r.forecast);
  const choose = (day: number | null) => {
    if (day === null) return set({ forecastDay: null });
    const d = dayDate(day);
    set({ forecastDay: day, month0: d.getMonth(), day: d.getDate(), playing: false });
  };
  const labels = ['aujourd’hui', 'demain', 'après-demain'];
  // Short enough for the panel: "Auj.", "Demain", then the weekday and date.
  const short = ['Auj.', 'Demain', dayDate(2).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })];
  const strip =
    forecastDay !== null && forecast?.status === 'ready'
      ? Array.from({ length: 14 }, (_, i) => 7 + i).map((h) => ({ h, f: forecastAt(forecast.hours, forecastDay, h) as { fromDeg: number; speedKmh: number } | undefined }))
      : [];
  return (
    <div className="forecast">
      <div className="seg small forecast-days" role="radiogroup" aria-label="Vent : à la main ou prévu">
        <button role="radio" aria-checked={forecastDay === null} className={forecastDay === null ? 'on' : ''} onClick={() => choose(null)}>
          À la main
        </button>
        {labels.map((l, i) => (
          <button key={l} role="radio" aria-checked={forecastDay === i} aria-label={`Prévision ${l}`} className={forecastDay === i ? 'on' : ''} onClick={() => choose(i)} title={`Vent prévu ${l}, ${dayDate(i).getDate()} ${MONTHS[dayDate(i).getMonth()]}`}>
            {short[i]}
          </button>
        ))}
      </div>
      {forecastDay !== null && (
        <>
          {forecast?.status === 'loading' && !strip.length && <p className="hint">Chargement de la prévision…</p>}
          {forecast?.status === 'error' && <p className="hint">Prévision indisponible ({forecast.message}).</p>}
          {strip.length > 0 && (
            <div className="forecast-strip" role="list" aria-label="Vent prévu heure par heure">
              {strip.map(({ h, f }) => (
                <button key={h} role="listitem" className={Math.round(hour) === h ? 'on' : ''} onClick={() => set({ hour: h, playing: false })} title={f ? `${h} h : ${compassFr(f.fromDeg)} ${f.speedKmh} km/h` : `${h} h`}>
                  <small>{h}h</small>
                  {f ? (
                    <>
                      <svg viewBox="-10 -10 20 20" width="16" height="16" aria-hidden style={{ transform: `rotate(${f.fromDeg + 180}deg)` }}>
                        <path d="M0 -8 L5 4 L0 1 L-5 4 Z" fill="currentColor" />
                      </svg>
                      <b>{f.speedKmh}</b>
                    </>
                  ) : (
                    <b>–</b>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="hint">
            Vent prévu aux crêtes (1500–3000 m) au centre de la vue, {labels[forecastDay]} {dayDate(forecastDay).getDate()} {MONTHS[dayDate(forecastDay).getMonth()]}, repris quand vous vous déplacez. Le relief et les brises font le reste ; nuages et instabilité ne sont pas simulés. Données Open-Meteo (AROME/ARPEGE).
          </p>
        </>
      )}
    </div>
  );
}
