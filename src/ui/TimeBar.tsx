import { useEffect, useRef } from 'react';
import { useApp, useRuntime } from '../state/store';
import { fmtHour, MONTHS } from './format';

const MIN_H = 5;
const MAX_H = 22;

/** Day timeline: hour slider, month, and a "play the day" animation. */
export function TimeBar() {
  const { hour, month0, playing, set } = useApp();
  const sun = useRuntime((r) => r.sun);
  const phase = useRuntime((r) => r.status.phase);
  const lastStep = useRef(0);

  // Advance the clock once the previous computation is displayed (the model is the bottleneck).
  useEffect(() => {
    if (!playing || phase === 'computing') return;
    const wait = Math.max(0, 650 - (performance.now() - lastStep.current));
    const t = window.setTimeout(() => {
      lastStep.current = performance.now();
      const h = useApp.getState().hour + 0.25;
      useApp.getState().set({ hour: h > 20 ? 8 : h });
    }, wait);
    return () => window.clearTimeout(t);
  }, [playing, phase, hour]);

  const dayFrac = (hour - MIN_H) / (MAX_H - MIN_H);
  return (
    <div className="timebar panel" role="group" aria-label="Heure et saison">
      <button className="play" onClick={() => set({ playing: !playing })} aria-label={playing ? 'Pause' : 'Animer la journée'} title={playing ? 'Pause' : 'Animer la journée'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="time-main">
        <div className="time-labels">
          <span className="time-now">{fmtHour(hour)}</span>
          <span className="time-sun">
            {sun ? (sun.elevation > 0 ? `☀ soleil ${Math.round(sun.elevation)}° · azimut ${Math.round(sun.azimuth)}°` : '☾ nuit') : ''}
          </span>
        </div>
        <div className="time-track" style={{ ['--p' as string]: dayFrac }}>
          <input
            type="range"
            min={MIN_H}
            max={MAX_H}
            step={0.25}
            value={hour}
            onChange={(e) => set({ hour: Number(e.target.value), playing: false })}
            aria-label="Heure légale"
          />
          <div className="time-ticks" aria-hidden>
            {[6, 9, 12, 15, 18, 21].map((h) => (
              <span key={h} style={{ left: `${((h - MIN_H) / (MAX_H - MIN_H)) * 100}%` }}>
                {h}h
              </span>
            ))}
          </div>
        </div>
      </div>
      <label className="month">
        <span className="sr-only">Mois</span>
        <select value={month0} onChange={(e) => set({ month0: Number(e.target.value), day: 15 })}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
