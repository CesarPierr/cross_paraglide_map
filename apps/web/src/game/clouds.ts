/**
 * Cumulus: ray-marched volumes, rendered at reduced resolution and composited over the map.
 *
 * Shape. Each cloud is a union of domes on a flat base (the condensation level): a body
 * about as high as wide (the whole of a humilis or mediocris) and three turrets rising from
 * it, the tallest to the cloud's top; when the cloud is taller than wide (congestus) the
 * turrets become steep-sided columns on a narrower body. The wind leans the towers. The
 * outline is then displaced by a tiling 3D noise generated once on the GPU: round-topped
 * Worley bulges at three scales proportional to the cloud (the cauliflower), torn
 * Perlin-Worley along the base, a finer level of bulges on the surface itself, and an
 * erosion of the edges by a fixed-scale Worley detail (wisps at the base, crisp above).
 * Every cloud has its own outline (seeded); the noise rises slowly: the turrets boil.
 *
 * Light. For each sample, a short march towards the sun (four samples, growing steps)
 * gives the self-shadowing; the sunlight is a two-lobe Henyey–Greenstein single scattering
 * (the silver lining when backlit) plus a diffusion term with reduced extinction σ(1−g) for
 * the light scattered many times inside (white sunny side, grey rather than black shaded
 * side). Sky light diffuses in from the top and the sides of the envelope, from the half
 * of the sky the visible face turns to (bright towards the sun, blue opposite); the
 * ground's bounce lights the flat dark base. The sunlight's colour is the atmosphere's
 * transmittance at the cloud's height and the aerial perspective comes from the same
 * atmosphere: distant clouds sink into the haze, cloud tops redden at dusk.
 *
 * Cost. The boxes are drawn with the map's camera, back to front, into a target of half
 * the screen's pixels per axis (a third on phones), of which a quarter is marched each
 * frame (2 × 2 checkerboard, the projection jittered to each sub-pixel in turn); a resolve
 * pass reprojects the previous result with the clouds' distance and clamps it to the
 * fresh samples. A fullscreen pass composites the result with the clouds' depth (alpha-
 * weighted distance), so the terrain, already in the depth buffer, hides the clouds behind
 * the mountains. Rays are first clipped to the domes' inflated ellipsoids (most box pixels
 * are empty), empty space is skipped by the displaced surface's distance, the march stops
 * when the cloud is opaque (cumulus are), steps and noise detail follow the pixel
 * footprint with distance.
 *
 * Shadows. The same density, marched along the sun direction, is accumulated per cloud
 * into a top-down optical-depth map around the pilot; the landscape pass reads it.
 */
import * as THREE from 'three';
import { ATMO_GLSL, FULLSCREEN_VERTEX, fullscreenPass } from './atmosphere';

export interface CloudShape {
  x: number;
  y: number;
  base: number;
  top: number;
  radius: number;
  size: number;
  seed: number;
}

const NOISE_FS = /* glsl */ `
precision highp float;
uniform float uSlice;
uniform float uN;
uniform int uKind;
layout(location = 0) out vec4 fragColor;
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float worley(vec3 p, float period) {
  vec3 id = floor(p);
  vec3 f = fract(p);
  float md = 1.0;
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      for (int z = -1; z <= 1; z++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 h = hash33(mod(id + o, period) + 17.0 * float(uKind));
        vec3 d = o + h - f;
        md = min(md, dot(d, d));
      }
  return 1.0 - sqrt(md);
}
float grad(vec3 i, vec3 f, float period) {
  vec3 g = hash33(mod(i, period) + 3.7) * 2.0 - 1.0;
  return dot(g, f);
}
float perlin(vec3 p, float period) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = grad(i, f, period);
  float b = grad(i + vec3(1, 0, 0), f - vec3(1, 0, 0), period);
  float c = grad(i + vec3(0, 1, 0), f - vec3(0, 1, 0), period);
  float d = grad(i + vec3(1, 1, 0), f - vec3(1, 1, 0), period);
  float e = grad(i + vec3(0, 0, 1), f - vec3(0, 0, 1), period);
  float g = grad(i + vec3(1, 0, 1), f - vec3(1, 0, 1), period);
  float h = grad(i + vec3(0, 1, 1), f - vec3(0, 1, 1), period);
  float k = grad(i + vec3(1, 1, 1), f - vec3(1, 1, 1), period);
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}
float worleyFbm(vec3 p, float fq) {
  return worley(p * fq, fq) * 0.625 + worley(p * fq * 2.0, fq * 2.0) * 0.25 + worley(p * fq * 4.0, fq * 4.0) * 0.125;
}
void main() {
  vec3 p = vec3(gl_FragCoord.xy / uN, uSlice);
  if (uKind == 0) {
    float pf = 0.0;
    float amp = 1.0;
    float fq = 4.0;
    float wsum = 0.0;
    for (int o = 0; o < 6; o++) {
      pf += perlin(p * fq, fq) * amp;
      wsum += amp;
      amp *= 0.5;
      fq *= 2.0;
    }
    pf = pf / wsum;
    pf = abs(pf * 1.6);
    float w4 = worleyFbm(p, 4.0);
    float pw = clamp(w4 + (1.0 - w4) * clamp(1.0 - pf, 0.0, 1.0) - 0.25, 0.0, 1.0);
    fragColor = vec4(pw, w4, worleyFbm(p, 8.0), worleyFbm(p, 16.0));
  } else {
    float d = worleyFbm(p, 2.0) * 0.625 + worleyFbm(p, 4.0) * 0.25 + worleyFbm(p, 8.0) * 0.125;
    fragColor = vec4(d, d, d, 1.0);
  }
}`;

