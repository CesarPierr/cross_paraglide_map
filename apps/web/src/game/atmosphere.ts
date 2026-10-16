/**
 * Physically based atmosphere: the sky's colour, the haze over the landscape and the colour
 * of the sunlight, from the same scattering model (Hillaire, "A Scalable and Production
 * Ready Sky and Atmosphere Rendering Technique", EGSR 2020; Bruneton's transmittance
 * parametrisation).
 *
 * The air is a spherical shell (radius 6360–6460 km) of three media: molecules (Rayleigh
 * scattering, the blue), aerosols (Mie scattering, the white haze and the glow around the
 * sun) and ozone (absorption, the deep blue of twilight). Aerosols follow the Alpine summer
 * pattern: a hazy convective boundary layer up to about the cumulus base, mixed by the
 * thermals, and much cleaner air above it; the humidity sets how thick the haze is.
 *
 * Small look-up tables are rendered on the GPU (the first three when the conditions change):
 * - transmittance (256 × 64): light lost along a ray from a height towards a direction;
 * - multiple scattering (32 × 32): the light scattered more than once, isotropic, per
 *   height and sun angle, which keeps twilight skies and thick haze bright enough;
 * - sky view (192 × 108): the sky's radiance around the camera, with more texels near the
 *   horizon, sampled by the sky pass;
 * - aerial perspective (512 × 192, every frame): in-scattered light and transmittance from
 *   the camera along 64 × 48 view directions over the screen, at 32 distances up to
 *   160 km (froxels), read by the landscape and cloud passes (`atmoAerialLut`), so the
 *   haze on a far ridge, on a far cloud and the sky above them match.
 * Radiances are per unit of sun illuminance; `uExposure` turns them into display values
 * through `atmoTonemap` (1 − e^−x), also used to read the orthophotos back into radiance,
 * with a partial adaptation at dusk (a photographer opens up, but not in proportion).
 * A small CPU copy of the model gives the colours of the lights.
 */
import * as THREE from 'three';

const RB = 6360;
const RT = 6460;
const RAYLEIGH: [number, number, number] = [5.802e-3, 13.558e-3, 33.1e-3];
const OZONE: [number, number, number] = [0.65e-3, 1.881e-3, 0.085e-3];
/** Free-troposphere aerosols above the boundary layer, per km at sea level (clean air). */
const MIE_BG = 0.0035;

