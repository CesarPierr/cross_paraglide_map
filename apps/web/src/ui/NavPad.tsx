/**
 * Camera controls usable without a mouse: an on-screen pad (hold a button
 * for continuous motion) plus keyboard shortcuts. Moves are relative to the
 * view direction, so "forward" always flies towards what you look at.
 *
 * Keys: ↑↓←→ or Z/Q/S/D (and W/A) move, A/E rotate (Q/E on QWERTY when not
 * moving), R/F tilt, +/− zoom, N north, Échap leaves the schema view.
 */
import { useEffect, useRef, useState } from 'react';
import { getController } from './controller-ref';
import { useIsMobile } from './mobile';

type Action = 'fwd' | 'back' | 'left' | 'right' | 'rotL' | 'rotR' | 'tiltUp' | 'tiltDown' | 'in' | 'out';

/** Applies one frame of motion; `dt` in seconds. */
function step(a: Action, dt: number): void {
  const map = getController()?.map;
  if (!map) return;
  const pan = 520 * dt; // pixels per second at any zoom
  // Screen-space pan is already relative to the view, so forward = up on screen.
  switch (a) {
    case 'fwd':
      map.panBy([0, -pan], { duration: 0 });
      break;
    case 'back':
      map.panBy([0, pan], { duration: 0 });
      break;
    case 'left':
      map.panBy([-pan, 0], { duration: 0 });
      break;
    case 'right':
      map.panBy([pan, 0], { duration: 0 });
      break;
    case 'rotL':
      map.setBearing(map.getBearing() - 70 * dt);
      break;
    case 'rotR':
      map.setBearing(map.getBearing() + 70 * dt);
      break;
    case 'tiltUp':
      map.setPitch(Math.min(map.getMaxPitch(), map.getPitch() + 40 * dt));
      break;
    case 'tiltDown':
      map.setPitch(Math.max(0, map.getPitch() - 40 * dt));
      break;
    case 'in':
      map.setZoom(map.getZoom() + 1.2 * dt);
      break;
    case 'out':
      map.setZoom(map.getZoom() - 1.2 * dt);
      break;
  }
}

/** Runs the held actions every animation frame. */
function useMotion() {
  const held = useRef(new Set<Action>());
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const loop = (t: number) => {
    const dt = last.current ? Math.min(0.05, (t - last.current) / 1000) : 1 / 60;
    last.current = t;
    for (const a of held.current) step(a, dt);
    raf.current = held.current.size ? requestAnimationFrame(loop) : null;
    if (!raf.current) last.current = 0;
  };
  const press = (a: Action) => {
    held.current.add(a);
    if (raf.current === null) raf.current = requestAnimationFrame(loop);
  };
  const release = (a?: Action) => {
    if (a) held.current.delete(a);
    else held.current.clear();
  };
  return { press, release };
}

const KEYS: Record<string, Action> = {
  ArrowUp: 'fwd',
  ArrowDown: 'back',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  z: 'fwd',
  w: 'fwd',
  s: 'back',
  q: 'left',
  d: 'right',
  a: 'rotL',
  e: 'rotR',
  r: 'tiltUp',
  f: 'tiltDown',
  '+': 'in',
  '=': 'in',
  '-': 'out',
};

function Btn({ a, label, title, motion, className = '' }: { a: Action; label: React.ReactNode; title: string; motion: ReturnType<typeof useMotion>; className?: string }) {
  return (
    <button
      className={`nav-btn ${className}`}
      title={title}
      aria-label={title}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        motion.press(a);
      }}
      onPointerUp={() => motion.release(a)}
      onPointerCancel={() => motion.release(a)}
      onLostPointerCapture={() => motion.release(a)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

const Arrow = ({ r }: { r: number }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" style={{ transform: `rotate(${r}deg)` }} aria-hidden>
    <path d="M12 5 L19 14 H5 Z" fill="currentColor" />
  </svg>
);

export function NavPad() {
  const motion = useMotion();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(!mobile);
  const [help, setHelp] = useState(false);

  // Keyboard: continuous while the key is held; ignored while typing.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => !!(e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; // hour shortcuts
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'n') {
        getController()?.map.easeTo({ bearing: 0, duration: 600 });
        return;
      }
      const a = KEYS[k];
      if (!a) return;
      e.preventDefault();
      motion.press(a);
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const a = KEYS[k];
      if (a) motion.release(a);
    };
    const blur = () => motion.release();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [motion]);

  return (
    <div className={`navpad panel ${open ? 'open' : ''}`} aria-label="Navigation">
      {open && (
        <div className="navpad-grid">
          <Btn a="rotL" label="⟲" title="Tourner à gauche (A)" motion={motion} />
          <Btn a="fwd" label={<Arrow r={0} />} title="Avancer (↑ ou Z)" motion={motion} />
          <Btn a="rotR" label="⟳" title="Tourner à droite (E)" motion={motion} />
          <Btn a="left" label={<Arrow r={-90} />} title="Aller à gauche (← ou Q)" motion={motion} />
          <button className="nav-btn north" title="Nord en haut (N)" aria-label="Nord en haut" onClick={() => getController()?.map.easeTo({ bearing: 0, duration: 600 })}>
            N
          </button>
          <Btn a="right" label={<Arrow r={90} />} title="Aller à droite (→ ou D)" motion={motion} />
          <Btn a="tiltDown" label="⤓" title="Vue plus verticale (F)" motion={motion} />
          <Btn a="back" label={<Arrow r={180} />} title="Reculer (↓ ou S)" motion={motion} />
          <Btn a="tiltUp" label="⤒" title="Vue plus rasante (R)" motion={motion} />
          <Btn a="out" label="−" title="Dézoomer (−)" motion={motion} className="zoom" />
          <button className="nav-btn" title="Aide à la navigation" aria-label="Aide à la navigation" onClick={() => setHelp(!help)}>
            ?
          </button>
          <Btn a="in" label="+" title="Zoomer (+)" motion={motion} className="zoom" />
        </div>
      )}
      <button className="navpad-toggle" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? 'Masquer les commandes' : 'Commandes de navigation'}>
        {open ? '×' : '✥'}
      </button>
      {help && open && (
        <div className="navpad-help" role="note">
          <p>
            <b>Souris</b> : glisser pour se déplacer, clic droit ou Ctrl + glisser pour tourner et incliner, molette pour zoomer.
          </p>
          <p>
            <b>Pavé tactile</b> : deux doigts pour zoomer ; Ctrl + glisser pour tourner et incliner.
          </p>
          <p>
            <b>Écran tactile</b> : un doigt pour se déplacer, pincer pour zoomer, tourner à deux doigts, glisser à deux doigts vers le haut ou le bas pour incliner.
          </p>
          <p>
            <b>Clavier</b> : ↑↓←→ ou ZQSD pour se déplacer, A/E pour tourner, R/F pour incliner, +/− pour zoomer, N pour le nord, Maj + ←/→ pour l’heure, Espace pour lire la journée,
            Échap pour fermer ou quitter la vue schéma.
          </p>
          <p>
            <b>Boutons</b> : maintenir appuyé pour un mouvement continu.
          </p>
        </div>
      )}
    </div>
  );
}