/** Per-cloud shape parameters, computed once per vertex from the seed (flat varyings). */
const SHAPE_VS = /* glsl */ `
in vec3 aCenter;
in vec3 aHalf;
in vec4 aShape;
flat out vec3 vHalf;
flat out vec4 vShape;
flat out vec4 vT0;
flat out vec4 vT1;
flat out vec4 vT2;
flat out vec4 vT3;
flat out vec4 vSeedOff;
float ch(float n) { return fract(sin(n) * 43758.5453123); }
// A turret rising from the body: offset, top (fraction of the height), radius (units of R).
vec4 turret(float s, float k, float lo, float hi, float tower) {
  float a = 6.2831853 * (ch(s + 3.1 * k) * 0.35 + k / 3.0);
  float d = mix(0.1, 0.42, ch(s + 5.7 * k)) * mix(1.0, 0.75, tower);
  float top = mix(lo, hi, ch(s + 7.3 * k));
  float rad = mix(0.42, 0.66, ch(s + 9.1 * k));
  return vec4(cos(a) * d, sin(a) * d, top, rad);
}
void cloudShape() {
  vHalf = aHalf;
  vShape = aShape;
  float s = aShape.x * 97.13 + 1.7;
  float A = aShape.w / (2.0 * aShape.z);
  float tower = smoothstep(0.75, 1.8, A);
  // Body: a broad dome about as high as wide (all of a flat cumulus); towers rise from it
  // in a congestus, the tallest to the cloud's top, the others lower.
  float tb = clamp(1.4 * aShape.z / aShape.w, 0.55, 1.0);
  vT0 = vec4(0.08 * (ch(s + 1.0) - 0.5), 0.08 * (ch(s + 2.0) - 0.5), tb, mix(0.95, 0.64, tower));
  vT1 = turret(s, 1.0, 1.0, 1.0, tower);
  vT2 = turret(s, 2.0, mix(0.75, 0.55, tower), 0.95, tower);
  vT3 = turret(s, 3.0, tb * 0.9, mix(0.95, 0.8, tower), tower);
  vSeedOff = vec4(vec3(ch(s + 11.0), ch(s + 12.0), ch(s + 13.0)) * 4000.0, tower);
}`;

/**
 * Density of a cloud at p (metres from its box centre), and the signed distance to its
 * displaced surface (units of R, < 0 outside) for skipping the empty space around it.
 */
const DENSITY_GLSL = /* glsl */ `
uniform highp sampler3D uShape;
uniform highp sampler3D uDetail;
uniform vec2 uLean;
uniform float uTime;
uniform float uShapeN;
flat in vec3 vHalf;
flat in vec4 vShape;
flat in vec4 vT0;
flat in vec4 vT1;
flat in vec4 vT2;
flat in vec4 vT3;
flat in vec4 vSeedOff;
float smax(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}
// Dome on the base: horizontal radius T.w (units of R), height T.z (fraction of H); > 0
// inside. Towers (column) keep steeper sides than an ellipsoid.
float dome(vec2 q, float hf, vec4 T, float rz, float column) {
  vec2 d2 = (q - T.xy) / T.w;
  // Widest a little above the base: the sides curve in towards the flat base.
  float c = 0.12 * T.z;
  float zz = hf > c ? (hf - c) / (T.z - c) : (c - hf) / (c * 2.6);
  float z2 = zz * zz;
  float m = dot(d2, d2) + (hf > c ? mix(z2, z2 * z2, column) : z2);
  return (1.0 - sqrt(m)) * min(T.w, T.z * rz);
}
// Signed "inside" distance to the cloud's envelope in units of the radius R, and the height fraction.
float envelopeDomes(vec3 p, out float hf) {
  float R = vShape.z;
  float rz = vShape.w / R;
  hf = (p.z + vHalf.z) / vShape.w;
  vec2 q = p.xy / R - uLean * hf;
  float c = vSeedOff.w;
  float e = dome(q, hf, vT0, rz, 0.0);
  e = smax(e, dome(q, hf, vT1, rz, c), 0.16);
  e = smax(e, dome(q, hf, vT2, rz, c), 0.16);
  e = smax(e, dome(q, hf, vT3, rz, c), 0.16);
  return e;
}
float envelope(vec3 p, out float hf) {
  float e = envelopeDomes(p, hf);
  return min(e, hf * vShape.w / vShape.z + 0.02);
}
float cloudDensity(vec3 p, float lod, bool detail, out float sd) {
  float hf;
  float e = envelope(p, hf);
  sd = e + 0.48;
  if (e < -0.5) return 0.0;
  float R = vShape.z;
  vec3 w = p + vSeedOff.xyz - vec3(0.0, 0.0, uTime * 1.2);
  float tile = R * 2.4;
  vec4 n = textureLod(uShape, w / tile, lod);
  // Billows: round-topped bulges (1 − F1² of the Worley cells) at three scales, about half
  // as high as wide (the cauliflower); torn Perlin-Worley along the base.
  float up = smoothstep(0.0, 0.1, hf);
  vec3 wb = 1.0 - (1.0 - n.gba) * (1.0 - n.gba);
  float billow = (wb.x - 0.8) * 0.85 + (wb.y - 0.8) * 0.24 + (wb.z - 0.8) * 0.07;
  float disp = mix((n.r - 0.5) * 0.28, billow, up);
  // The bulges fade away from the envelope: no puffs floating off the cloud.
  float s = e + disp * smoothstep(-0.52, -0.1, e);
  if (detail && s > -0.1 && s < 0.2) {
    // Finer bulges on the surface itself, down to a few tens of metres.
    vec4 n2 = textureLod(uShape, w / (tile * 0.25), lod + 2.0);
    vec2 wb2 = 1.0 - (1.0 - n2.ba) * (1.0 - n2.ba);
    s += ((wb2.x - 0.8) * 0.06 + (wb2.y - 0.8) * 0.025) * mix(0.5, 1.0, up);
  }
  sd = s;
  float d = clamp(s * 16.0, 0.0, 1.0);
  float zb = p.z + vHalf.z;
  d *= smoothstep(0.0, 30.0, zb + (n.r - 0.5) * 12.0);
  float grow = vShape.y;
  if (detail && d > 0.0 && d < 1.0) {
    float dl = lod + log2(tile / uShapeN) - log2(300.0 / 32.0);
    float det = textureLod(uDetail, w / 300.0, max(dl, 0.0)).r;
    float dm = mix(1.0 - det, det, up) * mix(0.6, 0.3, grow) * mix(1.0, 0.6, up);
    d = clamp((d - dm) / (1.0 - dm), 0.0, 1.0);
  }
  return d * mix(0.45, 1.0, grow);
}
// Height fraction of the envelope's top above a point (the domes' upper surfaces).
float envelopeTop(vec3 p, float hf) {
  vec2 q = p.xy / vShape.z - uLean * hf;
  float c = vSeedOff.w;
  float top = hf;
  for (int k = 0; k < 4; k++) {
    vec4 T = k == 0 ? vT0 : (k == 1 ? vT1 : (k == 2 ? vT2 : vT3));
    vec2 d2 = (q - T.xy) / T.w;
    float r2 = 1.0 - dot(d2, d2);
    float cz = 0.12 * T.z;
    if (r2 > 0.0) top = max(top, cz + (T.z - cz) * pow(r2, k == 0 ? 0.5 : mix(0.5, 0.25, c)));
  }
  return top;
}
float cloudDensity(vec3 p, float lod) {
  float sd;
  return cloudDensity(p, lod, false, sd);
}`;

