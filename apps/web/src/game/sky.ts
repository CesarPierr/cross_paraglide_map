/**
 * Sky, light and clouds of the game: the passes drawn in the map's custom layer around
 * the three.js scene, from the physically based atmosphere (atmosphere.ts) and the cumulus
 * (clouds.ts), all seen through one camera: the same exposure and the same filmic tone
 * curve for the sky, the landscape, the clouds and the three.js objects.
 *
 * Per frame, in order:
 * 1. offscreen: the atmosphere tables when the conditions changed, the aerial perspective,
 *    the cloud maps, their shadow map and the clouds at reduced resolution;
 * 2. landscape: the frame MapLibre drew so far is copied and redrawn where there is
 *    terrain, using MapLibre's own terrain depth to know each pixel's position. The IGN
 *    orthophoto is read back into the light of the scene it shows through the exact
 *    inverse of the tone curve (at the reference light, a clear summer noon, it comes out
 *    as it is), its veil removed, a little more contrast and colour than map imagery has;
 *    then it is lit by the light of the hour (the sun's part, warm and low at dawn and
 *    dusk, removed under the cloud shadows, which leaves the bluer sky light; the camera's
 *    white balance takes out a fifth of the light's colour) and seen through the haze
 *    (aerial perspective: transmittance and in-scattering along the view ray, bluish
 *    towards distant ridges, bright towards the sun). The relief is shaded by MapLibre's
 *    hillshade from the real sun, relative to flat ground;
 * 3. the sky where no terrain was drawn: the atmosphere's sky-view table, the sun's disk,
 *    high cirrus on humid days;
 * 4. (the three.js objects, by the world);
 * 5. the clouds, composited with their depth so the relief hides them;
 * 6. the sun's glare (the lens) when the sun is in view and not hidden.
 * Phones without float render targets keep MapLibre's sky and fog and get the clouds
 * marched straight into an 8-bit image.
 *
 * The CPU side keeps what the game logic needs from the clouds: the share of sun reaching
 * a point (for the glider's light) and soft shadow discs (fallback when the terrain depth
 * is not available).
 */
import * as THREE from 'three';
import { ATMO_GLSL, Atmosphere, fullscreenPass, tonemapACES, type Lighting } from './atmosphere';
import { CloudLayer, type CloudShape, type ViewInfo } from './clouds';
import { GpuTimer } from './gpu-timer';
import { TERRAIN_GLSL, type Ground } from './ground';
import { MATERIAL_GLSL } from './materials';

export type { CloudShape } from './clouds';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The landscape pass's `photoRadiance` on the CPU: an sRGB colour of the imagery back into scene light. */
function photoRadianceCpu(c: [number, number, number], veil: THREE.Vector3, gain: number, sat: number, mid: number, contrast: number): [number, number, number] {
  const dec = (v: number) => (v <= 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4));
  const vl = [veil.x, veil.y, veil.z];
  const y = c.map((v, i) => Math.min(0.97, Math.max(0, (dec(v) - vl[i]) / (1 - vl[i]))));
  // Inverse of the ACES fit (atmosphere.ts atmoUntonemap).
  const io = [
    [0.643038, 0.311187, 0.045775],
    [0.059269, 0.931436, 0.009295],
    [0.005962, 0.063929, 0.930118],
  ];
  const ii = [
    [1.764741, -0.675778, -0.088963],
    [-0.147028, 1.160252, -0.013224],
    [-0.036337, -0.162436, 1.198773],
  ];
  const u = io.map((r) => Math.min(1, Math.max(0, r[0] * y[0] + r[1] * y[1] + r[2] * y[2])));
  const v = u.map((uu) => {
    const A = uu * 0.983729 - 1;
    const B = uu * 0.432951 - 0.0245786;
    const C = uu * 0.238081 + 0.000090537;
    return (-B - Math.sqrt(Math.max(B * B - 4 * A * C, 0))) / (2 * A);
  });
  const x = ii.map((r) => Math.max(0, (r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) * 0.6 * gain));
  const l = Math.max(0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2], 1e-6);
  const k = Math.pow(l / mid, contrast - 1);
  return x.map((xx) => Math.max(0, l + (xx - l) * sat) * k) as [number, number, number];
}

