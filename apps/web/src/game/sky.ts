/**
 * Sky, light and clouds of the game: the passes drawn in the map's custom layer around
 * the three.js scene, from the physically based atmosphere (atmosphere.ts) and the cumulus
 * volumes (clouds.ts).
 *
 * Per frame, in order:
 * 1. offscreen: the atmosphere tables when the conditions changed, the cloud shadow map
 *    and the clouds at reduced resolution;
 * 2. landscape: the frame MapLibre drew so far is copied and redrawn where there is
 *    terrain, using MapLibre's own terrain depth (the picking depth it renders at CSS
 *    resolution) to know each pixel's position: the orthophoto is read back into radiance,
 *    relit by the light of the hour (warm and dimmer at dawn and dusk, the direct part
 *    removed under the cloud shadows) and seen through the haze (aerial perspective:
 *    transmittance and in-scattering of the atmosphere along the view ray, bluish towards
 *    distant ridges, brighter towards the sun). MapLibre's own fog is then switched off;
 * 3. the sky where no terrain was drawn (depth test at the far plane): sky radiance from
 *    the atmosphere's sky-view table, the sun's disk with limb darkening, a cirrus veil;
 * 4. (the three.js objects, by the world);
 * 5. the clouds, composited with their depth so the relief hides them;
 * 6. the glare of the sun when it is in view and not hidden by the relief or a cloud.
 * Phones without float render targets keep MapLibre's sky and fog and get the clouds
 * straight into the frame.
 *
 * The CPU side keeps what the game logic needs from the clouds: the share of sun reaching
 * a point (for the glider's light) and soft shadow discs (fallback when the terrain depth
 * is not available).
 */
import * as THREE from 'three';
import { ATMO_GLSL, Atmosphere, fullscreenPass, type Lighting } from './atmosphere';
import { CloudLayer, type CloudShape } from './clouds';

export type { CloudShape } from './clouds';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** What the passes need to know about this frame's camera (world.ts fills it). */
export interface FrameInfo {
  /** three.js camera whose projection is MapLibre's, in metres around the anchor (z up). */
  cam: THREE.Camera;
  width: number;
  height: number;
  /** Camera position relative to the anchor, and the anchor (absolute local metres). */
  eye: THREE.Vector3;
  anchor: { x: number; y: number; z: number };
  /** Far-plane points minus the eye: centre, and the change per unit of NDC x and y. */
  dirBase: THREE.Vector3;
  dirX: THREE.Vector3;
  dirY: THREE.Vector3;
  /** MapLibre's near and far planes (its own units: only their ratio matters here). */
  near: number;
  far: number;
  /** Depth range of the 3D layers (window depth of NDC −1 and +1). */
  depthRange: [number, number];
  /** MapLibre's terrain depth texture (packed NDC depth, CSS pixels), null without terrain. */
  terrainDepth: WebGLTexture | null;
  fovY: number;
}

const SKY_VS = /* glsl */ `
uniform float uZ;
void main() { gl_Position = vec4(position.xy, uZ, 1.0); }
`;

