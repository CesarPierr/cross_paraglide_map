/**
 * The relief's light for the landscape pass (sky.ts): the slope of the ground under every
 * pixel, the shadows the mountains cast and how much of the sky the relief leaves open,
 * from the elevations of the terrain MapLibre draws.
 *
 * Three levels of elevation around the pilot, each a square in local metres:
 * - near, ~6 km at ~6 m (MapLibre's terrain tiles as it draws them, `renderTerrainHeightMap`);
 * - far, ~60 km at ~60 m (the same, coarser);
 * - regional, ~160 km at ~300 m (the wind model's grid, region.ts): the mountains MapLibre
 *   has not loaded (behind the camera) still cast their shadows.
 * Each level is turned into a texture of slopes and heights, the sky's visibility (the
 * horizon in eight directions, beyond the local slope: deep valleys and gorges get less
 * sky) and the sun's visibility (a march towards the sun through the finest level holding
 * each point, soft edges). The slopes and the sky are redone when the elevations change,
 * the shadows also when the sun moves; nothing per frame otherwise.
 *
 * Per pixel (TERRAIN_GLSL), the finest level holding the point gives its normal, shadow
 * and sky, blended across the edges of the levels.
 */
import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import { FULLSCREEN_VERTEX, fullscreenPass } from './atmosphere';
import type { LocalFrame } from './geo';
import { GpuTimer } from './gpu-timer';
import { DetailTextures } from './materials';
import type { RegionMaps } from './region';

/** MapLibre's `renderTerrainHeightMap` (custom layers, offscreen pass, experimental). */
export type HeightMapFn = (target: { texture: WebGLTexture; width: number; height: number; bounds: [number, number, number, number] }) => void;

/** The levels' uniforms and lookups, shared by the passes below and the landscape pass. */
const LEVELS_GLSL = /* glsl */ `
uniform sampler2D uD0;
uniform sampler2D uD1;
uniform sampler2D uD2;
uniform vec4 uR0;
uniform vec4 uR1;
uniform vec4 uR2;
uniform vec3 uLvRef;
uniform vec3 uLvOn;
vec2 lvUv(vec4 r, vec2 p) { return (p - r.xy) * r.w; }
bool lvIn(vec2 uv) { return all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))); }
// Elevation (m) of the finest level holding p, -1e4 where none does.
float terrainH(vec2 p) {
  vec2 uv;
  vec4 t;
  if (uLvOn.x > 0.5) {
    uv = lvUv(uR0, p);
    if (lvIn(uv)) { t = textureLod(uD0, uv, 0.0); if (t.a > 0.99) return t.b + uLvRef.x; }
  }
  if (uLvOn.y > 0.5) {
    uv = lvUv(uR1, p);
    if (lvIn(uv)) { t = textureLod(uD1, uv, 0.0); if (t.a > 0.99) return t.b + uLvRef.y; }
  }
  if (uLvOn.z > 0.5) {
    uv = lvUv(uR2, p);
    if (lvIn(uv)) { t = textureLod(uD2, uv, 0.0); if (t.a > 0.99) return t.b + uLvRef.z; }
  }
  return -1e4;
}
`;

/**
 * Slopes and heights of a level: the elevations (MapLibre's float texture over mercator
 * bounds, or the regional grid in local metres) resampled on the level's square: uv of a
 * local point x = a·x + b, v = c + A·(y − yc) + B·(y − yc)² (mercator rows are not evenly
 * spaced in metres), bilinear by hand (float textures are not filterable everywhere).
 */
const DERIVED_FS = /* glsl */ `
precision highp float;
uniform highp sampler2D uHeight;
uniform vec2 uMapX;
uniform vec4 uMapY;
uniform vec4 uRect;
uniform float uN;
uniform float uRef;
layout(location = 0) out vec4 fragColor;
float hAt(vec2 p, inout float ok) {
  vec2 uv = vec2(uMapX.x * p.x + uMapX.y, uMapY.x + uMapY.y * (p.y - uMapY.w) + uMapY.z * (p.y - uMapY.w) * (p.y - uMapY.w));
  vec2 sz = vec2(textureSize(uHeight, 0));
  vec2 f = uv * sz - 0.5;
  vec2 i0 = floor(f);
  vec2 t = f - i0;
  ivec2 a = ivec2(clamp(i0, vec2(0.0), sz - 1.0));
  ivec2 b = ivec2(clamp(i0 + 1.0, vec2(0.0), sz - 1.0));
  float h00 = texelFetch(uHeight, a, 0).r;
  float h10 = texelFetch(uHeight, ivec2(b.x, a.y), 0).r;
  float h01 = texelFetch(uHeight, ivec2(a.x, b.y), 0).r;
  float h11 = texelFetch(uHeight, b, 0).r;
  // Elevation 0: no terrain loaded there (the Alps have no sea-level ground in view).
  float v = step(1e-3, abs(h00)) * step(1e-3, abs(h10)) * step(1e-3, abs(h01)) * step(1e-3, abs(h11));
  v *= step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  ok = min(ok, v);
  return mix(mix(h00, h10, t.x), mix(h01, h11, t.x), t.y);
}
void main() {
  vec2 p = uRect.xy + gl_FragCoord.xy / uN * uRect.z;
  float e = uRect.z / uN;
  float ok = 1.0;
  float h = hAt(p, ok);
  float hx0 = hAt(p - vec2(e, 0.0), ok);
  float hx1 = hAt(p + vec2(e, 0.0), ok);
  float hy0 = hAt(p - vec2(0.0, e), ok);
  float hy1 = hAt(p + vec2(0.0, e), ok);
  fragColor = vec4((hx1 - hx0) / (2.0 * e), (hy1 - hy0) / (2.0 * e), h - uRef, ok);
}`;

