/**
 * Cumulus: one ray-marched layer at reduced resolution, composited over the map.
 *
 * Shape. The clouds are first drawn from above into two 2D maps around the camera (the
 * "cloud maps", like the weather map of Schneider's Nubis): 48 km at 47 m per texel for
 * the air mass's cumulus, 200 km at 195 m for the field beyond, generated with the same
 * statistics (cover, size, base, height) so the sky is full of cumulus to the horizon, in
 * streets along the wind when it blows. Each cloud is a heap of bubbles on its flat base,
 * as a thermal's successive bubbles build it: the tallest near the middle, lower ones around
 * (a humilis is one flat lens with a few bumps, a congestus's central towers are steep
 * columns, at least half as wide as tall); a decaying or big cloud may trail a small ragged
 * lump under its base edge (fractus). Each texel holds the signed distance to the union of
 * the footprints, the height of the tops, the base, the cloud's size and age, and over the
 * clouds' margins the biggest size and highest top around (for the march's jumps). In 3D
 * the outline is that envelope displaced by round lobes on lobes at three octaves whose size
 * follows the cloud's (a big cloud's turrets are big), torn rather than billowed in the
 * bottom tens of metres, and by finer curls on the surface (hollow wisps at the base); a
 * decaying cloud thins. The base stays flat and sharp at the condensation level; the towers
 * lean downwind; the lobes rise slowly.
 *
 * Light. Along each view ray, for each sample in a cloud, a short march towards the sun
 * (growing steps) gives the optical depth to the light. Sunlight: single scattering with a
 * strongly forward phase (silver lining and glow when backlit) plus the light scattered many
 * times, which builds up below the surface (the darker "powder" rims on the sunlit side) and
 * diffuses deep inside with a slow decay (grey, not black, shaded sides and bases). Sky light
 * from above and from the sides, less under a bulge (one probe above: the shaded sides keep
 * their relief), the ground's bounce near the flat bases. The sunlight's colour is the
 * atmosphere's transmittance at the cloud's height; distant clouds sink into the same aerial
 * perspective as the landscape.
 *
 * Cost. The march runs in a full-screen pass at half the screen's resolution per axis (a
 * third on phones), a quarter of whose pixels are marched each frame (2 × 2 checkerboard); a
 * resolve pass reprojects the previous result with the clouds' distance and clamps it to
 * the fresh samples. Rays are clipped to the cloud layer and to the relief (MapLibre's
 * terrain depth), cross the clear air between clouds in jumps given by the maps' distance
 * field, stop when the cloud is opaque, and take coarser steps and noise with distance. A
 * full-resolution pass composites the result with the clouds' depth so the relief and the
 * three.js objects in front hide them.
 *
 * Shadows. The same maps, marched along the sun, give a top-down optical depth map around
 * the pilot (60 km) that the landscape pass reads.
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

/** Tiling noises, generated once on the GPU: shape (Perlin-Worley and three octaves of round cells) and detail. */
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
// Squared distance to the nearest feature point (one per cell, tiling with the period).
float worley2(vec3 p, float period, float salt) {
  vec3 id = floor(p);
  vec3 f = fract(p);
  float md = 9.0;
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      for (int z = -1; z <= 1; z++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 h = hash33(mod(id + o, period) + salt);
        vec3 d = o + h - f;
        md = min(md, dot(d, d));
      }
  return md;
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
// Round bumps: a spherical cap on each cell's feature point (1 − F1²).
float cells(vec3 p, float fq, float salt) {
  return clamp(1.0 - worley2(p * fq, fq, salt) * 1.15, 0.0, 1.0);
}
void main() {
  vec3 p = vec3(gl_FragCoord.xy / uN, uSlice);
  if (uKind == 0) {
    float pf = 0.0;
    float amp = 1.0;
    float fq = 4.0;
    float wsum = 0.0;
    for (int o = 0; o < 5; o++) {
      pf += perlin(p * fq, fq) * amp;
      wsum += amp;
      amp *= 0.5;
      fq *= 2.0;
    }
    pf = pf / wsum * 1.4 + 0.5;
    float wf = cells(p, 4.0, 1.0) * 0.625 + cells(p, 8.0, 2.0) * 0.25 + cells(p, 16.0, 3.0) * 0.125;
    // Perlin-Worley: Perlin's continuity, the cells' billows.
    float pw = clamp((pf - (1.0 - wf)) / max(wf, 1e-3), 0.0, 1.0);
    fragColor = vec4(pw, cells(p, 4.0, 11.0), cells(p, 8.0, 12.0), cells(p, 16.0, 13.0));
  } else {
    float d = cells(p, 2.0, 21.0) * 0.55 + cells(p, 4.0, 22.0) * 0.3 + cells(p, 8.0, 23.0) * 0.15;
    fragColor = vec4(d, d, d, 1.0);
  }
}`;

/**
 * Cloud maps: one instanced quad per dome, max-blended (union of the footprints, highest
 * top, lowest base). Target 0: signed distance to the footprint + margin, top, 10 km − base,
 * cloud size (km); target 1: age, tower. Scaled into [0, 1] where only 8-bit targets exist.
 */
const MAP_VS = /* glsl */ `
in vec4 aDome;
in vec4 aDome2;
in vec4 aDome3;
uniform vec4 uRect;
uniform float uStretch;
out vec2 vXY;
flat out vec4 vD;
flat out vec4 vD2;
flat out vec4 vD3;
void main() {
  vD = aDome;
  vD2 = aDome2;
  vD3 = aDome3;
  vec2 xy = aDome.xy + position.xy * (aDome.z * uStretch + uRect.w);
  vXY = xy;
  gl_Position = vec4((xy - uRect.xy) / uRect.z, 0.0, 1.0);
}`;

const MAP_FS = /* glsl */ `
precision highp float;
uniform vec4 uRect;
uniform vec2 uWindAx;
uniform float uStretch;
uniform float uValid;
uniform vec4 uMapScale;
in vec2 vXY;
flat in vec4 vD;
flat in vec4 vD2;
flat in vec4 vD3;
layout(location = 0) out vec4 oA;
layout(location = 1) out vec4 oB;
void main() {
  vec2 v = vXY - vD.xy;
  // Footprints a little longer along the wind.
  float along = dot(v, uWindAx) / uStretch;
  float across = dot(v, vec2(-uWindAx.y, uWindAx.x));
  float d = length(vec2(along, across));
  float r = vD.z;
  float s = r - d;
  if (s < -uRect.w) discard;
  float u = clamp(d / r, 0.0, 1.0);
  float prof = pow(max(1.0 - u * u, 0.0), vD2.z);
  // Heights around the footprint as far as the billows can bulge out (0.3 R, see the
  // density) and a little more, so the bilinear lookups near the edge stay consistent.
  float valid = s > -(uValid + 0.4 * vD2.y) ? 1.0 : 0.0;
  float top = vD2.x + vD.w * prof;
  oA = vec4((s + uRect.w) / 1000.0, valid * top / 1000.0, valid * (10.0 - vD2.x / 1000.0), valid * vD2.y / 1000.0) * uMapScale;
  // The size of the nearest clouds over the whole margin: how far their billows can reach,
  // for the march's jumps across clear air.
  oB = vec4(valid * vD2.w, valid * vD3.x, vD2.y / 2000.0, (vD2.x + vD.w) / 10000.0);
}`;

/** The cloud field (maps and noises) and the density, shared by the march and the shadow map. */
const FIELD_GLSL = /* glsl */ `
uniform sampler2D uNearA;
uniform sampler2D uNearB;
uniform sampler2D uFarA;
uniform sampler2D uFarB;
// Centre x, y (absolute local metres), half size (m), margin of the distance field (m).
uniform vec4 uNearRect;
uniform vec4 uFarRect;
uniform vec4 uMapScale;
uniform vec2 uLean;
uniform float uBaseRef;
uniform float uTime;
uniform highp sampler3D uShape;
uniform highp sampler3D uDetail;
uniform float uShapeN;
// Column at a horizontal position (absolute metres): A = (signed distance to the nearest
// footprint, top, base, cloud size), metres.
vec4 cloudColumnA(vec2 xy) {
  vec2 u = (xy - uNearRect.xy) / (2.0 * uNearRect.z) + 0.5;
  vec2 au = abs(u - 0.5);
  vec4 A;
  float M;
  if (max(au.x, au.y) < 0.492) {
    A = textureLod(uNearA, u, 0.0);
    M = uNearRect.w;
  } else {
    u = (xy - uFarRect.xy) / (2.0 * uFarRect.z) + 0.5;
    au = abs(u - 0.5);
    M = uFarRect.w;
    A = max(au.x, au.y) < 0.496 ? textureLod(uFarA, u, 0.0) : vec4(0.0);
  }
  A /= uMapScale;
  return vec4(A.x * 1000.0 - M, A.y * 1000.0, (10.0 - A.z) * 1000.0, A.w * 1000.0);
}
// The same and B = (age, tower, size of the clouds around / 2 km, their top / 10 km).
void cloudColumn(vec2 xy, out vec4 A, out vec4 B) {
  vec2 u = (xy - uNearRect.xy) / (2.0 * uNearRect.z) + 0.5;
  vec2 au = abs(u - 0.5);
  float M;
  if (max(au.x, au.y) < 0.492) {
    A = textureLod(uNearA, u, 0.0);
    B = textureLod(uNearB, u, 0.0);
    M = uNearRect.w;
  } else {
    u = (xy - uFarRect.xy) / (2.0 * uFarRect.z) + 0.5;
    au = abs(u - 0.5);
    M = uFarRect.w;
    if (max(au.x, au.y) < 0.496) {
      A = textureLod(uFarA, u, 0.0);
      B = textureLod(uFarB, u, 0.0);
    } else {
      A = vec4(0.0);
      B = vec4(0.0);
    }
  }
  A /= uMapScale;
  A = vec4(A.x * 1000.0 - M, A.y * 1000.0, (10.0 - A.z) * 1000.0, A.w * 1000.0);
}
// Billows of a cloud of size R: the shape noise on a tile proportional to the cloud (the
// power-of-two level nearest to 2 R): big clouds have big turrets. foot: pixel footprint.
vec4 shapeAt(vec3 q, float R, float foot, out float tile) {
  float L = floor(log2(max(R * 2.0, 160.0) / 160.0) + 0.5);
  tile = 160.0 * exp2(L);
  float lod = log2(max(foot * uShapeN / tile, 1.0));
  return textureLod(uShape, q / tile + vec3(0.0, 0.0, L * 0.293), lod);
}
// Density (0..1) at an absolute point (z: height above the curved ground), from its column
// (A, and the age B.x). skip > 0: no cloud within that horizontal distance.
float densityOf(vec3 p, vec4 A, float age, float foot, bool fine, out float skip);
float cloudDensity(vec3 p, float foot, bool fine, out float skip) {
  vec2 xy = p.xy - uLean * max(p.z - uBaseRef, 0.0);
  vec4 A;
  vec4 B;
  cloudColumn(xy, A, B);
  return densityOf(p, A, B.x, foot, fine, skip);
}
// Light samples: one map read (no age: a decaying cloud's interior shades a little darker).
float lightDensity(vec3 p, float foot) {
  float sk;
  return densityOf(p, cloudColumnA(p.xy - uLean * max(p.z - uBaseRef, 0.0)), 0.0, foot, false, sk);
}
float densityOf(vec3 p, vec4 A, float age, float foot, bool fine, out float skip) {
  float R = max(A.w, 120.0);
  float reach = 0.32 * R + 25.0;
  skip = -A.x - reach;
  if (skip > 0.0) return 0.0;
  skip = 0.0;
  float hb = p.z - A.z;
  if (hb < -1.0 || p.z > A.y + reach) return 0.0;
  // Envelope, > 0 inside (m): under the domes' tops (the flanks slope: × 0.7) and inside
  // the footprint, rounded off just above the flat base.
  float side = A.x - R * 0.06 * (1.0 - smoothstep(0.0, 0.15 * R, hb));
  float e = min(side, (A.y - p.z) * 0.7);
  if (e < -reach) return 0.0;
  vec3 q = vec3(p.xy, p.z - uTime * 1.6);
  float tile;
  vec4 n = shapeAt(q, R, foot, tile);
  float up = smoothstep(0.0, 0.35 * R, hb);
  // Cauliflower: round lobes on lobes (0.5, 0.25, 0.12 R across), flatter low on the
  // sides; the bottom few tens of metres torn rather than billowed.
  float bil = (n.g - 0.64) * 0.5 + (n.b - 0.64) * 0.42 + (n.a - 0.64) * 0.32;
  float torn = (n.r - 0.24) * 0.35 * (1.0 - smoothstep(0.0, 70.0, hb));
  float ee = e + R * (bil * mix(0.45, 1.0, up) + torn);
  // Finer lobes and curls on the surface (a few tens of metres), hollow wisps at the base.
  if (fine && ee > -0.12 * R && ee < 0.14 * R) {
    float dt = tile * 0.125;
    float det = textureLod(uDetail, q / dt, log2(max(foot * 32.0 / dt, 1.0))).r;
    ee += R * 0.11 * (det - 0.64) * mix(-1.0, 1.0, up);
  }
  float d = clamp(ee / (0.028 * R + 5.0), 0.0, 1.0);
  // The flat, sharp base at the condensation level.
  d *= smoothstep(-1.0, 6.0, hb);
  // A decaying cloud thins and frays.
  return d * mix(1.0, 0.5, age * age);
}`;

const MARCH_FS = /* glsl */ `
precision highp float;
${ATMO_GLSL}
${FIELD_GLSL}
uniform vec3 uEye;
uniform vec3 uAnchor;
uniform vec3 uDirBase;
uniform vec3 uDirX;
uniform vec3 uDirY;
uniform vec2 uHalfRes;
uniform vec2 uSub;
uniform float uQuarter;
uniform float uFrame;
uniform float uSigma;
uniform float uMsAmp;
uniform float uPixelAngle;
uniform int uSteps;
uniform int uLightSteps;
uniform float uSlabLo;
uniform float uSlabHi;
uniform float uMaxDist;
uniform float uReachMax;
uniform vec3 uAmbSun;
uniform vec3 uAmbAnti;
uniform vec3 uAmbBot;
uniform vec3 uSunColor;
uniform sampler2D uTDepth;
uniform float uHasDepth;
uniform vec2 uNF;
uniform vec3 uFog;
uniform vec2 uFogRange;
layout(location = 0) out vec4 oColor;
#ifndef DIRECT
layout(location = 1) out vec4 oDepth;
#endif
float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
}
float unpackDepth(vec4 c) { return dot(c, vec4(1.0 / 16777216.0, 1.0 / 65536.0, 1.0 / 256.0, 1.0)); }
// Distance along the ray to rise by c > 0 (height = rd.z t + k t²): always reached.
float rayRise(float c, float dz, float k) { return 2.0 * c / max(dz + sqrt(dz * dz + 4.0 * k * c), 1e-9); }
// Distance along the ray to sink by c > 0, 1e9 if it never does (the ground curves away).
float rayFall(float c, float dz, float k) {
  float disc = dz * dz - 4.0 * k * c;
  if (dz >= 0.0 || disc < 0.0) return 1e9;
  return 2.0 * c / max(-dz + sqrt(disc), 1e-9);
}
// Density at an absolute point for the view ray, and when there is none how far the ray
// can go before it may meet some: across clear air by the maps' distance field, under a
// base or over a top until it reaches that height or has gone a few hundred metres (the
// next cloud's base may differ).
float marchSample(vec3 p, vec3 rd, float rdH, float foot, bool fine, out float adv, out vec4 A) {
  vec2 xy = p.xy - uLean * max(p.z - uBaseRef, 0.0);
  vec4 B;
  cloudColumn(xy, A, B);
  float R = max(A.w, 120.0);
  float hor = 1.0 / max(rdH, 1e-3);
  adv = 0.0;
  // Clear air: beyond the reach of the biggest cloud around (its billows bulge out 0.32 R;
  // where no cloud's margin covers the texel, the biggest cloud of all).
  float clear = -A.x - (B.z > 0.0 ? 0.34 * max(B.z * 2000.0, R) + 30.0 : uReachMax);
  if (clear > 0.0) {
    adv = clear * hor;
    return 0.0;
  }
  float lim = min(350.0, 0.6 * R) * hor;
  float hb = p.z - A.z;
  if (hb < -1.0) {
    adv = rd.z > 1e-4 ? min(-hb / rd.z, lim) : lim;
    return 0.0;
  }
  // Above every cloud within the margin (their highest top, their reach): the ray can go
  // most of the margin before a cloud it has not seen could rise in front of it.
  float over = p.z - B.w * 10000.0 - 0.34 * max(B.z * 2000.0, R) - 30.0;
  if (over > 0.0) {
    float big = 0.85 * uNearRect.w * hor;
    adv = rd.z < -1e-4 ? min(over / -rd.z, big) : big;
    return 0.0;
  }
  float sk;
  return densityOf(p, A, B.x, foot, fine, sk);
}
void main() {
  // The pixel of the half-resolution image this texel stands for in this frame.
  vec2 hp = uQuarter > 0.5 ? floor(gl_FragCoord.xy) * 2.0 + uSub + 0.5 : gl_FragCoord.xy;
  vec2 uv = hp / uHalfRes;
  vec3 fv = uDirBase + (uv.x * 2.0 - 1.0) * uDirX + (uv.y * 2.0 - 1.0) * uDirY;
  vec3 rd = normalize(fv);
  vec3 ro = uEye;
  float camZ = uAnchor.z + ro.z;
  float rdH = length(rd.xy);
  // The cloud layer between the lowest base and the highest top, as heights above the
  // curved ground: height(t) = camZ + rd.z t + k t² (k: the Earth's curvature).
  float k = rdH * rdH * 7.85e-8;
  float t0;
  float t1;
  if (camZ < uSlabLo) {
    t0 = rayRise(uSlabLo - camZ, rd.z, k);
    t1 = rayRise(uSlabHi - camZ, rd.z, k);
  } else if (camZ <= uSlabHi) {
    t0 = 0.0;
    t1 = min(rayRise(uSlabHi - camZ, rd.z, k), rayFall(camZ - uSlabLo, rd.z, k));
  } else {
    t0 = rayFall(camZ - uSlabHi, rd.z, k);
    t1 = rayFall(camZ - uSlabLo, rd.z, k);
    if (t1 > 1e8) t1 = uMaxDist;
  }
  t1 = min(t1, uMaxDist);
  // The relief in front ends the ray.
  if (uHasDepth > 0.5) {
    float z = unpackDepth(texture(uTDepth, uv));
    if (z < 1.0 && z > 0.0) {
      float n = uNF.x;
      float f = uNF.y;
      float s = 2.0 * n / max((f + n) - z * (f - n), 1e-6);
      t1 = min(t1, s * length(fv));
    }
  }
  if (t1 <= t0) discard;
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy + uFrame * vec2(5.588238, 3.17), vec2(0.06711056, 0.00583715))));
  float cosT = dot(rd, uSunDir);
  // Sunlight at the clouds' height (the transmittance table), none in the Earth's shadow.
