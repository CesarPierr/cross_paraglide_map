/**
 * The 3D wind scene: three MapLibre custom layers sharing one GPU engine.
 *
 * - `engine`  (invisible, first): recomputes the field when parameters
 *   change, refreshes the terrain height map, serves probe/sample requests.
 *   GPU work is only legal inside MapLibre's render callbacks, so every
 *   readback is queued and resolved there.
 * - `drape`   (renderToTerrainTile): colour-mapped analysis painted onto the
 *   terrain tiles, below labels and markers.
 * - `scene`   (3D): wind particles, breeze comets and thermal bubbles.
 */
import type { CustomLayerInterface, CustomRenderMethodInput, CustomTerrainRenderInput, Map as MlMap } from 'maplibre-gl';
import { pacerFor } from '../map/frame-pacer';
import type { CuratedBreezeInput } from '@brises/model';
import type { ModelParams } from '@brises/model';
import { conditionFactor, windowActivity } from '@brises/model';
import type { Grid } from '@brises/model';
import type { OverlayMode } from '../engine/cpu-overlays';
import { smoothstep } from '@brises/model';
import { GpuWindEngine, SAMPLE_MAX, type Hotspot, type StaticPack } from './engine';
import { compileProgram, createFramebuffer, createTexture, FULLSCREEN_VS, uniforms, type Uniforms } from './gl-utils';
import { BUBBLE_FS, BUBBLE_VS, COMET_VS, DRAPE_FS, DRAPE_VS, PARTICLE_UPDATE_FS, PARTICLE_VS, RIBBON_FS, TRAIL } from './scene-glsl';

export interface SceneSettings {
  particles: boolean;
  particleCount: number;
  particleSpeed: number;
  colorMode: 'speed' | 'lift';
  heightMode: 'agl' | 'asl';
  heightM: number;
  exaggeration: number;
  comets: boolean;
  thermals: boolean;
  overlay: OverlayMode;
  overlayOpacity: number;
}

export interface ThermalSpot {
  name: string;
  lon: number;
  lat: number;
  massif?: string;
  /** Strength from the documentation (0..1): how firmly the sources describe this climb. */
  documented?: () => number;
}

type ProbeResult = ReturnType<GpuWindEngine['probe']>;

const OVERLAY_INDEX: Record<OverlayMode, number> = { none: 0, exposure: 1, thermal: 2, convergence: 3, lift: 4, speed: 5 };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface CometTrack {
  pts: Float64Array; // cells x, y
  cum: Float64Array; // cumulative length (cells)
  length: number;
  color: [number, number, number];
  speedMs: number;
  window: [number, number] | null;
  condition: CuratedBreezeInput['condition'];
  strength: number;
  phases: number[];
}

export class WindScene {
  engine: GpuWindEngine | null = null;
  readonly engineLayer: CustomLayerInterface;
  readonly drapeLayer: CustomLayerInterface & { terrainTileRevision: number };
  readonly sceneLayer: CustomLayerInterface;

  private map: MlMap | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private settings: SceneSettings;
  private params: ModelParams | null = null;
  private pendingProbe: { lon: number; lat: number; resolve: (r: ProbeResult) => void } | null = null;
  private hotspots: Hotspot[] = [];
  private hotspotVersion = -1;
  private lastHotspotTime = 0;
  private spots: ThermalSpot[] = [];
  private onUpdated: (() => void) | null = null;

  // Height map shared by the 3D layers.
  private hmapTex: WebGLTexture | null = null;
  private hmapSize = 1536;
  private hmapBounds: [number, number, number, number] = [0, 0, 1, 1];
  private hmapOn = false;
  private hmapKey = '';
  private frame = 0;

  // Particles.
  private stateTex: WebGLTexture[] = [];
  private stateFb: WebGLFramebuffer[] = [];
  private stateW = 128;
  private stateH = 1;
  private stateIdx = 0;
  private needReset = true;
  private progUpdate: { p: WebGLProgram; u: Uniforms } | null = null;
  private progParticles: { p: WebGLProgram; u: Uniforms } | null = null;
  private progComets: { p: WebGLProgram; u: Uniforms } | null = null;
  private progBubbles: { p: WebGLProgram; u: Uniforms } | null = null;
  private progDrape: { p: WebGLProgram; u: Uniforms } | null = null;
  private vaoEmpty: WebGLVertexArrayObject | null = null;
  private lastTime = 0;
  private time = 0;