/** Uniforms and functions shared by every shader that needs the atmosphere. */
export const ATMO_GLSL = /* glsl */ `
#ifndef PI
#define PI 3.14159265359
#endif
const float RB = 6360.0;
const float RT = 6460.0;
uniform vec3 uRayS;
// x: boundary-layer aerosol extinction per km at the ground, y: top of the boundary layer
// (km), z: valley floor (km), w: Mie asymmetry g.
uniform vec4 uMie;
uniform float uMieBg;
uniform vec3 uOzone;
uniform sampler2D uTransLut;
uniform sampler2D uMsLut;
uniform sampler2D uSkyLut;
uniform vec3 uSunDir;
uniform float uCamR;
uniform float uExposure;

void atmoMedium(float h, out vec3 scaR, out float scaM, out vec3 ext) {
  h = max(h, 0.0);
  float bl = exp(-max(h - uMie.z, 0.0) / 2.2) * (1.0 - smoothstep(uMie.y - 0.25, uMie.y + 0.4, h));
  float m = uMie.x * bl + uMieBg * exp(-h / 1.2);
  scaR = uRayS * exp(-h / 8.0);
  scaM = m * 0.92;
  ext = scaR + vec3(m) + uOzone * max(0.0, 1.0 - abs(h - 25.0) / 15.0);
}
float rayleighPhase(float c) { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
float miePhase(float c, float g) {
  float g2 = g * g;
  float k = 3.0 / (8.0 * PI) * (1.0 - g2) / (2.0 + g2);
  return k * (1.0 + c * c) / pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5);
}
// Nearest positive hit of a ray from inside or outside a sphere centred at the origin, -1 if none.
float raySphere(vec3 ro, vec3 rd, float R) {
  float b = dot(ro, rd);
  float r = length(ro);
  float c = (r - R) * (r + R);
  float disc = b * b - c;
  if (disc < 0.0) return -1.0;
  float s = sqrt(disc);
  float t0 = -b - s;
  float t1 = -b + s;
  if (t1 < 0.0) return -1.0;
  return t0 >= 0.0 ? t0 : t1;
}
vec2 transUv(float r, float mu) {
  float H = sqrt(RT * RT - RB * RB);
  float rho = sqrt(max(r * r - RB * RB, 0.0));
  float disc = r * r * (mu * mu - 1.0) + RT * RT;
  float d = max(0.0, -r * mu + sqrt(max(disc, 0.0)));
  float dmin = RT - r;
  float dmax = rho + H;
  return vec2((d - dmin) / max(dmax - dmin, 1e-4), rho / H);
}
vec3 atmoTransmittance(float r, float mu) { return textureLod(uTransLut, transUv(r, mu), 0.0).rgb; }
// Sunlight reaching a point (km, planet-centred): transmittance, zero in the Earth's shadow.
vec3 atmoSunAt(vec3 p) {
  float r = length(p);
  float mu = dot(p / r, uSunDir);
  if (raySphere(p, uSunDir, RB) >= 0.0) return vec3(0.0);
  return atmoTransmittance(r, mu);
}
vec3 atmoMs(float r, float mu) {
  vec2 uv = vec2(mu * 0.5 + 0.5, clamp((r - RB) / (RT - RB), 0.0, 1.0));
  uv = (uv * 31.0 + 0.5) / 32.0;
  return textureLod(uMsLut, uv, 0.0).rgb;
}
// Sky radiance seen from the camera towards dir (z up), per unit sun illuminance.
vec3 atmoSky(vec3 dir) {
  float r = uCamR;
  float vh = sqrt(max(r * r - RB * RB, 0.0));
  float beta = acos(clamp(vh / r, -1.0, 1.0));
  float zh = PI - beta;
  float vza = acos(clamp(dir.z, -1.0, 1.0));
  float v;
  if (vza < zh) v = 0.5 * (1.0 - sqrt(max(0.0, 1.0 - vza / zh)));
  else v = 0.5 + 0.5 * sqrt(clamp((vza - zh) / beta, 0.0, 1.0));
  vec2 h = dir.xy;
  vec2 s = uSunDir.xy;
  float cl = (dot(h, h) > 1e-8 && dot(s, s) > 1e-8) ? dot(normalize(h), normalize(s)) : 1.0;
  float u = sqrt(clamp(-cl * 0.5 + 0.5, 0.0, 1.0));
  vec2 uv = vec2((u * 191.0 + 0.5) / 192.0, (v * 107.0 + 0.5) / 108.0);
  return textureLod(uSkyLut, uv, 0.0).rgb;
}
// Light scattered into a view ray between the camera and a point dist km away (L, per unit
// sun illuminance) and the transmittance over that distance (T).
void atmoAerial(vec3 dir, float dist, int n, out vec3 L, out vec3 T) {
  vec3 ro = vec3(0.0, 0.0, uCamR);
  float c = dot(dir, uSunDir);
  float pR = rayleighPhase(c);
  float pM = miePhase(c, uMie.w);
  L = vec3(0.0);
  T = vec3(1.0);
  float dt = dist / float(n);
  for (int i = 0; i < 16; i++) {
    if (i >= n) break;
    vec3 p = ro + dir * ((float(i) + 0.5) * dt);
    float r = length(p);
    vec3 sR; float sM; vec3 ext;
    atmoMedium(r - RB, sR, sM, ext);
    float mu = dot(p / r, uSunDir);
    vec3 S = atmoSunAt(p) * (sR * pR + sM * pM) + atmoMs(r, mu) * (sR + sM);
    vec3 st = exp(-ext * dt);
    L += T * (S - S * st) / max(ext, vec3(1e-7));
    T *= st;
  }
}
// Aerial perspective table (froxels): 32 distance slices of 64 × 48 view directions over
// the screen, tiled 8 × 4 in one texture, recomputed every frame. uv: screen position.
uniform sampler2D uApL;
uniform sampler2D uApT;
uniform float uApMax;
vec2 apSliceUv(float k, vec2 luv) {
  vec2 tile = vec2(mod(k, 8.0), floor(k / 8.0));
  return (tile * vec2(64.0, 48.0) + luv * vec2(64.0, 48.0)) / vec2(512.0, 192.0);
}
void atmoAerialLut(vec2 uv, float distKm, out vec3 L, out vec3 T) {
  float x = sqrt(clamp(distKm / uApMax, 0.0, 1.0)) * 32.0 - 1.0;
  float k0 = floor(x);
  float fk = x - k0;
  vec2 luv = clamp(uv, vec2(0.5 / 64.0, 0.5 / 48.0), vec2(1.0 - 0.5 / 64.0, 1.0 - 0.5 / 48.0));
  vec3 L0 = vec3(0.0);
  vec3 T0 = vec3(1.0);
  if (k0 >= 0.0) {
    vec2 a = apSliceUv(k0, luv);
    L0 = textureLod(uApL, a, 0.0).rgb;
    T0 = textureLod(uApT, a, 0.0).rgb;
  }
  vec2 b = apSliceUv(min(k0 + 1.0, 31.0), luv);
  L = mix(L0, textureLod(uApL, b, 0.0).rgb, fk);
  T = mix(T0, textureLod(uApT, b, 0.0).rgb, fk);
}
vec3 atmoTonemap(vec3 x) { return 1.0 - exp(-max(x, vec3(0.0))); }
vec3 atmoUntonemap(vec3 c) { return -log(max(1.0 - min(c, vec3(0.985)), vec3(1e-4))); }
vec3 atmoEncode(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }
vec3 atmoDecode(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
`;