/**
 * Sky visibility: in eight directions the highest horizon above the local slope's plane
 * within uReach, the cosine-weighted share of the sky above it (cos² of the horizon angle).
 */
const SKY_FS = /* glsl */ `
precision highp float;
${LEVELS_GLSL}
uniform sampler2D uSelf;
uniform vec4 uRect;
uniform float uN;
uniform float uSelfRef;
uniform float uReach;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uN;
  vec4 s = textureLod(uSelf, uv, 0.0);
  if (s.a < 0.5) { fragColor = vec4(1.0); return; }
  vec2 p = uRect.xy + uv * uRect.z;
  float h0 = s.b + uSelfRef;
  float e = uRect.z / uN;
  float k = pow(uReach / e, 1.0 / 6.0);
  float vis = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = (float(i) + 0.5) * 0.785398;
    vec2 dir = vec2(cos(a), sin(a));
    float slope = dot(s.xy, dir);
    float tanH = 0.0;
    float d = e;
    for (int j = 0; j < 6; j++) {
      float h = terrainH(p + dir * d);
      tanH = max(tanH, (h - h0 - slope * d) / d);
      d *= k;
    }
    vis += 1.0 / (1.0 + tanH * tanH);
  }
  fragColor = vec4(vis / 8.0, 0.0, 0.0, 1.0);
}`;

/**
 * Sun visibility: a march towards the sun through the finest level holding each point, in
 * steps growing from a texel to uReach; the ray's clearance over the relief, relative to
 * the distance, makes soft edges (a penumbra of ~1.5°, wider than the sun's disk: the
 * elevations are smooth).
 */
const SUN_FS = /* glsl */ `
precision highp float;
${LEVELS_GLSL}
uniform sampler2D uSelf;
uniform vec4 uRect;
uniform float uN;
uniform float uSelfRef;
uniform float uReach;
uniform vec3 uSun;
uniform int uSteps;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uN;
  vec4 s = textureLod(uSelf, uv, 0.0);
  if (s.a < 0.5 || uSun.z <= 0.0) { fragColor = vec4(uSun.z > 0.0 ? 1.0 : 0.0); return; }
  vec2 p = uRect.xy + uv * uRect.z;
  float h0 = s.b + uSelfRef;
  float e = uRect.z / uN;
  vec2 dir = normalize(uSun.xy + vec2(1e-6, 0.0));
  float tanS = uSun.z / max(length(uSun.xy), 1e-4);
  float k = pow(uReach / (0.75 * e), 1.0 / float(uSteps));
  float d = 0.75 * e;
  float vis = 1.0;
  for (int i = 0; i < 64; i++) {
    if (i >= uSteps) break;
    float h = terrainH(p + dir * d);
    float clear = h0 + 0.03 * e + d * tanS - h;
    vis = min(vis, clamp(0.5 + 20.0 * clear / d, 0.0, 1.0));
    if (vis <= 0.0) break;
    d *= k;
  }
  fragColor = vec4(vis * vis * (3.0 - 2.0 * vis), 0.0, 0.0, 1.0);
}`;

/**
 * The landscape pass's view of a level, one texture: slope (x, y), sun visibility, and
 * 0.5 + 0.5 × sky visibility where the level holds elevations (0 where it does not).
 */
const LIGHT_FS = /* glsl */ `
precision highp float;
uniform sampler2D uSelf;
uniform sampler2D uSunT;
uniform sampler2D uSkyT;
uniform float uN;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uN;
  vec4 d = textureLod(uSelf, uv, 0.0);
  float ok = step(0.99, d.a);
  fragColor = vec4(d.xy, textureLod(uSunT, uv, 0.0).r, ok * (0.5 + 0.5 * textureLod(uSkyT, uv, 0.0).r));
}`;

