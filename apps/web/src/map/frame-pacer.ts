/**
 * Frame pacing for the animated wind layers. Without it every animation frame
 * asks MapLibre for a full repaint (3D terrain and all layers) at the display
 * rate, 60 to 120 times per second, even when nobody touches the map.
 *
 * The pacer caps the animation rate, drops it further after a while without
 * input, stops while the tab is hidden, and adapts to the device: on battery
 * or on a modest machine the "auto" mode behaves like "eco". Particles move
 * with real time, so a lower rate does not slow the flow down.
 */
import type { Map as MlMap } from 'maplibre-gl';

export type PowerMode = 'auto' | 'eco' | 'max';

interface Budget {
  activeFps: number;
  /** After a short while without input. */
  idleFps: number;
  /** After several minutes without input. */
  deepIdleFps: number;
  /** Device pixel ratio cap for the whole map. */
  maxDpr: number;
  /** Upper bound on the number of particles. */
  maxParticles: number;
}

const BUDGETS: Record<'eco' | 'balanced' | 'max' | 'phone' | 'phoneLight', Budget> = {
  eco: { activeFps: 24, idleFps: 15, deepIdleFps: 8, maxDpr: 1, maxParticles: 6000 },
  balanced: { activeFps: 30, idleFps: 24, deepIdleFps: 12, maxDpr: 1.5, maxParticles: 20000 },
  max: { activeFps: 60, idleFps: 30, deepIdleFps: 20, maxDpr: 3, maxParticles: 40000 },
  // Phones: a small, sharp screen. A steady rate with few particles reads better (and costs less)
  // than many particles stuttering at 8-15 fps on a blurry 1x canvas.
  phone: { activeFps: 30, idleFps: 24, deepIdleFps: 15, maxDpr: 1.5, maxParticles: 2500 },
  phoneLight: { activeFps: 24, idleFps: 20, deepIdleFps: 12, maxDpr: 1.25, maxParticles: 1500 },
};

const IDLE_AFTER_MS = 15000;
const DEEP_IDLE_AFTER_MS = 180000;

let onBattery = false;
/** Set when the device cannot keep up with the balanced budget (measured frame times). */
let struggling = false;
const lowEnd = typeof navigator !== 'undefined' && ((navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4);
const listeners = new Set<() => void>();
type BatteryLike = { charging: boolean; addEventListener: (t: string, f: () => void) => void };
void (navigator as { getBattery?: () => Promise<BatteryLike> }).getBattery?.()
  .then((b) => {
    const update = () => {
      onBattery = !b.charging;
      listeners.forEach((f) => f());
    };
    update();
    b.addEventListener('chargingchange', update);
  })
  .catch(() => {});

/** A phone or small tablet held in the hand (touch, narrow screen): always on battery, so battery is no signal there. */
const phone = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse) and (max-width: 1024px)').matches;

/** The budget actually applied for a user setting. */
export function budgetFor(mode: PowerMode): Budget {
  if (mode === 'max') return BUDGETS.max;
  if (phone) return mode === 'eco' || struggling ? BUDGETS.phoneLight : BUDGETS.phone;
  if (mode === 'eco' || lowEnd || onBattery || struggling) return BUDGETS.eco;
  return BUDGETS.balanced;
}

export function onPowerContextChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export class FramePacer {
  private mode: PowerMode = 'auto';
  private lastInput = performance.now();
  private timer: number | null = null;
  private lastFrame = 0;
  private readonly onInput = () => {
    const wasIdle = this.idle();
    this.lastInput = performance.now();
    if (wasIdle) this.request();
  };

  constructor(private map: MlMap) {
    for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'] as const) window.addEventListener(ev, this.onInput, { passive: true });
    map.on('movestart', this.onInput);
    // Measured frame pace: a device that cannot hold the balanced rate falls back to the eco budget.
    const times: number[] = [];
    const since = performance.now();
    map.on('render', () => {
      const now = performance.now();
      if (now - since < 15000) return; // initial tile and terrain loading is not representative
      times.push(now);
      while (times.length && now - times[0] > 3000) times.shift();
      if (struggling || this.mode !== 'auto' || this.idle() || times.length < 20) return;
      const mean = (times[times.length - 1] - times[0]) / (times.length - 1);
      if (mean > 2.2 * (1000 / BUDGETS.balanced.activeFps)) {
        struggling = true;
        listeners.forEach((f) => f());
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.request();
    });
  }

  setMode(mode: PowerMode): void {
    this.mode = mode;
    this.lastInput = performance.now();
  }

  get budget(): Budget {
    return budgetFor(this.mode);
  }

  private idle(): boolean {
    return performance.now() - this.lastInput > IDLE_AFTER_MS;
  }

  /** Asks for the next animation frame, no sooner than the current budget allows. */
  request(): void {
    if (this.timer !== null || document.hidden) return;
    const b = this.budget;
    const quiet = performance.now() - this.lastInput;
    const fps = quiet > DEEP_IDLE_AFTER_MS ? b.deepIdleFps : quiet > IDLE_AFTER_MS ? b.idleFps : b.activeFps;
    const wait = 1000 / fps - (performance.now() - this.lastFrame);
    const fire = () => {
      this.timer = null;
      this.lastFrame = performance.now();
      this.map.triggerRepaint();
    };
    if (wait <= 2) {
      this.timer = -1;
      requestAnimationFrame(fire);
    } else this.timer = window.setTimeout(fire, wait);
  }
}

const pacers = new WeakMap<MlMap, FramePacer>();
export function pacerFor(map: MlMap): FramePacer {
  let p = pacers.get(map);
  if (!p) pacers.set(map, (p = new FramePacer(map)));
  return p;
}