#ifdef DIRECT
  vec3 sunCol = uSunColor;
#else
  float rB = RB + uBaseRef / 1000.0;
  vec3 sunCol = raySphere(vec3(0.0, 0.0, rB), uSunDir, RB) >= 0.0 ? vec3(0.0) : atmoTransmittance(rB, uSunDir.z);
#endif
  // Phase: a sharp forward lobe (silver lining, glow around the sun) and a weak back lobe.
  float ph = mix(hg(cosT, 0.86), hg(cosT, -0.25), 0.22);
  // Sky light on the faces we see: brighter on the sun's side.
  vec2 sh = uSunDir.xy;
  float cosH = rdH > 1e-3 && dot(sh, sh) > 1e-6 ? dot(rd.xy / rdH, normalize(sh)) : 0.0;
  vec3 ambSky = mix(uAmbAnti, uAmbSun, 0.5 - 0.5 * cosH);
  float T = 1.0;
  vec3 L = vec3(0.0);
  float dAcc = 0.0;
  float t = t0;
  bool hit = false;
  float msIso = uMsAmp / (4.0 * PI);
  for (int i = 0; i < 192; i++) {
    if (i >= uSteps || t > t1 || T < 0.012) break;
    vec3 p = ro + rd * t + uAnchor;
    float hor = t * rdH;
    p.z += hor * hor * 7.85e-8;
    float foot = t * uPixelAngle;
    float ds = max(clamp(foot * 1.3, 7.0, 400.0), 7.0 + t * 0.002);
    float adv;
    vec4 A;
    float d = marchSample(p, rd, rdH, foot, foot < 90.0, adv, A);
    if (adv > 0.0) {
      // Land a random fraction of a step short: no banding where the jumps end.
      t += max(adv - ign * ds, ds * 0.5);
      continue;
    }
    if (d < 0.004) {
      t += hit ? ds : ds * 1.7;
      continue;
    }
    if (!hit) {
      // The surface: back to just before it, jittered (a crisp, unbanded edge).
      hit = true;
      t = max(t0, t - ds * (1.2 - 0.9 * ign));
      continue;
    }
    float sig = d * uSigma;
    // Optical depth towards the sun: growing steps from ten metres to a kilometre.
    float od = 0.0;
    float lt = 0.0;
    float seg = clamp(foot * 0.6, 9.0, 60.0);
    for (int j = 0; j < 6; j++) {
      if (j >= uLightSteps) break;
      od += lightDensity(p + uSunDir * (lt + 0.5 * seg), foot + lt * 0.02) * seg;
      lt += seg;
      seg *= 2.6;
    }
    od *= uSigma;
    float R = max(A.w, 120.0);
    float dTop = max(A.y - p.z, 0.0);
    float dSide = max(A.x, 0.0);
    float dBase = max(p.z - A.z, 0.0);
    // Sun: single scattering, then the light scattered many times, which builds up under
    // the sunlit surface (powder) and diffuses deep in with a slow decay.
    float powder = 1.0 - exp(-od * 1.6 - sig * 12.0);
    // The diffuse field of a thick cloud fades about linearly with the optical depth (two-
    // stream), not exponentially: shaded sides, bases and the inside stay grey, not black.
    float ms = msIso * powder * (0.8 * exp(-0.45 * od) + 0.2 / (1.0 + od / 18.0));
    vec3 sunS = sunCol * (ph * exp(-od) + ms);
    // Sky light through the top and the sides, less under a bulge (one probe above: the
    // shaded sides keep their relief), the ground's bounce through the base.
    float sa = uSigma * 0.045;
    float above = lightDensity(p + vec3(0.0, 0.0, 40.0), foot);
    vec3 amb = ambSky * exp(-sa * min(dTop, dSide * 1.3) - uSigma * above * 18.0) * mix(0.55, 1.0, smoothstep(0.0, 0.3 * R, dBase)) + uAmbBot * 0.85 * exp(-sa * 4.0 * dBase);
    vec3 S = sunS + amb;
    float st = exp(-sig * ds);
    L += T * S * (1.0 - st);
    dAcc += t * T * (1.0 - st);
    T *= st;
    t += ds;
  }
  float a = 1.0 - T;
  if (a < 0.003) discard;
  float dist = dAcc / max(a, 1e-4);
  a = clamp((a - 0.003) / 0.985, 0.0, 1.0);
  L /= max(1.0 - T, 1e-4);
