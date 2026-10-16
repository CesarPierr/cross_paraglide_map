/**
 * GPU time of a few passes (EXT_disjoint_timer_query_webgl2, where the browser exposes it):
 * a small pool of queries, read back a few frames later without stalling, averaged per
 * label. Used to adapt the clouds' resolution and steps to the GPU, and readable in
 * development (`__game.world.sky.timings`). No allocation per frame.
 */
interface Entry {
  label: string;
  q: WebGLQuery;
  busy: boolean;
}

export class GpuTimer {
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private entries: Entry[] = [];
  private active: Entry | null = null;
  /** Smoothed milliseconds per label. */
  readonly ms: Record<string, number> = {};

  constructor(private gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
    if (!this.ext) return;
    for (let i = 0; i < 24; i++) {
      const q = gl.createQuery();
      if (q) this.entries.push({ label: '', q, busy: false });
    }
  }

  get available(): boolean {
    return this.ext !== null && this.entries.length > 0;
  }

  begin(label: string): void {
    if (!this.ext || this.active) return;
    let e: Entry | null = null;
    for (const x of this.entries)
      if (!x.busy) {
        e = x;
        break;
      }
    if (!e) return;
    e.label = label;
    e.busy = true;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, e.q);
    this.active = e;
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.active = null;
  }

  /** Collects the finished queries (once per frame, outside any begin/end). */
  poll(): void {
    if (!this.ext || this.active) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    for (const e of this.entries) {
      if (!e.busy || !gl.getQueryParameter(e.q, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (!disjoint) {
        const v = (gl.getQueryParameter(e.q, gl.QUERY_RESULT) as number) / 1e6;
        const old = this.ms[e.label];
        this.ms[e.label] = old === undefined ? v : old + (v - old) * 0.08;
      }
      e.busy = false;
    }
  }

  dispose(): void {
    for (const e of this.entries) this.gl.deleteQuery(e.q);
    this.entries = [];
  }
}
