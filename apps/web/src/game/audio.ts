/**
 * Sound of the flight, all synthesised (nothing to download):
 * - audio vario: beeps rising in pitch and rate with the climb, a low continuous tone in
 *   strong sink, silent in between (as most varios are set);
 * - wind: pink-ish noise through a band-pass whose level grows with the airspeed squared
 *   and whose pitch rises with it (the rush of air on the helmet, louder on the bar);
 * - the canopy: a sharp flap when a side folds, a rustle while it is stalled or folded;
 * - a ground alert: two falling square tones, unlike any vario sound;
 * - a soft click at each brake step, higher the more brake;
 * - a soft chime for the school's important advice and a challenge's goal.
 */
export class AudioVario {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rustleGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private phase = 0;
  enabled = true;

  /** Must be called from a user gesture (browsers block audio otherwise). */
  start(): void {
    if (this.ctx) return;
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.osc = ctx.createOscillator();
      this.gain = ctx.createGain();
      this.osc.type = 'triangle';
      this.gain.gain.value = 0;
      this.osc.connect(this.gain).connect(ctx.destination);
      this.osc.start();
      // Two seconds of pink-ish noise, looped (Paul Kellet's filter).
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      }
      this.noise = buf;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.Q.value = 0.7;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      src.connect(this.windFilter).connect(this.windGain).connect(ctx.destination);
      src.start();
      const rustle = ctx.createBufferSource();
      rustle.buffer = buf;
      rustle.loop = true;
      rustle.playbackRate.value = 0.6;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      this.rustleGain = ctx.createGain();
      this.rustleGain.gain.value = 0;
      rustle.connect(hp).connect(this.rustleGain).connect(ctx.destination);
      rustle.start();
    } catch {
      this.ctx = null;
    }
  }

  /** Per frame: vario (m/s, filtered), true airspeed (m/s), canopy disturbance 0..1. */
  update(vz: number, dt: number, airspeed = 0, disturbed = 0): void {
    if (!this.ctx || !this.osc || !this.gain) return;
    const t = this.ctx.currentTime;
    let level = 0;
    if (this.enabled && vz > 0.15) {
      const rate = 1.6 + vz * 1.6;
      this.phase = (this.phase + dt * rate) % 1;
      level = this.phase < 0.55 ? 0.12 : 0;
      this.osc.frequency.setTargetAtTime(560 + vz * 140, t, 0.02);
    } else if (this.enabled && vz < -2.5) {
      level = 0.04 + Math.min(0.05, (-vz - 2.5) * 0.015);
      this.osc.frequency.setTargetAtTime(Math.max(160, 320 + vz * 18), t, 0.05);
    }
    this.gain.gain.setTargetAtTime(level, t, 0.008);
    if (this.windGain && this.windFilter) {
      const v = Math.max(0, airspeed);
      this.windGain.gain.setTargetAtTime(this.enabled ? Math.min(0.5, 0.0016 * v * v) : 0, t, 0.15);
      this.windFilter.frequency.setTargetAtTime(250 + 45 * v, t, 0.2);
    }
    this.rustleGain?.gain.setTargetAtTime(this.enabled ? 0.25 * disturbed : 0, t, 0.08);
  }

  /** The crack of a folding canopy. */
  flap(): void {
    if (!this.ctx || !this.noise || !this.enabled) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t, Math.random());
    src.stop(t + 0.7);
  }

  /** Two short falling tones: the relief ahead. */
  groundAlert(): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [dt, f] of [[0, 1180], [0.16, 830]] as const) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.07, t + dt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.13);
      o.connect(g).connect(ctx.destination);
      o.start(t + dt);
      o.stop(t + dt + 0.15);
    }
  }

  /** A soft click for a brake step, its pitch rising with the brake (0..1). */
  tick(level: number): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 500 + 900 * level;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.06);
  }

  /**
   * A soft two-note chime (rising fifth, sine): an important piece of advice from the school,
   * or a challenge's goal. Quieter than the vario, at most one every 1.5 s.
   */
  chime(): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (t - this.chimeT < 1.5) return;
    this.chimeT = t;
    for (const [dt, f] of [[0, 660], [0.12, 990]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.045, t + dt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t + dt);
      o.stop(t + dt + 0.4);
    }
  }
  private chimeT = -10;

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