  // Comets.
  private tracks: CometTrack[] = [];
  private cometVao: WebGLVertexArrayObject | null = null;
  private cometVbo: WebGLBuffer | null = null;
  private cometIbo: WebGLBuffer | null = null;
  private cometData = new Float32Array(0);
  private cometCapacity = 0;

  constructor(
    private grid: Grid,
    private pack: StaticPack,
    curated: CuratedBreezeInput[],
    breezeColors: Record<string, string>,
    settings: SceneSettings,
  ) {
    this.settings = settings;
    this.tracks = curated.map((b) => {
      const pts = new Float64Array(b.coords.length * 2);
      const cum = new Float64Array(b.coords.length);
      b.coords.forEach(([lon, lat], i) => {
        const [x, y] = grid.toGrid(lon, lat);
        pts[i * 2] = x;
        pts[i * 2 + 1] = y;
        if (i) cum[i] = cum[i - 1] + Math.hypot(x - pts[i * 2 - 2], y - pts[i * 2 - 1]);
      });
      const length = cum[cum.length - 1] || 0;
      const n = Math.max(1, Math.min(10, Math.round(length / 22)));
      return {
        pts,
        cum,
        length,
        color: hexToRgb(breezeColors[b.kind] ?? '#38bdf8'),
        speedMs: b.speedMs,
        window: b.window,
        condition: b.condition ?? null,
        strength: b.strength,
        phases: Array.from({ length: n }, (_, i) => (i + Math.random() * 0.5) / n),
      };
    });

    this.engineLayer = {
      id: 'wind-engine',
      type: 'custom',
      renderingMode: '2d',
      onAdd: (map, gl) => this.init(map, gl),
      onRemove: () => this.dispose(),
      prerender: (gl, opts) => this.prerenderEngine(gl, opts),
      render: () => {},
    };
    this.drapeLayer = {
      id: 'wind-drape',
      type: 'custom',
      renderingMode: '2d',
      terrainTileRevision: 0,
      render: () => {},
      renderToTerrainTile: (gl, input) => this.renderDrape(gl, input),
    };
    this.sceneLayer = {
      id: 'wind-scene',
      type: 'custom',
      renderingMode: '3d',
      prerender: (gl) => this.prerenderScene(gl),
      render: (gl, opts) => this.renderScene(gl, opts),
    };
  }

  /** Called once the field has been recomputed (UI can refresh readouts). */
  setOnUpdated(cb: () => void): void {
    this.onUpdated = cb;
  }

  setParams(p: ModelParams): void {
    this.params = p;
    this.engine?.setParams(p);
    this.map?.triggerRepaint();
  }

  setSettings(s: SceneSettings): void {
    const prev = this.settings;
    this.settings = s;
    if (this.gl && prev.particleCount !== s.particleCount) this.allocParticles(s.particleCount);
    if (prev.overlay !== s.overlay || prev.overlayOpacity !== s.overlayOpacity) this.bumpDrape();
    if (prev.heightM !== s.heightM || prev.heightMode !== s.heightMode) this.needReset = true;
    this.map?.triggerRepaint();
  }

  setThermalSpots(spots: ThermalSpot[]): void {
    this.spots = spots;
  }

  /**
   * Learning a massif: its documented climbs are shown as the sources describe
   * them (strength from the documentation, whatever the hour). null = live
   * simulation (the model decides from the hour, season and wind).
   */
  setDocumentedMassif(id: string | null): void {
    if (this.documentedMassif === id) return;
    this.documentedMassif = id;
    this.hotspotVersion = -1;
    this.map?.triggerRepaint();
  }

  private documentedMassif: string | null = null;
  private hotspotView = '';

  /** Model breakdown at a point, resolved on the next frame. */
  probe(lon: number, lat: number): Promise<ProbeResult> {
    return new Promise((resolve) => {
      this.pendingProbe?.resolve(null);
      this.pendingProbe = { lon, lat, resolve };
      this.map?.triggerRepaint();
    });
  }

  private bumpDrape(): void {
    this.drapeLayer.terrainTileRevision++;
  }

