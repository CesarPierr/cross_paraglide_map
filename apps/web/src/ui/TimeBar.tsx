import { useEffect } from 'react';
import { useApp, useRuntime } from '../state/store';
import { fmtHour, MONTHS } from './format';
import { IconMoon, IconPause, IconPlay, IconSun } from './icons';
import { WindChip } from './Popovers';

const MIN_H = 5;
const MAX_H = 22;

/** Day timeline: the track shows night / dawn / day, the model follows in real time. */
export function TimeBar() {
  const { hour, month0, playing, set } = useApp();
  const sun = useRuntime((r) => r.sun);

  // GPU model: the field updates every frame, so the day can play smoothly.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const h = useApp.getState().hour + dt * 0.6; // ~1 h every 1.7 s
      useApp.getState().set({ hour: h > 20.5 ? 7 : Math.round(h * 100) / 100 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const pct = ((hour - MIN_H) / (MAX_H - MIN_H)) * 100;
  return (
    <div className="timebar panel" role="group" aria-label="Heure et saison">
      <button className="play" onClick={() => set({ playing: !playing })} aria-label={playing ? 'Pause' : 'Animer la journée'} title={playing ? 'Pause (espace)' : 'Animer la journée (espace)'}>
        {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
      </button>
      <div className="time-main">
        <div className="time-labels">
          <span className="time-now">{fmtHour(Math.round(hour * 4) / 4)}</span>
          <span className="time-sun">
            {sun ? (
              sun.elevation > 0 ? (
                <>
                  <IconSun size={14} /> {Math.round(sun.elevation)}° · azimut {Math.round(sun.azimuth)}°
                </>
              ) : (
                <>
                  <IconMoon size={14} /> nuit
                </>
              )
            ) : null}
          </span>
        </div>
        <div className="time-track">
          <div className="sky" aria-hidden />
          <input
            type="range"
            min={MIN_H}
            max={MAX_H}
            step={0.25}
            value={hour}
            onChange={(e) => set({ hour: Number(e.target.value), playing: false })}
            aria-label="Heure légale"
            style={{ ['--p' as string]: `${pct}%` }}
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
      <WindChip />
    </div>
  );
}
