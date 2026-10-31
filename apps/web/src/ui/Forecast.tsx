/**
 * The day simulated: the forecast of today, tomorrow or the day after (the air by layer
 * at the centre of the view: wind, temperature and humidity from 950 to 500 hPa, low and
 * mid clouds, AROME/ARPEGE via the weather provider), or a day set by hand (one wind « aux
 * crêtes » and a stability preset, with an optional inversion). The map follows the time
 * bar through the forecast hours, and the forecast follows the view when it moves more
 * than 20 km. Setting the wind by hand leaves the forecast.
 */
import { compassFr, presetAir, type AirColumn } from '@brises/model';
import type { SynopticWind } from '@brises/shared';
import { useEffect, useState } from 'react';
import { useApp, useRuntime } from '../state/store';
import { forecastAir } from './air-brief';
import { getController, getDataClient } from './controller-ref';
import { MONTHS } from './format';

/** Distance (km) the view may move before the forecast is taken again. */
const REFETCH_KM = 20;

export const dayDate = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
};
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
export function forecastAt(hours: SynopticWind[], day: number, hour: number): SynopticWind | undefined {
  const prefix = `${isoDay(dayDate(day))}T${String(Math.min(23, Math.round(hour))).padStart(2, '0')}`;
  return hours.find((h) => h.time.startsWith(prefix));
}

/** One column object per forecast hour, so the model is not recomputed while the hour stays. */
const airCache = new WeakMap<SynopticWind, AirColumn | null>();
function airOf(h: SynopticWind): AirColumn | null {
  if (!airCache.has(h)) airCache.set(h, forecastAir(h));
  return airCache.get(h) ?? null;
}

/** Keeps the simulated air on the forecast (or on the manual preset). Mounted once. */
export function useForecastSync(): void {
  const forecastDay = useApp((s) => s.forecastDay);
  const hour = useApp((s) => s.hour);
  const forecast = useRuntime((r) => r.forecast);
  const stability = useApp((s) => s.stability);
  const inversionM = useApp((s) => s.inversionM);
  const synopticFrom = useApp((s) => s.synopticFrom);
  const synopticKmh = useApp((s) => s.synopticKmh);
  const month0 = useApp((s) => s.month0);

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

  // Forecast: the ridge wind, the stability and the air by layer of the forecast hour.
  useEffect(() => {
    if (forecastDay === null || !forecast || forecast.status !== 'ready') return;
    const h = forecastAt(forecast.hours, forecastDay, hour);
    if (!h) return;
    const s = useApp.getState();
    const lapse = h.lapseRate ?? null;
    const air = airOf(h);
    if (s.synopticFrom !== h.fromDeg || s.synopticKmh !== h.speedKmh || s.lapseRate !== lapse || s.air !== air) s.set({ synopticFrom: h.fromDeg, synopticKmh: h.speedKmh, lapseRate: lapse, air });
  }, [forecastDay, forecast, hour]);

  // By hand: the stability preset (and inversion) around the chosen wind.
  useEffect(() => {
    if (forecastDay !== null) return;
    const p = presetAir({ stability, inversionM, fromDeg: synopticFrom, kmh: synopticKmh, month0 });
    useApp.getState().set({ air: p.air ?? null, lapseRate: p.lapseRate ?? null });
  }, [forecastDay, stability, inversionM, synopticFrom, synopticKmh, month0]);
}

/** Pilots' reading of the lapse rate between 850 and 700 hPa. */
export function stabilityLabel(lapse: number): string {
  if (lapse < 3) return 'inversion en altitude : thermiques bloqués bas';
  if (lapse < 5) return 'air stable : thermiques faibles, brises préservées';
  if (lapse < 6.5) return 'air moyennement stable';
  if (lapse < 8) return 'air instable : bons thermiques, le vent descend dans les vallées';
  return 'air très instable : thermiques forts et turbulents';
}

