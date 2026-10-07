/**
 * MapLibre custom layer drawing wind particles in 3D, a given height above the
 * terrain (or at a fixed altitude).
 *
 * - Particle heads are advected on the CPU through the model field (cheap: a
 *   bilinear lookup per particle and frame).
 * - Each particle is drawn as a tapered ribbon whose shape is a short
 *   streamline integrated backwards on the GPU from the head, so trails need
 *   no history buffers and stay correct when the camera moves.
 * - The ground height comes from MapLibre's own rendered terrain
 *   (`renderTerrainHeightMap`) when available, otherwise from the coarse
 *   model DEM, so particles hug the visible relief.
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';
import { pacerFor } from './frame-pacer';
import { EARTH_CIRCUMFERENCE, type Grid } from '@brises/model';

export type ParticleColorMode = 'speed' | 'lift';

export interface ParticleSettings {
  count: number;
  /** Height above ground (m) in 'agl' mode, absolute altitude in 'asl' mode. */
  heightMode: 'agl' | 'asl';
  heightM: number;
  colorMode: ParticleColorMode;
  /** Visual time acceleration multiplier. */
  speed: number;
  exaggeration: number;
}

const TRAIL = 10;

const VS = `#version 300 es
precision highp float;
uniform mat4 u_matrix;
uniform sampler2D u_field;
uniform sampler2D u_dem;
uniform sampler2D u_hmap;
uniform vec4 u_bounds;      // field/DEM mercator bounds minX,minY,maxX,maxY
uniform vec4 u_hbounds;     // heightmap mercator bounds
uniform float u_hmapOn;
uniform float u_trailStep;  // mercator units per (m/s) per trail step, at the equator scale
uniform float u_height;
uniform float u_asl;
uniform float u_exag;
uniform vec2 u_viewport;
uniform float u_width;
uniform float u_colorMode;
in vec3 a_head;             // mercator x, y, age01 (0..1 of lifetime)
out vec4 v_color;
out float v_along;

const float C = ${EARTH_CIRCUMFERENCE.toFixed(3)};
const int T = ${TRAIL};

vec2 fieldUv(vec2 p) { return (p - u_bounds.xy) / (u_bounds.zw - u_bounds.xy); }

vec4 fieldAt(vec2 p) { return texture(u_field, fieldUv(p)); }

float metersToMerc(float my) {
  float y = 3.141592653589793 * (1.0 - 2.0 * my);
  return cosh(y) / C;
}

float groundAt(vec2 p) {
  if (u_hmapOn > 0.5) {
    vec2 huv = vec2((p.x - u_hbounds.x) / (u_hbounds.z - u_hbounds.x), (u_hbounds.w - p.y) / (u_hbounds.w - u_hbounds.y));
    if (huv.x > 0.0 && huv.y > 0.0 && huv.x < 1.0 && huv.y < 1.0) {
      vec4 h = texture(u_hmap, huv);
      if (h.a > 0.5) return h.r;
    }
  }
  return texture(u_dem, fieldUv(p)).r * u_exag;
}

vec4 project(vec2 p) {
  float ground = groundAt(p);
  float z = u_asl > 0.5 ? max(u_height * u_exag, ground + 25.0 * u_exag) : ground + u_height * u_exag;
  return u_matrix * vec4(p, z * metersToMerc(p.y), 1.0);
}

vec3 speedRamp(float kmh) {
  vec3 c0 = vec3(0.80, 0.93, 1.00);
  vec3 c1 = vec3(0.30, 0.85, 1.00);
  vec3 c2 = vec3(0.55, 1.00, 0.45);
  vec3 c3 = vec3(1.00, 0.88, 0.25);
  vec3 c4 = vec3(1.00, 0.45, 0.15);
  vec3 c5 = vec3(0.95, 0.15, 0.45);
  if (kmh < 5.0) return mix(c0, c1, kmh / 5.0);
  if (kmh < 12.0) return mix(c1, c2, (kmh - 5.0) / 7.0);
  if (kmh < 22.0) return mix(c2, c3, (kmh - 12.0) / 10.0);
  if (kmh < 35.0) return mix(c3, c4, (kmh - 22.0) / 13.0);
  // Legend (ui/Legend.tsx): 0, 5, 12, 22, 35, 50+ km/h — full pink at 50 km/h.
  return mix(c4, c5, clamp((kmh - 35.0) / 15.0, 0.0, 1.0));
}

vec3 liftRamp(float w) {
  if (w < 0.0) return mix(vec3(0.85, 0.9, 1.0), vec3(0.25, 0.45, 1.0), clamp(-w / 2.0, 0.0, 1.0));
  return mix(vec3(0.85, 0.95, 0.85), vec3(1.0, 0.55, 0.1), clamp(w / 3.0, 0.0, 1.0));
}

void main() {
  int idx = gl_VertexID / 2;
  float side = (gl_VertexID % 2 == 0) ? -1.0 : 1.0;
  vec2 p = a_head.xy;
  vec2 pPrev = p;
  vec2 pNext = p;
  vec4 f0 = fieldAt(p);
  // Integrate backwards along the flow to find this vertex and its neighbour.
  for (int i = 0; i < T; i++) {
    if (i >= idx + 1) break;
    vec4 f = fieldAt(p);
    vec2 step = vec2(f.x, -f.y) * u_trailStep * metersToMerc(p.y) * C;
    pPrev = p;
    p -= step;
  }
  // p is trail point idx; neighbour: one more step back (or previous point for the tail).
  vec4 fp = fieldAt(p);
  pNext = p - vec2(fp.x, -fp.y) * u_trailStep * metersToMerc(p.y) * C;
  vec4 c0 = project(p);
  vec4 c1 = idx < T ? project(pNext) : project(pPrev);
  vec2 s0 = c0.xy / c0.w * u_viewport;
  vec2 s1 = c1.xy / c1.w * u_viewport;
  vec2 dir = s1 - s0;
  if (idx >= T) dir = -dir;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  float t = float(idx) / float(T);
  float width = u_width * (1.0 - 0.75 * t);
  c0.xy += normal * side * width / u_viewport * c0.w;
  gl_Position = c0;

  float speed = length(f0.xy);
  float age = a_head.z;
  float lifeAlpha = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.8, 1.0, age));
  float calm = smoothstep(0.2, 1.2, speed);
  vec3 col = u_colorMode > 0.5 ? liftRamp(f0.z) : speedRamp(speed * 3.6);
  float a = lifeAlpha * calm * (1.0 - t) * 0.95;
  v_color = vec4(col * a, a);
  v_along = t;
}`;

