/**
 * GPU wind engine: static terrain textures + compute passes producing the
 * wind field, auxiliary fields (thermal, lee, venturi) and lift, all inside
 * MapLibre's WebGL2 context so every layer can sample them directly.
 *
 * Recomputing the full 1.6 M-cell field takes a few milliseconds, which is
 * what makes the hour / wind / height sliders feel live.
 */
import type { CellResult, CuratedBreezeInfo, ModelParams } from '../model/field';
import { windowActivity } from '../model/field';
import { windVector, type Grid } from '../model/grid';
import { smoothstep } from '../model/raster';
import { RULES } from '../model/rules';
import { legalTimeToUtc, noonElevation, solarTime, sunPosition, type SunPosition } from '../model/sun';
import { compileProgram, createFramebuffer, createTexture, FULLSCREEN_VS, uniforms, type Uniforms } from './gl-utils';
import { FIELD_FS, HOTSPOT_FS, INSOLATION_FS, LIFT_FS, PROBE_FS, SAMPLE_FS } from './model-glsl';

/** Packed static terrain, 4 floats per cell per texture (see worker). */
export interface StaticPack {
  tZ: Float32Array;
  tV: Float32Array;
  tW: Float32Array;
  tR: Float32Array;
  tC: Float32Array;
  breezes: CuratedBreezeInfo[];
}

export interface TimeState {
  sun: SunPosition;
  solarHour: number;
  valleyPhase: number;
  waterPhase: number;
  season: number;
  night: boolean;
}

export interface Hotspot {
  lon: number;
  lat: number;
  /** Mercator x, y. */
  mx: number;
  my: number;
  strength: number;
}

function cycle(t: number, s: [number, number, number, number], nightValue: number): number {
  const [a, b, c, d] = s;
  if (t <= a - 2 || t >= d + 2) return -nightValue;
  if (t < a) return -nightValue * smoothstep(a, a - 2, t);
  if (t < b) return smoothstep(a, b, t);
  if (t <= c) return 1;
  if (t < d) return 1 - smoothstep(c, d, t);
  return -nightValue * smoothstep(d, d + 2, t);
}

export function timeState(grid: Grid, p: ModelParams): TimeState {
  const lon = grid.colLon(grid.width / 2);
  const lat = grid.rowLat(grid.height / 2);
  const utc = legalTimeToUtc(p.year, p.month0, p.day, p.hour);
  const sun = sunPosition(utc, lat, lon);
  const solarHour = solarTime(utc, lon);
  const season = Math.min(1, Math.max(0.2, (noonElevation(p.month0, p.day, lat) - 18) / 48));
  return {
    sun,
    solarHour,
    season,
    night: sun.elevation < 3,
    valleyPhase: cycle(solarHour, RULES.valleySchedule, RULES.valleyNightRatio),
    waterPhase: cycle(solarHour, RULES.waterSchedule, 0.25),
  };
}

export const SAMPLE_MAX = 64;

const VALLEY_KINDS = new Set(['valley', 'downvalley', 'lake', 'pass-transfer', 'katabatic']);

export class GpuWindEngine {
  readonly grid: Grid;
  /** u, v, dynamic lift, turbulence. */
  fieldTex!: WebGLTexture;
  /** thermal, lee, venturi, insolation. */
  auxTex!: WebGLTexture;
  /** convergence, total lift. */
  liftTex!: WebGLTexture;
  /** z, gx, gy, tpi — also the fallback ground height for layers. */
  zTex!: WebGLTexture;
  /** Bumped every time the field changes; layers use it to refresh. */
  version = 0;
  time: TimeState | null = null;
  params: ModelParams | null = null;

  private gl: WebGL2RenderingContext;
  private tex: Record<'V' | 'W' | 'R' | 'C' | 'B' | 'insol' | 'probe' | 'hot' | 'sample', WebGLTexture> = {} as never;
  private fbInsol!: WebGLFramebuffer;
  private fbField!: WebGLFramebuffer;
  private fbLift!: WebGLFramebuffer;
  private fbProbe!: WebGLFramebuffer;
  private fbHot!: WebGLFramebuffer;
  private fbSample!: WebGLFramebuffer;
  private progs: Record<'insol' | 'field' | 'lift' | 'probe' | 'hot' | 'sample', { p: WebGLProgram; u: Uniforms }> = {} as never;
  private vao!: WebGLVertexArrayObject;
  private breezes: CuratedBreezeInfo[];
  private breezeData: Float32Array;
  private timeKey = '';
  private dirtyField = true;
  private dirtyTime = true;
  private hotBlock = 6;
  private hotW: number;
  private hotH: number;