/** Per pixel in the landscape pass: normal, sun and sky visibility of the relief at p. */
export const TERRAIN_GLSL = /* glsl */ `
${LEVELS_GLSL}
// The levels as their light textures show them (placed when they were last drawn).
uniform vec4 uQ0;
uniform vec4 uQ1;
uniform vec4 uQ2;
uniform vec3 uQOn;
// 1 when the near or far level is drawn: the relief's normals replace MapLibre's hillshade;
// 0 with the regional level alone (its 216 m slopes are too coarse): flat normals, the
// hillshade stays, the regional shadows remain.
uniform float uReliefN;
uniform sampler2D uL0;
uniform sampler2D uL1;
uniform sampler2D uL2;
struct Relief { vec3 n; float sun; float sky; float fine; };
// Weight of a level at uv: 1 inside, fading over its outer 6 %, 0 outside or where it holds no data.
float lvWeight(vec2 uv, float a) {
  vec2 e = min(uv, 1.0 - uv);
  return smoothstep(0.0, 0.06, min(e.x, e.y)) * clamp(2.0 * a, 0.0, 1.0);
}
Relief relief(vec2 p) {
  Relief r;
  vec2 g = vec2(0.0);
  float sun = 0.0;
  float sky = 0.0;
  float acc = 0.0;
  r.fine = 0.0;
  // From the finest level down: each takes what the finer ones left; the rest is open and lit.
  if (uQOn.x > 0.5) {
    vec2 uv = lvUv(uQ0, p);
    if (lvIn(uv)) {
      vec4 t = texture(uL0, uv);
      float w = lvWeight(uv, t.a);
      g += t.xy * w; sun += t.z * w; sky += clamp(2.0 * t.a - 1.0, 0.0, 1.0) * w;
      acc = w;
      r.fine = w;
    }
  }
  if (uQOn.y > 0.5 && acc < 0.999) {
    vec2 uv = lvUv(uQ1, p);
    if (lvIn(uv)) {
      vec4 t = texture(uL1, uv);
      float w = lvWeight(uv, t.a) * (1.0 - acc);
      g += t.xy * w; sun += t.z * w; sky += clamp(2.0 * t.a - 1.0, 0.0, 1.0) * w;
      acc += w;
    }
  }
  if (uQOn.z > 0.5 && acc < 0.999) {
    vec2 uv = lvUv(uQ2, p);
    if (lvIn(uv)) {
      vec4 t = texture(uL2, uv);
      float w = lvWeight(uv, t.a) * (1.0 - acc);
      g += t.xy * w; sun += t.z * w; sky += clamp(2.0 * t.a - 1.0, 0.0, 1.0) * w;
      acc += w;
    }
  }
  float rest = max(0.0, 1.0 - acc);
  g /= max(acc, 1e-3);
  r.n = normalize(vec3(-g * uReliefN, 1.0));
  r.sun = clamp(sun + rest, 0.0, 1.0);
  r.sky = clamp(sky + rest, 0.0, 1.0);
  return r;
}
`;

/** Regional level: texels per side and half size (m), as region.ts resamples them. */
export const REGION_N = 512;
export const REGION_HALF = 80000;

/**
 * Seasonal snow line (m, where half the ground is white, slopes of mean exposure) in the
 * northern French Alps, mid-month, January first. Anchored on the Alps' median snow lines,
 * ~800 m in winter and ~3100 m in summer (Hantel, Maurer & Mayer 2012, "The snowline
 * climate of the Alps 1961-2010", Theor. Appl. Climatol. 110), a little higher in winter and
 * lower in summer in the western Alps as they find; the southern massifs, drier, keep less
 * snow (Durand et al. 2009, J. Appl. Meteor. Climatol. 48: a north-west to south-east
 * gradient of ~60 days of snow cover at 1500 m), ~250 m higher here. From July to September
 * the orthophotos (flown in summer) already show the season's snow: the line is set above
 * the summits' snowfields so as not to add any.
 */
const SNOW_LINE = [900, 950, 1250, 1650, 2100, 2500, 3050, 3400, 3400, 2650, 1750, 1100];

/** Snow line (m) for a month (0-11), day and latitude. */
export function snowLine(month0: number, day: number, lat: number): number {
  // Mid-month values, linear in between.
  const t = month0 + (day - 15) / 30.5;
  const i = Math.floor(t);
  const f = t - i;
  const a = SNOW_LINE[((i % 12) + 12) % 12];
  const b = SNOW_LINE[(((i + 1) % 12) + 12) % 12];
  const south = Math.min(1, Math.max(0, (45.5 - lat) / 1.0));
  return a + (b - a) * f + 250 * south * south * (3 - 2 * south);
}