const MARCH_VS = /* glsl */ `
${ATMO_GLSL}
${SHAPE_VS}
uniform vec3 uAnchor;
out vec3 vWp;
flat out vec3 vC;
flat out vec3 vSun;
void main() {
  cloudShape();
  vC = aCenter - uAnchor;
  vec3 wp = vC + position * aHalf;
  vWp = wp;
  // Sunlight at the cloud's height (the transmittance table), reddened at dawn and dusk.
#ifdef DIRECT
  vSun = vec3(1.0);
#else
  float r = RB + max(aCenter.z, 0.0) / 1000.0;
  vSun = raySphere(vec3(0.0, 0.0, r), uSunDir, RB) >= 0.0 ? vec3(0.0) : atmoTransmittance(r, uSunDir.z);
#endif
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const MARCH_FS = /* glsl */ `
precision highp float;
${ATMO_GLSL}
${DENSITY_GLSL}
uniform vec3 uEye;
uniform float uFrame;
uniform float uSigma;
uniform float uMsAmp;
uniform vec3 uSunColor;
uniform vec3 uAmbSun;
uniform vec3 uAmbAnti;
uniform vec3 uAmbBot;
uniform float uPixelAngle;
uniform int uSteps;
uniform int uLightSteps;
uniform vec2 uRtSize;
uniform vec2 uJitterUv;
uniform vec3 uFog;
uniform vec2 uFogRange;
in vec3 vWp;
flat in vec3 vC;
flat in vec3 vSun;
layout(location = 0) out vec4 oColor;
#ifndef DIRECT
layout(location = 1) out vec4 oDepth;
#endif
float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
void main() {
  vec3 ro = uEye;
  vec3 rd = normalize(vWp - uEye);
  vec3 bmin = vC - vHalf;
  vec3 bmax = vC + vHalf;
  vec3 inv = 1.0 / rd;
  vec3 t0s = (bmin - ro) * inv;
  vec3 t1s = (bmax - ro) * inv;
  vec3 tsm = min(t0s, t1s);
  vec3 tbg = max(t0s, t1s);
  float tn = max(max(tsm.x, tsm.y), max(tsm.z, 0.0));
  float tf = min(min(tbg.x, tbg.y), tbg.z);
  if (tf <= tn) discard;
  float R = vShape.z;
  // Tighter bounds than the box: the ray against each dome's ellipsoid, inflated by the
  // noise's reach, in the leaning (sheared) frame where the domes are ellipsoids.
  vec3 P0 = ro - vC;
  float H = vShape.w;
  float rz = H / R;
  float hf0 = (P0.z + vHalf.z) / H;
  float hf1 = rd.z / H;
  vec2 q0 = P0.xy / R - uLean * hf0;
  vec2 q1 = rd.xy / R - uLean * hf1;
  float te = 1e9;
  float tx = -1e9;
  for (int k = 0; k < 4; k++) {
    vec4 D = k == 0 ? vT0 : (k == 1 ? vT1 : (k == 2 ? vT2 : vT3));
    float sk = 1.12 + 0.52 / min(D.w, D.z * rz);
    vec3 U0 = vec3((q0 - D.xy) / D.w, hf0 / D.z);
    vec3 U1 = vec3(q1 / D.w, hf1 / D.z);
    float a = dot(U1, U1);
    float b = dot(U0, U1);
    float c = dot(U0, U0) - sk * sk;
    float disc = b * b - a * c;
    if (disc > 0.0) {
      float sq = sqrt(disc);
      te = min(te, (-b - sq) / a);
      tx = max(tx, (-b + sq) / a);
    }
  }
  tn = max(tn, te);
  tf = min(tf, tx);
  if (tf <= tn) discard;
  float ds0 = clamp(R * 0.022, 5.0, 18.0);
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy + uFrame * vec2(5.588238, 3.17), vec2(0.06711056, 0.00583715))));
  float cosT = dot(rd, uSunDir);
  // Two-lobe phase (forward silver lining, a little back-scattering).
  float ph = mix(hg(cosT, 0.8), hg(cosT, -0.25), 0.25);
  vec3 sunCol = vSun * uSunColor;
  // Sky light on the faces we see: turned away from the sun when we look towards it.
  vec2 rh = rd.xy;
  vec2 sh = uSunDir.xy;
  float cosH = dot(rh, rh) > 1e-6 && dot(sh, sh) > 1e-6 ? dot(normalize(rh), normalize(sh)) : 0.0;
  vec3 ambTop = mix(uAmbAnti, uAmbSun, 0.5 - 0.5 * cosH);
  float T = 1.0;
  vec3 L = vec3(0.0);
  float dAcc = 0.0;
  float t = tn;
  float texel = R * 2.6 / uShapeN;
  bool first = true;
  for (int i = 0; i < 160; i++) {
    if (i >= uSteps || t > tf || T < 0.015) break;
    vec3 p = ro + rd * t - vC;
    float foot = t * uPixelAngle;
    float ds = max(ds0, foot * 1.4);
    float lod = log2(max(1.0, foot / texel));
    float sd;
    float d = cloudDensity(p, lod, foot < 40.0, sd);
    if (d <= 0.002) {
      // Outside the displaced surface: skip by (a fraction of) its distance.
      t += max(-sd * R * 0.55, ds);
      continue;
    }
    if (first) {
      // Step back half a step at the first hit, jittered: a crisp, unbanded surface.
      first = false;
      t -= ds * ign;
      p = ro + rd * t - vC;
      d = cloudDensity(p, lod, foot < 40.0, sd);
      if (d <= 0.002) { t += ds; continue; }
    }
    float sig = d * uSigma;
    // Optical depth towards the sun: a few samples, growing steps.
    float od = 0.0;
    float lt = 0.0;
    float lsz = foot < 8.0 ? 0.02 : 0.035;
    int ls = foot > 25.0 ? uLightSteps - 1 : uLightSteps;
    for (int j = 0; j < 6; j++) {
      if (j >= ls) break;
      float seg = R * lsz;
      od += cloudDensity(p + uSunDir * (lt + 0.5 * seg), lod + 1.0) * seg;
      lt += seg;
      lsz *= 2.2;
    }
    od *= uSigma;
    // Sky light diffuses in from the top and the sides, the ground's bounce from the flat
    // base: attenuated with the reduced extinction of diffusion (σ(1−g)) over the depth.
    float hf;
    float eSide = envelopeDomes(p, hf);
    float dTop = (envelopeTop(p, hf) - hf) * H;
    float dSide = max(eSide, 0.0) * R * 1.6;
    float zb = max(p.z + vHalf.z, 0.0);
    float sr = uSigma * 0.2;
    vec3 sunL = sunCol * (ph * exp(-od) + uMsAmp * exp(-od * 0.25));
    // Near the base a face sees the ground below as much as the sky: less sky light.
    vec3 amb = ambTop * exp(-sr * min(dTop, dSide)) * mix(0.5, 1.0, smoothstep(0.0, 0.35, hf)) + uAmbBot * exp(-sr * zb);
    vec3 S = sunL + amb;
    float st = exp(-sig * ds);
    L += T * S * (1.0 - st);
    dAcc += t * T * (1.0 - st);
    T *= st;
    t += ds;
  }
  float a = 1.0 - T;
  if (a < 0.003) discard;
  a = clamp((a - 0.003) / 0.982, 0.0, 1.0);
  L /= max(1.0 - T, 1e-4);
  float dist = dAcc / max(1.0 - T, 1e-4);