  constructor(gl: WebGL2RenderingContext, grid: Grid, pack: StaticPack) {
    this.gl = gl;
    this.grid = grid;
    this.breezes = pack.breezes;
    this.breezeData = new Float32Array(Math.max(1, pack.breezes.length) * 4);
    this.hotW = Math.ceil(grid.width / this.hotBlock);
    this.hotH = Math.ceil(grid.height / this.hotBlock);
    const { width: w, height: h } = grid;
    const half = { internal: gl.RGBA16F, format: gl.RGBA, type: gl.FLOAT };
    const lin = gl.LINEAR;
    this.zTex = createTexture(gl, w, h, { ...half, filter: lin, data: pack.tZ });
    this.tex.V = createTexture(gl, w, h, { ...half, data: pack.tV });
    this.tex.W = createTexture(gl, w, h, { ...half, data: pack.tW });
    this.tex.R = createTexture(gl, w, h, { ...half, data: pack.tR });
    // Curated breeze index must stay exact: 32-bit.
    this.tex.C = createTexture(gl, w, h, { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT, data: pack.tC });
    this.tex.B = createTexture(gl, Math.max(1, pack.breezes.length), 1, { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT, data: this.breezeData });
    this.tex.insol = createTexture(gl, w, h, { internal: gl.R16F, format: gl.RED, type: gl.FLOAT });
    this.fieldTex = createTexture(gl, w, h, { ...half, filter: lin });
    this.auxTex = createTexture(gl, w, h, { ...half, filter: lin });
    this.liftTex = createTexture(gl, w, h, { ...half, filter: lin });
    this.tex.probe = createTexture(gl, 8, 1, { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT });
    this.tex.hot = createTexture(gl, this.hotW, this.hotH, { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT });
    this.fbInsol = createFramebuffer(gl, [this.tex.insol]);
    this.fbField = createFramebuffer(gl, [this.fieldTex, this.auxTex]);
    this.fbLift = createFramebuffer(gl, [this.liftTex]);
    this.fbProbe = createFramebuffer(gl, [this.tex.probe]);
    this.fbHot = createFramebuffer(gl, [this.tex.hot]);
    this.tex.sample = createTexture(gl, SAMPLE_MAX, 1, { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT });
    this.fbSample = createFramebuffer(gl, [this.tex.sample]);
    const mk = (fs: string, label: string) => {
      const p = compileProgram(gl, FULLSCREEN_VS, fs, label);
      return { p, u: uniforms(gl, p) };
    };
    this.progs.insol = mk(INSOLATION_FS, 'insolation');
    this.progs.field = mk(FIELD_FS, 'field');
    this.progs.lift = mk(LIFT_FS, 'lift');
    this.progs.probe = mk(PROBE_FS, 'probe');
    this.progs.hot = mk(HOTSPOT_FS, 'hotspots');
    this.progs.sample = mk(SAMPLE_FS, 'sample');
    this.vao = gl.createVertexArray()!;
  }

  setParams(p: ModelParams): void {
    const key = `${p.year}-${p.month0}-${p.day}-${p.hour.toFixed(3)}`;
    if (key !== this.timeKey) {
      this.timeKey = key;
      this.time = timeState(this.grid, p);
      this.dirtyTime = true;
      // Curated breeze activity depends on the hour.
      this.breezes.forEach((b, i) => {
        const act = b.window ? windowActivity(p.hour, b.window) : Math.max(0, this.time!.valleyPhase);
        this.breezeData.set([b.speedMs, act, VALLEY_KINDS.has(b.kind) ? 1 : 0, 0], i * 4);
      });
    }
    this.params = p;
    this.dirtyField = true;
  }

  get needsUpdate(): boolean {
    return this.dirtyField || this.dirtyTime;
  }