interface Level {
  /** South-west corner (absolute local metres), size (m), texels per side. */
  x0: number;
  y0: number;
  size: number;
  n: number;
  /** Offset of the centre ahead of the eye (share of the size) and recentring distance (m). */
  ahead: number;
  move: number;
  /** MapLibre's elevations (levels 0 and 1), R32F. */
  height: THREE.WebGLRenderTarget | null;
  derived: THREE.WebGLRenderTarget;
  sky: THREE.WebGLRenderTarget;
  sun: THREE.WebGLRenderTarget;
  /** What the landscape pass reads (LIGHT_FS), redone when the sky or the sun changed. */
  light: THREE.WebGLRenderTarget;
  lightDirty: boolean;
  ref: number;
  rect: THREE.Vector4;
  /** Where the light texture was drawn (the landscape pass's rect), and whether it was. */
  shown: THREE.Vector4;
  lit: boolean;
  /** Reach of the sky's horizon and of the sun's march (m), the march's steps. */
  skyReach: number;
  sunReach: number;
  steps: number;
  /** Minimum interval between redraws of the elevations (ms) and the last one. */
  every: number;
  at: number;
  ready: boolean;
  /** The slopes changed: sky and sun to redo (sun row by row over a few frames). */
  skyDirty: boolean;
  sunRow: number;
  /** The elevations and their mapping last derived from (development benchmark). */
  src: { tex: THREE.Texture; x: [number, number]; y: [number, number, number, number] } | null;
  /** MapLibre loaded elevation tiles since this level's last drawing. */
  tiles: boolean;
}

export class Ground {
  /** Off: the landscape pass relights as before (flat ground and MapLibre's hillshade), for comparisons. */
  enabled = true;
  /** The relief's light is on (some level drawn). */
  active = false;
  /** Its normals too (the near or far level drawn, MapLibre's elevations): MapLibre's hillshade can go. */
  fine = false;
  readonly uniforms: Record<string, THREE.IUniform>;
  /** The materials' detail stack (materials.ts), drawn on the first frame. */
  readonly detail: DetailTextures;
  /**
   * Materials off (relief light only), for comparisons. Debug views: 1 classes, 2 normals,
   * 3 sun, 4 sky, 5 and 6 raw features (luminance, green, trees; saturation, bare, built),
   * 7 not-a-number finder (blue: near pass, brighter where its march missed), 8 no detail.
   */
  materials = true;
  debug = 0;
  private levels: Level[];
  private derivedMat: THREE.ShaderMaterial;
  private skyMat: THREE.ShaderMaterial;
  private sunMat: THREE.ShaderMaterial;
  private derivedPass: THREE.Mesh;
  private lightMat: THREE.ShaderMaterial;
  private lightPass: THREE.Mesh;
  private skyPass: THREE.Mesh;
  private sunPass: THREE.Mesh;
  private cam = new THREE.Camera();
  private sunDir = new THREE.Vector3(0, 0, 1);
  private sunDone = new THREE.Vector3(0, 0, -2);
  private regionVersion = -1;
  readonly floatHeights: boolean;

  private region: RegionMaps | null = null;