const FULLSCREEN_VS = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/** Builds the aerial perspective table: each texel integrates its view ray up to its slice's distance. */
const AP_FS = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uDirBase;
uniform vec3 uDirX;
uniform vec3 uDirY;
layout(location = 0) out vec4 oL;
layout(location = 1) out vec4 oT;
void main() {
  vec2 px = gl_FragCoord.xy - 0.5;
  vec2 tile = floor(px / vec2(64.0, 48.0));
  float k = tile.y * 8.0 + tile.x;
  vec2 luv = (mod(px, vec2(64.0, 48.0)) + 0.5) / vec2(64.0, 48.0);
  vec2 ndc = luv * 2.0 - 1.0;
  vec3 dir = normalize(uDirBase + ndc.x * uDirX + ndc.y * uDirY);
  float d = uApMax * pow((k + 1.0) / 32.0, 2.0);
  vec3 L;
  vec3 T;
  atmoAerial(dir, d, 12, L, T);
  oL = vec4(L, 1.0);
  oT = vec4(T, 1.0);
}`;

const TRANS_FS = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uSize;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float H = sqrt(RT * RT - RB * RB);
  float rho = H * uv.y;
  float r = sqrt(rho * rho + RB * RB);
  float dmin = RT - r;
  float dmax = rho + H;
  float d = dmin + uv.x * (dmax - dmin);
  float mu = d <= 0.0 ? 1.0 : clamp((H * H - rho * rho - d * d) / (2.0 * r * d), -1.0, 1.0);
  vec3 ro = vec3(0.0, 0.0, r);
  vec3 rd = vec3(sqrt(max(0.0, 1.0 - mu * mu)), 0.0, mu);
  float tMax = max(raySphere(ro, rd, RT), 0.0);
  vec3 od = vec3(0.0);
  float prev = 0.0;
  for (int i = 0; i < 64; i++) {
    float f = (float(i) + 1.0) / 64.0;
    float t = tMax * f * f;
    float dt = t - prev;
    vec3 p = ro + rd * (t - 0.5 * dt);
    prev = t;
    vec3 sR; float sM; vec3 ext;
    atmoMedium(length(p) - RB, sR, sM, ext);
    od += ext * dt;
  }
  fragColor = vec4(exp(-od), 1.0);
}`;

