import { useCallback, useRef } from 'react';
import { compassFr } from '@brises/model';

interface Props {
  fromDeg: number;
  speedKmh: number;
  onChange: (fromDeg: number) => void;
}

const TICKS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** Compass dial: drag to set the direction the synoptic wind blows FROM. */
export function WindDial({ fromDeg, speedKmh, onChange }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const setFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const r = ref.current!.getBoundingClientRect();
      const dx = clientX - (r.left + r.width / 2);
      const dy = clientY - (r.top + r.height / 2);
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      onChange((Math.round(((deg + 360) % 360) / 5) * 5) % 360);
    },
    [onChange],
  );
  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.type === 'pointerdown') (e.target as Element).setPointerCapture?.(e.pointerId);
    if (e.type === 'pointerdown' || e.buttons === 1) setFromEvent(e.clientX, e.clientY);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((fromDeg + 355) % 360);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((fromDeg + 5) % 360);
  };
  const calm = speedKmh < 1;
  // Arrow drawn in the direction the wind blows TO.
  const toDeg = (fromDeg + 180) % 360;
  return (
    <svg
      ref={ref}
      className="wind-dial"
      viewBox="-60 -60 120 120"
      onPointerDown={onPointer}
      onPointerMove={onPointer}
      onKeyDown={onKey}
      tabIndex={0}
      role="slider"
      aria-label="Direction du vent météo"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={fromDeg}
      aria-valuetext={`Vent de ${compassFr(fromDeg)}`}
    >
      <circle r="52" className="dial-ring" />
      {TICKS.map((t, i) => {
        const a = (i * 45 * Math.PI) / 180;
        return (
          <text key={t} x={Math.sin(a) * 43} y={-Math.cos(a) * 43 + 3.5} className={i % 2 ? 'dial-tick minor' : 'dial-tick'} textAnchor="middle">
            {t}
          </text>
        );
      })}
      <g transform={`rotate(${toDeg})`} opacity={calm ? 0.25 : 1}>
        <line x1="0" y1="26" x2="0" y2="-24" className="dial-arrow" />
        <path d="M0,-32 L9,-18 L-9,-18 Z" className="dial-head" />
        <circle cy="26" r="4" className="dial-tail" />
      </g>
      <text y="5" textAnchor="middle" className="dial-center">
        {calm ? 'calme' : compassFr(fromDeg)}
      </text>
    </svg>
  );
}