#ifdef DIRECT
  vec3 col = atmoTonemap(L * uExposure);
  col = mix(col, atmoDecode(uFog), smoothstep(uFogRange.x, uFogRange.y, dist) * 0.85);
  oColor = vec4(atmoEncode(col) * a, a);
#else
  vec3 Lap;
  vec3 Tap;
  atmoAerialLut(gl_FragCoord.xy / uRtSize + uJitterUv, dist / 1000.0, Lap, Tap);
  L = L * Tap + Lap;
  oColor = vec4(L * uExposure * a, a);
  oDepth = vec4(dist / 1000.0 * a, 0.0, 0.0, a);
#endif
}`;

const SHADOW_VS = /* glsl */ `
${SHAPE_VS}
uniform vec3 uSunDir;
uniform vec4 uMap;
uniform float uZref;
out vec2 vXY;
flat out vec3 vC;
void main() {
  cloudShape();
  vC = aCenter;
  vec2 off = uSunDir.xy / max(uSunDir.z, 0.05);
  vec2 c = aCenter.xy - off * (aCenter.z - uZref);
  vec2 ext = aHalf.xy + abs(off) * aHalf.z;
  vec2 w = c + position.xy * ext;
  vXY = w;
  gl_Position = vec4((w - uMap.xy) * uMap.z, 0.0, 1.0);
}`;

const SHADOW_FS = /* glsl */ `
precision highp float;
#define PI 3.14159265359
${DENSITY_GLSL}
uniform vec3 uSunDir;
uniform float uZref;
uniform float uSigma;
in vec2 vXY;
flat in vec3 vC;
layout(location = 0) out vec4 fragColor;
void main() {
  vec3 ro = vec3(vXY, uZref);
  vec3 rd = uSunDir;
  vec3 inv = 1.0 / rd;
  vec3 t0s = (vC - vHalf - ro) * inv;
  vec3 t1s = (vC + vHalf - ro) * inv;
  vec3 tsm = min(t0s, t1s);
  vec3 tbg = max(t0s, t1s);
  float tn = max(max(tsm.x, tsm.y), max(tsm.z, 0.0));
  float tf = min(min(tbg.x, tbg.y), tbg.z);
  if (tf <= tn) discard;
  float dt = (tf - tn) / 12.0;
  float od = 0.0;
  for (int i = 0; i < 12; i++) {
    vec3 p = ro + rd * (tn + (float(i) + 0.5) * dt) - vC;
    od += cloudDensity(p, 1.5);
  }
  od *= dt * uSigma;
  if (od < 0.01) discard;
  fragColor = vec4(od, 0.0, 0.0, 1.0);
}`;

/**
 * Temporal resolve: the march renders one pixel of each 2 × 2 block per frame (in turn);
 * the three others come from the previous result, reprojected with the cloud's distance
 * and the previous camera, and clamped to the colours of the fresh samples around (no
 * ghost trails when a cloud moves or the view turns fast).
 */
const RESOLVE_FS = /* glsl */ `
precision highp float;
uniform sampler2D uCurC;
uniform sampler2D uCurD;
uniform sampler2D uHistC;
uniform sampler2D uHistD;
uniform vec2 uO;
uniform vec2 uFR;
uniform mat4 uPrevProj;
uniform vec3 uAnchorDelta;
uniform vec3 uEye;
uniform vec3 uDirBase;
uniform vec3 uDirX;
uniform vec3 uDirY;
uniform float uHistOk;
layout(location = 0) out vec4 oC;
layout(location = 1) out vec4 oD;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 q = p / 2;
  ivec2 sub = p - q * 2;
  ivec2 qmax = textureSize(uCurC, 0) - 1;
  vec4 c = texelFetch(uCurC, min(q, qmax), 0);
  vec4 cd = texelFetch(uCurD, min(q, qmax), 0);
  bool fresh = sub == ivec2(uO);
  if (fresh && uHistOk < 0.5) {
    oC = c;
    oD = cd;
    return;
  }
  vec4 mn = vec4(1e9);
  vec4 mx = vec4(-1e9);
  float dsum = 0.0;
  float asum = 0.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      ivec2 qq = clamp(q + ivec2(i, j), ivec2(0), qmax);
      vec4 s = texelFetch(uCurC, qq, 0);
      mn = min(mn, s);
      mx = max(mx, s);
      dsum += texelFetch(uCurD, qq, 0).r;
      asum += s.a;
    }
  vec2 uv = gl_FragCoord.xy / uFR;
  vec4 up = texture(uCurC, uv);
  vec4 upd = texture(uCurD, uv);
  if (uHistOk < 0.5) {
    oC = up;
    oD = upd;
    return;
  }
  float distKm = asum > 0.02 ? dsum / asum : 15.0;
  vec3 dir = normalize(uDirBase + (uv.x * 2.0 - 1.0) * uDirX + (uv.y * 2.0 - 1.0) * uDirY);
  vec3 X = uEye + dir * distKm * 1000.0 + uAnchorDelta;
  vec4 cp = uPrevProj * vec4(X, 1.0);
  vec2 puv = cp.xy / cp.w * 0.5 + 0.5;
  if (cp.w <= 0.0 || puv.x < 0.0 || puv.y < 0.0 || puv.x > 1.0 || puv.y > 1.0) {
    oC = fresh ? c : up;
    oD = fresh ? cd : upd;
    return;
  }
  vec4 h = texture(uHistC, puv);
  vec4 hd = texture(uHistD, puv);
  vec4 hc = clamp(h, mn, mx);
  float hdist = h.a > 1e-3 ? hd.r / h.a : distKm;
  if (fresh) {
    // The fresh sample, averaged with the clamped history: the step jitter's noise fades
    // over a few frames instead of showing as a fixed dither.
    oC = mix(hc, c, 0.45);
    float cdist = c.a > 1e-3 ? cd.r / c.a : hdist;
    oD = vec4(mix(hdist, cdist, 0.45) * oC.a, 0.0, 0.0, oC.a);
    return;
  }
  oC = hc;
  oD = vec4(hdist * hc.a, 0.0, 0.0, hc.a);
}`;

const COMPOSITE_FS = /* glsl */ `
precision highp float;
${ATMO_GLSL}
uniform sampler2D uColor;
uniform sampler2D uDepthT;
uniform vec2 uRes;
uniform vec3 uDirBase;
uniform vec3 uDirX;
uniform vec3 uDirY;
uniform vec2 uNF;
uniform vec2 uDR;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 c = texture(uColor, uv);
  if (c.a < 0.004) discard;
  float distKm = texture(uDepthT, uv).r / c.a;
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 dirFar = uDirBase + ndc.x * uDirX + ndc.y * uDirY;
  float s = distKm * 1000.0 / length(dirFar);
  float n = uNF.x;
  float f = uNF.y;
  float zv = clamp(s * f, n, f);
  float z = ((f + n) - 2.0 * f * n / zv) / (f - n);
  gl_FragDepth = uDR.x + (uDR.y - uDR.x) * (z * 0.5 + 0.5);
  vec3 col = atmoEncode(atmoTonemap(c.rgb / c.a));
  fragColor = vec4(col * c.a, c.a);
}`;

function mat(vs: string, fs: string, uniforms: Record<string, THREE.IUniform>, extra: Partial<THREE.ShaderMaterialParameters> = {}, defines: Record<string, string> = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, glslVersion: THREE.GLSL3, uniforms, defines, ...extra });
}

/** The camera of the frame as the temporal resolve needs it (metres around the anchor). */
export interface ViewInfo {
  eye: THREE.Vector3;
  anchor: { x: number; y: number; z: number };
  dirBase: THREE.Vector3;
  dirX: THREE.Vector3;
  dirY: THREE.Vector3;
}

export class CloudLayer {
  private maxClouds: number;
  private aCenter: THREE.InstancedBufferAttribute;
  private aHalf: THREE.InstancedBufferAttribute;
  private aShape: THREE.InstancedBufferAttribute;
  private marchGeo: THREE.InstancedBufferGeometry;
  private shadowGeo: THREE.InstancedBufferGeometry;
  readonly march: THREE.Mesh;
  private shadowMesh: THREE.Mesh;
  private composite: THREE.Mesh;
  readonly marchMat: THREE.ShaderMaterial;
  private shadowMat: THREE.ShaderMaterial;
  readonly compositeMat: THREE.ShaderMaterial;
  /** Quarter-resolution march target and the two history targets of the temporal resolve. */
  private rt: THREE.WebGLRenderTarget | null = null;
  private hist: THREE.WebGLRenderTarget[] = [];
  private histIdx = 0;
  private histOk = false;
  private prevProj = new THREE.Matrix4();
  private prevAnchor = new THREE.Vector3();
  private marchCam = new THREE.Camera();
  private resolveMat: THREE.ShaderMaterial;
  private resolve: THREE.Mesh;
  readonly shadowRT: THREE.WebGLRenderTarget;
  private shapeRT: THREE.WebGL3DRenderTarget;
  private detailRT: THREE.WebGL3DRenderTarget;
  private noiseReady = false;
  private items: { x: number; y: number; z: number; hx: number; hz: number; seed: number; size: number; R: number; H: number }[] = [];
  private order: number[] = [];
  private frameNo = 0;
  /** Shadow map: centre (absolute local metres), half size (m), reference height of the projection. */
  readonly shadowMap = { cx: 0, cy: 0, half: 24000, zref: 1500, ready: false };
  private shapeN: number;
  private cam = new THREE.Camera();

  constructor(
    readonly lowQuality: boolean,
    readonly direct: boolean,
    atmoUniforms: Record<string, THREE.IUniform>,
    maxClouds = 160,
  ) {
    this.maxClouds = maxClouds;
    this.shapeN = lowQuality ? 64 : 128;
    const n3 = (n: number) => {
      const t = new THREE.WebGL3DRenderTarget(n, n, n, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false });
      const tex = t.texture;
      tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      return t;
    };
    this.shapeRT = n3(this.shapeN);
    this.detailRT = n3(32);
    this.aCenter = new THREE.InstancedBufferAttribute(new Float32Array(maxClouds * 3), 3);
    this.aHalf = new THREE.InstancedBufferAttribute(new Float32Array(maxClouds * 3), 3);
    this.aShape = new THREE.InstancedBufferAttribute(new Float32Array(maxClouds * 4), 4);
    for (const a of [this.aCenter, this.aHalf, this.aShape]) a.setUsage(THREE.DynamicDrawUsage);
    const box = new THREE.BoxGeometry(2, 2, 2);
    this.marchGeo = new THREE.InstancedBufferGeometry();
    this.marchGeo.index = box.index;
    this.marchGeo.setAttribute('position', box.getAttribute('position'));
    const quad = new THREE.PlaneGeometry(2, 2);
    this.shadowGeo = new THREE.InstancedBufferGeometry();
    this.shadowGeo.index = quad.index;
    this.shadowGeo.setAttribute('position', quad.getAttribute('position'));
    for (const g of [this.marchGeo, this.shadowGeo]) {
      g.setAttribute('aCenter', this.aCenter);
      g.setAttribute('aHalf', this.aHalf);
      g.setAttribute('aShape', this.aShape);
      g.instanceCount = 0;
    }
    const shared = {
      uShape: { value: this.shapeRT.texture },
      uDetail: { value: this.detailRT.texture },
      uLean: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uShapeN: { value: this.shapeN },
      uSigma: { value: 0.045 },
    };
    this.marchMat = mat(
      MARCH_VS,
      MARCH_FS,
      {
        ...atmoUniforms,
        ...shared,
        uAnchor: { value: new THREE.Vector3() },
        uEye: { value: new THREE.Vector3() },
        uFrame: { value: 0 },
        uMsAmp: { value: 0.2 },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uAmbSun: { value: new THREE.Color(0.06, 0.08, 0.11) },
        uAmbAnti: { value: new THREE.Color(0.06, 0.08, 0.11) },
        uAmbBot: { value: new THREE.Color(0.03, 0.03, 0.025) },
        uPixelAngle: { value: 0.002 },
        uSteps: { value: lowQuality ? 56 : 120 },
        uLightSteps: { value: lowQuality ? 3 : 4 },
        uRtSize: { value: new THREE.Vector2(1, 1) },
        uJitterUv: { value: new THREE.Vector2() },
        uFog: { value: new THREE.Color('#dbe6f1') },
        uFogRange: { value: new THREE.Vector2(9000, 45000) },
      },
      {
        side: THREE.BackSide,
        transparent: true,
        depthTest: direct,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      },
      direct ? { DIRECT: '1' } : {},
    );
    this.march = new THREE.Mesh(this.marchGeo, this.marchMat);
    this.march.frustumCulled = false;
    this.shadowMat = mat(
      SHADOW_VS,
      SHADOW_FS,
      { ...shared, uSunDir: atmoUniforms.uSunDir, uMap: { value: new THREE.Vector4() }, uZref: { value: 1500 } },
      { side: THREE.DoubleSide, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation },
    );
    this.shadowMesh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    this.shadowMesh.frustumCulled = false;
    const sz = lowQuality ? 512 : 1024;
    this.shadowRT = new THREE.WebGLRenderTarget(sz, sz, { type: direct ? THREE.UnsignedByteType : THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    this.compositeMat = mat(
      FULLSCREEN_VERTEX,
      COMPOSITE_FS,
      {
        ...atmoUniforms,
        uColor: { value: null },
        uDepthT: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uDirBase: { value: new THREE.Vector3() },
        uDirX: { value: new THREE.Vector3() },
        uDirY: { value: new THREE.Vector3() },
        uNF: { value: new THREE.Vector2(1, 1000) },
        uDR: { value: new THREE.Vector2(0, 1) },
      },
      { depthTest: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor },
    );
    this.composite = fullscreenPass(this.compositeMat);
    this.resolveMat = mat(FULLSCREEN_VERTEX, RESOLVE_FS, {
      uCurC: { value: null },
      uCurD: { value: null },
      uHistC: { value: null },
      uHistD: { value: null },
      uO: { value: new THREE.Vector2() },
      uFR: { value: new THREE.Vector2(1, 1) },
      uPrevProj: { value: new THREE.Matrix4() },
      uAnchorDelta: { value: new THREE.Vector3() },
      uEye: { value: new THREE.Vector3() },
      uDirBase: { value: new THREE.Vector3() },
      uDirX: { value: new THREE.Vector3() },
      uDirY: { value: new THREE.Vector3() },
      uHistOk: { value: 0 },
    }, { depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    this.resolve = fullscreenPass(this.resolveMat);
  }

  /** One-time GPU generation of the two tiling noises (a few ms, on the first frame). */
  private makeNoise(r: THREE.WebGLRenderer): void {
    const m = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: NOISE_FS, glslVersion: THREE.GLSL3, uniforms: { uSlice: { value: 0 }, uN: { value: 1 }, uKind: { value: 0 } }, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    const pass = fullscreenPass(m);
    for (const [rt, kind] of [
      [this.shapeRT, 0],
      [this.detailRT, 1],
    ] as const) {
      const n = rt.width;
      // Storage with the full mip chain, mipmaps generated once after the last slice.
      r.initRenderTarget(rt);
      rt.texture.generateMipmaps = false;
      m.uniforms.uN.value = n;
      m.uniforms.uKind.value = kind;
      for (let z = 0; z < n; z++) {
        if (z === n - 1) rt.texture.generateMipmaps = true;
        m.uniforms.uSlice.value = (z + 0.5) / n;
        r.setRenderTarget(rt, z);
        r.render(pass, this.cam);
      }
    }
    m.dispose();
    pass.geometry.dispose();
    this.noiseReady = true;
  }

  /** Cloud list from the air mass (absolute local metres). */
  setClouds(list: CloudShape[], near?: { x: number; y: number }): void {
    this.items = [];
    // The nearest clouds first when there are more than the instances.
    if (near && list.length > this.maxClouds) list = [...list].sort((a, b) => (a.x - near.x) ** 2 + (a.y - near.y) ** 2 - ((b.x - near.x) ** 2 + (b.y - near.y) ** 2));
    for (const c of list) {
      if (this.items.length >= this.maxClouds) break;
      const R = c.radius * 1.15;
      const H = Math.max(c.top - c.base, 0.45 * R);
      // Room for the shoulders, the lean and the bulges (see the shape's ranges).
      const hz = (H + 0.25 * R) / 2;
      this.items.push({ x: c.x, y: c.y, z: c.base + hz, hx: R * 1.62, hz, seed: c.seed, size: c.size, R, H });
    }
    this.order = this.items.map((_, i) => i);
  }

  get count(): number {
    return this.items.length;
  }

  /** Back-to-front order from the eye (absolute), then the instance buffers. */
  private sortAndUpload(eye: THREE.Vector3): void {
    const it = this.items;
    const d = it.map((c) => (c.x - eye.x) ** 2 + (c.y - eye.y) ** 2 + (c.z - eye.z) ** 2);
    this.order.sort((a, b) => d[b] - d[a]);
    const ac = this.aCenter.array as Float32Array;
    const ah = this.aHalf.array as Float32Array;
    const as = this.aShape.array as Float32Array;
    this.order.forEach((k, n) => {
      const c = it[k];
      ac.set([c.x, c.y, c.z], n * 3);
      ah.set([c.hx, c.hx, c.hz], n * 3);
      as.set([c.seed, c.size, c.R, c.H], n * 4);
    });
    this.aCenter.needsUpdate = this.aHalf.needsUpdate = this.aShape.needsUpdate = true;
    this.marchGeo.instanceCount = this.shadowGeo.instanceCount = it.length;
  }

  /**
   * Per frame, before the map's passes that use them: the noise (once), the shadow map
   * and the low-resolution cloud target. eyeAbs: camera in absolute local metres.
   */
  prepare(r: THREE.WebGLRenderer, cam: THREE.Camera, view: ViewInfo, width: number, height: number, sunDir: THREE.Vector3, shadows: boolean): void {
    const eyeAbs = new THREE.Vector3(view.anchor.x + view.eye.x, view.anchor.y + view.eye.y, view.anchor.z + view.eye.z);
    if (!this.noiseReady) this.makeNoise(r);
    this.frameNo++;
    this.marchMat.uniforms.uFrame.value = this.frameNo % 64;
    this.sortAndUpload(eyeAbs);
    const n = this.items.length;
    // Shadow map: snapped to its texels, refreshed every other frame (every 4th on phones).
    if (shadows && sunDir.z > 0.05 && (this.frameNo % (this.lowQuality ? 4 : 2) === 0 || !this.shadowMap.ready)) {
      const sm = this.shadowMap;
      const texel = (2 * sm.half) / this.shadowRT.width;
      sm.cx = Math.round(eyeAbs.x / texel) * texel;
      sm.cy = Math.round(eyeAbs.y / texel) * texel;
      let zref = Infinity;
      for (const c of this.items) zref = Math.min(zref, c.z - c.hz);
      sm.zref = Number.isFinite(zref) ? zref : 1500;
      this.shadowMat.uniforms.uMap.value.set(sm.cx, sm.cy, 1 / sm.half, 0);
      this.shadowMat.uniforms.uZref.value = sm.zref;
      r.setRenderTarget(this.shadowRT);
      r.setClearColor(0x000000, 0);
      r.clear(true, false, false);
      if (n > 0) r.render(this.shadowMesh, this.cam);
      sm.ready = true;
    }
    if (this.direct) return;
    // Clouds at half the pixels per axis (a third on phones), at most ~1 Mpx, of which a
    // quarter is marched each frame (2 × 2 checkerboard over four frames).
    let scale = this.lowQuality ? 0.34 : 0.5;
    const max = this.lowQuality ? 0.26e6 : 0.8e6;
    if (width * height * scale * scale > max) scale = Math.sqrt(max / (width * height));
    const qw = Math.max(1, Math.ceil((width * scale) / 2));
    const qh = Math.max(1, Math.ceil((height * scale) / 2));
    const w = qw * 2;
    const h = qh * 2;
    const target = (tw: number, th: number) =>
      new THREE.WebGLRenderTarget(tw, th, { count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    if (!this.rt || this.rt.width !== qw || this.rt.height !== qh) {
      this.rt?.dispose();
      for (const t of this.hist) t.dispose();
      this.rt = target(qw, qh);
      this.hist = [target(w, h), target(w, h)];
      this.histOk = false;
    }
    const BAYER = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
    ];
    const [ox, oy] = BAYER[this.frameNo % 4];
    // Projection shifted so each quarter-resolution pixel samples this frame's sub-pixel.
    const dx = (ox - 0.5) / qw;
    const dy = (oy - 0.5) / qh;
    this.marchCam.projectionMatrix.makeTranslation(-dx, -dy, 0).multiply(cam.projectionMatrix);
    this.marchCam.projectionMatrixInverse.copy(this.marchCam.projectionMatrix).invert();
    const fovY = (cam as THREE.Camera & { fovRad?: number }).fovRad ?? 1.15;
    const mu = this.marchMat.uniforms;
    mu.uPixelAngle.value = fovY / h;
    mu.uRtSize.value.set(qw, qh);
    mu.uJitterUv.value.set(dx / 2, dy / 2);
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
    if (n > 0) r.render(this.march, this.marchCam);
    // Resolve into the next history target.
    const prev = this.hist[this.histIdx];
    this.histIdx = 1 - this.histIdx;
    const cur = this.hist[this.histIdx];
    const ru = this.resolveMat.uniforms;
    ru.uCurC.value = this.rt.textures[0];
    ru.uCurD.value = this.rt.textures[1];
    ru.uHistC.value = prev.textures[0];
    ru.uHistD.value = prev.textures[1];
    ru.uO.value.set(ox, oy);
    ru.uFR.value.set(w, h);
    ru.uPrevProj.value.copy(this.prevProj);
    ru.uAnchorDelta.value.set(view.anchor.x - this.prevAnchor.x, view.anchor.y - this.prevAnchor.y, view.anchor.z - this.prevAnchor.z);
    ru.uEye.value.copy(view.eye);
    ru.uDirBase.value.copy(view.dirBase);
    ru.uDirX.value.copy(view.dirX);
    ru.uDirY.value.copy(view.dirY);
    ru.uHistOk.value = this.histOk ? 1 : 0;
    r.setRenderTarget(cur);
    r.render(this.resolve, this.cam);
    this.histOk = true;
    this.prevProj.copy(cam.projectionMatrix);
    this.prevAnchor.set(view.anchor.x, view.anchor.y, view.anchor.z);
    this.compositeMat.uniforms.uColor.value = cur.textures[0];
    this.compositeMat.uniforms.uDepthT.value = cur.textures[1];
  }

  /** Full resolution: the clouds over the frame, hidden by the terrain in front of them. */
  drawComposite(r: THREE.WebGLRenderer, width: number, height: number): void {
    if (this.direct || !this.rt || this.items.length === 0) return;
    this.compositeMat.uniforms.uRes.value.set(width, height);
    r.render(this.composite, this.cam);
  }

  /** Phones without float targets: the clouds straight into the frame (full resolution, fewer steps). */
  drawDirect(r: THREE.WebGLRenderer, cam: THREE.Camera, height: number): void {
    if (!this.direct || this.items.length === 0) return;
    const fovY = (cam as THREE.Camera & { fovRad?: number }).fovRad ?? 1.15;
    this.marchMat.uniforms.uPixelAngle.value = fovY / height;
    r.render(this.march, cam);
  }

  dispose(): void {
    this.rt?.dispose();
    for (const t of this.hist) t.dispose();
    this.resolveMat.dispose();
    this.shadowRT.dispose();
    this.shapeRT.dispose();
    this.detailRT.dispose();
    this.marchGeo.dispose();
    this.shadowGeo.dispose();
    this.marchMat.dispose();
    this.shadowMat.dispose();
    this.compositeMat.dispose();
  }
}