const MS_FS = /* glsl */ `
${ATMO_GLSL}
uniform float uAlbedo;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 u = clamp((gl_FragCoord.xy - 0.5) / 31.0, 0.0, 1.0);
  float muS = u.x * 2.0 - 1.0;
  float r = RB + max(u.y * (RT - RB), 0.01);
  vec3 ro = vec3(0.0, 0.0, r);
  vec3 sun = vec3(0.0, sqrt(max(0.0, 1.0 - muS * muS)), muS);
  vec3 Lsum = vec3(0.0);
  vec3 fsum = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    for (int j = 0; j < 8; j++) {
      float th = 2.0 * PI * (float(i) + 0.5) / 8.0;
      float cph = 1.0 - 2.0 * (float(j) + 0.5) / 8.0;
      float sph = sqrt(max(0.0, 1.0 - cph * cph));
      vec3 rd = vec3(cos(th) * sph, sin(th) * sph, cph);
      float tG = raySphere(ro, rd, RB);
      float tT = raySphere(ro, rd, RT);
      float tMax = tG > 0.0 ? tG : max(tT, 0.0);
      float dt = tMax / 20.0;
      vec3 L = vec3(0.0);
      vec3 f = vec3(0.0);
      vec3 thr = vec3(1.0);
      for (int k = 0; k < 20; k++) {
        vec3 p = ro + rd * ((float(k) + 0.5) * dt);
        float rp = length(p);
        vec3 sR; float sM; vec3 ext;
        atmoMedium(rp - RB, sR, sM, ext);
        vec3 scat = sR + vec3(sM);
        float mu = dot(p / rp, sun);
        vec3 ts = raySphere(p, sun, RB) >= 0.0 ? vec3(0.0) : atmoTransmittance(rp, mu);
        vec3 S = scat * ts / (4.0 * PI);
        vec3 st = exp(-ext * dt);
        vec3 e = max(ext, vec3(1e-7));
        L += thr * (S - S * st) / e;
        f += thr * (scat - scat * st) / e;
        thr *= st;
      }
      if (tG > 0.0) {
        vec3 up = normalize(ro + rd * tG);
        float nl = max(dot(up, sun), 0.0);
        L += thr * atmoTransmittance(RB, dot(up, sun)) * nl * uAlbedo / PI;
      }
      Lsum += L;
      fsum += f;
    }
  }
  Lsum /= 64.0;
  fsum /= 64.0;
  fragColor = vec4(Lsum / max(vec3(1.0) - fsum, vec3(1e-3)), 1.0);
}`;

const SKY_FS = /* glsl */ `
${ATMO_GLSL}
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 uv = clamp((gl_FragCoord.xy - 0.5) / vec2(191.0, 107.0), 0.0, 1.0);
  float r = uCamR;
  float vh = sqrt(max(r * r - RB * RB, 0.0));
  float beta = acos(clamp(vh / r, -1.0, 1.0));
  float zh = PI - beta;
  float vza;
  if (uv.y < 0.5) {
    float c = 1.0 - 2.0 * uv.y;
    vza = zh * (1.0 - c * c);
  } else {
    float c = uv.y * 2.0 - 1.0;
    vza = zh + beta * c * c;
  }
  float cl = -(uv.x * uv.x * 2.0 - 1.0);
  float sl = sqrt(max(0.0, 1.0 - cl * cl));
  vec3 rd = vec3(sin(vza) * cl, sin(vza) * sl, cos(vza));
  vec3 ro = vec3(0.0, 0.0, r);
  float muS = uSunDir.z;
  vec3 sun = vec3(sqrt(max(0.0, 1.0 - muS * muS)), 0.0, muS);
  float tG = raySphere(ro, rd, RB);
  float tT = raySphere(ro, rd, RT);
  float tMax = tG > 0.0 ? tG : max(tT, 0.0);
  float c = dot(rd, sun);
  float pR = rayleighPhase(c);
  float pM = miePhase(c, uMie.w);
  vec3 L = vec3(0.0);
  vec3 thr = vec3(1.0);
  float prev = 0.0;
  for (int i = 0; i < 40; i++) {
    float f = (float(i) + 1.0) / 40.0;
    float t = tMax * f * f;
    float dt = t - prev;
    vec3 p = ro + rd * (t - 0.5 * dt);
    prev = t;
    float rp = length(p);
    vec3 sR; float sM; vec3 ext;
    atmoMedium(rp - RB, sR, sM, ext);
    float mu = dot(p / rp, sun);
    vec3 ts = raySphere(p, sun, RB) >= 0.0 ? vec3(0.0) : atmoTransmittance(rp, mu);
    vec3 S = ts * (sR * pR + sM * pM) + atmoMs(rp, mu) * (sR + sM);
    vec3 st = exp(-ext * dt);
    L += thr * (S - S * st) / max(ext, vec3(1e-7));
    thr *= st;
  }
  fragColor = vec4(L, 1.0);
}`;