/** Shared by the sky and landscape passes: view rays from the far-plane vectors. */
const RAY_GLSL = /* glsl */ `
uniform vec2 uRes;
uniform vec3 uDirBase;
uniform vec3 uDirX;
uniform vec3 uDirY;
vec3 farVector(vec2 uv) {
  vec2 ndc = uv * 2.0 - 1.0;
  return uDirBase + ndc.x * uDirX + ndc.y * uDirY;
}
float ignNoise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

const SKY_FS = /* glsl */ `
precision highp float;
${ATMO_GLSL}
${RAY_GLSL}
uniform highp sampler3D uNoise;
uniform float uSunDisk;
uniform float uCirrus;
uniform vec2 uCirrusOff;
uniform vec2 uWindDir;
uniform vec3 uCamAbs;
uniform vec3 uAmbTop;
uniform float uGrey;
uniform float uPixAng;
layout(location = 0) out vec4 fragColor;
float hgP(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 dir = normalize(farVector(uv));
  vec3 L = atmoSky(dir);
  float cs = dot(dir, uSunDir);
  // Sun disk (a little larger than the real 0.27°: it would be a pixel), limb-darkened.
  float ang = sqrt(max(0.0, 2.0 * (1.0 - cs)));
  float rs = 0.0085;
  if (ang < rs * 1.5) {
    float x = clamp(ang / rs, 0.0, 1.0);
    float mu = sqrt(max(0.0, 1.0 - x * x));
    float limb = 1.0 - 0.6 * (1.0 - mu) - 0.2 * (1.0 - mu) * (1.0 - mu);
    float edge = 1.0 - smoothstep(0.85, 1.15, ang / rs);
    vec3 sunT = raySphere(vec3(0.0, 0.0, uCamR), uSunDir, RB) >= 0.0 ? vec3(0.0) : atmoTransmittance(uCamR, uSunDir.z);
    L += sunT * uSunDisk * limb * edge;
  }
  // Cirrus veil at 9 km: patches of fibres stretched along the wind, thin, lit by the sun
  // (forward scattering of ice crystals) and by the sky, fading into the horizon's haze.
  if (uCirrus > 0.01 && dir.z > 0.008) {
    float tc = (9000.0 - uCamAbs.z) / dir.z;
    if (tc > 0.0 && tc < 140000.0) {
      vec2 xy = uCamAbs.xy + dir.xy * tc + uCirrusOff;
      vec2 a = uWindDir;
      vec2 st = vec2(dot(xy, a), dot(xy, vec2(-a.y, a.x)));
      float foot = tc * uPixAng / max(dir.z, 0.05);
      float patchN = textureLod(uNoise, vec3(st / 70000.0, 0.13), log2(max(1.0, foot / 550.0))).r;
      vec4 f = textureLod(uNoise, vec3(st.x / 45000.0 + patchN * 0.25, st.y / 6000.0, 0.57), log2(max(1.0, foot / 47.0)));
      float fib = f.g * 0.55 + f.b * 0.3 + f.a * 0.15;
      float cov = smoothstep(1.0 - uCirrus * 0.8, 1.25 - uCirrus * 0.8, patchN);
      float alpha = cov * smoothstep(0.42, 0.8, fib) * 0.5 * smoothstep(0.008, 0.1, dir.z);
      float fade = exp(-tc / 90000.0);
      vec3 sunH = raySphere(vec3(0.0, 0.0, RB + 9.0), uSunDir, RB) >= 0.0 ? vec3(0.0) : atmoTransmittance(RB + 9.0, uSunDir.z);
      vec3 Lc = sunH * mix(hgP(cs, 0.75), 1.0 / (4.0 * PI), 0.5) * 2.0 + uAmbTop * 0.8;
      L = mix(L, Lc, alpha * fade);
    }
  }
  float lum = dot(L, vec3(0.2126, 0.7152, 0.0722));
  L = mix(L, vec3(lum) * vec3(0.97, 1.0, 1.05), uGrey);
  vec3 col = atmoEncode(atmoTonemap(L * uExposure));
  col += (ignNoise(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}`;

const GROUND_FS = /* glsl */ `
precision highp float;
${ATMO_GLSL}
${RAY_GLSL}
uniform sampler2D uScene;
uniform sampler2D uTDepth;
uniform sampler2D uShadow;
uniform vec4 uShadowMap;
uniform float uShadowOn;
uniform vec3 uAnchor;
uniform vec3 uEye;
uniform vec2 uNF;
uniform vec3 uSunGain;
uniform vec3 uSkyGain;
uniform float uSat;
layout(location = 0) out vec4 fragColor;
float unpackDepth(vec4 c) { return dot(c, vec4(1.0 / 16777216.0, 1.0 / 65536.0, 1.0 / 256.0, 1.0)); }
// Share of the direct sun reaching an absolute point through the clouds.
float cloudShadow(vec3 pa) {
  if (uShadowOn < 0.5) return 1.0;
  vec2 off = uSunDir.xy / max(uSunDir.z, 0.05);
  vec2 q = pa.xy - off * (uShadowMap.w - pa.z);
  vec2 suv = (q - uShadowMap.xy) * uShadowMap.z * 0.5 + 0.5;
  float edge = smoothstep(0.0, 0.06, min(min(suv.x, suv.y), min(1.0 - suv.x, 1.0 - suv.y)));
  float od = texture(uShadow, suv).r;
  float t = exp(-od);
  // Light forward-scattered through the cloud: shadows are never black, softer under thin clouds.
  t = mix(0.04 + 0.96 * t, 1.0, 1.0 - edge);
  return mix(1.0, t, smoothstep(0.05, 0.14, uSunDir.z));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb;
  vec3 fv = farVector(uv);
#ifdef NEAR
  vec3 P = uEye;
  float dist = 0.0;
#else
  float z = unpackDepth(texture(uTDepth, uv));
  if (z > 1.0005) {
    // The terrain depth (CSS pixels) says sky at a terrain edge: nearest terrain around.
    vec2 px = 1.0 / vec2(textureSize(uTDepth, 0));
    float best = 2.0;
    for (int i = 0; i < 4; i++) {
      vec2 o = vec2(i == 0 ? 1.0 : (i == 1 ? -1.0 : 0.0), i == 2 ? 1.0 : (i == 3 ? -1.0 : 0.0));
      float zz = unpackDepth(texture(uTDepth, uv + o * px));
      if (zz < 1.0005) best = min(best, zz);
    }
    if (best > 1.0) discard;
    z = best;
  }
  float n = uNF.x;
  float f = uNF.y;
  float s = 2.0 * n / max((f + n) - z * (f - n), 1e-6);
  vec3 P = uEye + fv * s;
  float dist = s * length(fv);
#endif
  // The photo back to radiance, relit by the light of the hour.
  vec3 x = atmoUntonemap(atmoDecode(c));
  float sh = cloudShadow(P + uAnchor);
  x *= uSunGain * sh + uSkyGain;
  float l = dot(x, vec3(0.2126, 0.7152, 0.0722));
  x = mix(vec3(l), x, uSat);
  // Aerial perspective between the eye and the ground.
  vec3 Lap;
  vec3 Tap;
  atmoAerialLut(uv, dist / 1000.0, Lap, Tap);
  x = x * Tap + Lap * uExposure;
  vec3 col = atmoEncode(atmoTonemap(x));
  col += (ignNoise(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}`;

const GLARE_VS = /* glsl */ `
uniform vec2 uSunUv;
uniform float uOnScreen;
uniform sampler2D uTDepth;
uniform sampler2D uCloudA;
uniform float uHasDepth;
uniform float uHasClouds;
flat out float vVis;
float unpackDepth(vec4 c) { return dot(c, vec4(1.0 / 16777216.0, 1.0 / 65536.0, 1.0 / 256.0, 1.0)); }
void main() {
  // Visibility of the sun: relief (terrain depth says sky) and clouds (their alpha), 9 taps.
  float v = 0.0;
  if (uOnScreen > 0.5) {
    for (int i = -1; i <= 1; i++)
      for (int j = -1; j <= 1; j++) {
        vec2 p = uSunUv + vec2(float(i), float(j)) * 0.004;
        float sky = uHasDepth > 0.5 ? step(1.0005, unpackDepth(textureLod(uTDepth, p, 0.0))) : 1.0;
        float a = uHasClouds > 0.5 ? textureLod(uCloudA, p, 0.0).a : 0.0;
        v += sky * (1.0 - a);
      }
    v /= 9.0;
  }
  vVis = v;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const GLARE_FS = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform vec2 uSunUv;
uniform vec3 uGlareColor;
uniform float uFovY;
flat in float vVis;
layout(location = 0) out vec4 fragColor;
void main() {
  if (vVis < 0.003) discard;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 d = (uv - uSunUv) * vec2(uRes.x / uRes.y, 1.0);
  float r = length(d) * uFovY;
  float g = 0.55 * exp(-r / 0.012) + 0.22 * exp(-r / 0.06) + 0.08 * exp(-r / 0.3);
  // A faint ring and streak, as a lens adds.
  g += 0.025 * exp(-pow((r - 0.16) / 0.02, 2.0));
  fragColor = vec4(uGlareColor * g * vVis, 0.0);
}`;

function shader(vs: string, fs: string, uniforms: Record<string, THREE.IUniform>, extra: Partial<THREE.ShaderMaterialParameters> = {}, defines: Record<string, string> = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, glslVersion: THREE.GLSL3, uniforms, defines, ...extra });
}

export interface SkyLight extends Lighting {
  /** Display colours for MapLibre's sky and fog (fallback) and the three.js lights. */
  skyHex: THREE.Color;
  horizonHex: THREE.Color;
}

export class Sky {
  readonly atmo: Atmosphere;
  readonly cloudLayer: CloudLayer;
  private skyMat: THREE.ShaderMaterial;
  private groundMat: THREE.ShaderMaterial;
  private groundNearMat: THREE.ShaderMaterial;
  private glareMat: THREE.ShaderMaterial;
  private skyPass: THREE.Mesh;
  private groundPass: THREE.Mesh;
  private groundNearPass: THREE.Mesh;
  private glarePass: THREE.Mesh;
  private sceneCopy: THREE.FramebufferTexture | null = null;
  private depthTex = new THREE.ExternalTexture();
  private cam = new THREE.Camera();
  private sunDir = new THREE.Vector3(0, 0, 1);
  private t0 = performance.now();
  private cirrusCover = 0.3;
  private windDir = new THREE.Vector2(1, 0);
  /** The landscape pass ran this frame: MapLibre's fog must stay off. */
  groundActive = false;
  /** Current clouds, for shadows and the dimming under them. */
  shapes: CloudShape[] = [];
  light: SkyLight | null = null;

  constructor(readonly lowQuality: boolean, floatTargets: boolean) {
    this.atmo = new Atmosphere(floatTargets);
    const au = this.atmo.uniforms as unknown as Record<string, THREE.IUniform>;
    this.cloudLayer = new CloudLayer(lowQuality, !floatTargets, au);
    const ray = () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uDirBase: { value: new THREE.Vector3() },
      uDirX: { value: new THREE.Vector3() },
      uDirY: { value: new THREE.Vector3() },
    });
    this.skyMat = shader(
      SKY_VS,
      SKY_FS,
      {
        ...au,
        ...ray(),
        uZ: { value: 0.999999 },
        uNoise: { value: (this.cloudLayer.marchMat.uniforms.uShape as THREE.IUniform).value },
        uSunDisk: { value: 38 },
        uCirrus: { value: 0.3 },
        uCirrusOff: { value: new THREE.Vector2() },
        uWindDir: { value: new THREE.Vector2(1, 0) },
        uCamAbs: { value: new THREE.Vector3() },
        uAmbTop: { value: new THREE.Color() },
        uGrey: { value: 0 },
        uPixAng: { value: 0.001 },
      },
      { depthTest: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, blending: THREE.NoBlending },
    );
    this.skyPass = fullscreenPass(this.skyMat);
    const groundUniforms = () => ({
      ...au,
      ...ray(),
      uZ: { value: 0.05 },
      uScene: { value: null as THREE.Texture | null },
      uTDepth: { value: this.depthTex },
      uShadow: { value: this.cloudLayer.shadowRT.texture },
      uShadowMap: { value: new THREE.Vector4() },
      uShadowOn: { value: 0 },
      uAnchor: { value: new THREE.Vector3() },
      uEye: { value: new THREE.Vector3() },
      uNF: { value: new THREE.Vector2(1, 1000) },
      uSunGain: { value: new THREE.Vector3(0.8, 0.8, 0.8) },
      uSkyGain: { value: new THREE.Vector3(0.2, 0.2, 0.2) },
      uSat: { value: 0.9 },
    });
    // Terrain beyond the cut (valid packed depth) and nearer than it (the eye's surroundings).
    this.groundMat = shader(SKY_VS, GROUND_FS, groundUniforms(), { depthTest: true, depthWrite: false, depthFunc: THREE.LessDepth, blending: THREE.NoBlending });
    this.groundNearMat = shader(SKY_VS, GROUND_FS, groundUniforms(), { depthTest: true, depthWrite: false, depthFunc: THREE.GreaterEqualDepth, blending: THREE.NoBlending }, { NEAR: '1' });
    this.groundPass = fullscreenPass(this.groundMat);
    this.groundNearPass = fullscreenPass(this.groundNearMat);
    this.glareMat = shader(
      GLARE_VS,
      GLARE_FS,
      {
        uRes: { value: new THREE.Vector2(1, 1) },
        uSunUv: { value: new THREE.Vector2() },
        uOnScreen: { value: 0 },
        uTDepth: { value: this.depthTex },
        uCloudA: { value: (this.cloudLayer.compositeMat.uniforms.uColor as THREE.IUniform).value },
        uHasDepth: { value: 0 },
        uHasClouds: { value: 0 },
        uGlareColor: { value: new THREE.Color(1, 0.95, 0.85) },
        uFovY: { value: 1.15 },
      },
      { depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor },
    );
    this.glarePass = fullscreenPass(this.glareMat);
  }

  /**
   * Lighting for the hour: sun direction (east/north/up), haze from the humidity with its
   * top at the cumulus base, cover (0..1) whitening the light. Returns the light's colours.
   */
  setLight(sunDir: THREE.Vector3, elevation: number, humidity: number, instability: number, cover: number, hazeTopM: number, camAltM: number): SkyLight {
    this.sunDir.copy(sunDir).normalize();
    const k = this.atmo.setConditions(this.sunDir, humidity, cover, hazeTopM, 350, camAltM);
    const ref = this.atmo.reference;
    // Landscape relighting: the photo stands for the reference light (summer noon, clear);
    // the hour changes the colour and level of the direct and sky parts, partly corrected
    // as a camera's white balance would.
    const dirF = (el: number) => 0.3 + 0.7 * Math.max(0, Math.sin((el * Math.PI) / 180));
    const sunEff = k.sunIrr.clone().multiplyScalar(dirF(elevation) / Math.max(0.02, Math.sin((Math.max(elevation, 1) * Math.PI) / 180)) * (1 - 0.12 * cover));
    const refSun = ref.sunIrr.clone().multiplyScalar(dirF(60) / Math.sin(Math.PI / 3));
    const refTot = new THREE.Color(refSun.r + ref.skyIrr.r, refSun.g + ref.skyIrr.g, refSun.b + ref.skyIrr.b);
    const ex = k.exposure / ref.exposure;
    const lumOf = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const balance = (c: THREE.Color) => {
      const g = new THREE.Color(c.r / refTot.r, c.g / refTot.g, c.b / refTot.b).multiplyScalar(ex);
      const l = Math.max(1e-5, lumOf(g));
      return new THREE.Vector3(l + (g.r - l) * 0.6, l + (g.g - l) * 0.6, l + (g.b - l) * 0.6);
    };
    const sunGain = balance(sunEff);
    const skyGain = balance(k.skyIrr);
    for (const m of [this.groundMat, this.groundNearMat]) {
      m.uniforms.uSunGain.value.copy(sunGain);
      m.uniforms.uSkyGain.value.copy(skyGain);
      m.uniforms.uSat.value = 0.9 - 0.12 * humidity - 0.1 * cover;
    }
    // Clouds: ambient from the sky above and the ground's bounce below.
    const cu = this.cloudLayer.marchMat.uniforms;
    // A face sees about half the sky, and a cloud returns ~80 % of the diffuse light.
    cu.uAmbSun.value.copy(k.skySun).multiplyScalar(0.75);
    cu.uAmbAnti.value.copy(k.skyAnti).multiplyScalar(0.75);
    cu.uAmbBot.value.copy(k.ground);
    cu.uSunColor.value.setRGB(1, 1, 1);
    if (this.cloudLayer.direct) cu.uSunColor.value.copy(k.sun);
    this.skyMat.uniforms.uAmbTop.value.copy(k.skyAbove);
    this.skyMat.uniforms.uGrey.value = 0.22 * cover + 0.1 * humidity;
    // High veil: humid days, more ahead of a front than on unstable ones.
    this.cirrusCover = Math.max(0, Math.min(1, 0.8 * humidity - 0.45 * instability));
    this.skyMat.uniforms.uCirrus.value = this.cirrusCover;
    const exp = k.exposure;
    const disp = (c: THREE.Color) => {
      const v = (x: number) => Math.pow(1 - Math.exp(-x * exp), 1 / 2.2);
      return new THREE.Color(v(c.r), v(c.g), v(c.b));
    };
    this.light = { ...k, skyHex: disp(k.zenith), horizonHex: disp(k.horizon) };
    // Without float targets the clouds fade into MapLibre's fog colour with distance.
    cu.uFog.value.copy(this.light.horizonHex);
    cu.uFogRange.value.set(14000 - 9000 * humidity, 60000 - 30000 * humidity);
    return this.light;
  }

  /** Per frame: time, wind (towers lean, cirrus drift), camera height for the sky table. */
  frame(anchor: { x: number; y: number; z: number }, eye: THREE.Vector3, windU: number, windV: number, dt: number): void {
    const time = (performance.now() - this.t0) / 1000;
    const cu = this.cloudLayer.marchMat.uniforms;
    cu.uTime.value = time;
    const ws = Math.hypot(windU, windV);
    // Towers lean downwind with height: a fifth of the radius per height for 10 m/s.
    const lean = Math.min(0.3, ws * 0.02);
    if (ws > 0.1) {
      cu.uLean.value.set((windU / ws) * lean, (windV / ws) * lean);
      this.windDir.set(windU / ws, windV / ws);
    }
    const su = this.skyMat.uniforms;
    su.uCirrusOff.value.x -= windU * 1.8 * dt;
    su.uCirrusOff.value.y -= windV * 1.8 * dt;
    su.uWindDir.value.copy(this.windDir);
    su.uCamAbs.value.set(anchor.x + eye.x, anchor.y + eye.y, anchor.z + eye.z);
    this.atmo.setCamera(anchor.z + eye.z);
  }

  setClouds(list: CloudShape[], near?: { x: number; y: number }): void {
    this.shapes = list;
    this.cloudLayer.setClouds(list, near);
  }

  private setRays(m: THREE.ShaderMaterial, f: FrameInfo): void {
    const u = m.uniforms;
    u.uRes.value.set(f.width, f.height);
    u.uDirBase.value.copy(f.dirBase);
    u.uDirX.value.copy(f.dirX);
    u.uDirY.value.copy(f.dirY);
  }

  /** Offscreen work of the frame (tables, shadow map, low-resolution clouds). */
  prepare(r: THREE.WebGLRenderer, f: FrameInfo): void {
    this.atmo.update(r);
    this.atmo.updateAerial(r, f.dirBase, f.dirX, f.dirY);
    const cu = this.cloudLayer.marchMat.uniforms;
    cu.uAnchor.value.set(f.anchor.x, f.anchor.y, f.anchor.z);
    cu.uEye.value.copy(f.eye);
    (f.cam as THREE.Camera & { fovRad?: number }).fovRad = f.fovY;
    this.cloudLayer.prepare(r, f.cam, f, f.width, f.height, this.sunDir, f.terrainDepth !== null && this.atmo.supported);
  }

  /** Landscape (relit, hazy, shadowed) and sky, into the frame (default framebuffer bound). */
  drawBackground(r: THREE.WebGLRenderer, f: FrameInfo): void {
    this.groundActive = false;
    if (!this.atmo.supported) return;
    if (f.terrainDepth) {
      if (!this.sceneCopy || this.sceneCopy.image.width !== f.width || this.sceneCopy.image.height !== f.height) {
        this.sceneCopy?.dispose();
        this.sceneCopy = new THREE.FramebufferTexture(f.width, f.height);
      }
      r.copyFramebufferToTexture(this.sceneCopy);
      this.depthTex.sourceTexture = f.terrainDepth;
      // NDC depth of the cut between the two landscape passes: MapLibre packs only positive
      // depths, i.e. beyond about twice its near plane (some 60 m): nearer, the eye's position.
      const sm = this.cloudLayer.shadowMap;
      for (const m of [this.groundMat, this.groundNearMat]) {
        const u = m.uniforms;
        this.setRays(m, f);
        u.uScene.value = this.sceneCopy;
        u.uAnchor.value.set(f.anchor.x, f.anchor.y, f.anchor.z);
        u.uEye.value.copy(f.eye);
        u.uNF.value.set(f.near, f.far);
        u.uShadowMap.value.set(sm.cx, sm.cy, 1 / sm.half, sm.zref);
        u.uShadowOn.value = sm.ready && this.cloudLayer.count > 0 ? 1 : 0;
      }
      r.render(this.groundPass, this.cam);
      r.render(this.groundNearPass, this.cam);
      this.groundActive = true;
    }
    this.setRays(this.skyMat, f);
    this.skyMat.uniforms.uPixAng.value = f.fovY / f.height;
    r.render(this.skyPass, this.cam);
  }

  /** The clouds over the frame (after the world's objects). */
  drawClouds(r: THREE.WebGLRenderer, f: FrameInfo): void {
    if (this.cloudLayer.direct) {
      this.cloudLayer.drawDirect(r, f.cam, f.height);
      return;
    }
    const u = this.cloudLayer.compositeMat.uniforms;
    u.uDirBase.value.copy(f.dirBase);
    u.uDirX.value.copy(f.dirX);
    u.uDirY.value.copy(f.dirY);
    u.uNF.value.set(f.near, f.far);
    u.uDR.value.set(f.depthRange[0], f.depthRange[1]);
    this.cloudLayer.drawComposite(r, f.width, f.height);
  }

  /** Sun glare when the sun is in (or near) the view and visible. */
  drawGlare(r: THREE.WebGLRenderer, f: FrameInfo): void {
    if (this.sunDir.z < -0.02 || !this.atmo.supported) return;
    const v = new THREE.Vector4(f.eye.x + this.sunDir.x * 1e5, f.eye.y + this.sunDir.y * 1e5, f.eye.z + this.sunDir.z * 1e5, 1).applyMatrix4(f.cam.projectionMatrix);
    if (v.w <= 0) return;
    const sx = (v.x / v.w) * 0.5 + 0.5;
    const sy = (v.y / v.w) * 0.5 + 0.5;
    if (sx < -0.3 || sx > 1.3 || sy < -0.3 || sy > 1.3) return;
    const u = this.glareMat.uniforms;
    u.uRes.value.set(f.width, f.height);
    u.uSunUv.value.set(sx, sy);
    u.uOnScreen.value = sx > 0.002 && sx < 0.998 && sy > 0.002 && sy < 0.998 ? 1 : 0;
    u.uHasDepth.value = f.terrainDepth ? 1 : 0;
    u.uHasClouds.value = this.cloudLayer.count > 0 ? 1 : 0;
    u.uCloudA.value = (this.cloudLayer.compositeMat.uniforms.uColor as THREE.IUniform).value;
    u.uFovY.value = f.fovY;
    const k = this.light;
    if (k) {
      const s = k.sun;
      const m = Math.max(s.r, s.g, s.b, 1e-4);
      u.uGlareColor.value.setRGB(s.r / m, (s.g / m) * 0.97, (s.b / m) * 0.9).multiplyScalar(0.55 + 0.45 * k.day);
    }
    r.render(this.glarePass, this.cam);
  }

  /** How much of the sun a point sees through the clouds (ray towards the sun against the cloud volumes), 0..1. */
  sunlightAt(x: number, y: number, z: number): number {
    const s = this.sunDir;
    if (s.z <= 0.02) return 0.3;
    let light = 1;
    for (const c of this.shapes) {
      if (z > c.top) continue;
      // Where the ray towards the sun crosses the cloud's mid height.
      const mid = Math.max(z, (c.base + c.top) / 2);
      const t = (mid - z) / s.z;
      const px = x + s.x * t;
      const py = y + s.y * t;
      const d = Math.hypot(px - c.x, py - c.y) / (c.radius * 0.85);
      if (d < 1.2) light *= 1 - 0.75 * c.size * (1 - smooth(0.6, 1.2, d));
    }
    return light;
  }

  /** Cloud shadows on the ground (fallback without the terrain depth): discs offset away from the sun. */
  shadows(groundAt: (x: number, y: number) => number): { x: number; y: number; r: number; k: number }[] {
    const s = this.sunDir;
    if (s.z <= 0.05) return [];
    const out: { x: number; y: number; r: number; k: number }[] = [];
    for (const c of this.shapes) {
      const g = groundAt(c.x, c.y);
      const h = Math.max(0, (c.base + c.top) / 2 - g);
      out.push({ x: c.x - (s.x / s.z) * h, y: c.y - (s.y / s.z) * h, r: c.radius * 0.8, k: 0.42 * c.size });
    }
    return out;
  }

  dispose(): void {
    this.atmo.dispose();
    this.cloudLayer.dispose();
    this.sceneCopy?.dispose();
    for (const m of [this.skyMat, this.groundMat, this.groundNearMat, this.glareMat]) m.dispose();
  }
}