#ifdef DIRECT
  vec3 col = atmoTonemap(L * uExposure);
  col = mix(col, uFog, smoothstep(uFogRange.x, uFogRange.y, dist) * 0.85);
  oColor = vec4(atmoEncode(col) * a, a);
#else
  vec3 Lap;
  vec3 Tap;
  atmoAerialLut(uv, dist / 1000.0, Lap, Tap);
  L = L * Tap + Lap;
  oColor = vec4(L * uExposure * a, a);
  oDepth = vec4(dist / 1000.0 * a, 0.0, 0.0, a);
#endif
}`;

/** Optical depth of the clouds along the sun, over a top-down map around the pilot. */
const SHADOW_FS = /* glsl */ `
precision highp float;
${FIELD_GLSL}
uniform vec3 uSunDir;
uniform vec4 uShadowRect;
uniform vec2 uSize;
uniform float uSigmaShadow;
uniform float uSlabLo;
uniform float uSlabHi;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec3 o = vec3(uShadowRect.xy + (uv * 2.0 - 1.0) * uShadowRect.z, uShadowRect.w);
  vec3 sd = normalize(vec3(uSunDir.xy, max(uSunDir.z, 0.08)));
  float ta = max(uSlabLo - o.z, 0.0) / sd.z;
  float tb = (uSlabHi - o.z) / sd.z;
  float dt = (tb - ta) / 16.0;
  float od = 0.0;
  for (int i = 0; i < 16; i++) {
    vec3 p = o + sd * (ta + (float(i) + 0.5) * dt);
    vec4 A;
    vec4 B;
    cloudColumn(p.xy - uLean * max(p.z - uBaseRef, 0.0), A, B);
    float R = max(A.w, 120.0);
    float inside = smoothstep(-0.12 * R, 0.08 * R, A.x) * smoothstep(A.z - 5.0, A.z + 25.0, p.z) * smoothstep(A.y + 0.12 * R, A.y - 0.1 * R, p.z);
    od += inside * mix(1.0, 0.45, B.x);
  }
  fragColor = vec4(od * dt * uSigmaShadow, 0.0, 0.0, 1.0);
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
    oC = mix(hc, c, 0.3);
    float cdist = c.a > 1e-3 ? cd.r / c.a : hdist;
    oD = vec4(mix(hdist, cdist, 0.3) * oC.a, 0.0, 0.0, oC.a);
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
uniform float uDirect;
layout(location = 0) out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 c = texture(uColor, uv);
  if (c.a < 0.004) discard;
  if (uDirect > 0.5) {
    gl_FragDepth = uDR.x;
    fragColor = c;
    return;
  }
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
  col += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  fragColor = vec4(col * c.a, c.a);
}`;

function mat(vs: string, fs: string, uniforms: Record<string, THREE.IUniform>, extra: Partial<THREE.ShaderMaterialParameters> = {}, defines: Record<string, string> = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, glslVersion: THREE.GLSL3, uniforms, defines, ...extra });
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Deterministic random numbers from a seed (mulberry32). */
function rng(seed: number): () => number {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash → 0..1 (for the far field's cells). */
function hash2(i: number, j: number, k: number): number {
  let h = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** The camera of the frame as the passes need it (metres around the anchor). */
export interface ViewInfo {
  eye: THREE.Vector3;
  anchor: { x: number; y: number; z: number };
  dirBase: THREE.Vector3;
  dirX: THREE.Vector3;
  dirY: THREE.Vector3;
  near: number;
  far: number;
  fovY: number;
  /** This frame's projection (MapLibre's, around the anchor), for the next frame's reprojection. */
  proj: THREE.Matrix4;
}

/** Statistics of the air mass's cumulus, for the field beyond them. */
interface FieldStats {
  n: number;
  cover: number;
  R: number;
  H: number;
  base: number;
}

/** Sub-pixel of each 2 × 2 block marched in turn (x, y pairs). */
const BAYER = [0, 0, 1, 1, 1, 0, 0, 1];

/** Half-float target pair (radiance, distance) of the march and its history. */
function marchTarget(w: number, h: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(w, h, { count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
}

/** Half size of the maps (m): the air mass's cumulus, and the field to the horizon. */
const NEAR_HALF = 24000;
const FAR_HALF = 100000;
/** Range of the air mass's clouds around the pilot (its query box, m). */
const AIRMASS_BOX = 22000;

export class CloudLayer {
  private cap: number;
  private a0: THREE.InstancedBufferAttribute;
  private a1: THREE.InstancedBufferAttribute;
  private a2: THREE.InstancedBufferAttribute;
  private mapGeo: THREE.InstancedBufferGeometry;
  private mapMesh: THREE.Mesh;
  private mapMat: THREE.ShaderMaterial;
  readonly marchMat: THREE.ShaderMaterial;
  private march: THREE.Mesh;
  private shadowMat: THREE.ShaderMaterial;
  private shadowPass: THREE.Mesh;
  readonly compositeMat: THREE.ShaderMaterial;
  private composite: THREE.Mesh;
  private resolveMat: THREE.ShaderMaterial;
  private resolve: THREE.Mesh;
  /** March target (a quarter of the half-resolution pixels) and the two history targets. */
  private rt: THREE.WebGLRenderTarget | null = null;
  private hist: THREE.WebGLRenderTarget[] = [];
  private histIdx = 0;
  private histOk = false;
  private prevProj = new THREE.Matrix4();
  private prevAnchor = new THREE.Vector3();
  readonly shadowRT: THREE.WebGLRenderTarget;
  private nearRT: THREE.WebGLRenderTarget;
  private farRT: THREE.WebGLRenderTarget;
  private shapeRT: THREE.WebGL3DRenderTarget;
  private detailRT: THREE.WebGL3DRenderTarget;
  private noiseReady = false;
  private cam = new THREE.Camera();
  private frameNo = 0;
  /** Clouds of the air mass, and the field generated beyond them. */
  private near: CloudShape[] = [];
  private far: CloudShape[] = [];
  private stats: FieldStats = { n: 0, cover: 0, R: 500, H: 900, base: 2000 };
  /** Growth of each cloud between updates (seed → size, age), for the decaying ones' look. */
  private ages = new Map<number, { size: number; age: number }>();
  private domeCount = 0;
  private domesDirty = true;
  private farAt = { x: 1e12, y: 1e12, t: -1e9 };
  private nearRect = new THREE.Vector4(0, 0, NEAR_HALF, 1500);
  private farRect = new THREE.Vector4(0, 0, FAR_HALF, 2500);
  private mapsDirty = true;
  private wind = new THREE.Vector2();
  private time = 0;
  /** Lowest base and highest top of the clouds (m): the layer the rays cross. */
  private slab = { lo: 1e9, hi: -1e9 };
  /** Shadow map: centre (absolute local metres), half size (m), reference height of the projection. */
  readonly shadowMap = { cx: 0, cy: 0, half: 30000, zref: 1500, ready: false };
  /** Resolution scale of the march (per axis, of the drawing buffer) and its step budget: adapted to the GPU. */
  scale: number;
  steps: number;
  private mapScale: THREE.Vector4;

  constructor(
    readonly lowQuality: boolean,
    readonly direct: boolean,
    atmoUniforms: Record<string, THREE.IUniform>,
  ) {
    this.cap = lowQuality ? 6000 : 14000;
    this.scale = lowQuality ? 0.34 : 0.5;
    this.steps = lowQuality ? 80 : 160;
    const n3 = (n: number) => {
      const t = new THREE.WebGL3DRenderTarget(n, n, n, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false });
      const tex = t.texture;
      tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      return t;
    };
    this.shapeRT = n3(lowQuality ? 64 : 128);
    this.detailRT = n3(32);
    // Cloud maps: half floats (8-bit, scaled, without float targets).
    const mapType = direct ? THREE.UnsignedByteType : THREE.HalfFloatType;
    this.mapScale = direct ? new THREE.Vector4(0.25, 0.1, 0.1, 0.5) : new THREE.Vector4(1, 1, 1, 1);
    const mapRT = (n: number) => new THREE.WebGLRenderTarget(n, n, { count: 2, type: mapType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    this.nearRT = mapRT(lowQuality ? 512 : 1024);
    this.farRT = mapRT(lowQuality ? 512 : 1024);
    this.a0 = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4);
    this.a1 = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4);
    this.a2 = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4);
    const quad = new THREE.PlaneGeometry(2, 2);
    this.mapGeo = new THREE.InstancedBufferGeometry();
    this.mapGeo.index = quad.index;
    this.mapGeo.setAttribute('position', quad.getAttribute('position'));
    this.mapGeo.setAttribute('aDome', this.a0);
    this.mapGeo.setAttribute('aDome2', this.a1);
    this.mapGeo.setAttribute('aDome3', this.a2);
    this.mapGeo.instanceCount = 0;
    this.mapMat = mat(
      MAP_VS,
      MAP_FS,
      {
        uRect: { value: new THREE.Vector4() },
        uWindAx: { value: new THREE.Vector2(1, 0) },
        uStretch: { value: 1 },
        uValid: { value: 80 },
        uMapScale: { value: this.mapScale },
      },
      { depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor },
    );
    this.mapMesh = new THREE.Mesh(this.mapGeo, this.mapMat);
    this.mapMesh.frustumCulled = false;
    const field = (): Record<string, THREE.IUniform> => ({
      uNearA: { value: this.nearRT.textures[0] },
      uNearB: { value: this.nearRT.textures[1] },
      uFarA: { value: this.farRT.textures[0] },
      uFarB: { value: this.farRT.textures[1] },
      uNearRect: { value: this.nearRect },
      uFarRect: { value: this.farRect },
      uMapScale: { value: this.mapScale },
      uLean: { value: new THREE.Vector2() },
      uBaseRef: { value: 2000 },
      uTime: { value: 0 },
      uShape: { value: this.shapeRT.texture },
      uDetail: { value: this.detailRT.texture },
      uShapeN: { value: this.shapeRT.width },
      uSlabLo: { value: 1500 },
      uSlabHi: { value: 4000 },
    });
    this.marchMat = mat(
      FULLSCREEN_VERTEX,
      MARCH_FS,
      {
        ...atmoUniforms,
        ...field(),
        uEye: { value: new THREE.Vector3() },
        uAnchor: { value: new THREE.Vector3() },
        uDirBase: { value: new THREE.Vector3() },
        uDirX: { value: new THREE.Vector3() },
        uDirY: { value: new THREE.Vector3() },
        uHalfRes: { value: new THREE.Vector2(1, 1) },
        uSub: { value: new THREE.Vector2() },
        uQuarter: { value: direct ? 0 : 1 },
        uFrame: { value: 0 },
        uSigma: { value: 0.055 },
        uMsAmp: { value: 5.5 },
        uPixelAngle: { value: 0.002 },
        uSteps: { value: this.steps },
        uLightSteps: { value: lowQuality ? 4 : 6 },
        uMaxDist: { value: 90000 },
        uReachMax: { value: 500 },
        uAmbSun: { value: new THREE.Color(0.06, 0.08, 0.11) },
        uAmbAnti: { value: new THREE.Color(0.06, 0.08, 0.11) },
        uAmbBot: { value: new THREE.Color(0.03, 0.03, 0.025) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uTDepth: { value: null },
        uHasDepth: { value: 0 },
        uNF: { value: new THREE.Vector2(1, 1000) },
        uFog: { value: new THREE.Color('#dbe6f1') },
        uFogRange: { value: new THREE.Vector2(9000, 45000) },
      },
      { depthTest: false, depthWrite: false, blending: THREE.NoBlending },
      direct ? { DIRECT: '1' } : {},
    );
    this.march = fullscreenPass(this.marchMat);
    this.shadowMat = mat(
      FULLSCREEN_VERTEX,
      SHADOW_FS,
      {
        ...field(),
        uSunDir: atmoUniforms.uSunDir,
        uShadowRect: { value: new THREE.Vector4() },
        uSize: { value: new THREE.Vector2(1, 1) },
        uSigmaShadow: { value: 0.012 },
      },
      { depthTest: false, depthWrite: false, blending: THREE.NoBlending },
    );
    this.shadowPass = fullscreenPass(this.shadowMat);
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
        uDirect: { value: direct ? 1 : 0 },
      },
      { depthTest: !direct, depthWrite: false, depthFunc: THREE.LessEqualDepth, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor },
    );
    this.composite = fullscreenPass(this.compositeMat);
    this.resolveMat = mat(
      FULLSCREEN_VERTEX,
      RESOLVE_FS,
      {
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
      },
      { depthTest: false, depthWrite: false, blending: THREE.NoBlending },
    );
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
    // The mip chains of both volumes, explicitly (a chain left incomplete would make the
    // textures sample as black).
    const gl = r.getContext() as WebGL2RenderingContext;
    for (const rt of [this.shapeRT, this.detailRT]) {
      const tex = (r.properties.get(rt.texture) as { __webglTexture?: WebGLTexture }).__webglTexture;
      if (!tex) continue;
      gl.bindTexture(gl.TEXTURE_3D, tex);
      gl.generateMipmap(gl.TEXTURE_3D);
    }
    gl.bindTexture(gl.TEXTURE_3D, null);
    r.state.reset();
    this.noiseReady = true;
  }

  /** Cumulus of the air mass (absolute local metres); `at`: the pilot (centre of the air mass's query). */
  setClouds(list: CloudShape[], at?: { x: number; y: number }): void {
    this.near = list;
    // Growth or decay of each cloud since the last update.
    const seen = new Set<number>();
    for (const c of list) {
      seen.add(c.seed);
      const a = this.ages.get(c.seed);
      if (!a) this.ages.set(c.seed, { size: c.size, age: 0.25 });
      else {
        const target = c.size < a.size - 1e-4 ? 1 : c.size > a.size + 1e-4 ? 0 : a.age;
        a.age += (target - a.age) * 0.05;
        a.size = c.size;
      }
    }
    for (const k of this.ages.keys()) if (!seen.has(k)) this.ages.delete(k);
    // Statistics of the field (weighted by size), smoothed over a few updates.
    if (list.length > 0) {
      let wR = 0;
      let sR = 0;
      let sH = 0;
      let area = 0;
      const bases: number[] = [];
      for (const c of list) {
        wR += c.size;
        sR += c.radius * c.size;
        sH += (c.top - c.base) * c.size;
        area += Math.PI * c.radius * c.radius * c.size;
        bases.push(c.base);
      }
      bases.sort((a, b) => a - b);
      const cover = Math.min(0.8, area / (4 * AIRMASS_BOX * AIRMASS_BOX));
      const st = this.stats;
      const k = st.n === 0 ? 1 : 0.2;
      st.R += (sR / Math.max(wR, 1e-3) - st.R) * k;
      st.H += (sH / Math.max(wR, 1e-3) - st.H) * k;
      st.base += (bases[bases.length >> 1] - st.base) * k;
      st.cover += (cover - st.cover) * k;
      st.n = list.length;
    } else {
      this.stats.n = 0;
      this.stats.cover *= 0.8;
    }
    if (at) this.boxAt = { x: at.x, y: at.y };
    this.domesDirty = true;
  }

  private boxAt = { x: 0, y: 0 };

  /** Wind (m/s, east/north): streets and drift of the far field, lean of the towers. */
  setWind(u: number, v: number, time: number): void {
    this.wind.set(u, v);
    this.time = time;
    const ws = Math.hypot(u, v);
    const lean = Math.min(0.25, ws * 0.018);
    const f = this.field();
    if (ws > 0.1) for (const m of f) m.uLean.value.set((u / ws) * lean, (v / ws) * lean);
    for (const m of f) m.uTime.value = time;
    if (ws > 0.3) this.mapMat.uniforms.uWindAx.value.set(u / ws, v / ws);
    this.mapMat.uniforms.uStretch.value = 1 + 0.35 * smooth(3, 10, ws);
  }

  private field(): Record<string, THREE.IUniform>[] {
    return [this.marchMat.uniforms, this.shadowMat.uniforms];
  }

  get count(): number {
    return this.near.length + this.far.length;
  }

  /** All the clouds drawn (air mass and far field), absolute local metres. */
  get shapes(): CloudShape[] {
    return this.near;
  }

  /**
   * The far field: cumulus with the air mass's statistics, beyond its query box, on a grid
   * that follows the wind (in streets when it blows) and drifts with it; each cloud lives a
   * cycle of 15–30 min.
   */
  private makeFar(cx: number, cy: number): void {
    const st = this.stats;
    this.far = [];
    if (st.n < 2 || st.cover < 0.004) return;
    const ws = this.wind.length();
    const ax = ws > 0.5 ? this.wind.x / ws : 1;
    const ay = ws > 0.5 ? this.wind.y / ws : 0;
    const streets = smooth(4, 9, ws);
    const R = Math.max(200, st.R);
    const C = Math.min(9000, Math.max(1400, Math.sqrt((Math.PI * R * R * 0.7) / Math.max(st.cover, 1e-3))));
    const Ca = C * (1 - 0.35 * streets);
    const Cb = C * (1 + 0.55 * streets);
    const t = this.time;
    const dx = this.wind.x * t;
    const dy = this.wind.y * t;
    // The camera in the drifting grid's frame.
    const rx = cx - dx;
    const ry = cy - dy;
    const ca = rx * ax + ry * ay;
    const cb = -rx * ay + ry * ax;
    const range = FAR_HALF * 0.92;
    const i0 = Math.floor((ca - range) / Ca);
    const i1 = Math.ceil((ca + range) / Ca);
    const j0 = Math.floor((cb - range) / Cb);
    const j1 = Math.ceil((cb + range) / Cb);
    const bx = this.boxAt.x;
    const by = this.boxAt.y;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        if (hash2(i, j, 1) > 0.78) continue;
        const a = (i + 0.5 + (hash2(i, j, 2) - 0.5) * 0.85) * Ca;
        const b = (j + 0.5 + (hash2(i, j, 3) - 0.5) * (0.85 - 0.6 * streets)) * Cb;
        const x = a * ax - b * ay + dx;
        const y = a * ay + b * ax + dy;
        if (Math.abs(x - bx) < AIRMASS_BOX && Math.abs(y - by) < AIRMASS_BOX) continue;
        if (Math.abs(x - cx) > range || Math.abs(y - cy) > range) continue;
        const period = 900 + 900 * hash2(i, j, 4);
        const u = (((t / period + hash2(i, j, 5)) % 1) + 1) % 1;
        const size = smooth(0, 0.15, u) * (1 - smooth(0.6, 0.8, u));
        if (size < 0.08) continue;
        const h6 = hash2(i, j, 6);
        const rad = R * (0.55 + 0.9 * h6 * h6) * (0.55 + 0.45 * size);
        const H = Math.max(0.3 * rad, st.H * (0.5 + 0.8 * hash2(i, j, 7)) * (0.4 + 0.6 * size) * Math.pow(rad / R, 0.3));
        const base = st.base + (hash2(i, j, 8) - 0.5) * 160;
        this.far.push({ x, y, base, top: base + H, radius: rad, size, seed: hash2(i, j, 9) + (u > 0.45 ? 1 : 0) });
      }
    }
  }

  /**
   * Domes of the clouds into the instance buffers (per cloud, from its seed): the far
   * field's first (the far map draws only those), then the air mass's.
   */
  private writeDomes(list: CloudShape[], far: boolean, start: number): { end: number; lo: number; hi: number; rMax: number } {
    const A0 = this.a0.array as Float32Array;
    const A1 = this.a1.array as Float32Array;
    const A2 = this.a2.array as Float32Array;
    let k = start;
    let lo = 1e9;
    let hi = -1e9;
    const put = (x: number, y: number, r: number, H: number, base: number, R: number, p: number, age: number, tower: number) => {
      if (k >= this.cap) return;
      A0[k * 4] = x;
      A0[k * 4 + 1] = y;
      A0[k * 4 + 2] = r;
      A0[k * 4 + 3] = H;
      A1[k * 4] = base;
      A1[k * 4 + 1] = R;
      A1[k * 4 + 2] = p;
      A1[k * 4 + 3] = age;
      A2[k * 4] = tower;
      k++;
    };
    let rMax = 0;
    for (const c of list) {
      // A towering cloud is at least about half as wide as it is tall (the air mass's
      // radius is its thermal's).
      const R = Math.max(c.radius * 1.08, 0.22 * (c.top - c.base));
      rMax = Math.max(rMax, R);
      const H = Math.max(c.top - c.base, 0.3 * R);
      const aspect = H / (2 * R);
      const tower = smooth(0.75, 1.7, aspect);
      const flat = 1 - smooth(0.3, 0.6, aspect);
      const age = far ? (c.seed >= 1 ? 0.75 : 0.2) : (this.ages.get(c.seed)?.age ?? 0.25);
      const rnd = rng(c.seed % 1);
      lo = Math.min(lo, c.base);
      hi = Math.max(hi, c.base + H);
      // A heap of bubbles on the flat base, as the thermal's successive bubbles build it: the
      // tallest near the middle reaching the top, lower ones around it. A humilis is a single
      // flat lens with a few low bumps; a congestus's central towers are steep columns.
      if (flat > 0.6) {
        put(c.x, c.y, R * 0.95, H, c.base, R, 0.65, age, tower);
        const nb = far ? 1 : 2 + Math.floor(rnd() * 2.5);
        for (let i = 0; i < nb; i++) {
          const ang = rnd() * Math.PI * 2;
          const dist = R * (0.15 + 0.45 * rnd());
          put(c.x + Math.cos(ang) * dist, c.y + Math.sin(ang) * dist, R * (0.35 + 0.2 * rnd()), H * (1.1 + 0.3 * rnd()), c.base, R, 0.55, age, tower);
        }
      } else {
        const nb = far ? 4 : 6 + Math.floor(rnd() * 4.99);
        const a0 = rnd() * Math.PI * 2;
        for (let i = 0; i < nb; i++) {
          const main = i === 0;
          // Spread over the footprint (golden angle), the first ones near the middle.
          const u = main ? 0.02 + 0.05 * rnd() : (i + rnd() * 0.8) / nb;
          const ang = a0 + i * 2.39996 + (rnd() - 0.5) * 0.5;
          const dist = R * 0.5 * Math.sqrt(u);
          const fall = Math.pow(dist / R, 1.3);
          const h = H * (main ? 1 : Math.max(0.5, (1 - (0.7 + 0.3 * tower) * fall) * (0.66 + 0.3 * rnd())));
          // Lower bubbles are smaller: the heap narrows to its base rather than spreading.
          const r = R * (main ? 0.52 + 0.15 * rnd() : (0.3 + 0.2 * rnd()) * (0.75 + 0.25 * h / H)) * (1 - 0.12 * tower);
          put(c.x + Math.cos(ang) * dist, c.y + Math.sin(ang) * dist, r, h, c.base, R, main ? 0.5 - 0.22 * tower : 0.5 - 0.1 * tower, age, tower);
        }
      }
      // A ragged lump hanging under the base edge of some big or decaying clouds (fractus):
      // rounder than wide, frayed (old), its own small billows.
      if (!far && (age > 0.6 || R > 650) && rnd() < 0.3) {
        const ang = rnd() * Math.PI * 2;
        const fd = R * (0.7 + 0.25 * rnd());
        const fr = R * (0.1 + 0.07 * rnd());
        put(c.x + Math.cos(ang) * fd, c.y + Math.sin(ang) * fd, fr, fr * (1.6 + 0.6 * rnd()), c.base - 50 - 70 * rnd(), Math.max(120, fr * 2.2), 0.5, 0.9, 0);
      }
    }
    return { end: k, lo, hi, rMax };
  }

  private farEnd = 0;
  private farLo = 1e9;
  private farHi = -1e9;
  private farRMax = 0;
  private farDomesDirty = true;
  private farMapDirty = true;

  private buildDomes(): void {
    if (this.farDomesDirty) {
      const f = this.writeDomes(this.far, true, 0);
      this.farEnd = f.end;
      this.farLo = f.lo;
      this.farHi = f.hi;
      this.farRMax = f.rMax;
      this.farDomesDirty = false;
      this.farMapDirty = true;
    }
    const n = this.writeDomes(this.near, false, this.farEnd);
    const k = n.end;
    this.domeCount = k;
    for (const a of [this.a0, this.a1, this.a2]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, k * 4);
      a.needsUpdate = true;
    }
    const lo = Math.min(n.lo, this.farLo);
    const hi = Math.max(n.hi, this.farHi);
    if (k > 0) {
      this.slab.lo = lo;
      this.slab.hi = hi;
    }
    const baseRef = this.stats.n > 0 ? this.stats.base : lo;
    this.marchMat.uniforms.uReachMax.value = 0.34 * Math.max(n.rMax, this.farRMax, 120) + 30;
    for (const m of this.field()) {
      m.uSlabLo.value = this.slab.lo - 150;
      m.uSlabHi.value = this.slab.hi + 0.35 * Math.max(300, this.stats.R) + 60;
      m.uBaseRef.value = baseRef;
    }
    this.domesDirty = false;
    this.mapsDirty = true;
  }

  private renderMap(r: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget, rect: THREE.Vector4, count: number): void {
    const u = this.mapMat.uniforms;
    u.uRect.value.copy(rect);
    u.uValid.value = ((2 * rect.z) / rt.width) * 1.6;
    this.mapGeo.instanceCount = count;
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
    if (count > 0) r.render(this.mapMesh, this.cam);
  }

  /**
   * Per frame, before the map's passes: the noise (once), the cloud maps when the clouds or
   * the camera moved, the shadow map, the march and its resolve.
   */
  prepare(r: THREE.WebGLRenderer, view: ViewInfo, width: number, height: number, sunDir: THREE.Vector3, shadows: boolean, terrainDepth: THREE.Texture | null): void {
    const ex = view.anchor.x + view.eye.x;
    const ey = view.anchor.y + view.eye.y;
    if (!this.noiseReady) this.makeNoise(r);
    this.frameNo++;
    // The far field follows the camera and lives its cycles: rebuilt every few seconds.
    if (Math.hypot(ex - this.farAt.x, ey - this.farAt.y) > 3000 || Math.abs(this.time - this.farAt.t) > 4) {
      this.makeFar(ex, ey);
      this.farAt.x = ex;
      this.farAt.y = ey;
      this.farAt.t = this.time;
      this.farDomesDirty = true;
      this.domesDirty = true;
    }
    if (this.domesDirty) this.buildDomes();
    const nearTexel = (2 * NEAR_HALF) / this.nearRT.width;
    const farTexel = (2 * FAR_HALF) / this.farRT.width;
    if (Math.hypot(ex - this.nearRect.x, ey - this.nearRect.y) > 2500) {
      this.nearRect.x = Math.round(ex / nearTexel) * nearTexel;
      this.nearRect.y = Math.round(ey / nearTexel) * nearTexel;
      this.mapsDirty = true;
    }
    if (Math.hypot(ex - this.farRect.x, ey - this.farRect.y) > 10000) {
      this.farRect.x = Math.round(ex / farTexel) * farTexel;
      this.farRect.y = Math.round(ey / farTexel) * farTexel;
      this.farMapDirty = true;
    }
    const have = this.domeCount > 0;
    if (this.mapsDirty) {
      // The near map holds every cloud over its area (the far field's included at its
      // edges); the far map only the far field, redrawn when it changes.
      this.renderMap(r, this.nearRT, this.nearRect, this.domeCount);
      this.mapsDirty = false;
      this.shadowMap.ready = false;
    }
    if (this.farMapDirty) {
      this.renderMap(r, this.farRT, this.farRect, this.farEnd);
      this.farMapDirty = false;
    }
    // Shadow map: every other frame (every 4th on phones), snapped to its texels.
    if (shadows && sunDir.z > 0.04 && (this.frameNo % (this.lowQuality ? 4 : 2) === 0 || !this.shadowMap.ready)) {
      const sm = this.shadowMap;
      const texel = (2 * sm.half) / this.shadowRT.width;
      sm.cx = Math.round(ex / texel) * texel;
      sm.cy = Math.round(ey / texel) * texel;
      sm.zref = this.slab.lo < 1e8 ? this.slab.lo - 160 : 1500;
      const u = this.shadowMat.uniforms;
      u.uShadowRect.value.set(sm.cx, sm.cy, sm.half, sm.zref);
      u.uSize.value.set(this.shadowRT.width, this.shadowRT.height);
      r.setRenderTarget(this.shadowRT);
      r.setClearColor(0x000000, 0);
      r.clear(true, false, false);
      if (have) r.render(this.shadowPass, this.cam);
      sm.ready = true;
    }
    const mu = this.marchMat.uniforms;
    mu.uEye.value.copy(view.eye);
    mu.uAnchor.value.set(view.anchor.x, view.anchor.y, view.anchor.z);
    mu.uDirBase.value.copy(view.dirBase);
    mu.uDirX.value.copy(view.dirX);
    mu.uDirY.value.copy(view.dirY);
    mu.uNF.value.set(view.near, view.far);
    mu.uTDepth.value = terrainDepth;
    mu.uHasDepth.value = terrainDepth ? 1 : 0;
    mu.uSteps.value = this.steps;
    mu.uFrame.value = this.frameNo % 64;
    // Clouds at `scale` of the pixels per axis (at most ~0.9 Mpx), a quarter of which is
    // marched each frame (2 × 2 checkerboard over four frames); phones without float
    // targets march every pixel of a smaller image.
    let scale = this.scale;
    const max = this.lowQuality ? 0.3e6 : 0.9e6;
    if (width * height * scale * scale > max) scale = Math.sqrt(max / (width * height));
    const qw = Math.max(1, Math.ceil((width * scale) / 2));
    const qh = Math.max(1, Math.ceil((height * scale) / 2));
    const w = qw * 2;
    const h = qh * 2;
    mu.uPixelAngle.value = view.fovY / h;
    if (this.direct) {
      if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
        this.rt?.dispose();
        this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
      }
      mu.uHalfRes.value.set(w, h);
      r.setRenderTarget(this.rt);
      r.setClearColor(0x000000, 0);
      r.clear(true, false, false);
      if (have) r.render(this.march, this.cam);
      this.compositeMat.uniforms.uColor.value = this.rt.texture;
      return;
    }
    if (!this.rt || this.rt.width !== qw || this.rt.height !== qh) {
      this.rt?.dispose();
      for (const t of this.hist) t.dispose();
      this.rt = marchTarget(qw, qh);
      this.hist = [marchTarget(w, h), marchTarget(w, h)];
      this.histOk = false;
    }
    const ox = BAYER[(this.frameNo % 4) * 2];
    const oy = BAYER[(this.frameNo % 4) * 2 + 1];
    mu.uHalfRes.value.set(w, h);
    mu.uSub.value.set(ox, oy);
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
    if (have) r.render(this.march, this.cam);
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
    this.prevProj.copy(view.proj);
    this.prevAnchor.set(view.anchor.x, view.anchor.y, view.anchor.z);
    this.compositeMat.uniforms.uColor.value = cur.textures[0];
    this.compositeMat.uniforms.uDepthT.value = cur.textures[1];
  }

  /** Full resolution: the clouds over the frame, hidden by the terrain in front of them. */
  drawComposite(r: THREE.WebGLRenderer, width: number, height: number): void {
    if (!this.rt || this.domeCount === 0) return;
    this.compositeMat.uniforms.uRes.value.set(width, height);
    r.render(this.composite, this.cam);
  }

  /** The history target holding this frame's clouds (alpha: coverage), for the sun's occlusion. */
  get coverTexture(): THREE.Texture | null {
    return (this.compositeMat.uniforms.uColor as THREE.IUniform).value as THREE.Texture | null;
  }

  dispose(): void {
    this.rt?.dispose();
    for (const t of this.hist) t.dispose();
    this.resolveMat.dispose();
    this.shadowRT.dispose();
    this.nearRT.dispose();
    this.farRT.dispose();
    this.shapeRT.dispose();
    this.detailRT.dispose();
    this.mapGeo.dispose();
    this.mapMat.dispose();
    this.marchMat.dispose();
    this.shadowMat.dispose();
    this.compositeMat.dispose();
  }
}