/** A fullscreen triangle: one mesh per pass, its material doing the work. */
export function fullscreenPass(material: THREE.ShaderMaterial): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const m = new THREE.Mesh(g, material);
  m.frustumCulled = false;
  return m;
}

export const FULLSCREEN_VERTEX = FULLSCREEN_VS;

type V3 = [number, number, number];

/** CPU copy of the medium, for the colours of the lights (a few rays per update). */
class AtmoModel {
  mieBL = 0.05;
  mieTop = 2.4;
  ground = 0.3;
  g = 0.78;

  medium(h: number): { sR: V3; sM: number; ext: V3 } {
    h = Math.max(h, 0);
    const bl = Math.exp(-Math.max(h - this.ground, 0) / 2.2) * (1 - smoothstep(this.mieTop - 0.25, this.mieTop + 0.4, h));
    const m = this.mieBL * bl + MIE_BG * Math.exp(-h / 1.2);
    const dR = Math.exp(-h / 8);
    const dO = Math.max(0, 1 - Math.abs(h - 25) / 15);
    const sR: V3 = [RAYLEIGH[0] * dR, RAYLEIGH[1] * dR, RAYLEIGH[2] * dR];
    return { sR, sM: m * 0.92, ext: [sR[0] + m + OZONE[0] * dO, sR[1] + m + OZONE[1] * dO, sR[2] + m + OZONE[2] * dO] };
  }

  /** Transmittance from height h (km) towards a direction of vertical cosine mu, to the top of the atmosphere. */
  transmittance(h: number, mu: number, steps = 48): V3 {
    const r = RB + h;
    if (mu < 0 && r * r * (mu * mu - 1) + RB * RB >= 0) return [0, 0, 0];
    const disc = r * r * (mu * mu - 1) + RT * RT;
    const tMax = -r * mu + Math.sqrt(Math.max(disc, 0));
    const od: V3 = [0, 0, 0];
    let prev = 0;
    const s = Math.sqrt(Math.max(0, 1 - mu * mu));
    for (let i = 0; i < steps; i++) {
      const f = (i + 1) / steps;
      const t = tMax * f * f;
      const dt = t - prev;
      const tm = t - dt / 2;
      prev = t;
      const x = s * tm;
      const z = r + mu * tm;
      const e = this.medium(Math.hypot(x, z) - RB).ext;
      od[0] += e[0] * dt;
      od[1] += e[1] * dt;
      od[2] += e[2] * dt;
    }
    return [Math.exp(-od[0]), Math.exp(-od[1]), Math.exp(-od[2])];
  }