  constructor(
    private frame: LocalFrame,
    readonly lowQuality: boolean,
    gl: WebGL2RenderingContext | null,
  ) {
    // MapLibre draws its elevations into a 32-bit float texture (needs EXT_color_buffer_float).
    this.floatHeights = !!gl?.getExtension('EXT_color_buffer_float');
    this.detail = new DetailTextures(lowQuality ? 256 : 512);
    const n0 = lowQuality ? 512 : 1024;
    const rt = (n: number, type: THREE.TextureDataType, format: THREE.PixelFormat, filter: THREE.MagnificationTextureFilter) =>
      new THREE.WebGLRenderTarget(n, n, { type, format, depthBuffer: false, minFilter: filter, magFilter: filter, generateMipmaps: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    const level = (size: number, n: number, ahead: number, maplibre: boolean, skyReach: number, sunReach: number, steps: number, every: number): Level => ({
      x0: 0,
      y0: 0,
      size,
      n,
      ahead,
      move: size / 8,
      height: maplibre && this.floatHeights ? rt(n, THREE.FloatType, THREE.RedFormat, THREE.NearestFilter) : null,
      derived: rt(n, THREE.HalfFloatType, THREE.RGBAFormat, THREE.LinearFilter),
      sky: rt(n / 2, THREE.UnsignedByteType, THREE.RedFormat, THREE.LinearFilter),
      sun: rt(n, THREE.UnsignedByteType, THREE.RedFormat, THREE.LinearFilter),
      light: rt(n, THREE.HalfFloatType, THREE.RGBAFormat, THREE.LinearFilter),
      lightDirty: false,
      ref: 0,
      rect: new THREE.Vector4(0, 0, size, 1 / size),
      shown: new THREE.Vector4(0, 0, size, 1 / size),
      lit: false,
      skyReach,
      sunReach,
      steps,
      every,
      at: -1e9,
      ready: false,
      skyDirty: false,
      sunRow: -1,
      src: null,
      tiles: true,
    });
    this.levels = [
      level(6000, n0, 0.3, true, 1500, 30000, lowQuality ? 32 : 48, 1000),
      level(60000, n0, 0.3, true, 12000, 60000, lowQuality ? 24 : 40, 4000),
      level(REGION_HALF * 2, REGION_N, 0, false, 30000, 90000, 32, 0),
    ];
    const lv = this.levels;
    this.uniforms = {
      uD0: { value: lv[0].derived.texture },
      uD1: { value: lv[1].derived.texture },
      uD2: { value: lv[2].derived.texture },
      uR0: { value: lv[0].rect },
      uR1: { value: lv[1].rect },
      uR2: { value: lv[2].rect },
      uLvRef: { value: new THREE.Vector3() },
      uLvOn: { value: new THREE.Vector3() },
      uQ0: { value: lv[0].shown },
      uQ1: { value: lv[1].shown },
      uQ2: { value: lv[2].shown },
      uQOn: { value: new THREE.Vector3() },
      uL0: { value: lv[0].light.texture },
      uL1: { value: lv[1].light.texture },
      uL2: { value: lv[2].light.texture },
      uRelief: { value: 0 },
      uReliefN: { value: 0 },
      // Materials (materials.ts).
      uDetail: { value: this.detail.texture },
      uDetailN: { value: this.detail.size },
      uCover: { value: null },
      uCoverRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uCoverOn: { value: 0 },
      uSeason: { value: new THREE.Vector2(3150, 1) },
      uWindS: { value: new THREE.Vector2() },
      uTimeS: { value: 0 },
      uPixAng: { value: 0.001 },
      uAlbedoToX: { value: new THREE.Vector3(0.28, 0.28, 0.28) },
      uSunX: { value: new THREE.Vector3(1, 1, 1) },
      uMaterials: { value: 1 },
      uDetailOn: { value: 1 },
      uGDebug: { value: 0 },
    };
    const levelUniforms = () => ({
      uD0: this.uniforms.uD0,
      uD1: this.uniforms.uD1,
      uD2: this.uniforms.uD2,
      uR0: this.uniforms.uR0,
      uR1: this.uniforms.uR1,
      uR2: this.uniforms.uR2,
      uLvRef: this.uniforms.uLvRef,
      uLvOn: this.uniforms.uLvOn,
    });
    const mat = (fs: string, u: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: fs, glslVersion: THREE.GLSL3, uniforms: u, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    this.derivedMat = mat(DERIVED_FS, {
      uHeight: { value: null },
      uMapX: { value: new THREE.Vector2() },
      uMapY: { value: new THREE.Vector4() },
      uRect: { value: new THREE.Vector4() },
      uN: { value: 1 },
      uRef: { value: 0 },
    });
    const own = () => ({ uSelf: { value: null }, uRect: { value: new THREE.Vector4() }, uN: { value: 1 }, uSelfRef: { value: 0 }, uReach: { value: 1000 } });
    this.skyMat = mat(SKY_FS, { ...levelUniforms(), ...own() });
    this.sunMat = mat(SUN_FS, { ...levelUniforms(), ...own(), uSun: { value: new THREE.Vector3(0, 0, 1) }, uSteps: { value: 32 } });
    this.derivedPass = fullscreenPass(this.derivedMat);
    this.lightMat = mat(LIGHT_FS, { uSelf: { value: null }, uSunT: { value: null }, uSkyT: { value: null }, uN: { value: 1 } });
    this.lightPass = fullscreenPass(this.lightMat);
    this.skyPass = fullscreenPass(this.skyMat);
    this.sunPass = fullscreenPass(this.sunMat);
  }

  /** The regional elevations (region.ts), once the engine knows where the model's grid is. */
  setRegion(region: RegionMaps): void {
    this.region = region;
    this.regionVersion = -1;
  }

  /** MapLibre loaded elevation tiles: the levels' elevations are redrawn (throttled). */
  terrainChanged(): void {
    for (const L of this.levels) L.tiles = true;
  }

  setSun(dir: THREE.Vector3): void {
    this.sunDir.copy(dir);
  }

  /** The scenario's date: the seasonal snow line at the site's latitude. */
  setSeason(month0: number, day: number): void {
    this.uniforms.uSeason.value.set(snowLine(month0, day, this.frame.lat0), 1);
  }

  /** Wind near the ground (m/s, east/north): ripples on the water, sastrugi in the snow. */
  setWind(u: number, v: number): void {
    this.uniforms.uWindS.value.set(u, v);
  }

  /**
   * Offscreen work of the frame (MapLibre's offscreen pass): elevations of the levels that
   * moved or whose tiles changed, their slopes, sky and (when the sun moved) shadows.
   * `eye` and `look` in absolute local metres.
   */
  prepare(r: THREE.WebGLRenderer, eye: THREE.Vector3, look: THREE.Vector3, renderHeights: HeightMapFn | undefined): void {
    if (!this.enabled) {
      this.active = false;
      this.fine = false;
      this.uniforms.uRelief.value = 0;
      return;
    }
    const now = performance.now();
    if (!this.timer && import.meta.env.DEV) this.timer = new GpuTimer(r.getContext() as WebGL2RenderingContext);
    if (this.timer) {
      this.timer.poll();
      Object.assign(this.timings, this.timer.ms);
      this.timer.begin('relief');
    }
    if (!this.lowQuality) this.detail.build(r);
    this.uniforms.uTimeS.value = (now / 1000) % 100000;
    // Slow frames (sky.ts's adaptive quality): the detail stack goes, and on phones the
    // materials altogether (the relief's light and shadows stay).
    this.uniforms.uMaterials.value = this.materials && !(this.lowQuality && this.lowDetail) ? 1 : 0;
    this.uniforms.uGDebug.value = this.debug;
    this.uniforms.uDetailOn.value = this.lowDetail ? 0 : 1;
    const lv = this.levels;
    let changed = false;
    // One heavy pass per frame at most (a level's elevations and slopes, its sky, a band of
    // its shadows): an update spreads over a few frames instead of costing one of them.
    let busy = false;
    // Regional level: the wind model's grid, resampled around the pilot by region.ts.
    const reg = this.region;
    if (reg?.ready && reg.version !== this.regionVersion) {
      this.regionVersion = reg.version;
      this.uniforms.uCover.value = reg.cover;
      this.uniforms.uCoverRect.value.set(reg.centre.x - reg.half, reg.centre.y - reg.half, 2 * reg.half, 1 / (2 * reg.half));
      this.uniforms.uCoverOn.value = 1;
      const L = lv[2];
      L.x0 = reg.centre.x - reg.half;
      L.y0 = reg.centre.y - reg.half;
      L.ref = eye.z;
      this.derive(r, L, reg.height, [1 / L.size, -L.x0 / L.size], [0.5, 1 / L.size, 0, L.y0 + L.size / 2]);
      changed = true;
      busy = true;
    }
    // Near and far levels: MapLibre's elevations, centred a little ahead of the eye.
    if (renderHeights && !busy) {
      const hl = Math.hypot(look.x, look.y) || 1;
      for (let i = 0; i < 2 && !busy; i++) {
        const L = lv[i];
        if (!L.height) continue;
        const cx = eye.x + (look.x / hl) * L.ahead * L.size;
        const cy = eye.y + (look.y / hl) * L.ahead * L.size;
        const moved = !L.ready || Math.hypot(cx - (L.x0 + L.size / 2), cy - (L.y0 + L.size / 2)) > L.move;
        if (!moved && !(L.tiles && now - L.at > L.every)) continue;
        if (now - L.at < Math.min(L.every, 250)) continue;
        if (moved) {
          // Snapped to 8 texels: the shadows do not crawl when the level follows the pilot.
          const snap = (8 * L.size) / L.n;
          L.x0 = Math.round(cx / snap) * snap - L.size / 2;
          L.y0 = Math.round(cy / snap) * snap - L.size / 2;
        }
        L.ref = eye.z;
        this.drawHeights(r, L, renderHeights);
        L.at = now;
        L.tiles = false;
        changed = true;
        busy = true;
      }
    }
    if (changed) for (const L of lv) L.rect.set(L.x0, L.y0, L.size, 1 / L.size);
    this.uniforms.uLvRef.value.set(lv[0].ref, lv[1].ref, lv[2].ref);
    this.uniforms.uLvOn.value.set(lv[0].ready ? 1 : 0, lv[1].ready ? 1 : 0, lv[2].ready ? 1 : 0);
    // Sky: once per new set of slopes (the horizon depends on the neighbours: all levels).
    if (!busy)
      for (const L of lv)
        if (L.ready && L.skyDirty) {
          this.drawSky(r, L);
          busy = true;
          break;
        }
    // Sun: when it moved by more than ~0.05° or the slopes changed (each level marches
    // through the others), a band of rows per frame.
    const sunMoved = this.sunDir.distanceToSquared(this.sunDone) > 1e-6;
    if (sunMoved || changed) {
      this.sunDone.copy(this.sunDir);
      for (const L of lv) if (L.ready) L.sunRow = 0;
    }
    if (!busy)
      for (const L of lv)
        if (L.sunRow >= 0) {
          this.drawSun(r, L);
          break;
        }
    for (const L of lv) if (L.lightDirty) this.drawLight(r, L);
    this.uniforms.uQOn.value.set(lv[0].lit ? 1 : 0, lv[1].lit ? 1 : 0, lv[2].lit ? 1 : 0);
    this.active = this.enabled && (lv[0].lit || lv[1].lit || lv[2].lit);
    this.fine = this.active && (lv[0].lit || lv[1].lit);
    this.uniforms.uReliefN.value = this.fine ? 1 : 0;
    this.uniforms.uRelief.value = this.active ? 1 : 0;
    this.timer?.end();
  }

  /** MapLibre's elevations over the level's square (its mercator bounds), then the slopes. */
  private drawHeights(r: THREE.WebGLRenderer, L: Level, renderHeights: HeightMapFn): void {
    const target = L.height!;
    r.initRenderTarget(target);
    const tex = (r.properties.get(target.texture) as { __webglTexture?: WebGLTexture }).__webglTexture;
    if (!tex) return;
    const f = this.frame;
    const [w, s] = f.toLngLat(L.x0, L.y0);
    const [e, n] = f.toLngLat(L.x0 + L.size, L.y0 + L.size);
    const sw = MercatorCoordinate.fromLngLat([w, s]);
    const ne = MercatorCoordinate.fromLngLat([e, n]);
    const t0 = this.benchHeights ? performance.now() : 0;
    renderHeights({ texture: tex, width: L.n, height: L.n, bounds: [sw.x, ne.y, ne.x, sw.y] });
    r.resetState();
    if (this.benchHeights) {
      // Development: waited for by reading a texel back.
      r.readRenderTargetPixels(target, 0, 0, 1, 1, this.texel);
      const ms = performance.now() - t0;
      this.heightsMs = this.heightsMs === 0 ? ms : this.heightsMs + (ms - this.heightsMs) * 0.2;
    }
    // Local x → u is linear; local y → v (south = 0) follows the mercator rows: a quadratic
    // through the edges and the middle (exact there, < 1 m off elsewhere).
    const mx = (x: number) => ((f.toLngLat(x, 0)[0] + 180) / 360 - sw.x) / (ne.x - sw.x);
    const my = (y: number) => (sw.y - MercatorCoordinate.fromLngLat([f.lon0, f.toLngLat(0, y)[1]]).y) / (sw.y - ne.y);
    const a = mx(1) - mx(0);
    const yc = L.y0 + L.size / 2;
    const dy = L.size / 2;
    const vm = my(yc - dy);
    const vc = my(yc);
    const vp = my(yc + dy);
    this.derive(r, L, target.texture, [a, mx(0)], [vc, (vp - vm) / (2 * dy), (vp - 2 * vc + vm) / (2 * dy * dy), yc]);
  }

  private derive(r: THREE.WebGLRenderer, L: Level, height: THREE.Texture, mapX: [number, number], mapY: [number, number, number, number]): void {
    L.src = { tex: height, x: mapX, y: mapY };
    const u = this.derivedMat.uniforms;
    u.uHeight.value = height;
    u.uMapX.value.set(mapX[0], mapX[1]);
    u.uMapY.value.set(mapY[0], mapY[1], mapY[2], mapY[3]);
    u.uRect.value.set(L.x0, L.y0, L.size, 1 / L.size);
    u.uN.value = L.n;
    u.uRef.value = L.ref;
    r.setRenderTarget(L.derived);
    r.render(this.derivedPass, this.cam);
    r.setRenderTarget(null);
    L.ready = true;
    L.skyDirty = true;
    L.sunRow = 0;
  }

  private own(m: THREE.ShaderMaterial, L: Level, target: THREE.WebGLRenderTarget, reach: number): void {
    const u = m.uniforms;
    u.uSelf.value = L.derived.texture;
    u.uRect.value.set(L.x0, L.y0, L.size, 1 / L.size);
    u.uN.value = target.width;
    u.uSelfRef.value = L.ref;
    u.uReach.value = reach;
  }

  private drawSky(r: THREE.WebGLRenderer, L: Level): void {
    this.own(this.skyMat, L, L.sky, L.skyReach);
    r.setRenderTarget(L.sky);
    r.render(this.skyPass, this.cam);
    r.setRenderTarget(null);
    L.skyDirty = false;
    // The light texture waits for the sun's march to finish (it runs over a few frames).
    L.lightDirty = L.sunRow < 0;
  }

  private drawLight(r: THREE.WebGLRenderer, L: Level): void {
    const u = this.lightMat.uniforms;
    u.uSelf.value = L.derived.texture;
    u.uSunT.value = L.sun.texture;
    u.uSkyT.value = L.sky.texture;
    u.uN.value = L.n;
    r.setRenderTarget(L.light);
    r.render(this.lightPass, this.cam);
    r.setRenderTarget(null);
    L.lightDirty = false;
    L.shown.copy(L.rect);
    L.lit = true;
  }

  /** A quarter of the rows per frame (the march is the costliest pass). */
  private drawSun(r: THREE.WebGLRenderer, L: Level): void {
    this.own(this.sunMat, L, L.sun, L.sunReach);
    const u = this.sunMat.uniforms;
    u.uSun.value.copy(this.sunDir);
    u.uSteps.value = L.steps;
    const n = L.sun.height;
    const band = Math.ceil(n / 4);
    const y = L.sunRow * band;
    L.sun.scissor.set(0, y, n, Math.min(band, n - y));
    L.sun.scissorTest = true;
    r.setRenderTarget(L.sun);
    r.render(this.sunPass, this.cam);
    L.sun.scissorTest = false;
    r.setRenderTarget(null);
    L.sunRow++;
    if (L.sunRow * band >= n) {
      L.sunRow = -1;
      L.lightDirty = true;
    }
  }

  /** GPU time of the relief's passes (ms, development builds where the browser can tell). */
  readonly timings: Record<string, number> = {};
  private timer: GpuTimer | null = null;
  /** The adaptive quality (sky.ts) asked for less: the detail stack is skipped (phones: the materials). */
  lowDetail = false;

  /** Development: time MapLibre's drawing of the elevations (waits for the GPU: slows the frame). */
  benchHeights = false;
  heightsMs = 0;
  private texel = new Float32Array(4);

  /**
   * Development: GPU time (ms, median of n) of a whole update of each level once its
   * elevations are drawn: slopes, sky, the four bands of shadows and the light texture,
   * waited for by reading a texel back.
   */
  benchRelief(r: THREE.WebGLRenderer, n = 5): Record<string, number> {
    const out: Record<string, number> = {};
    const sync = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, depthBuffer: false });
    const copy = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: 'precision highp float;\nuniform sampler2D uT;\nlayout(location = 0) out vec4 o;\nvoid main() { o = textureLod(uT, vec2(0.5), 0.0); }', glslVersion: THREE.GLSL3, uniforms: { uT: { value: null } }, depthTest: false, depthWrite: false });
    const pass = fullscreenPass(copy);
    const px = new Float32Array(4);
    this.levels.forEach((L, i) => {
      if (!L.ready || !L.src) return;
      const times: number[] = [];
      for (let k = 0; k < n; k++) {
        const t0 = performance.now();
        this.derive(r, L, L.src.tex, L.src.x, L.src.y);
        this.drawSky(r, L);
        while (L.sunRow >= 0) this.drawSun(r, L);
        this.drawLight(r, L);
        copy.uniforms.uT.value = L.light.texture;
        r.setRenderTarget(sync);
        r.render(pass, this.cam);
        r.readRenderTargetPixels(sync, 0, 0, 1, 1, px);
        r.setRenderTarget(null);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      out[`niveau ${i} (${L.n}²)`] = Number(times[n >> 1].toFixed(2));
    });
    sync.dispose();
    copy.dispose();
    pass.geometry.dispose();
    return out;
  }