  private init(map: MlMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.gl = gl;
    this.engine = new GpuWindEngine(gl, this.grid, this.pack);
    // The packed arrays now live on the GPU.
    this.pack = { ...this.pack, tZ: new Float32Array(0), tV: new Float32Array(0), tW: new Float32Array(0), tR: new Float32Array(0), tC: new Float32Array(0), tC2: new Float32Array(0) };
    if (this.params) this.engine.setParams(this.params);
    this.hmapTex = createTexture(gl, this.hmapSize, this.hmapSize, { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.LINEAR });
    const mk = (vs: string, fs: string, label: string) => {
      const p = compileProgram(gl, vs, fs, label);
      return { p, u: uniforms(gl, p) };
    };
    this.progUpdate = mk(FULLSCREEN_VS, PARTICLE_UPDATE_FS, 'particle-update');
    this.progParticles = mk(PARTICLE_VS, RIBBON_FS, 'particles');
    this.progComets = mk(COMET_VS, RIBBON_FS, 'comets');
    this.progBubbles = mk(BUBBLE_VS, BUBBLE_FS, 'bubbles');
    this.progDrape = mk(DRAPE_VS, DRAPE_FS, 'drape');
    this.vaoEmpty = gl.createVertexArray();
    this.allocParticles(this.settings.particleCount);

    // Comet geometry: dynamic vertices, static indices.
    this.cometVao = gl.createVertexArray();
    this.cometVbo = gl.createBuffer();
    this.cometIbo = gl.createBuffer();
    gl.bindVertexArray(this.cometVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cometVbo);
    const stride = 10 * 4;
    const attr = (name: string, size: number, offset: number) => {
      const loc = gl.getAttribLocation(this.progComets!.p, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
    };
    attr('aPos', 2, 0);
    attr('aNext', 2, 2);
    attr('aColor', 4, 4);
    attr('aMeta', 2, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cometIbo);
    gl.bindVertexArray(null);
  }

  private allocParticles(count: number): void {
    const gl = this.gl!;
    for (const t of this.stateTex) gl.deleteTexture(t);
    for (const f of this.stateFb) gl.deleteFramebuffer(f);
    this.stateW = 128;
    this.stateH = Math.max(1, Math.ceil(count / this.stateW));
    this.stateTex = [0, 1].map(() => createTexture(gl, this.stateW, this.stateH, { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT }));
    this.stateFb = this.stateTex.map((t) => createFramebuffer(gl, [t]));
    this.stateIdx = 0;
    this.needReset = true;
  }

  // ---------- Camera helpers ----------

  private cameraMercator(): [number, number, number] {
    const map = this.map!;
    const c = map.getCenter();
    const r = (c.lat * Math.PI) / 180;
    const cx = (c.lng + 180) / 360;
    const cy = (1 - Math.asinh(Math.tan(r)) / Math.PI) / 2;
    const worldSize = 512 * 2 ** map.getZoom();
    const fov = (map.getVerticalFieldOfView() * Math.PI) / 180;
    const dist = (0.5 * map.getCanvas().clientHeight) / Math.tan(fov / 2) / worldSize;
    const pitch = (map.getPitch() * Math.PI) / 180;
    const bearing = (map.getBearing() * Math.PI) / 180;
    const back = dist * Math.sin(pitch);
    return [cx - Math.sin(bearing) * back, cy + Math.cos(bearing) * back, Math.max(dist * Math.cos(pitch), 1e-7)];
  }

  private viewMercator(): [number, number, number, number] | null {
    const b = this.map!.getBounds();
    const toM = (lng: number, lat: number): [number, number] => {
      const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
      return [(lng + 180) / 360, (1 - Math.asinh(Math.tan(r)) / Math.PI) / 2];
    };
    const [x0, y0] = toM(b.getWest(), b.getNorth());
    const [x1, y1] = toM(b.getEast(), b.getSouth());
    const [gx0, gy0, gx1, gy1] = this.grid.mercatorBounds();
    const v: [number, number, number, number] = [Math.max(x0, gx0), Math.max(y0, gy0), Math.min(x1, gx1), Math.min(y1, gy1)];
    return v[2] > v[0] && v[3] > v[1] ? v : null;
  }

  private mercToCells(mx: number, my: number): [number, number] {
    const [gx0, gy0, gx1, gy1] = this.grid.mercatorBounds();
    return [((mx - gx0) / (gx1 - gx0)) * this.grid.width, ((my - gy0) / (gy1 - gy0)) * this.grid.height];
  }

  /** Cells per (m/s) per second so that 5 m/s crosses ~50 px/s on screen at any zoom. */
  private accelCells(): number {
    return (10 * this.settings.particleSpeed * this.grid.worldPx) / (512 * 2 ** this.map!.getZoom());
  }

  private sceneVisible(): boolean {
    return this.settings.particles || this.settings.comets || this.settings.thermals;
  }

  // ---------- Engine layer ----------

  private prerenderEngine(_gl: WebGL2RenderingContext, opts: CustomRenderMethodInput): void {
    const engine = this.engine;
    if (!engine) return;
    const updated = engine.update();
    if (updated) {
      this.bumpDrape();
      this.onUpdated?.();
      this.map?.triggerRepaint();
    }
    if (this.pendingProbe && engine.params) {
      const { lon, lat, resolve } = this.pendingProbe;
      this.pendingProbe = null;
      resolve(engine.probe(lon, lat));
    }
    // Thermal hotspots: refresh at most ~3 times per second after a field change or a view move.
    const now = performance.now();
    const b = this.map!.getBounds();
    const view = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(2)).join(',');
    if (this.settings.thermals && (engine.version !== this.hotspotVersion || view !== this.hotspotView) && now - this.lastHotspotTime > 300 && engine.params) {
      this.hotspotVersion = engine.version;
      this.hotspotView = view;
      this.lastHotspotTime = now;
      const toHot = (s: ThermalSpot, strength: number): Hotspot => {
        const r = (s.lat * Math.PI) / 180;
        return { lon: s.lon, lat: s.lat, mx: (s.lon + 180) / 360, my: (1 - Math.asinh(Math.tan(r)) / Math.PI) / 2, strength };
      };
      // Known climbs in view (all of them, not the first few of the list).
      const pad = 0.05;
      const inView = this.spots.filter((s) => s.lon > b.getWest() - pad && s.lon < b.getEast() + pad && s.lat > b.getSouth() - pad && s.lat < b.getNorth() + pad);
      if (this.documentedMassif) {
        // Learning: the documented climbs of the massif, as described, whatever the hour.
        this.hotspots = inView
          .filter((s) => s.massif === this.documentedMassif)
          .map((s) => toHot(s, s.documented?.() ?? 0.7))
          .slice(0, 96);
      } else {
        // More known climbs in view than the GPU sampler takes: the best documented first.
        const sampled = inView.length > SAMPLE_MAX ? [...inView].sort((x, y) => (y.documented?.() ?? 0) - (x.documented?.() ?? 0)).slice(0, SAMPLE_MAX) : inView;
        const spotSamples = engine.sample(sampled.map((s) => [s.lon, s.lat]));
        const known = sampled.map((s, i) => toHot(s, Math.min(1, spotSamples[i * 4] * 1.15)));
        const model = engine.hotspots(70, 4, 0.45);
        const near = (a: Hotspot, c: Hotspot) => Math.hypot(a.lon - c.lon, (a.lat - c.lat) * 1.4) < 0.04;
        this.hotspots = [...known.filter((k) => k.strength > 0.25), ...model.filter((m) => !known.some((k) => near(k, m)))].slice(0, 96);
      }
    }
    // Terrain height map for the 3D layers.
    if (this.sceneVisible() && opts.renderTerrainHeightMap && this.hmapTex) {
      const vb = this.viewMercator();
      if (vb) {
        const px = (vb[2] - vb[0]) * 0.05;
        const py = (vb[3] - vb[1]) * 0.05;
        const bounds: [number, number, number, number] = [vb[0] - px, vb[1] - py, vb[2] + px, vb[3] + py];
        this.frame++;
        // Re-rendered when the view moves, and every 32 frames only while terrain tiles are still loading.
        const loading = !this.map?.areTilesLoaded();
        const key = bounds.map((v) => v.toFixed(7)).join(',') + `|${this.settings.exaggeration}|${loading ? this.frame >> 5 : 'loaded'}`;
        if (key !== this.hmapKey) {
          this.hmapKey = key;
          this.hmapBounds = bounds;
          opts.renderTerrainHeightMap({ texture: this.hmapTex, width: this.hmapSize, height: this.hmapSize, bounds });
          this.hmapOn = true;
        }
      }
    } else if (!opts.renderTerrainHeightMap) this.hmapOn = false;
  }