  private bindModelUniforms(u: Uniforms): void {
    const gl = this.gl;
    const p = this.params!;
    const t = this.time!;
    const g = windVector(p.synoptic.fromDeg, p.synoptic.speedKmh / 3.6);
    const r = (p.synoptic.fromDeg * Math.PI) / 180;
    const units: [string, WebGLTexture][] = [
      ['tZ', this.zTex],
      ['tV', this.tex.V],
      ['tW', this.tex.W],
      ['tR', this.tex.R],
      ['tC', this.tex.C],
      ['tB', this.tex.B],
      ['tInsol', this.tex.insol],
    ];
    units.forEach(([name, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u[name], i);
    });
    gl.uniform2i(u.uGrid, this.grid.width, this.grid.height);
    gl.uniform1f(u.uPy0, this.grid.meta.py0);
    gl.uniform1f(u.uWorldPx, this.grid.worldPx);
    gl.uniform1f(u.uNight, t.night ? 1 : 0);
    gl.uniform1f(u.uSunElev, t.sun.elevation);
    gl.uniform1f(u.uSeason, t.season);
    gl.uniform1f(u.uValleyPhase, t.valleyPhase);
    gl.uniform1f(u.uWaterPhase, t.waterPhase);
    gl.uniform2f(u.uG, g[0], g[1]);
    gl.uniform1f(u.uGSpeed, p.synoptic.speedKmh / 3.6);
    gl.uniform1f(u.uGKmh, p.synoptic.speedKmh);
    gl.uniform2f(u.uUp, Math.sin(r), -Math.cos(r));
    gl.uniform1f(u.uHeightMode, p.height.mode === 'asl' ? 1 : 0);
    gl.uniform1f(u.uHeightM, p.height.meters);
    gl.uniform1f(u.uBreezeScale, p.breezeScale);
  }