  dispose(): void {
    for (const L of this.levels) {
      L.height?.dispose();
      L.derived.dispose();
      L.sky.dispose();
      L.sun.dispose();
      L.light.dispose();
    }
    for (const m of [this.derivedMat, this.skyMat, this.sunMat, this.lightMat]) m.dispose();
    this.detail.dispose();
    this.timer?.dispose();
  }
}

/** What a three.js material needs to see the sun as the ground does (see `sunlit`). */
export interface SunUniforms {
  uQ0: THREE.IUniform;
  uL0: THREE.IUniform;
  uQOn: THREE.IUniform;
  uShadow: THREE.IUniform;
  uShadowMap: THREE.IUniform;
  uShadowOn: THREE.IUniform;
  uSunDir: THREE.IUniform;
  /** Absolute local metres of the world objects' origin (the anchor the world shifts them by). */
  uAnchorW: THREE.IUniform;
}

/**
 * Lets a three.js material (trees, buildings…) take the sun's direct light only where the
 * ground does: behind the mountains' shadow (the near level's sun visibility) and under the
 * clouds' (their optical depth map), looked up per vertex. Returns the material.
 */
export function sunlit<T extends THREE.Material>(m: T, u: SunUniforms): T {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform vec4 uQ0;
uniform sampler2D uL0;
uniform vec3 uQOn;
uniform sampler2D uShadow;
uniform vec4 uShadowMap;
uniform float uShadowOn;
uniform vec3 uSunDir;
uniform vec3 uAnchorW;
varying float vSunVis;
float sunVisAt(vec3 pa) {
  float v = 1.0;
  if (uQOn.x > 0.5) {
    vec2 uv = (pa.xy - uQ0.xy) * uQ0.w;
    if (all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
      vec4 t = textureLod(uL0, uv, 0.0);
      if (t.a > 0.25) v = t.z;
    }
  }
  if (uShadowOn > 0.5) {
    vec3 sd = normalize(vec3(uSunDir.xy, max(uSunDir.z, 0.08)));
    vec2 q = pa.xy + sd.xy / sd.z * (uShadowMap.w - pa.z);
    vec2 suv = (q - uShadowMap.xy) * uShadowMap.z * 0.5 + 0.5;
    if (all(greaterThan(suv, vec2(0.0))) && all(lessThan(suv, vec2(1.0)))) v *= mix(0.12, 1.0, exp(-textureLod(uShadow, suv, 0.0).r));
  }
  return v;
}`,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
  vec4 wpSun = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  wpSun = instanceMatrix * wpSun;
  #endif
  wpSun = modelMatrix * wpSun;
  vSunVis = sunVisAt(wpSun.xyz + uAnchorW);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSunVis;')
      .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= vSunVis;');
  };
  // One program for every material patched alike (the uniforms are shared objects).
  m.customProgramCacheKey = () => 'sunlit';
  return m;
}