  // ---------- Drape layer ----------

  private renderDrape(gl: WebGL2RenderingContext, input: CustomTerrainRenderInput): void {
    const engine = this.engine;
    const mode = OVERLAY_INDEX[this.settings.overlay] ?? 0;
    if (!engine || !mode || !engine.params || !this.progDrape) return;
    const { z, x, y } = input.tileID.canonical;
    const n = 2 ** z;
    const tx0 = x / n;
    const tx1 = (x + 1) / n;
    const ty0 = y / n;
    const ty1 = (y + 1) / n;
    const [gx0, gy0, gx1, gy1] = this.grid.mercatorBounds();
    if (gx1 <= tx0 || gx0 >= tx1 || gy1 <= ty0 || gy0 >= ty1) return;
    const cx = (m: number) => ((m - tx0) / (tx1 - tx0)) * 2 - 1;
    const cy = (m: number) => ((ty1 - m) / (ty1 - ty0)) * 2 - 1;
    const { p, u } = this.progDrape;
    gl.useProgram(p);
    gl.uniform4f(u.uRect, cx(gx0), cy(gy0), cx(gx1), cy(gy1));
    const units: [string, WebGLTexture][] = [
      ['tField', engine.fieldTex],
      ['tAux', engine.auxTex],
      ['tLift', engine.liftTex],
    ];
    units.forEach(([name, tex], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u[name], i);
    });
    const gKmh = engine.params.synoptic.speedKmh;
    gl.uniform1i(u.uMode, mode);
    gl.uniform1f(u.uWindOn, smoothstep(3, 15, gKmh));
    gl.uniform1f(u.uGKmh, gKmh);
    gl.uniform1f(u.uOpacity, this.settings.overlayOpacity);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vaoEmpty);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  // ---------- Scene layer ----------

  private bindCommon(gl: WebGL2RenderingContext, u: Uniforms, opts: CustomRenderMethodInput, firstUnit: number): number {
    const engine = this.engine!;
    gl.uniformMatrix4fv(u.uMatrix, false, opts.defaultProjectionData.mainMatrix as Float32Array);
    gl.uniform4fv(u.uGridMerc, this.grid.mercatorBounds());
    gl.uniform2f(u.uGridSize, this.grid.width, this.grid.height);
    gl.activeTexture(gl.TEXTURE0 + firstUnit);
    gl.bindTexture(gl.TEXTURE_2D, this.hmapTex);
    gl.uniform1i(u.tHeight, firstUnit);
    gl.activeTexture(gl.TEXTURE0 + firstUnit + 1);
    gl.bindTexture(gl.TEXTURE_2D, engine.zTex);
    gl.uniform1i(u.tZ, firstUnit + 1);
    gl.uniform4fv(u.uHeightBounds, this.hmapBounds);
    gl.uniform1f(u.uHeightOn, this.hmapOn ? 1 : 0);
    gl.uniform1f(u.uExag, this.settings.exaggeration);
    gl.uniform2f(u.uViewport, gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2);
    return firstUnit + 2;
  }

  private prerenderScene(gl: WebGL2RenderingContext): void {
    const engine = this.engine;
    if (!engine || !engine.params || !this.settings.particles || !this.progUpdate) return;
    const now = performance.now();
    // Up to 0.12 s per step: at a reduced frame rate the particles keep their real speed.
    const dt = this.lastTime ? Math.min(0.12, (now - this.lastTime) / 1000) : 0.016;
    this.lastTime = now;
    const vb = this.viewMercator();
    if (!vb) return;
    const [vx0, vy0] = this.mercToCells(vb[0], vb[1]);
    const [vx1, vy1] = this.mercToCells(vb[2], vb[3]);
    const [cmx, cmy, cmz] = this.cameraMercator();
    const [cx, cy] = this.mercToCells(cmx, cmy);
    const [gx0, , gx1] = this.grid.mercatorBounds();
    const camH = (cmz / (gx1 - gx0)) * this.grid.width;

    const { p, u } = this.progUpdate;
    gl.useProgram(p);
    const src = this.stateIdx;
    const dst = 1 - src;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stateTex[src]);
    gl.uniform1i(u.tState, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, engine.fieldTex);
    gl.uniform1i(u.tField, 1);
    gl.uniform2f(u.uGridSize, this.grid.width, this.grid.height);
    gl.uniform4f(u.uView, vx0, vy0, vx1, vy1);
    gl.uniform3f(u.uCam, cx, cy, camH);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uAccel, this.accelCells());
    gl.uniform1ui(u.uFrame, this.frame++ & 0xffffff);
    gl.uniform1f(u.uReset, this.needReset ? 1 : 0);
    gl.uniform1f(u.uPy0, this.grid.meta.py0);
    gl.uniform1f(u.uWorldPx, this.grid.worldPx);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.stateFb[dst]);
    gl.viewport(0, 0, this.stateW, this.stateH);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.bindVertexArray(this.vaoEmpty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.stateIdx = dst;
    this.needReset = false;
  }

  private renderScene(gl: WebGL2RenderingContext, opts: CustomRenderMethodInput): void {
    const engine = this.engine;
    if (!engine || !engine.params) return;
    const now = performance.now();
    this.time = now / 1000;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    if (this.settings.particles && this.progParticles) {
      const { p, u } = this.progParticles;
      gl.useProgram(p);
      let unit = this.bindCommon(gl, u, opts, 0);
      const tex: [string, WebGLTexture][] = [
        ['tState', this.stateTex[this.stateIdx]],
        ['tField', engine.fieldTex],
        ['tLift', engine.liftTex],
      ];
      for (const [name, t] of tex) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.uniform1i(u[name], unit++);
      }
      gl.uniform1i(u.uStateW, this.stateW);
      gl.uniform1f(u.uTrailStep, (this.accelCells() * 0.7) / TRAIL);
      gl.uniform1f(u.uHeight, this.settings.heightM);
      gl.uniform1f(u.uAsl, this.settings.heightMode === 'asl' ? 1 : 0);
      const zoom = this.map!.getZoom();
      const zt = Math.min(1, Math.max(0, (zoom - 7) / 4));
      gl.uniform1f(u.uWidth, (1.0 + 0.7 * zt) * dpr);
      gl.uniform1f(u.uZoomAlpha, 0.38 + 0.62 * zt);
      gl.uniform1f(u.uColorMode, this.settings.colorMode === 'lift' ? 1 : 0);
      gl.uniform1f(u.uLiftZ, this.settings.heightMode === 'agl' ? 25 : 0);
      gl.uniform1f(u.uTime, this.time % 1000);
      gl.bindVertexArray(this.vaoEmpty);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (TRAIL + 1) * 2, this.settings.particleCount);
    }

    if (this.settings.comets && this.progComets) this.drawComets(gl, opts, dpr);

    if (this.settings.thermals && this.progBubbles && this.hotspots.length) {
      const { p, u } = this.progBubbles;
      gl.useProgram(p);
      this.bindCommon(gl, u, opts, 0);
      const hot = new Float32Array(96 * 4);
      this.hotspots.forEach((h, i) => hot.set([h.mx, h.my, h.strength, (i * 0.618) % 1], i * 4));
      gl.uniform4fv(u.uHot, hot);
      const perHot = 22;
      gl.uniform1i(u.uPerHot, perHot);
      gl.uniform1f(u.uTime, this.time % 10000);
      const params = engine.params;
      const r = (params.synoptic.fromDeg * Math.PI) / 180;
      const gms = params.synoptic.speedKmh / 3.6;
      // Bubbles climb at ~2.5 m/s while the wind carries them downwind.
      const lat = this.grid.rowLat(this.grid.height / 2);
      const k = 1 / (40075016.686 * Math.cos((lat * Math.PI) / 180));
      gl.uniform2f(u.uDrift, ((-Math.sin(r) * gms) / 2.5) * 0.7 * k, ((Math.cos(r) * gms) / 2.5) * 0.7 * k);
      gl.uniform1f(u.uSize, 7 * dpr);
      gl.bindVertexArray(this.vaoEmpty);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.hotspots.length * perHot);
    }

    gl.depthMask(true);
    gl.bindVertexArray(null);
    // Paced: capped and lowered when idle (see map/frame-pacer.ts).
    if (this.sceneVisible() && this.map) pacerFor(this.map).request();
  }

  private drawComets(gl: WebGL2RenderingContext, opts: CustomRenderMethodInput, dpr: number): void {
    const params = this.engine!.params!;
    const K = 12;
    const accel = this.accelCells();
    // Count active comets.
    const active: { tr: CometTrack; act: number }[] = [];
    let comets = 0;
    for (const tr of this.tracks) {
      if (tr.length < 2) continue;
      // Conditional breezes only stream when their condition holds (field.ts → curatedActivity).
      const cond = tr.condition ? conditionFactor(tr.condition, params) : 1;
      const act = cond * (tr.window ? windowActivity(params.hour, tr.window) : tr.condition?.wind ? 1 : windowActivity(params.hour, [11, 19]));
      if (act < 0.05) continue;
      active.push({ tr, act });
      comets += tr.phases.length;
    }
    if (!comets) return;
    const floatsPerVertex = 10;
    const nVerts = comets * K * 2;
    if (this.cometData.length < nVerts * floatsPerVertex) this.cometData = new Float32Array(nVerts * floatsPerVertex * 1.5);
    const data = this.cometData;
    let o = 0;
    const at = (tr: CometTrack, s: number): [number, number] => {
      s = Math.max(0, Math.min(tr.length, s));
      let lo = 0;
      let hi = tr.cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (tr.cum[mid] <= s) lo = mid;
        else hi = mid;
      }
      const seg = tr.cum[hi] - tr.cum[lo] || 1;
      const t = (s - tr.cum[lo]) / seg;
      return [tr.pts[lo * 2] + (tr.pts[hi * 2] - tr.pts[lo * 2]) * t, tr.pts[lo * 2 + 1] + (tr.pts[hi * 2 + 1] - tr.pts[lo * 2 + 1]) * t];
    };
    for (const { tr, act } of active) {
      const v = tr.speedMs * accel * 0.9; // cells per second
      const trail = Math.min(tr.length * 0.35, Math.max(v * 1.6, 3));
      const alpha = act * (0.45 + 0.55 * tr.strength);
      for (const ph of tr.phases) {
        const span = tr.length + trail;
        const head = ((ph * span + this.time * v) % span + span) % span;
        for (let k = 0; k < K; k++) {
          const t = k / (K - 1);
          const s = head - t * trail;
          const [x, y] = at(tr, s);
          const [nx, ny] = at(tr, s - trail / (K - 1));
          // Fade where the trail runs past the ends of the breeze.
          const inRange = s >= 0 && s <= tr.length ? 1 : 0;
          const edge = smoothstep(0, 4, s) * (1 - smoothstep(tr.length - 4, tr.length, s));
          for (const side of [-1, 1]) {
            data[o++] = x;
            data[o++] = y;
            data[o++] = nx === x && ny === y ? x + 0.01 : nx;
            data[o++] = ny;
            data[o++] = tr.color[0];
            data[o++] = tr.color[1];
            data[o++] = tr.color[2];
            data[o++] = alpha * inRange * edge;
            data[o++] = t;
            data[o++] = side;
          }
        }
      }
    }
    // Indices (rebuilt only when the comet count grows).
    if (comets > this.cometCapacity) {
      const idx = new Uint32Array(comets * (K - 1) * 6);
      let q = 0;
      for (let c = 0; c < comets; c++) {
        for (let k = 0; k < K - 1; k++) {
          const a = (c * K + k) * 2;
          idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], q);
          q += 6;
        }
      }
      gl.bindVertexArray(this.cometVao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cometIbo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      this.cometCapacity = comets;
    }
    const { p, u } = this.progComets!;
    gl.useProgram(p);
    this.bindCommon(gl, u, opts, 0);
    gl.uniform1f(u.uHeight, 70);
    gl.uniform1f(u.uWidth, 3.2 * dpr);
    gl.bindVertexArray(this.cometVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cometVbo);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, o), gl.STREAM_DRAW);
    gl.drawElements(gl.TRIANGLES, comets * (K - 1) * 6, gl.UNSIGNED_INT, 0);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    this.engine?.dispose();
    for (const t of [...this.stateTex, this.hmapTex]) if (t) gl.deleteTexture(t);
    for (const f of this.stateFb) gl.deleteFramebuffer(f);
    for (const pr of [this.progUpdate, this.progParticles, this.progComets, this.progBubbles, this.progDrape]) if (pr) gl.deleteProgram(pr.p);
    for (const b of [this.cometVbo, this.cometIbo]) if (b) gl.deleteBuffer(b);
    for (const v of [this.vaoEmpty, this.cometVao]) if (v) gl.deleteVertexArray(v);
    this.gl = null;
    this.map = null;
  }
}