const FS = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_along;
out vec4 fragColor;
void main() { fragColor = v_color; }`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

/** Deterministic fast PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class WindParticleLayer implements CustomLayerInterface {
  readonly id = 'wind-particles';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MlMap | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private headBuffer: WebGLBuffer | null = null;
  private fieldTex: WebGLTexture | null = null;
  private demTex: WebGLTexture | null = null;
  private hmapTex: WebGLTexture | null = null;
  private hmapSize = 1536;
  private hmapBounds: [number, number, number, number] = [0, 0, 1, 1];
  private hmapOn = false;
  private hmapKey = '';
  private hmapSupported = false;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  private heads = new Float32Array(0);
  private ages = new Float32Array(0);
  private lifetimes = new Float32Array(0);
  private upload = new Float32Array(0);
  private random = rng(7);
  private lastTime = 0;
  private fieldU: Float32Array | null = null;
  private fieldV: Float32Array | null = null;
  private bounds: [number, number, number, number];
  private enabled = true;

  constructor(
    private grid: Grid,
    private settings: ParticleSettings,
  ) {
    this.bounds = grid.mercatorBounds();
    this.resize(settings.count);
  }

  setSettings(s: ParticleSettings): void {
    const countChanged = s.count !== this.settings.count;
    this.settings = s;
    if (countChanged) this.resize(s.count);
    this.map?.triggerRepaint();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.map?.triggerRepaint();
  }

  private resize(n: number): void {
    this.heads = new Float32Array(n * 2);
    this.ages = new Float32Array(n);
    this.lifetimes = new Float32Array(n);
    this.upload = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.heads[i * 2] = -1; // force respawn
      this.lifetimes[i] = 1;
      this.ages[i] = 1;
    }
    if (this.gl && this.headBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.headBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.upload.byteLength, this.gl.DYNAMIC_DRAW);
    }
  }

  /** New model field: RGBA per cell (u, v, w, turbulence), rows north → south. */
  setField(field: Float32Array): void {
    const n = this.grid.size;
    this.fieldU = new Float32Array(n);
    this.fieldV = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      this.fieldU[k] = field[k * 4];
      this.fieldV[k] = field[k * 4 + 1];
    }
    const gl = this.gl;
    if (gl && this.fieldTex) {
      gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.grid.width, this.grid.height, 0, gl.RGBA, gl.FLOAT, field);
    } else this.pendingField = field;
    this.map?.triggerRepaint();
  }

  private pendingField: Float32Array | null = null;
  private pendingDem: Float32Array | null = null;

  setElevation(elev: Float32Array): void {
    const gl = this.gl;
    if (gl && this.demTex) {
      gl.bindTexture(gl.TEXTURE_2D, this.demTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, this.grid.width, this.grid.height, 0, gl.RED, gl.FLOAT, elev);
    } else this.pendingDem = elev;
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    this.program = prog;
    for (const name of [
      'u_matrix',
      'u_field',
      'u_dem',
      'u_hmap',
      'u_bounds',
      'u_hbounds',
      'u_hmapOn',
      'u_trailStep',
      'u_height',
      'u_asl',
      'u_exag',
      'u_viewport',
      'u_width',
      'u_colorMode',
    ])
      this.uniforms[name] = gl.getUniformLocation(prog, name);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.headBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.headBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.upload.byteLength, gl.DYNAMIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_head');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(loc, 1);
    gl.bindVertexArray(null);

    const makeTex = (filter: number) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.fieldTex = makeTex(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(4));
    this.demTex = makeTex(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array(1));
    this.hmapSupported = !!gl.getExtension('EXT_color_buffer_float');
    this.hmapTex = makeTex(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.hmapSize, this.hmapSize, 0, gl.RGBA, gl.HALF_FLOAT, null);
    if (this.pendingField) this.setField(this.pendingField);
    if (this.pendingDem) this.setElevation(this.pendingDem);
    this.pendingField = this.pendingDem = null;
  }

  onRemove(_map: MlMap, gl: WebGL2RenderingContext): void {
    if (this.program) gl.deleteProgram(this.program);
    for (const t of [this.fieldTex, this.demTex, this.hmapTex]) if (t) gl.deleteTexture(t);
    if (this.headBuffer) gl.deleteBuffer(this.headBuffer);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.map = null;
    this.gl = null;
  }

  /** Mercator bounds of the visible area, clipped to the model grid. */
  private viewBounds(): [number, number, number, number] | null {
    const map = this.map!;
    const b = map.getBounds();
    const toM = (lng: number, lat: number): [number, number] => {
      const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
      return [(lng + 180) / 360, (1 - Math.asinh(Math.tan(r)) / Math.PI) / 2];
    };
    const [x0, y0] = toM(b.getWest(), b.getNorth());
    const [x1, y1] = toM(b.getEast(), b.getSouth());
    const [gx0, gy0, gx1, gy1] = this.bounds;
    const v: [number, number, number, number] = [Math.max(x0, gx0), Math.max(y0, gy0), Math.min(x1, gx1), Math.min(y1, gy1)];
    if (v[2] <= v[0] || v[3] <= v[1]) return null;
    return v;
  }

  prerender(_gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    if (!this.enabled || !this.hmapSupported || !options.renderTerrainHeightMap || !this.hmapTex) {
      this.hmapOn = false;
      return;
    }
    const vb = this.viewBounds();
    if (!vb) return;
    // Pad a little so ribbons crossing the edge still find the ground.
    const px = (vb[2] - vb[0]) * 0.05;
    const py = (vb[3] - vb[1]) * 0.05;
    const bounds: [number, number, number, number] = [vb[0] - px, vb[1] - py, vb[2] + px, vb[3] + py];
    // Re-rendered when the view moves, and periodically only while terrain tiles are still loading.
    const loading = !this.map?.areTilesLoaded();
    const key = bounds.map((v) => v.toFixed(7)).join(',') + `|${this.settings.exaggeration}|${loading ? this.frameCounter >> 4 : 'loaded'}`;
    if (key === this.hmapKey) return;
    this.hmapKey = key;
    this.hmapBounds = bounds;
    options.renderTerrainHeightMap({ texture: this.hmapTex, width: this.hmapSize, height: this.hmapSize, bounds });
    this.hmapOn = true;
  }

  private frameCounter = 0;

  private step(dt: number): void {
    const map = this.map!;
    const { width: w, height: h } = this.grid;
    const [gx0, gy0, gx1, gy1] = this.bounds;
    const sx = w / (gx1 - gx0);
    const sy = h / (gy1 - gy0);
    const fu = this.fieldU;
    const fv = this.fieldV;
    const vb = this.viewBounds();
    // Visual speed: particles cross ~50 px/s at 5 m/s whatever the zoom.
    const zoom = map.getZoom();
    const mercPerPx = 1 / (512 * 2 ** zoom);
    const accel = (50 * mercPerPx * this.settings.speed) / (5 / EARTH_CIRCUMFERENCE);
    // Camera position for distance-weighted spawning (keeps near-field density in pitched views).
    const [camX, camY, camZ] = this.cameraMercator();
    const n = this.ages.length;
    const rand = this.random;
    for (let i = 0; i < n; i++) {
      let x = this.heads[i * 2];
      let y = this.heads[i * 2 + 1];
      let age = this.ages[i] + dt / this.lifetimes[i];
      let inside = x >= gx0 && y >= gy0 && x < gx1 && y < gy1;
      if (inside && fu && fv) {
        const fx = (x - gx0) * sx - 0.5;
        const fy = (y - gy0) * sy - 0.5;
        const ii = Math.max(0, Math.min(w - 2, fx | 0));
        const jj = Math.max(0, Math.min(h - 2, fy | 0));
        const tx = Math.min(1, Math.max(0, fx - ii));
        const ty = Math.min(1, Math.max(0, fy - jj));
        const o = jj * w + ii;
        const u = (fu[o] * (1 - tx) + fu[o + 1] * tx) * (1 - ty) + (fu[o + w] * (1 - tx) + fu[o + w + 1] * tx) * ty;
        const v = (fv[o] * (1 - tx) + fv[o + 1] * tx) * (1 - ty) + (fv[o + w] * (1 - tx) + fv[o + w + 1] * tx) * ty;
        const k = Math.cosh(Math.PI * (1 - 2 * y)) / EARTH_CIRCUMFERENCE;
        x += u * k * dt * accel;
        y -= v * k * dt * accel;
        inside = x >= gx0 && y >= gy0 && x < gx1 && y < gy1;
      }
      if (age >= 1 || !inside || (vb && (x < vb[0] || x > vb[2] || y < vb[1] || y > vb[3]))) {
        if (!vb) {
          x = -1;
          y = -1;
        } else {
          // Rejection sampling: favour points close to the camera ground position.
          for (let tries = 0; tries < 12; tries++) {
            x = vb[0] + rand() * (vb[2] - vb[0]);
            y = vb[1] + rand() * (vb[3] - vb[1]);
            const d2 = (x - camX) ** 2 + (y - camY) ** 2;
            const wgt = Math.min(1, (camZ * camZ * 2.5) / (d2 + 1e-14));
            if (rand() < wgt) break;
          }
        }
        // Born transparent so the fade-in runs (no popping).
        age = rand() * 0.02;
        this.lifetimes[i] = 1.5 + rand() * 2.5;
      }
      this.heads[i * 2] = x;
      this.heads[i * 2 + 1] = y;
      this.ages[i] = age;
      this.upload[i * 3] = x;
      this.upload[i * 3 + 1] = y;
      this.upload[i * 3 + 2] = age;
    }
    this.trailStep = (accel * 0.6) / TRAIL / EARTH_CIRCUMFERENCE;
  }

  private trailStep = 0;

  /** Approximate camera position (mercator x, y, height above the centre) from the public camera state. */
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

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    if (!this.enabled || !this.program || !this.fieldU) return;
    const now = performance.now();
    const dt = this.lastTime ? Math.min(0.12, (now - this.lastTime) / 1000) : 0.016;
    this.lastTime = now;
    this.frameCounter++;
    this.step(dt);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.headBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.upload);

    const U = this.uniforms;
    gl.uniformMatrix4fv(U.u_matrix, false, options.defaultProjectionData.mainMatrix as Float32Array);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.uniform1i(U.u_field, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.demTex);
    gl.uniform1i(U.u_dem, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.hmapTex);
    gl.uniform1i(U.u_hmap, 2);
    gl.uniform4fv(U.u_bounds, this.bounds);
    gl.uniform4fv(U.u_hbounds, this.hmapBounds);
    gl.uniform1f(U.u_hmapOn, this.hmapOn ? 1 : 0);
    gl.uniform1f(U.u_trailStep, this.trailStep);
    gl.uniform1f(U.u_height, this.settings.heightM);
    gl.uniform1f(U.u_asl, this.settings.heightMode === 'asl' ? 1 : 0);
    gl.uniform1f(U.u_exag, this.settings.exaggeration);
    gl.uniform2f(U.u_viewport, gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2);
    // Width in drawing-buffer pixels: the map's own pixel ratio (capped on phones), not the screen's.
    gl.uniform1f(U.u_width, 1.6 * (this.map?.getPixelRatio() ?? 1));
    gl.uniform1f(U.u_colorMode, this.settings.colorMode === 'lift' ? 1 : 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (TRAIL + 1) * 2, this.ages.length);
    gl.depthMask(true);
    gl.bindVertexArray(null);
    if (this.map) pacerFor(this.map).request();
  }
}