/** The day simulated: by hand, or the forecast of today and the next two days. */
export function DayPicker() {
  const forecastDay = useApp((s) => s.forecastDay);
  const set = useApp((s) => s.set);
  const choose = (day: number | null) => {
    if (day === null) return set({ forecastDay: null });
    const d = dayDate(day);
    set({ forecastDay: day, month0: d.getMonth(), day: d.getDate(), playing: false });
  };
  const labels = ['aujourd’hui', 'demain', 'après-demain'];
  // Short enough for the panel: "Auj.", "Demain", then the weekday and date.
  const short = ['Auj.', 'Demain', dayDate(2).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })];
  return (
    <div className="seg small forecast-days" role="radiogroup" aria-label="Journée simulée : prévision ou à la main">
      {labels.map((l, i) => (
        <button key={l} role="radio" aria-checked={forecastDay === i} aria-label={`Prévision ${l}`} className={forecastDay === i ? 'on' : ''} onClick={() => choose(i)} title={`Prévision ${l}, ${dayDate(i).getDate()} ${MONTHS[dayDate(i).getMonth()]}`}>
          {short[i]}
        </button>
      ))}
      <button role="radio" aria-checked={forecastDay === null} className={forecastDay === null ? 'on' : ''} onClick={() => choose(null)}>
        À la main
      </button>
    </div>
  );
}

const stabilityTone = (lapse: number | undefined) => (lapse === undefined ? '' : lapse < 5 ? 'stable' : lapse >= 7 ? 'unstable' : '');

/** The forecast day hour by hour: ridge wind, stability tint; a tap sets the hour. */
export function ForecastStrip() {
  const { forecastDay, hour, set } = useApp();
  const forecast = useRuntime((r) => r.forecast);
  if (forecastDay === null) return null;
  if (forecast?.status === 'error') return <p className="hint">Prévision indisponible ({forecast.message}).</p>;
  if (!forecast || forecast.status !== 'ready') return <p className="hint">Chargement de la prévision…</p>;
  const strip = Array.from({ length: 14 }, (_, i) => 7 + i).map((h) => ({ h, f: forecastAt(forecast.hours, forecastDay, h) }));
  return (
    <div className="forecast-strip" role="list" aria-label="Vent aux crêtes et stabilité heure par heure">
      {strip.map(({ h, f }) => (
        <button
          key={h}
          role="listitem"
          className={`${Math.round(hour) === h ? 'on' : ''} ${stabilityTone(f?.lapseRate)}`}
          onClick={() => set({ hour: h, playing: false })}
          title={f ? `${h} h : ${compassFr(f.fromDeg)} ${f.speedKmh} km/h aux crêtes${f.lapseRate !== undefined ? `, ${f.lapseRate.toLocaleString('fr-FR')} °C/km` : ''}` : `${h} h`}
        >
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
  );
}

/**
 * The place read by the briefing and the profile: the probed point, or the centre of the
 * view (ground from the 3D relief, else the forecast ground), with the view's bounds.
 */
export function usePlace(): { groundM: number; where: string; bbox: [number, number, number, number] | null } {
  const probe = useRuntime((r) => r.probe);
  const forecast = useRuntime((r) => r.forecast);
  const status = useRuntime((r) => r.status.phase);
  const [view, setView] = useState<{ ground: number | null; bbox: [number, number, number, number] } | null>(null);
  useEffect(() => {
    const map = getController()?.map;
    if (!map) return;
    let t = 0;
    let tries = 0;
    const read = () => {
      const c = map.getCenter();
      const b = map.getBounds();
      const exag = map.getTerrain()?.exaggeration ?? 0;
      const e = exag > 0 ? map.queryTerrainElevation(c) : null;
      // 0 while the relief tile under the centre is not loaded yet: read again a little later.
      const ground = e != null && Number.isFinite(e) && e > 0 ? Math.round(e / exag) : null;
      const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      setView((v) => (v && v.ground === ground && v.bbox.every((x, i) => Math.abs(x - bbox[i]) < 1e-6) ? v : { ground, bbox }));
      window.clearTimeout(t);
      if (ground === null && exag > 0 && tries++ < 8) t = window.setTimeout(read, 1500);
    };
    const onMove = () => {
      tries = 0;
      read();
    };
    onMove();
    map.on('moveend', onMove);
    return () => {
      window.clearTimeout(t);
      map.off('moveend', onMove);
    };
  }, [status]);
  const p = probe?.result;
  if (p && !p.underground) return { groundM: p.elevation, where: `sonde, sol ${fmtGround(p.elevation)} m`, bbox: view?.bbox ?? null };
  const fh = forecast?.hours[0];
  const g = view?.ground ?? fh?.groundM ?? null;
  return { groundM: g ?? 300, where: g !== null ? `centre de la vue, sol ${fmtGround(g)} m` : 'fond de vallée type (300 m)', bbox: view?.bbox ?? null };
}

const fmtGround = (z: number) => (Math.round(z / 10) * 10).toLocaleString('fr-FR');