  private draw(fb: WebGLFramebuffer, w: number, h: number, buffers: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.drawBuffers(Array.from({ length: buffers }, (_, i) => gl.COLOR_ATTACHMENT0 + i));
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Runs the dirty passes. Call from a custom layer's prerender (GL state is ours). */
  update(): boolean {
    if (!this.params || !this.needsUpdate) return false;
    const gl = this.gl;
    const { width: w, height: h } = this.grid;
    if (this.dirtyTime) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex.B);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, Math.max(1, this.breezes.length), 1, gl.RGBA, gl.FLOAT, this.breezeData);
      const { sun } = this.time!;
      const el = (sun.elevation * Math.PI) / 180;
      const az = (sun.azimuth * Math.PI) / 180;
      const { p, u } = this.progs.insol;
      gl.useProgram(p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.zTex);
      gl.uniform1i(u.tZ, 0);
      gl.uniform2i(u.uGrid, w, h);
      gl.uniform1f(u.uPy0, this.grid.meta.py0);
      gl.uniform1f(u.uWorldPx, this.grid.worldPx);
      gl.uniform3f(u.uSun, Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(Math.max(el, 0.005)));
      gl.uniform1f(u.uTanEl, Math.tan(Math.max(el, 0.005)));
      gl.uniform1f(u.uAtten, sun.elevation > -1 ? smoothstep(-1, 12, sun.elevation) : 0);
      gl.uniform2f(u.uSunStep, Math.sin(az), -Math.cos(az));
      this.draw(this.fbInsol, w, h, 1);
      this.dirtyTime = false;
    }
    {
      const { p, u } = this.progs.field;
      gl.useProgram(p);
      this.bindModelUniforms(u);
      this.draw(this.fbField, w, h, 2);
    }
    {
      const { p, u } = this.progs.lift;
      gl.useProgram(p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
      gl.uniform1i(u.tField, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.auxTex);
      gl.uniform1i(u.tAux, 1);
      gl.uniform2i(u.uGrid, w, h);
      gl.uniform1f(u.uPy0, this.grid.meta.py0);
      gl.uniform1f(u.uWorldPx, this.grid.worldPx);
      gl.uniform1f(u.uDepth, RULES.convergenceDepth);
      this.draw(this.fbLift, w, h, 1);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.dirtyField = false;
    this.version++;
    return true;
  }

  /** Full breakdown of the model at one point (synchronous GPU readback). */
  probe(lon: number, lat: number): (CellResult & { convergence: number; lift: number; curatedName: string | null }) | null {
    if (!this.params || !this.grid.contains(lon, lat)) return null;
    const gl = this.gl;
    const [x, y] = this.grid.toGrid(lon, lat);
    const { p, u } = this.progs.probe;
    gl.useProgram(p);
    this.bindModelUniforms(u);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this.liftTex);
    gl.uniform1i(u.tLift, 7);
    gl.uniform2i(u.uCell, Math.floor(x), Math.floor(y));
    this.draw(this.fbProbe, 8, 1, 1);
    const out = new Float32Array(32);
    gl.readPixels(0, 0, 8, 1, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const v = (i: number): [number, number] => [out[i], out[i + 1]];
    const cidx = Math.round(out[20]);
    return {
      total: v(0),
      synoptic: v(2),
      slope: v(4),
      valley: v(6),
      curated: v(8),
      regional: v(10),
      elevation: out[12],
      heightAgl: out[13],
      slopeDeg: out[14],
      aspectDeg: out[15],
      insolation: out[16],
      valleyLevel: out[17],
      valleyDepth: out[18],
      curatedWeight: out[19],
      curatedIndex: cidx,
      breezeWeight: out[21],
      shelterDeg: out[22],
      lee: out[23],
      venturi: out[24],
      channelling: out[25],
      dynamicLift: out[26],
      thermal: out[27],
      turbulence: out[28],
      convergence: out[29],
      underground: out[30] > 0.5,
      lift: out[31],
      breeze: [0, 0],
      curatedName: cidx >= 0 ? (this.breezes[cidx]?.name ?? null) : null,
    };
  }

  /** Strongest thermal spots (local maxima of the thermal potential), for the 3D columns. */
  hotspots(limit = 60, minSpacingKm = 4, threshold = 0.42): Hotspot[] {
    if (!this.params) return [];
    const gl = this.gl;
    const { p, u } = this.progs.hot;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.auxTex);
    gl.uniform1i(u.tAux, 0);
    gl.uniform2i(u.uGrid, this.grid.width, this.grid.height);
    gl.uniform1i(u.uBlock, this.hotBlock);
    this.draw(this.fbHot, this.hotW, this.hotH, 1);
    const data = new Float32Array(this.hotW * this.hotH * 4);
    gl.readPixels(0, 0, this.hotW, this.hotH, gl.RGBA, gl.FLOAT, data);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const cands: { s: number; x: number; y: number }[] = [];
    for (let k = 0; k < this.hotW * this.hotH; k++) if (data[k * 4] > threshold) cands.push({ s: data[k * 4], x: data[k * 4 + 1], y: data[k * 4 + 2] });
    cands.sort((a, b) => b.s - a.s);
    const minCells = (minSpacingKm * 1000) / this.grid.cellM[this.grid.height >> 1];
    const picked: typeof cands = [];
    for (const c of cands) {
      if (picked.length >= limit) break;
      if (picked.every((q) => (q.x - c.x) ** 2 + (q.y - c.y) ** 2 > minCells * minCells)) picked.push(c);
    }
    const [mx0, my0, mx1, my1] = this.grid.mercatorBounds();
    return picked.map((c) => ({
      lon: this.grid.colLon(c.x + 0.5),
      lat: this.grid.rowLat(c.y + 0.5),
      mx: mx0 + ((c.x + 0.5) / this.grid.width) * (mx1 - mx0),
      my: my0 + ((c.y + 0.5) / this.grid.height) * (my1 - my0),
      strength: c.s,
    }));
  }

  /** Thermal potential, lift and wind at up to SAMPLE_MAX points (aux.x, lift.y, |wind|). */
  sample(points: [number, number][]): Float32Array {
    const n = Math.min(points.length, SAMPLE_MAX);
    const out = new Float32Array(n * 4);
    if (!n || !this.params) return out;
    const gl = this.gl;
    const { p, u } = this.progs.sample;
    gl.useProgram(p);
    const cells = new Int32Array(SAMPLE_MAX * 2);
    for (let i = 0; i < n; i++) {
      const [x, y] = this.grid.toGrid(points[i][0], points[i][1]);
      cells[i * 2] = Math.max(0, Math.min(this.grid.width - 1, Math.floor(x)));
      cells[i * 2 + 1] = Math.max(0, Math.min(this.grid.height - 1, Math.floor(y)));
    }
    gl.uniform2iv(u.uCells, cells);
    const units: [string, WebGLTexture][] = [
      ['tField', this.fieldTex],
      ['tAux', this.auxTex],
      ['tLift', this.liftTex],
    ];
    units.forEach(([name, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u[name], i);
    });
    this.draw(this.fbSample, n, 1, 1);
    gl.readPixels(0, 0, n, 1, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of [this.zTex, this.fieldTex, this.auxTex, this.liftTex, ...Object.values(this.tex)]) gl.deleteTexture(t);
    for (const fb of [this.fbInsol, this.fbField, this.fbLift, this.fbProbe, this.fbHot, this.fbSample]) gl.deleteFramebuffer(fb);
    for (const { p } of Object.values(this.progs)) gl.deleteProgram(p);
    gl.deleteVertexArray(this.vao);
  }
}