  /** Single scattering towards dir (east/north/up) from height h, sun along sun; × a multiple-scattering factor. */
  sky(h: number, dir: V3, sun: V3, steps = 20): V3 {
    const r = RB + h;
    const mu = dir[2];
    const disc = r * r * (mu * mu - 1) + RB * RB;
    const hitsGround = mu < 0 && disc >= 0;
    const tMax = hitsGround ? -r * mu - Math.sqrt(disc) : -r * mu + Math.sqrt(Math.max(r * r * (mu * mu - 1) + RT * RT, 0));
    const c = dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2];
    const pR = (3 / (16 * Math.PI)) * (1 + c * c);
    const g2 = this.g * this.g;
    const pM = ((3 / (8 * Math.PI)) * (1 - g2) / (2 + g2)) * (1 + c * c) / Math.pow(Math.max(1 + g2 - 2 * this.g * c, 1e-4), 1.5);
    const L: V3 = [0, 0, 0];
    const T: V3 = [1, 1, 1];
    let prev = 0;
    for (let i = 0; i < steps; i++) {
      const f = (i + 1) / steps;
      const t = tMax * f * f;
      const dt = t - prev;
      const tm = t - dt / 2;
      prev = t;
      const p: V3 = [dir[0] * tm, dir[1] * tm, r + dir[2] * tm];
      const rp = Math.hypot(p[0], p[1], p[2]);
      const m = this.medium(rp - RB);
      const muS = (p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2]) / rp;
      const ts = this.transmittance(rp - RB, muS, 12);
      for (let k = 0; k < 3; k++) {
        // Multiple scattering: a flat 45 % on top of the single scattering (aerosol-rich air).
        const S = ts[k] * (m.sR[k] * pR + m.sM * pM) * 1.45;
        const st = Math.exp(-m.ext[k] * dt);
        L[k] += (T[k] * (S - S * st)) / Math.max(m.ext[k], 1e-7);
        T[k] *= st;
      }
    }
    return L;
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface Lighting {
  /** Direct sunlight at the camera (linear, per unit sun illuminance). */
  sun: THREE.Color;
  /** Mean radiance of the sky above (linear): the ambient light from above. */
  skyAbove: THREE.Color;
  /** Mean radiance of the upper half of the sky on the sun's side, and on the opposite side. */
  skySun: THREE.Color;
  skyAnti: THREE.Color;
  /** Sky radiance at the zenith and at the horizon (around), linear. */
  zenith: THREE.Color;
  horizon: THREE.Color;
  /** Light bounced by the ground (linear radiance): the ambient from below. */
  ground: THREE.Color;
  /** Illuminance on a horizontal surface from the sun and from the sky (linear). */
  sunIrr: THREE.Color;
  skyIrr: THREE.Color;
  /** Display exposure (radiance → tone-mapped value). */
  exposure: number;
  /** 0 night … 1 full day. */
  day: number;
}

export class Atmosphere {
  readonly uniforms = {
    uRayS: { value: new THREE.Vector3(...RAYLEIGH) },
    uMie: { value: new THREE.Vector4(0.05, 2.4, 0.3, 0.78) },
    uMieBg: { value: MIE_BG },
    uOzone: { value: new THREE.Vector3(...OZONE) },
    uTransLut: { value: null as THREE.Texture | null },
    uMsLut: { value: null as THREE.Texture | null },
    uSkyLut: { value: null as THREE.Texture | null },
    uSunDir: { value: new THREE.Vector3(0, 0, 1) },
    uCamR: { value: RB + 1 },
    uExposure: { value: 9 },
    uApL: { value: null as THREE.Texture | null },
    uApT: { value: null as THREE.Texture | null },
    uApMax: { value: 160 },
  };
  private model = new AtmoModel();
  private trans: THREE.WebGLRenderTarget;
  private ms: THREE.WebGLRenderTarget;
  private skyView: THREE.WebGLRenderTarget;
  private ap: THREE.WebGLRenderTarget;
  private apMat: THREE.ShaderMaterial;
  private passes: { trans: THREE.Mesh; ms: THREE.Mesh; sky: THREE.Mesh; ap: THREE.Mesh };
  private cam = new THREE.Camera();
  private mediumDirty = true;
  private skyDirty = true;
  private skyAlt = -1e9;
  /** Float render targets are available: false = the caller falls back to MapLibre's sky. */
  readonly supported: boolean;
  lighting: Lighting;
  /** Light of the orthophotos: a clear summer noon (sun at 60°, light haze), for the relighting. */
  readonly reference: Lighting;