/** Radius of a cloud as drawn: a towering one is at least about half as wide as tall (see clouds.ts). */
const visRadius = (c: CloudShape) => Math.max(c.radius * 1.08, 0.22 * (c.top - c.base));

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
  // The sun's disk (0.27°, a little more so it keeps a few pixels), limb-darkened.
  float ang = sqrt(max(0.0, 2.0 * (1.0 - cs)));
  float rs = 0.0062;
  if (ang < rs * 1.6) {
    float x = clamp(ang / rs, 0.0, 1.0);
    float mu = sqrt(max(0.0, 1.0 - x * x));
    float limb = 1.0 - 0.6 * (1.0 - mu) - 0.2 * (1.0 - mu) * (1.0 - mu);
    float edge = 1.0 - smoothstep(1.0 - 1.5 * uPixAng / rs, 1.0 + 1.5 * uPixAng / rs, ang / rs);
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
      float alpha = cov * smoothstep(0.42, 0.8, fib) * 0.42 * smoothstep(0.008, 0.1, dir.z);
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
${TERRAIN_GLSL}
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
uniform float uShadowFloor;
uniform float uHillFlat;
uniform vec3 uVeil;
uniform float uSat;
uniform float uGain;
uniform float uMid;
uniform float uContrast;
uniform float uRelief;
uniform vec3 uSunNorm;
uniform vec3 uGroundGain;
uniform vec3 uRefSunNorm;
uniform vec3 uRefSky;
uniform vec3 uRefGround;
uniform vec3 uRefDir;
uniform float uDelight;
uniform vec3 uSnowX;
${MATERIAL_GLSL}
layout(location = 0) out vec4 fragColor;
float unpackDepth(vec4 c) { return dot(c, vec4(1.0 / 16777216.0, 1.0 / 65536.0, 1.0 / 256.0, 1.0)); }
// The imagery back into the light of the scene it shows (the inverse of the camera's curve:
// at the reference light the photo comes out unchanged), its veil off, a little more
// contrast and colour than map imagery has; the hillshade's darkening of flat ground undone.
vec3 photoRadiance(vec3 c) {
  c = min(c / uHillFlat, vec3(1.0));
  vec3 x = max(atmoDecode(c) - uVeil, vec3(0.0)) / (1.0 - uVeil);
  x = atmoUntonemap(x) * uGain;
  float l = max(dot(x, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
  return max(mix(vec3(l), x, uSat), vec3(0.0)) * pow(l / uMid, uContrast - 1.0);
}
// Distance factor along the far-plane vector from a packed terrain depth.
float depthScale(float z) {
  float n = uNF.x;
  float f = uNF.y;
  return 2.0 * n / max((f + n) - z * (f - n), 1e-6);
}
// Share of the direct sun reaching an absolute point through the clouds.
float cloudShadow(vec3 pa) {
  if (uShadowOn < 0.5) return 1.0;
  vec3 sd = normalize(vec3(uSunDir.xy, max(uSunDir.z, 0.08)));
  vec2 q = pa.xy + sd.xy / sd.z * (uShadowMap.w - pa.z);
  vec2 suv = (q - uShadowMap.xy) * uShadowMap.z * 0.5 + 0.5;
  float edge = smoothstep(0.0, 0.04, min(min(suv.x, suv.y), min(1.0 - suv.x, 1.0 - suv.y)));
  float t = exp(-texture(uShadow, suv).r);
  return mix(1.0, t, edge * smoothstep(0.03, 0.1, uSunDir.z));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb;
  vec3 fv = farVector(uv);
#ifdef NEAR
  // Nearer than the depth texture can tell (between MapLibre's near plane, ~30 m, and about
  // twice that): the view ray marched over the relief's elevations from the near plane (the
  // ground under the eye is out of view, its elevations not drawn), the hit refined by halving.
  vec3 P = uEye;
  float dist = 0.0;
  float nearMiss = 1.0;
  if (uRelief > 0.5) {
    vec3 rd = normalize(fv);
    vec3 eyeA = uEye + uAnchor;
    float t = 0.95 * length(fv) * uNF.x / uNF.y;
    float t0 = t;
    float t1 = t;
    bool hit = false;
    for (int i = 0; i < 16; i++) {
      vec3 q = eyeA + rd * t;
      if (q.z <= terrainH(q.xy)) { hit = true; t1 = t; break; }
      t0 = t;
      t *= 1.07;
    }
    if (hit) {
      for (int i = 0; i < 6; i++) {
        float tm = 0.5 * (t0 + t1);
        vec3 q = eyeA + rd * tm;
        if (q.z <= terrainH(q.xy)) t1 = tm; else t0 = tm;
      }
      dist = 0.5 * (t0 + t1);
      P = uEye + rd * dist;
      nearMiss = 0.0;
    }
  }
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
  float s = depthScale(z);
  // The depth is at the page's pixels (half the screen's on most phones and retina screens):
  // inside a surface, interpolated between its four nearest texels (inverse depth, linear
  // on a plane), so the ground's detail does not come out in blocks.
  {
    vec2 tsz = vec2(textureSize(uTDepth, 0));
    vec2 tf = uv * tsz - 0.5;
    vec2 ti = floor(tf);
    vec2 tt = tf - ti;
    vec4 inv;
    bool same = true;
    for (int i = 0; i < 4; i++) {
      vec2 o = vec2(float(i & 1), float(i >> 1));
      float zz = unpackDepth(texelFetch(uTDepth, ivec2(clamp(ti + o, vec2(0.0), tsz - 1.0)), 0));
      if (zz > 1.0005) same = false;
      float ss = depthScale(zz);
      inv[i] = 1.0 / max(ss, 1e-9);
      if (abs(ss - s) > 0.015 * s) same = false;
    }
    if (same) s = 1.0 / mix(mix(inv.x, inv.y, tt.x), mix(inv.z, inv.w, tt.x), tt.y);
  }
  vec3 P = uEye + fv * s;
  float dist = s * length(fv);
#endif
  vec3 x = photoRadiance(c);
  // Lit by the light of the hour, the direct part dimmed under the clouds' shadows (the
  // sky's blue remains).
  float sh = cloudShadow(P + uAnchor);
  if (uRelief > 0.5) {
    // The relief's light (ground.ts): the photo is the ground under the reference light (a
    // summer noon from the south), the slope's own share of it taken out, then lit by the
    // sun of the hour on that slope, behind the mountains' shadows and the clouds', by the
    // sky the relief leaves open and by the light the ground below sends back; what the
    // ground is made of (materials.ts) adds its micro-relief, its snow, its reflections.
    vec3 pa = P + uAnchor;
    Relief rf = relief(pa.xy);
    vec3 N = rf.n;
    float skyOpen = (0.5 + 0.5 * N.z) * rf.sky;
    float below = 0.5 - 0.5 * N.z;
    vec3 eRef = uRefSunNorm * max(dot(N, uRefDir), 0.0) + uRefSky * skyOpen + uRefGround * below;
    vec3 dl = mix(vec3(1.0), max(eRef, vec3(0.45)), uDelight);
    vec3 xd = x / dl;
    float sunVis = mix(uShadowFloor, 1.0, sh);
    if (uMaterials > 0.5) {
      // Steep faces: the photo is stretched down the fall line; its colour averaged across
      // (along the screen's rows), between similar pixels only (not over the cliff's edge).
      vec3 xs = xd;
#ifndef GROUND_LOW
      if (N.z < 0.55) {
        vec3 acc = x;
        float wsum = 1.0;
        float lx = lum3(x);
        for (int i = 0; i < 2; i++) {
          vec3 xt = photoRadiance(texelFetch(uScene, ivec2(gl_FragCoord.xy + vec2(i == 0 ? 5.0 : -5.0, 0.0)), 0).rgb);
          float w = exp(-2.0 * abs(lum3(xt) - lx) / max(lx, 1e-4));
          acc += xt * w;
          wsum += w;
        }
        xs = acc / wsum / dl;
      }
#endif
      x = gShade(xd, xs, uSnowX, pa, normalize(-fv), dist, rf, sunVis);
      if (uGDebug == 7) {
        // Not-a-number finder: red in the colour, green in the position's derivatives.
        bool bad = any(isnan(x)) || any(isinf(x));
        bool badD = any(isnan(dFdx(pa))) || any(isinf(dFdx(pa))) || any(isnan(dFdy(pa)));
#ifdef NEAR
        fragColor = vec4(bad ? 1.0 : 0.0, badD ? 1.0 : 0.0, 0.5 + 0.5 * nearMiss, 1.0);
#else
        fragColor = vec4(bad ? 1.0 : 0.0, badD ? 1.0 : 0.0, 0.0, 1.0);
#endif
        return;
      }
      if (uGDebug >= 5) {
        fragColor = vec4(gDbg, 1.0);
        return;
      }
    } else {
      vec3 eNow = uSunNorm * max(dot(N, uSunDir), 0.0) * rf.sun * sunVis + uSkyGain * skyOpen + uGroundGain * below;
      x = xd * eNow;
    }
  } else {
    x *= uSunGain * mix(uShadowFloor, 1.0, sh) + uSkyGain;
  }
  // Aerial perspective between the eye and the ground.
  vec3 Lap;
  vec3 Tap;
  atmoAerialLut(uv, dist / 1000.0, Lap, Tap);
  x = x * Tap + Lap;
  vec3 col = atmoEncode(atmoTonemap(x * uExposure));
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
        vec2 p = uSunUv + vec2(float(i), float(j)) * 0.003;
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
  // A lens's veiling glare around a very bright source: a tight core and a long faint tail.
  float g = 0.5 * exp(-r / 0.006) + 0.16 * exp(-r / 0.025) + 0.05 * exp(-r / 0.11) + 0.018 * exp(-r / 0.4);
  fragColor = vec4(uGlareColor * g * vVis, 0.0);
}`;

function shader(vs: string, fs: string, uniforms: Record<string, THREE.IUniform>, extra: Partial<THREE.ShaderMaterialParameters> = {}, defines: Record<string, string> = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, glslVersion: THREE.GLSL3, uniforms, defines, ...extra });
}

export interface SkyLight extends Lighting {
  /** Display colours for MapLibre's sky and fog (fallback). */
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
  private windDir = new THREE.Vector2(1, 0);
  private sunV = new THREE.Vector4();
  private timer: GpuTimer | null = null;
  private view: ViewInfo = { eye: new THREE.Vector3(), anchor: { x: 0, y: 0, z: 0 }, dirBase: new THREE.Vector3(), dirX: new THREE.Vector3(), dirY: new THREE.Vector3(), near: 1, far: 1000, fovY: 1, proj: new THREE.Matrix4() };
  /** Average GPU time of the passes (ms), in development, where the browser can measure it. */
  readonly timings: Record<string, number> = {};
  private adaptT = 0;
  private raiseT = 0;
  /** Adaptive cloud quality on (development tools turn it off for comparisons). */
  adaptive = true;

  private frameEma = 1 / 60;
  /** The landscape pass ran this frame: MapLibre's fog must stay off. */
  groundActive = false;
  light: SkyLight | null = null;
  /** Darkening of flat ground by MapLibre's hillshade (sRGB factor), undone by the landscape pass. */
  hillFlat = 1;
  /**
   * The relief's light (ground.ts) in the landscape pass's units (shares of the reference
   * light's illuminance on flat ground): the sun at normal incidence, the ground's bounce,
   * and the same for the reference light the photos were taken in (a summer noon, the sun
   * 60° high in the south).
   */
  private relight = {
    sunNorm: { value: new THREE.Vector3(1, 1, 1) },
    ground: { value: new THREE.Vector3(0.1, 0.1, 0.1) },
    refSunNorm: { value: new THREE.Vector3(1, 1, 1) },
    refSky: { value: new THREE.Vector3(0.2, 0.2, 0.2) },
    refGround: { value: new THREE.Vector3(0.1, 0.1, 0.1) },
    refDir: { value: new THREE.Vector3(0, -0.5, Math.sqrt(0.75)) },
    snowX: { value: new THREE.Vector3(1, 1, 1) },
  };

  constructor(
    readonly lowQuality: boolean,
    floatTargets: boolean,
    readonly ground: Ground,
  ) {
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
        uSunDisk: { value: 60 },
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
      uSunGain: { value: new THREE.Vector3(0.83, 0.83, 0.83) },
      uSkyGain: { value: new THREE.Vector3(0.17, 0.17, 0.17) },
      uShadowFloor: { value: 0.12 },
      uHillFlat: { value: 1 },
      uVeil: { value: new THREE.Vector3(0.004, 0.006, 0.012) },
      uSat: { value: 1.18 },
      uGain: { value: 1 / 3.4 },
      uMid: { value: 0.05 },
      uContrast: { value: 1.1 },
      ...ground.uniforms,
      uSunNorm: this.relight.sunNorm,
      uGroundGain: this.relight.ground,
      uRefSunNorm: this.relight.refSunNorm,
      uRefSky: this.relight.refSky,
      uRefGround: this.relight.refGround,
      uRefDir: this.relight.refDir,
      uDelight: { value: 0.85 },
      uSnowX: this.relight.snowX,
    });
    // Terrain beyond the cut (valid packed depth) and nearer than it (the eye's surroundings).
    // Phones: the materials without their detail stack (materials.ts).
    const low: Record<string, string> = lowQuality ? { GROUND_LOW: '1' } : {};
    this.groundMat = shader(SKY_VS, GROUND_FS, groundUniforms(), { depthTest: true, depthWrite: false, depthFunc: THREE.LessDepth, blending: THREE.NoBlending }, low);
    this.groundNearMat = shader(SKY_VS, GROUND_FS, groundUniforms(), { depthTest: true, depthWrite: false, depthFunc: THREE.GreaterEqualDepth, blending: THREE.NoBlending }, { NEAR: '1', ...low });
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
        uCloudA: { value: null },
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
    // Landscape: the photo stands for the reference light (a clear summer noon). The hour
    // changes the level and colour of the direct and sky parts; the camera's white balance
    // takes out a fifth of the light's colour by day, none when the sun is low (dusk stays
    // golden, shade stays blue).
    const refTot = [ref.sunIrr.r + ref.skyIrr.r, ref.sunIrr.g + ref.skyIrr.g, ref.sunIrr.b + ref.skyIrr.b];
    const sunE = [k.sunIrr.r, k.sunIrr.g, k.sunIrr.b].map((v) => v * (1 - 0.1 * cover));
    const skyE = [k.skyIrr.r, k.skyIrr.g, k.skyIrr.b];
    const ratio = [0, 1, 2].map((c) => (sunE[c] + skyE[c]) / refTot[c]);
    const neutral = 0.2126 * ratio[0] + 0.7152 * ratio[1] + 0.0722 * ratio[2];
    // No correction at all when the sun is low: the golden hour is shot in daylight balance.
    const wbK = 0.2 * smooth(8, 30, elevation);
    const wb = ratio.map((v) => Math.pow(neutral / Math.max(v, 1e-5), wbK));
    // The relief's light: the sun at normal incidence (its illuminance on flat ground over the
    // sine of its height), the ground's bounce (π × its radiance), now and in the reference.
    const sinNow = Math.max(0.02, sunDir.z);
    const rl = this.relight;
    rl.sunNorm.value.set(...([0, 1, 2].map((c) => ((sunE[c] / sinNow) / refTot[c]) * wb[c]) as [number, number, number]));
    const grnd = [k.ground.r, k.ground.g, k.ground.b];
    rl.ground.value.set(...([0, 1, 2].map((c) => ((Math.PI * grnd[c]) / refTot[c]) * wb[c]) as [number, number, number]));
    const refSun = [ref.sunIrr.r, ref.sunIrr.g, ref.sunIrr.b];
    const refSky = [ref.skyIrr.r, ref.skyIrr.g, ref.skyIrr.b];
    const refGrnd = [ref.ground.r, ref.ground.g, ref.ground.b];
    const sinRef = rl.refDir.value.z;
    rl.refSunNorm.value.set(...([0, 1, 2].map((c) => refSun[c] / sinRef / refTot[c]) as [number, number, number]));
    rl.refSky.value.set(...([0, 1, 2].map((c) => refSky[c] / refTot[c]) as [number, number, number]));
    rl.refGround.value.set(...([0, 1, 2].map((c) => (Math.PI * refGrnd[c]) / refTot[c]) as [number, number, number]));
    // Materials: an albedo in the landscape's units (a white ground under the reference
    // light), the sun at normal incidence for the speculars.
    const gu = this.ground.uniforms;
    gu.uAlbedoToX.value.set(refTot[0] / Math.PI, refTot[1] / Math.PI, refTot[2] / Math.PI);
    gu.uSunX.value.copy(rl.sunNorm.value).multiply(new THREE.Vector3(refTot[0], refTot[1], refTot[2]));
    for (const m of [this.groundMat, this.groundNearMat]) {
      const u = m.uniforms;
      u.uSunGain.value.set(...([0, 1, 2].map((c) => (sunE[c] / refTot[c]) * wb[c]) as [number, number, number]));
      u.uSkyGain.value.set(...([0, 1, 2].map((c) => (skyE[c] / refTot[c]) * wb[c]) as [number, number, number]));
      // The photo is the reference light seen through the reference exposure; mid-grey of
      // its scene light for the contrast. Humid days and a covered sky look flatter.
      u.uGain.value = 1 / ref.exposure;
      u.uMid.value = 0.165 / ref.exposure;
      u.uSat.value = 1.2 - 0.1 * humidity - 0.1 * cover;
      u.uContrast.value = 1.1 - 0.04 * humidity;
    }
    // Fresh snow as the photos show it (their snowfields' colour read back like any pixel).
    {
      const u = this.groundMat.uniforms;
      const x = photoRadianceCpu([0.91, 0.925, 0.95], u.uVeil.value as THREE.Vector3, u.uGain.value as number, u.uSat.value as number, u.uMid.value as number, u.uContrast.value as number);
      this.relight.snowX.value.set(x[0], x[1], x[2]);
    }
    // Clouds: ambient from the sky above and the ground's bounce below.
    const cu = this.cloudLayer.marchMat.uniforms;
    cu.uAmbSun.value.copy(k.skySun);
    cu.uAmbAnti.value.copy(k.skyAnti);
    cu.uAmbBot.value.copy(k.ground);
    cu.uSunColor.value.copy(k.sun);
    this.skyMat.uniforms.uAmbTop.value.copy(k.skyAbove);
    this.skyMat.uniforms.uGrey.value = 0.15 * cover + 0.06 * humidity;
    // High veil: humid days, more ahead of a front than on unstable ones.
    this.skyMat.uniforms.uCirrus.value = Math.max(0, Math.min(1, 0.8 * humidity - 0.45 * instability));
    const disp = (c: THREE.Color) => {
      const t = tonemapACES(c.r * k.exposure, c.g * k.exposure, c.b * k.exposure);
      return new THREE.Color().setRGB(t.r, t.g, t.b, THREE.LinearSRGBColorSpace);
    };
    this.light = { ...k, skyHex: disp(k.zenith), horizonHex: disp(k.horizon) };
    // Without float targets the clouds fade into MapLibre's fog colour with distance.
    cu.uFog.value.copy(this.light.horizonHex);
    cu.uFogRange.value.set(14000 - 9000 * humidity, 60000 - 30000 * humidity);
    return this.light;
  }

  /** Per frame: time, wind (towers lean, cirrus drift, far clouds drift), camera height for the sky table. */
  frame(anchor: { x: number; y: number; z: number }, eye: THREE.Vector3, windU: number, windV: number, dt: number): void {
    const time = (performance.now() - this.t0) / 1000;
    this.adapt(dt);
    this.cloudLayer.setWind(windU, windV, time);
    const ws = Math.hypot(windU, windV);
    if (ws > 0.1) this.windDir.set(windU / ws, windV / ws);
    const su = this.skyMat.uniforms;
    su.uCirrusOff.value.x -= windU * 1.8 * dt;
    su.uCirrusOff.value.y -= windV * 1.8 * dt;
    su.uWindDir.value.copy(this.windDir);
    su.uCamAbs.value.set(anchor.x + eye.x, anchor.y + eye.y, anchor.z + eye.z);
    this.atmo.setCamera(anchor.z + eye.z);
  }

  setClouds(list: CloudShape[], near?: { x: number; y: number }): void {
    this.cloudLayer.setClouds(list, near);
  }

  /** The clouds' shadow map as the landscape pass reads it (for three.js materials, ground.ts `sunlit`). */
  get cloudShadowUniforms(): { uShadow: THREE.IUniform; uShadowMap: THREE.IUniform; uShadowOn: THREE.IUniform; uSunDir: THREE.IUniform } {
    const u = this.groundMat.uniforms;
    return { uShadow: u.uShadow, uShadowMap: u.uShadowMap, uShadowOn: u.uShadowOn, uSunDir: u.uSunDir };
  }

  /** Current clouds of the air mass, for shadows and the dimming under them. */
  get shapes(): CloudShape[] {
    return this.cloudLayer.shapes;
  }

  private setRays(m: THREE.ShaderMaterial, f: FrameInfo): void {
    const u = m.uniforms;
    u.uRes.value.set(f.width, f.height);
    u.uDirBase.value.copy(f.dirBase);
    u.uDirX.value.copy(f.dirX);
    u.uDirY.value.copy(f.dirY);
  }

  private time(label: string, on: boolean): void {
    if (!this.timer) return;
    if (on) this.timer.begin(label);
    else this.timer.end();
  }

  /** Offscreen work of the frame (tables, cloud maps, shadow map, low-resolution clouds). */
  prepare(r: THREE.WebGLRenderer, f: FrameInfo): void {
    if (!this.timer && import.meta.env.DEV) this.timer = new GpuTimer(r.getContext() as WebGL2RenderingContext);
    if (this.timer) {
      this.timer.poll();
      Object.assign(this.timings, this.timer.ms);
    }
    this.time('atmosphere', true);
    this.atmo.update(r);
    this.atmo.updateAerial(r, f.dirBase, f.dirX, f.dirY);
    this.time('atmosphere', false);
    if (f.terrainDepth) this.depthTex.sourceTexture = f.terrainDepth;
    this.time('clouds', true);
    const v = this.view;
    v.eye = f.eye;
    v.anchor = f.anchor;
    v.dirBase = f.dirBase;
    v.dirX = f.dirX;
    v.dirY = f.dirY;
    v.near = f.near;
    v.far = f.far;
    v.fovY = f.fovY;
    v.proj = f.cam.projectionMatrix;
    this.cloudLayer.prepare(r, v, f.width, f.height, this.sunDir, f.terrainDepth !== null && this.atmo.supported, f.terrainDepth ? this.depthTex : null);
    this.time('clouds', false);
  }

  /**
   * Adaptive quality from the frame time (GPU timer queries are not reliable everywhere:
   * ANGLE on Metal reports whole command buffers): when frames run long, the clouds lose
   * resolution first, then steps; when they are comfortably short again, they get them back
   * one notch at a time.
   */
  private adapt(dt: number): void {
    if (!this.adaptive || dt <= 0 || dt > 0.25) return;
    this.frameEma += (dt - this.frameEma) * 0.04;
    const now = performance.now();
    if (now - this.adaptT < 2000) return;
    const cl = this.cloudLayer;
    // Up to three quarters of the pixels per axis on a computer when the frames allow it:
    // at half, a 1:1 screen shows the march's 2-pixel steps on near clouds (a high-density
    // screen is held to ~0.9 Mpx by the layer anyway).
    const top = this.lowQuality ? 0.34 : 0.75;
    const topSteps = this.lowQuality ? 80 : 160;
    const floor = this.frameEma > 0.03 ? 0.24 : this.lowQuality ? 0.28 : 0.36;
    if (this.frameEma > 0.0195 && cl.scale > floor + 1e-3) {
      cl.scale = Math.max(floor, cl.scale - 0.04);
      if (cl.scale <= floor + 1e-3) cl.steps = Math.max(this.lowQuality ? 56 : 96, cl.steps - 16);
      this.adaptT = now;
      this.raiseT = now;
    } else if (this.frameEma > 0.0195 && !this.ground.lowDetail) {
      // The clouds at their floor and still slow: the ground's detail stack goes (materials.ts).
      this.ground.lowDetail = true;
      this.adaptT = now;
      this.raiseT = now;
    } else if (this.frameEma < 0.0172 && now - this.raiseT > 8000 && this.ground.lowDetail) {
      this.ground.lowDetail = false;
      this.adaptT = now;
      this.raiseT = now;
    } else if (this.frameEma < 0.0172 && now - this.raiseT > 8000 && (cl.scale < top - 1e-3 || cl.steps < topSteps)) {
      cl.scale = Math.min(top, cl.scale + 0.04);
      cl.steps = Math.min(topSteps, cl.steps + 16);
      this.adaptT = now;
      this.raiseT = now;
    }
  }

  /** Landscape (relit, hazy, shadowed) and sky, into the frame (default framebuffer bound). */
  drawBackground(r: THREE.WebGLRenderer, f: FrameInfo): void {
    this.groundActive = false;
    if (!this.atmo.supported) return;
    this.time('background', true);
    if (f.terrainDepth) {
      if (!this.sceneCopy || this.sceneCopy.image.width !== f.width || this.sceneCopy.image.height !== f.height) {
        this.sceneCopy?.dispose();
        this.sceneCopy = new THREE.FramebufferTexture(f.width, f.height);
      }
      r.copyFramebufferToTexture(this.sceneCopy);
      this.lastSize.set(f.width, f.height);
      this.depthTex.sourceTexture = f.terrainDepth;
      this.ground.uniforms.uPixAng.value = f.fovY / f.height;
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
        u.uHillFlat.value = this.hillFlat;
      }
      r.render(this.groundPass, this.cam);
      r.render(this.groundNearPass, this.cam);
      this.groundActive = true;
    }
    this.setRays(this.skyMat, f);
    this.skyMat.uniforms.uPixAng.value = f.fovY / f.height;
    r.render(this.skyPass, this.cam);
    this.time('background', false);
  }

  /**
   * Development: GPU time of the landscape pass (ms per full-screen pass) at the last frame's
   * view, drawn n times into offscreen targets and waited for by reading a pixel back. Timer
   * queries and frame times cannot tell it apart in a headless browser on macOS.
   */
  benchGround(r: THREE.WebGLRenderer, n = 30): number {
    const w = this.lastSize.x;
    const h = this.lastSize.y;
    if (!w || !h) return NaN;
    // Two targets in turn: each draw its own render pass, which a tiled GPU cannot skip.
    const rts = [0, 1].map(() => new THREE.WebGLRenderTarget(w, h, { depthBuffer: false }));
    const m = this.groundMat;
    const keep = m.depthTest;
    m.depthTest = false;
    m.needsUpdate = true;
    const px = new Uint8Array(4);
    r.setRenderTarget(rts[0]);
    r.render(this.groundPass, this.cam);
    r.readRenderTargetPixels(rts[0], 0, 0, 1, 1, px);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      r.setRenderTarget(rts[i & 1]);
      r.render(this.groundPass, this.cam);
    }
    r.readRenderTargetPixels(rts[(n - 1) & 1], 0, 0, 1, 1, px);
    const ms = (performance.now() - t0) / n;
    r.setRenderTarget(null);
    m.depthTest = keep;
    m.needsUpdate = true;
    for (const rt of rts) rt.dispose();
    return ms;
  }
  private lastSize = new THREE.Vector2();

  /** The clouds over the frame (after the world's objects). */
  drawClouds(r: THREE.WebGLRenderer, f: FrameInfo): void {
    const u = this.cloudLayer.compositeMat.uniforms;
    u.uDirBase.value.copy(f.dirBase);
    u.uDirX.value.copy(f.dirX);
    u.uDirY.value.copy(f.dirY);
    u.uNF.value.set(f.near, f.far);
    u.uDR.value.set(f.depthRange[0], f.depthRange[1]);
    this.time('composite', true);
    this.cloudLayer.drawComposite(r, f.width, f.height);
    this.time('composite', false);
  }

  /** Sun glare when the sun is in (or near) the view and visible. */
  drawGlare(r: THREE.WebGLRenderer, f: FrameInfo): void {
    if (this.sunDir.z < -0.02 || !this.atmo.supported) return;
    const v = this.sunV.set(f.eye.x + this.sunDir.x * 1e5, f.eye.y + this.sunDir.y * 1e5, f.eye.z + this.sunDir.z * 1e5, 1).applyMatrix4(f.cam.projectionMatrix);
    if (v.w <= 0) return;
    const sx = (v.x / v.w) * 0.5 + 0.5;
    const sy = (v.y / v.w) * 0.5 + 0.5;
    if (sx < -0.3 || sx > 1.3 || sy < -0.3 || sy > 1.3) return;
    const u = this.glareMat.uniforms;
    u.uRes.value.set(f.width, f.height);
    u.uSunUv.value.set(sx, sy);
    u.uOnScreen.value = sx > 0.002 && sx < 0.998 && sy > 0.002 && sy < 0.998 ? 1 : 0;
    u.uHasDepth.value = f.terrainDepth ? 1 : 0;
    const cover = this.cloudLayer.coverTexture;
    u.uHasClouds.value = cover && this.cloudLayer.count > 0 ? 1 : 0;
    u.uCloudA.value = cover;
    u.uFovY.value = f.fovY;
    const k = this.light;
    if (k) {
      const s = k.sun;
      const m = Math.max(s.r, s.g, s.b, 1e-4);
      // Dimmer through a thick haze (the sun's own transmittance), never more than a glow.
      const level = Math.min(1, 1.6 * (0.2126 * s.r + 0.7152 * s.g + 0.0722 * s.b)) * (0.55 + 0.45 * k.day);
      u.uGlareColor.value.setRGB(s.r / m, (s.g / m) * 0.97, (s.b / m) * 0.92).multiplyScalar(level);
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
      const d = Math.hypot(px - c.x, py - c.y) / (visRadius(c) * 0.95);
      if (d < 1.2) light *= 1 - 0.85 * smooth(0.08, 0.5, c.size) * (1 - smooth(0.7, 1.2, d));
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
      out.push({ x: c.x - (s.x / s.z) * h, y: c.y - (s.y / s.z) * h, r: visRadius(c) * 0.85, k: 0.5 * smooth(0.08, 0.5, c.size) });
    }
    return out;
  }

  dispose(): void {
    this.atmo.dispose();
    this.cloudLayer.dispose();
    this.sceneCopy?.dispose();
    this.timer?.dispose();
    for (const m of [this.skyMat, this.groundMat, this.groundNearMat, this.glareMat]) m.dispose();
  }
}