  constructor(supported: boolean) {
    this.supported = supported;
    const rt = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    this.trans = rt(256, 64);
    this.ms = rt(32, 32);
    this.skyView = rt(192, 108);
    this.uniforms.uTransLut.value = this.trans.texture;
    this.uniforms.uMsLut.value = this.ms.texture;
    this.uniforms.uSkyLut.value = this.skyView.texture;
    this.ap = new THREE.WebGLRenderTarget(512, 192, { count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    this.uniforms.uApL.value = this.ap.textures[0];
    this.uniforms.uApT.value = this.ap.textures[1];
    const mat = (fs: string, extra: Record<string, THREE.IUniform> = {}) =>
      new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VS, fragmentShader: fs, glslVersion: THREE.GLSL3, uniforms: { ...this.uniforms, ...extra }, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    this.apMat = mat(AP_FS, { uDirBase: { value: new THREE.Vector3() }, uDirX: { value: new THREE.Vector3() }, uDirY: { value: new THREE.Vector3() } });
    this.passes = {
      trans: fullscreenPass(mat(TRANS_FS, { uSize: { value: new THREE.Vector2(256, 64) } })),
      ms: fullscreenPass(mat(MS_FS, { uAlbedo: { value: 0.18 } })),
      sky: fullscreenPass(mat(SKY_FS)),
      ap: fullscreenPass(this.apMat),
    };
    this.model.mieBL = 0.008 + 0.065 * Math.pow(0.4, 1.5);
    this.reference = this.computeLighting(new THREE.Vector3(0, 0.5, Math.sqrt(0.75)), 1.5, 0);
    this.lighting = this.reference;
  }

  /**
   * Conditions of the hour. humidity 0..1 thickens the boundary-layer haze, whose top
   * follows the cumulus base (the convective layer); cover whitens the light a little.
   */
  setConditions(sunDir: THREE.Vector3, humidity: number, cover: number, hazeTopM: number, groundM: number, camAltM: number): Lighting {
    const mie = 0.008 + 0.065 * Math.pow(humidity, 1.5) + 0.02 * cover;
    const top = Math.max(1.2, hazeTopM / 1000);
    const ground = Math.max(0, groundM / 1000);
    const g = 0.8 - 0.06 * humidity;
    const u = this.uniforms;
    const mv = u.uMie.value;
    if (Math.abs(mv.x - mie) > 1e-4 || Math.abs(mv.y - top) > 0.02 || Math.abs(mv.z - ground) > 0.02) this.mediumDirty = true;
    mv.set(mie, top, ground, g);
    this.model.mieBL = mie;
    this.model.mieTop = top;
    this.model.ground = ground;
    this.model.g = g;
    if (u.uSunDir.value.distanceToSquared(sunDir) > 1e-8) this.skyDirty = true;
    u.uSunDir.value.copy(sunDir).normalize();
    this.lighting = this.computeLighting(u.uSunDir.value, camAltM / 1000, cover);
    u.uExposure.value = this.lighting.exposure;
    return this.lighting;
  }

  /** Camera altitude (m): the sky-view table is redone when it changed noticeably. */
  setCamera(altM: number): void {
    this.uniforms.uCamR.value = RB + Math.max(0.01, altM / 1000);
    if (Math.abs(altM - this.skyAlt) > 60) this.skyDirty = true;
  }

  /** Renders the tables that are out of date (call inside the map's render, before the passes using them). */
  update(r: THREE.WebGLRenderer): void {
    if (!this.supported) return;
    if (this.mediumDirty) {
      r.setRenderTarget(this.trans);
      r.render(this.passes.trans, this.cam);
      r.setRenderTarget(this.ms);
      r.render(this.passes.ms, this.cam);
      this.mediumDirty = false;
      this.skyDirty = true;
    }
    if (this.skyDirty) {
      this.skyAlt = (this.uniforms.uCamR.value - RB) * 1000;
      r.setRenderTarget(this.skyView);
      r.render(this.passes.sky, this.cam);
      this.skyDirty = false;
    }
  }

  /** The aerial perspective table for this frame's view (far-plane vectors, see sky.ts). */
  updateAerial(r: THREE.WebGLRenderer, dirBase: THREE.Vector3, dirX: THREE.Vector3, dirY: THREE.Vector3): void {
    if (!this.supported) return;
    const u = this.apMat.uniforms;
    u.uDirBase.value.copy(dirBase);
    u.uDirX.value.copy(dirX);
    u.uDirY.value.copy(dirY);
    r.setRenderTarget(this.ap);
    r.render(this.passes.ap, this.cam);
  }

  private computeLighting(sun: THREE.Vector3, camKm: number, cover: number): Lighting {
    const m = this.model;
    const s: V3 = [sun.x, sun.y, sun.z];
    const col = (v: V3) => new THREE.Color(v[0], v[1], v[2]);
    const sunT = m.transmittance(camKm, sun.z);
    const groundKm = m.ground;
    const sunG = m.transmittance(groundKm, sun.z);
    // Sky irradiance on a horizontal surface and the mean radiance above: 3 rings × 8 azimuths.
    // Sky irradiance on a horizontal surface, the mean radiance above, and the mean
    // radiance of the half of the sky on the sun's side and on the other side (what a cloud
    // face turned towards or away from the sun sees): 3 rings × 8 azimuths.
    const sunAz = Math.atan2(sun.y, sun.x);
    const skyAt = (h: number) => {
      const E: V3 = [0, 0, 0];
      const Lm: V3 = [0, 0, 0];
      const Ls: V3 = [0, 0, 0];
      const La: V3 = [0, 0, 0];
      let w = 0;
      let ws = 0;
      let wa = 0;
      for (const el of [12, 38, 70]) {
        const ce = Math.cos((el * Math.PI) / 180);
        const se = Math.sin((el * Math.PI) / 180);
        const band = el === 12 ? 0.62 : el === 38 ? 0.55 : 0.33;
        for (let k = 0; k < 8; k++) {
          const a = sunAz + ((k + 0.5) / 8) * Math.PI * 2;
          const L = m.sky(h, [Math.cos(a) * ce, Math.sin(a) * ce, se], s, 14);
          const dw = (band * 2 * Math.PI) / 8;
          const toward = Math.cos(a - sunAz) > 0;
          for (let c = 0; c < 3; c++) {
            E[c] += L[c] * se * dw;
            Lm[c] += L[c] * dw;
            if (toward) Ls[c] += L[c] * dw;
            else La[c] += L[c] * dw;
          }
          w += dw;
          if (toward) ws += dw;
          else wa += dw;
        }
      }
      const div = (v: V3, d: number) => [v[0] / d, v[1] / d, v[2] / d] as V3;
      return { E, L: div(Lm, w), Ls: div(Ls, ws), La: div(La, wa) };
    };
    const skyCam = skyAt(camKm);
    const skyG = skyAt(groundKm);
    const zen = m.sky(camKm, [0, 0, 1], s, 16);
    const hz: V3 = [0, 0, 0];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const L = m.sky(camKm, [Math.cos(a) * 0.996, Math.sin(a) * 0.996, 0.087], s, 16);
      for (let c = 0; c < 3; c++) hz[c] += L[c] / 6;
    }
    const sinE = Math.max(0, sun.z);
    const sunIrr: V3 = [sunG[0] * sinE, sunG[1] * sinE, sunG[2] * sinE];
    const albedo: V3 = [0.13, 0.14, 0.1];
    const ground: V3 = [0, 1, 2].map((c) => (albedo[c] * (sunIrr[c] * (1 - 0.4 * cover) + skyG.E[c])) / Math.PI) as V3;
    // Exposure: a photographer exposes for the scene; dusk is darker, but not in proportion.
    const lum = (v: V3) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    const E = lum(sunIrr) + lum(skyG.E);
    const Eref = 0.9;
    const adapt = Math.min(4.5, Math.pow(Eref / Math.max(E, 1e-4), 0.45));
    return {
      sun: col(sunT),
      skyAbove: col(skyCam.L),
      skySun: col(skyCam.Ls),
      skyAnti: col(skyCam.La),
      zenith: col(zen),
      horizon: col(hz),
      ground: col(ground),
      sunIrr: col(sunIrr),
      skyIrr: col(skyG.E),
      exposure: 9.5 * adapt,
      day: smoothstep(-4, 12, (Math.asin(Math.max(-1, Math.min(1, sun.z))) * 180) / Math.PI),
    };
  }

  dispose(): void {
    this.trans.dispose();
    this.ms.dispose();
    this.skyView.dispose();
    this.ap.dispose();
  }
}
