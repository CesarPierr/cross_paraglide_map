/**
 * Detail of the ground's materials near the pilot, procedural (no texture under copyright):
 * a stack of tiling patterns drawn once on the GPU, each holding a micro-relief (its normal
 * and height) and a variation of brightness, mip-mapped so the detail melts away with the
 * distance. The landscape pass (sky.ts, MATERIAL_GLSL) lays them on the orthophoto by type
 * of ground:
 *
 * 0 limestone and rock faces seen from the side: strata, ledges, vertical joints, stains;
 * 1 rock from above, scree: blocks and stones of several sizes, dark gaps;
 * 2 grass of meadows and alpine pastures: tufts, bare spots;
 * 3 forest canopy: rounded crowns of several sizes, dark gaps between them;
 * 4 snow: wind ripples (sastrugi), smooth;
 * 5 glacier ice: crevasses across the flow, smooth ice between;
 * 6 fields: furrows and clods.
 *
 * Texel: RG = normal (x, y) × 0.5 + 0.5 in the pattern's plane, B = height, A = brightness
 * (0.5 = unchanged). Phones (GROUND_LOW) keep the classes, the snow, the water and the
 * canopies' light, without the detail stack.
 */
import * as THREE from 'three';
import { FULLSCREEN_VERTEX, fullscreenPass } from './atmosphere';

export const DETAIL_LAYERS = 7;

const DETAIL_FS = /* glsl */ `
precision highp float;
uniform float uN;
uniform int uLayer;
layout(location = 0) out vec4 fragColor;
vec2 hash22(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.xx + p.yx) * p.yx);
}
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// Value noise tiling with period per (integer frequencies).
float vnoise(vec2 p, vec2 per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(mod(i, per));
  float b = hash12(mod(i + vec2(1.0, 0.0), per));
  float c = hash12(mod(i + vec2(0.0, 1.0), per));
  float d = hash12(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, vec2 per, int oct) {
  float s = 0.0;
  float a = 0.5;
  float w = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * vnoise(p, per);
    w += a;
    p *= 2.0;
    per *= 2.0;
    a *= 0.5;
  }
  return s / w;
}
// Distances to the nearest and second nearest feature points (one per cell, jittered), tiling.
vec2 worley(vec2 p, vec2 per, float jitter) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 9.0;
  float d2 = 9.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 h = hash22(mod(i + o, per)) * jitter + 0.5 * (1.0 - jitter);
      float d = length(o + h - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  return vec2(d1, d2);
}
// Rounded stones: a cap on each cell's point, its radius drawn per cell; the cell's id too.
float stones(vec2 p, vec2 per, out float id) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float h = 0.0;
  id = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 c = mod(i + o, per);
      vec2 pt = hash22(c) * 0.8 + 0.1;
      float r = 0.45 + 0.4 * hash12(c + 7.1);
      float d = length(o + pt - f) / r;
      float cap = sqrt(max(0.0, 1.0 - d * d));
      if (cap > h) { h = cap; id = hash12(c + 3.3); }
    }
  return h;
}

// Each pattern: height (0..1) and brightness (0..1) at uv in [0, 1)².
void pattern(vec2 uv, out float h, out float b) {
  if (uLayer == 0) {
    // Limestone face (u along the face, v up): beds of uneven thickness, wavy and pinching
    // out, a ledge or an overhang at the foot of each, joints through some beds only, small
    // roughness; beds of slightly different tints, dark runoff streaks hanging under the
    // ledges, lighter fresh scars.
    float warp = 1.3 * fbm(vec2(uv.x * 2.0, uv.y * 3.0), vec2(2.0, 3.0), 3) + 0.25 * sin(uv.x * 6.2831853 * 2.0 + uv.y * 3.0);
    float t = uv.y * 11.0 + warp;
    t += 0.38 * sin(t * 1.7) + 0.2 * sin(t * 4.1 + 1.3);
    float bed = floor(t);
    float f = fract(t);
    float thick = hash12(vec2(bed, 3.0));
    float ledge = smoothstep(0.0, 0.08 + 0.1 * thick, f) * (1.0 - (0.35 + 0.4 * thick) * f);
    float overhang = (1.0 - smoothstep(0.0, 0.05, f)) * step(0.55, thick);
    vec2 w = worley(vec2(uv.x * 7.0, uv.y * 1.5 + bed * 0.37), vec2(7.0, 1.5), 1.0);
    float joint = (1.0 - smoothstep(0.0, 0.06, w.y - w.x)) * step(0.35, hash12(vec2(bed, 11.0)));
    float rough = fbm(uv * 24.0, vec2(24.0), 4);
    h = clamp(0.5 * ledge + 0.3 * rough - 0.35 * joint - 0.25 * overhang + 0.2, 0.0, 1.0);
    float streak = fbm(vec2(uv.x * 46.0, uv.y * 1.2 + 0.3 * rough), vec2(46.0, 1.2), 3);
    float stain = smoothstep(0.5, 0.82, streak) * (0.4 + 0.6 * (1.0 - f));
    float scar = smoothstep(0.78, 0.92, fbm(uv * vec2(5.0, 9.0) + 3.1, vec2(5.0, 9.0), 2));
    b = 0.5 + 0.16 * (hash12(vec2(bed, 9.0)) - 0.5) + 0.16 * (rough - 0.5) - 0.22 * stain - 0.12 * joint - 0.16 * overhang + 0.12 * scar;
  } else if (uLayer == 1) {
    // Blocks and scree from above: big stones, smaller ones between, fine gravel; gaps dark.
    float id1;
    float id2;
    float s1 = stones(uv * 10.0, vec2(10.0), id1);
    float s2 = stones(uv * 27.0 + 0.37, vec2(27.0), id2);
    float grit = fbm(uv * 64.0, vec2(64.0), 3);
    h = max(s1 * 0.9, s2 * 0.55) + 0.12 * grit;
    float id = s1 * 0.9 > s2 * 0.55 ? id1 : id2;
    b = 0.5 + 0.22 * (id - 0.5) + 0.25 * (min(1.0, h * 1.6) - 0.6) + 0.06 * (grit - 0.5);
  } else if (uLayer == 2) {
    // Grass: tufts and blades (fine noise), clumps, a few bare or dry spots.
    float clump = fbm(uv * 6.0, vec2(6.0), 3);
    float tuft = fbm(uv * 48.0, vec2(48.0), 3);
    float blade = vnoise(uv * vec2(160.0, 140.0), vec2(160.0, 140.0));
    h = 0.45 * clump + 0.35 * tuft + 0.2 * blade;
    b = 0.5 + 0.16 * (clump - 0.5) + 0.18 * (tuft - 0.5) + 0.1 * (blade - 0.5);
  } else if (uLayer == 3) {
    // Canopy: crowns of several sizes (about 8 per tile side), their gaps in shadow.
    float id1;
    float id2;
    float c1 = stones(uv * 8.0, vec2(8.0), id1);
    float c2 = stones(uv * 15.0 + 0.21, vec2(15.0), id2) * 0.8;
    float leaf = fbm(uv * 96.0, vec2(96.0), 2);
    float c = max(c1, c2);
    h = c * (0.85 + 0.15 * leaf);
    float id = c1 > c2 ? id1 : id2;
    b = 0.5 + 0.12 * (id - 0.5) + 0.32 * (min(1.0, c * 1.4) - 0.7) + 0.08 * (leaf - 0.5);
  } else if (uLayer == 4) {
    // Snow: sastrugi, ripples stretched across the wind (u along the wind), sharp crests.
    float n = fbm(vec2(uv.x * 3.0, uv.y * 18.0) + vec2(0.0, 0.8 * fbm(uv * 4.0, vec2(4.0), 2)), vec2(3.0, 18.0), 4);
    float crest = 1.0 - abs(2.0 * n - 1.0);
    float grain = vnoise(uv * 128.0, vec2(128.0));
    h = 0.75 * crest * crest + 0.08 * grain;
    b = 0.5 + 0.05 * (crest - 0.5) + 0.03 * (grain - 0.5);
  } else if (uLayer == 5) {
    // Glacier ice: crevasses across the flow (v along the flow), bent and broken.
    float v = uv.y * 7.0 + 0.45 * fbm(vec2(uv.x * 2.0, uv.y * 2.0), vec2(2.0), 3);
    float f = abs(fract(v) - 0.5);
    float seg = smoothstep(0.35, 0.6, fbm(vec2(uv.x * 5.0, floor(v) * 1.7), vec2(5.0, 11.9), 2));
    float crev = (1.0 - smoothstep(0.0, 0.07, 0.5 - f)) * seg;
    float rough = fbm(uv * 32.0, vec2(32.0), 3);
    h = 0.75 - 0.7 * crev + 0.12 * rough;
    b = 0.5 - 0.35 * crev + 0.08 * (rough - 0.5);
  } else {
    // Fields: furrows (v across them), clods.
    float fur = 0.5 + 0.5 * sin(uv.y * 6.2831853 * 40.0 + 0.6 * fbm(uv * 3.0, vec2(3.0), 2));
    float clod = fbm(uv * 80.0, vec2(80.0), 3);
    h = 0.6 * fur + 0.4 * clod;
    b = 0.5 + 0.12 * (fur - 0.5) + 0.14 * (clod - 0.5);
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / uN;
  float e = 1.0 / uN;
  float h;
  float b;
  pattern(uv, h, b);
  float hx;
  float hy;
  float bb;
  pattern(fract(uv + vec2(e, 0.0)), hx, bb);
  pattern(fract(uv + vec2(0.0, e)), hy, bb);
  float hx0;
  float hy0;
  pattern(fract(uv - vec2(e, 0.0)), hx0, bb);
  pattern(fract(uv - vec2(0.0, e)), hy0, bb);
  // Slope in height units per texel: the normal's tilt is scaled in the shader using it.
  vec2 g = vec2(hx - hx0, hy - hy0) * 0.5 * uN / 64.0;
  vec3 n = normalize(vec3(-g, 1.0));
  fragColor = vec4(n.xy * 0.5 + 0.5, h, clamp(b, 0.0, 1.0));
}`;

/** The detail stack: drawn once (a few milliseconds) on the first frame that needs it. */
export class DetailTextures {
  readonly target: THREE.WebGLArrayRenderTarget;
  private ready = false;

  constructor(readonly size: number) {
    this.target = new THREE.WebGLArrayRenderTarget(size, size, DETAIL_LAYERS, { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false });
    const t = this.target.texture;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    // Storage with the whole mip chain; three.js regenerates it after each layer drawn.
    t.generateMipmaps = true;
    t.anisotropy = 1;
  }

  get texture(): THREE.Texture {
    return this.target.texture;
  }

  /** Draws the patterns (once) and their mip-maps. */
  build(r: THREE.WebGLRenderer): void {
    if (this.ready) return;
    const m = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: DETAIL_FS, glslVersion: THREE.GLSL3, uniforms: { uN: { value: this.size }, uLayer: { value: 0 } }, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    const pass = fullscreenPass(m);
    const cam = new THREE.Camera();
    r.initRenderTarget(this.target);
    for (let layer = 0; layer < DETAIL_LAYERS; layer++) {
      m.uniforms.uLayer.value = layer;
      r.setRenderTarget(this.target, layer);
      r.render(pass, cam);
    }
    r.setRenderTarget(null);
    m.dispose();
    pass.geometry.dispose();
    this.ready = true;
  }

  dispose(): void {
    this.target.dispose();
  }
}

/**
 * Per pixel in the landscape pass (after ATMO_GLSL and TERRAIN_GLSL): what the ground is
 * made of, from the photo's colour (its albedo once the reference light is taken out), the
 * slope, the altitude and the land cover of the wind model's grid (ESA WorldCover shares
 * of trees, bare ground, snow and ice, buildings around the point), and how it reflects:
 * micro-relief and brightness from the detail stack where the photo runs out of pixels,
 * forest canopies darker and hot-spotted, cliffs textured where the photo is stretched,
 * snow by season, altitude and exposure, glaciers, water with the sky's reflection and the
 * sun's glitter in ripples drawn by the wind.
 */
export const MATERIAL_GLSL = /* glsl */ `
uniform highp sampler2DArray uDetail;
uniform sampler2D uCover;
uniform vec4 uCoverRect;
uniform float uCoverOn;
// x: seasonal snow line (m, mid-slope, at this latitude), y: 1 = seasonal snow on.
uniform vec2 uSeason;
uniform vec2 uWindS;
uniform float uTimeS;
uniform float uPixAng;
uniform vec3 uAlbedoToX;
uniform float uMaterials;
uniform float uDetailOn;
uniform int uGDebug;
uniform vec3 uSunX;
uniform float uDetailN;
// Debug views 5 and 6 bypass the tone curve: raw values read back from screenshots.
vec3 gDbg = vec3(0.0);

float lum3(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float gHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float gNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// The ground position's change from a pixel to the next (computed once, where all the
// pixels of a quad run the same code): the patterns are filtered with it, anisotropically,
// so a slope seen edge-on does not shimmer.
vec3 gDx = vec3(0.0);
vec3 gDy = vec3(0.0);
// A detail texel of a pattern laid on the plane of axes (a, b) with a tile of T metres:
// slope (per unit of the pattern's height, per 1/64 of a tile), height, brightness offset.
vec4 gDetail(vec2 uv, vec2 dx, vec2 dy, float layer) {
  vec4 t = textureGrad(uDetail, vec3(uv, layer), dx, dy);
  vec2 n = t.rg * 2.0 - 1.0;
  float nz = sqrt(max(0.05, 1.0 - dot(n, n)));
  return vec4(-n / nz, t.b, t.a - 0.5);
}
vec4 gDetailXY(vec3 p, float T, float layer) { return gDetail(p.xy / T, gDx.xy / T, gDy.xy / T, layer); }
vec4 gDetailYZ(vec3 p, float T, float layer) { return gDetail(p.yz / T, gDx.yz / T, gDy.yz / T, layer); }
vec4 gDetailXZ(vec3 p, float T, float layer) { return gDetail(p.xz / T, gDx.xz / T, gDy.xz / T, layer); }
// Mip level for a tile of T metres seen with footprint m per pixel, and the detail's weight
// (fading out before the tile shrinks to a few pixels).
float gLod(float T, float foot) { return log2(max(foot * uDetailN / T, 1e-3)); }
float gFade(float lod) { return 1.0 - smoothstep(log2(uDetailN) - 5.5, log2(uDetailN) - 4.0, lod); }

struct Ground {
  vec3 albedo;   // in the landscape's units (photo radiance under the reference light)
  vec3 n;        // shading normal
  float forest;
  float rock;
  float snow;
  float ice;
  float water;
  float meadow;
  float crop;
  float built;
};

// Classes from the albedo (rho), the macro normal, altitude and the land cover around.
void gClassify(vec3 rho, vec3 N, vec3 pa, out float forest, out float meadow, out float crop, out float rock, out float ice, out float built, out float water) {
  float L = lum3(rho);
  float sum = rho.r + rho.g + rho.b + 1e-4;
  float green = rho.g / sum - 0.3333;
  float blue = rho.b / sum - 0.3333;
  float mx = max(max(rho.r, rho.g), rho.b);
  float sat = (mx - min(min(rho.r, rho.g), rho.b)) / max(mx, 1e-4);
  vec4 cov = vec4(0.0);
  if (uCoverOn > 0.5) cov = texture(uCover, (pa.xy - uCoverRect.xy) * uCoverRect.w);
  float pTrees = cov.r;
  float pBare = cov.g;
  float pSnow = cov.b;
  float pBuilt = cov.a;
  gDbg = vec3(L * 2.0, green + 0.3, pTrees);
  if (uGDebug == 6) gDbg = vec3(sat, pBare, pBuilt);
  // Thresholds read on the IGN orthophotos (albedo-like units): dense forest L 0.035-0.075,
  // green +0.02-0.07, saturation 0.25-0.4; meadows L 0.06-0.45, green +0.03-0.05; limestone
  // L 0.25-0.4, saturation < 0.15; lakes saturated cyan (0.55-0.66), L 0.05-0.14; glacier
  // L > 0.4; buildings' grey and red roofs where the land cover has buildings.
  float steep = smoothstep(0.72, 0.5, N.z);
  float flat_ = smoothstep(0.985, 0.998, N.z);
  float high = smoothstep(1900.0, 2600.0, pa.z);
  // Lakes: dead flat; their turquoise shallows, less saturated, along shores the elevations
  // do not quite flatten.
  float lakeFlat = max(smoothstep(0.999, 0.9999, N.z), smoothstep(0.98, 0.995, N.z) * smoothstep(0.06, 0.1, green + blue));
  water = smoothstep(0.38, 0.5, sat) * step(-0.02, green + blue) * smoothstep(0.22, 0.15, L) * lakeFlat * (1.0 - smoothstep(0.5, 0.85, pTrees));
  ice = smoothstep(0.3, 0.45, L) * smoothstep(0.35, 0.2, sat) * max(smoothstep(0.03, 0.2, pSnow), smoothstep(0.42, 0.6, L) * smoothstep(2400.0, 2900.0, pa.z)) * (1.0 - water);
  float veg = smoothstep(-0.01, 0.025, green);
  // Beyond ~60° the photo is a smear down the fall line: rock whatever it shows; steep
  // slopes up to there keep their forest when the photo is dark and green.
  float cliff = smoothstep(0.58, 0.45, N.z);
  forest = max(veg * smoothstep(0.13, 0.085, L) * mix(0.3, 1.0, smoothstep(0.1, 0.6, pTrees)), smoothstep(0.08, 0.05, L) * smoothstep(0.4, 0.8, pTrees));
  forest *= (1.0 - cliff) * (1.0 - water) * (1.0 - ice) * smoothstep(0.52, 0.42, sat);
  built = smoothstep(0.1, 0.35, pBuilt) * (1.0 - forest) * (1.0 - steep) * (1.0 - water) * (1.0 - 0.7 * veg);
  float grey = smoothstep(0.03, 0.005, green) * smoothstep(0.22, 0.1, sat);
  rock = max(max(cliff, steep * (1.0 - forest) * (1.0 - 0.7 * veg)), grey * max(smoothstep(0.16, 0.26, L), smoothstep(0.06, 0.12, L) * smoothstep(0.1, 0.35, pBare + 0.4 * high)));
  rock *= (1.0 - water) * (1.0 - ice) * (1.0 - built);
  // Grass and crops: the rest; fields on flat low ground away from woods and rock.
  float open_ = (1.0 - forest) * (1.0 - rock) * (1.0 - ice) * (1.0 - water) * (1.0 - built);
  float low = smoothstep(1300.0, 800.0, pa.z) * flat_ * (1.0 - smoothstep(0.2, 0.5, pTrees + pBare));
  crop = open_ * low * smoothstep(0.03, 0.06, L);
  meadow = open_ * (1.0 - low * 0.8) * smoothstep(0.02, 0.06, L);
}

// Ripples of a lake or a river: wind waves around the wind's direction, from capillary-like
// wavelets to waves of a few metres moving at their own speed; their slope (dz/dx, dz/dy)
// and, over a pixel too wide to show them, their slope variance (the water looks rougher).
vec2 gWaves(vec2 p, float t, float ws, float foot, out float variance) {
  vec2 wd = ws > 0.2 ? uWindS / ws : vec2(0.7071, 0.7071);
  float steep = 0.02 + 0.05 * smoothstep(0.5, 8.0, ws);
  vec2 g = vec2(0.0);
  variance = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ang = (fi - 2.0) * 0.42 + 0.3 * sin(fi * 7.1);
    vec2 d = vec2(wd.x * cos(ang) - wd.y * sin(ang), wd.x * sin(ang) + wd.y * cos(ang));
    float lam = 0.35 * pow(2.0, fi) * (0.6 + 0.4 * smoothstep(1.0, 8.0, ws));
    float k = 6.2831853 / lam;
    float c = sqrt(9.81 / k);
    float a = steep / k;
    // A wave narrower than ~3 pixels only adds roughness.
    float vis = smoothstep(3.0 * foot, 6.0 * foot, lam);
    float ph = k * dot(d, p) - k * c * t + fi * 1.7;
    g += d * (a * k * cos(ph)) * vis;
    variance += 0.5 * (a * k) * (a * k) * (1.0 - vis);
  }
  return g;
}

// GGX normal distribution and Smith's visibility, Schlick's Fresnel.
float gGgx(float nh, float a) {
  float a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159265 * d * d);
}
float gVis(float nv, float nl, float a) {
  float k = a * 0.5;
  return 0.25 / ((nv * (1.0 - k) + k) * (nl * (1.0 - k) + k));
}

// The ground at pa under the light of the hour. xd: the photo's radiance with the reference
// light's slope shading taken out (an albedo in the landscape's units); xdSmooth: the same
// smoothed across the fall line (cliffs); snowX: fresh snow as the photos show it; V:
// towards the eye; sunVis: the sun through the clouds.
vec3 gShade(vec3 xd, vec3 xdSmooth, vec3 snowX, vec3 pa, vec3 V, float dist, Relief rf, float sunVis) {
  gDx = dFdx(pa);
  gDy = dFdy(pa);
  vec3 N0 = rf.n;
  vec3 L = uSunDir;
  float forest; float meadow; float crop; float rock; float ice; float built; float water;
  gClassify(xd / uAlbedoToX, N0, pa, forest, meadow, crop, rock, ice, built, water);
  // Metres per pixel on the ground (more at grazing angles).
  float foot = max(dist, 1.0) * uPixAng / sqrt(max(abs(dot(N0, V)), 0.06));
  if (uGDebug == 8 || uDetailOn < 0.5) foot = 1e6;
  // Where the photo runs out of pixels (its texels ~0.2-0.5 m), the detail's brightness takes over.
  float near = 1.0 - smoothstep(0.25, 0.9, foot);
  float stretch = smoothstep(0.62, 0.32, N0.z);
  vec3 albedo = mix(xd, xdSmooth, stretch * rock);
  // Bright rock faces: the photos burn them out (the camera's curve read backwards makes
  // them whiter than limestone is): toned down where the face is steep.
  albedo *= 1.0 - 0.22 * rock * stretch * smoothstep(0.25, 0.45, lum3(xd / uAlbedoToX));
  vec3 grad = vec3(0.0);
  float bright = 0.0;
  float ao = 1.0;
  // Seasonal snow: above the season's line, lower on north faces, higher on south ones,
  // patchy near the line, not on faces steeper than ~55°, hidden under the trees.
  float slopeLen = length(N0.xy);
  float north = slopeLen > 1e-3 ? N0.y / slopeLen * smoothstep(0.03, 0.25, slopeLen) : 0.0;
  float snow = 0.0;
  if (uSeason.y > 0.5 && pa.z > uSeason.x - 700.0) {
    float zEff = pa.z + 280.0 * north + 170.0 * (gNoise(pa.xy / 700.0) - 0.5) + 70.0 * (gNoise(pa.xy / 85.0) - 0.5);
    snow = smoothstep(uSeason.x - 140.0, uSeason.x + 140.0, zEff) * smoothstep(0.48, 0.7, N0.z) * (1.0 - water);
    // Outcrops dark in the photo on slopes past ~35° shed it.
    snow *= 1.0 - 0.6 * smoothstep(0.85, 0.6, N0.z) * smoothstep(0.2, 0.08, lum3(xd / uAlbedoToX));
  }
  // Under the trees the snow is mostly hidden by the crowns.
  snow *= 1.0 - 0.82 * forest;
  float iceAll = max(ice, snow);
#ifndef GROUND_LOW
  // --- Rock: strata on the faces (two side projections), blocks and scree on top.
  if (rock > 0.02 && foot < 9.5) {
    vec3 w = pow(abs(N0), vec3(4.0));
    w /= w.x + w.y + w.z;
    float lod = gLod(18.0, foot);
    float fd = gFade(lod);
    float bA = max(near, stretch) * 0.75;
    if (fd > 0.0 && w.x > 0.04) { vec4 d = gDetailYZ(pa, 18.0, 0.0); grad += rock * w.x * fd * 2.2 * vec3(0.0, d.x, d.y); bright += rock * w.x * d.w * bA * fd; }
    if (fd > 0.0 && w.y > 0.04) { vec4 d = gDetailXZ(pa, 18.0, 0.0); grad += rock * w.y * fd * 2.2 * vec3(d.x, 0.0, d.y); bright += rock * w.y * d.w * bA * fd; }
    // The beds of a whole cliff (a few metres thick), visible from kilometres away where the
    // photo has nothing to show but a smear.
    float lodB = gLod(150.0, foot);
    float fB = gFade(lodB) * smoothstep(0.85, 0.55, N0.z);
    if (fB > 0.0) {
      vec2 sh = vec2(0.31, 0.17);
      if (w.x > 0.04) { vec4 d = gDetailYZ(pa + vec3(0.0, sh * 150.0), 150.0, 0.0); grad += rock * w.x * fB * 2.4 * vec3(0.0, d.x, d.y); bright += rock * w.x * d.w * fB * mix(0.25, 0.6, stretch); }
      if (w.y > 0.04) { vec4 d = gDetailXZ(pa + vec3(sh.x * 150.0, 0.0, sh.y * 150.0), 150.0, 0.0); grad += rock * w.y * fB * 2.4 * vec3(d.x, 0.0, d.y); bright += rock * w.y * d.w * fB * mix(0.25, 0.6, stretch); }
    }
    float lod2 = gLod(9.0, foot);
    float f2 = gFade(lod2);
    if (f2 > 0.0 && w.z > 0.04) {
      vec4 d = gDetailXY(pa, 9.0, 1.0);
      grad += rock * w.z * f2 * 2.8 * vec3(d.x, d.y, 0.0);
      bright += rock * w.z * d.w * near * 0.8 * f2;
      ao *= mix(1.0, 0.72 + 0.4 * d.z, rock * w.z * f2);
    }
  }
  // --- Forest canopy: crowns, dark gaps.
  if (forest > 0.02 && foot < 2.7) {
    float lod = gLod(42.0, foot);
    float fd = gFade(lod);
    if (fd > 0.0) {
      vec4 d = gDetailXY(pa, 42.0, 3.0);
      grad += forest * fd * 7.0 * vec3(d.x, d.y, 0.0);
      bright += forest * d.w * fd * mix(0.5, 1.0, near);
      ao *= mix(1.0, 0.55 + 0.6 * d.z, forest * fd);
    }
  }
  // --- Meadows and alpine pastures: tufts, and patches at a larger scale.
  if (meadow > 0.02 && foot < 1.5) {
    float lod = gLod(3.0, foot);
    float fd = gFade(lod);
    if (fd > 0.0) {
      vec4 d = gDetailXY(pa, 3.0, 2.0);
      grad += meadow * fd * 2.0 * vec3(d.x, d.y, 0.0);
      bright += meadow * d.w * near * fd * 1.5;
    }
    float lodP = gLod(23.0, foot);
    float fP = gFade(lodP);
    if (fP > 0.0) bright += meadow * gDetailXY(pa + 8.5, 23.0, 2.0).w * 0.6 * near * fP;
  }
  // --- Fields: furrows, each field (a ~120 m cell) ploughed its own way.
  if (crop > 0.02 && foot < 0.8) {
    vec2 cell = floor(pa.xy / 120.0);
    float a = gHash(cell) * 3.14159;
    vec2 q = vec2(cos(a) * pa.x + sin(a) * pa.y, -sin(a) * pa.x + cos(a) * pa.y);
    float lod = gLod(12.0, foot);
    float fd = gFade(lod);
    if (fd > 0.0) {
      mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
      vec4 d = gDetail(q / 12.0, rot * gDx.xy / 12.0, rot * gDy.xy / 12.0, 6.0);
      vec2 gd = vec2(cos(a) * d.x - sin(a) * d.y, sin(a) * d.x + cos(a) * d.y);
      grad += crop * fd * 1.1 * vec3(gd, 0.0);
      bright += crop * d.w * near * fd;
    }
  }
  // --- Snow (sastrugi across the wind) and glacier ice (crevasses across the flow).
  if (iceAll > 0.02 && foot < 3.8) {
    float ws = length(uWindS);
    vec2 wd = ws > 0.2 ? uWindS / ws : vec2(1.0, 0.0);
    vec2 q = vec2(dot(pa.xy, wd), dot(pa.xy, vec2(-wd.y, wd.x)));
    float lod = gLod(12.0, foot);
    float fd = gFade(lod);
    if (fd > 0.0) {
      vec2 qx = vec2(dot(gDx.xy, wd), dot(gDx.xy, vec2(-wd.y, wd.x)));
      vec2 qy = vec2(dot(gDy.xy, wd), dot(gDy.xy, vec2(-wd.y, wd.x)));
      vec4 d = gDetail(q / 12.0, qx / 12.0, qy / 12.0, 4.0);
      vec2 gd = d.x * wd + d.y * vec2(-wd.y, wd.x);
      grad += iceAll * fd * 0.8 * vec3(gd, 0.0);
      bright += iceAll * d.w * near * fd * 0.5;
    }
    // Crevasses on glaciers that slope (the flow goes down the fall line).
    if (ice > 0.05 && slopeLen > 0.12) {
      vec2 fl = -N0.xy / slopeLen;
      vec2 q2 = vec2(dot(pa.xy, vec2(-fl.y, fl.x)), dot(pa.xy, fl));
      float lodI = gLod(60.0, foot);
      float fI = gFade(lodI);
      if (fI > 0.0) {
        vec2 ax = vec2(-fl.y, fl.x);
        vec4 d = gDetail(q2 / 60.0, vec2(dot(gDx.xy, ax), dot(gDx.xy, fl)) / 60.0, vec2(dot(gDy.xy, ax), dot(gDy.xy, fl)) / 60.0, 5.0);
        vec2 gd = d.x * vec2(-fl.y, fl.x) + d.y * fl;
        float k = ice * fI * smoothstep(0.12, 0.3, slopeLen);
        grad += k * 2.0 * vec3(gd, 0.0);
        bright += k * d.w * 0.9;
        ao *= mix(1.0, 0.55 + 0.45 * d.z, k);
      }
    }
  }
#endif
  // Snow on the ground: bright, a touch blue; the photo's own snow and ice keep their colour.
  albedo = mix(albedo, snowX, snow);
  albedo *= 1.0 + 2.0 * clamp(bright, -0.32, 0.32);
  // The shading normal: the micro-relief's slope projected on the surface.
  vec3 N = normalize(N0 - (grad - dot(grad, N0) * N0));
  // --- Water: the ripples' normal.
  float wv = 0.0;
  if (water > 0.02) {
    float ws = length(uWindS);
    vec2 wg = gWaves(pa.xy, uTimeS, ws, foot, wv);
    N = normalize(mix(N, normalize(vec3(-wg, 1.0)), water));
  }
  float nl = max(dot(N, L), 0.0);
  float nl0 = max(dot(N0, L), 0.0);
  // Micro-relief shadows: a face turned from the sun inside a lit slope stays dark, but the
  // detail cannot cast light where the relief is in shadow.
  float sun = sunVis * rf.sun;
  // Forest canopies: their own shadows grow as the sun sinks; brighter facing away from the
  // sun (the hot spot: the shadows hidden behind the crowns), darker against it.
  float vl = dot(V, L);
  float canopy = mix(1.0, (0.6 + 0.4 * smoothstep(0.05, 0.6, L.z)) * (1.0 + 0.45 * exp((vl - 1.0) * 14.0) - 0.15 * max(0.0, -vl)), forest);
  float skyOpen = (0.5 + 0.5 * N.z) * rf.sky * ao;
  vec3 E = uSunNorm * nl * sun * canopy * mix(1.0, ao, 0.6) + uSkyGain * skyOpen + uGroundGain * (0.5 - 0.5 * N.z) * ao;
  vec3 col = albedo * E;
  vec3 H = normalize(L + V);
  float nv = max(dot(N, V), 1e-3);
  float nh = max(dot(N, H), 0.0);
  float vh = max(dot(V, H), 0.0);
  float fres = pow(clamp(1.0 - vh, 0.0, 1.0), 5.0);
  // Snow and ice: a soft forward sheen, and glints of crystals close by.
  if (iceAll > 0.02 && nl > 0.0) {
    float a = mix(0.45, 0.25, ice);
    float F = 0.03 + 0.97 * fres;
    col += iceAll * uSunX * (gGgx(nh, a) * gVis(nv, nl, a) * F * nl) * sun;
    if (foot < 0.08) {
      vec2 cell = floor(pa.xy / 0.04);
      float glint = step(0.9985, gHash(cell));
      col += iceAll * glint * (1.0 - foot / 0.08) * uSunX * 0.6 * nl * sun * smoothstep(0.9, 1.0, nh);
    }
  }
  // Water: what shows through (the photo's colour, its own reflections taken out), the sky
  // reflected (darker towards the horizon where the shores and mountains stand) and the
  // sun's glitter, the wider the rougher the water.
  if (water > 0.02) {
    vec3 R = reflect(-V, N);
    R.z = abs(R.z);
    float F = 0.02 + 0.98 * pow(clamp(1.0 - nv, 0.0, 1.0), 5.0);
    vec3 sky = atmoSky(normalize(R)) * mix(0.35, 1.0, smoothstep(0.02, 0.3, R.z));
    float a = clamp(sqrt(0.0016 + 2.0 * wv), 0.04, 0.5);
    vec3 glint = uSunX * (gGgx(nh, a) * gVis(nv, nl, a) * (0.02 + 0.98 * fres) * nl) * sun;
    vec3 wcol = albedo * 0.55 * E * (1.0 - F) + sky * F + glint;
    col = mix(col, wcol, water);
  }
  if (uGDebug == 1) {
    vec3 k = vec3(1.0, 0.0, 1.0) * max(0.0, 1.0 - forest - meadow - crop - rock - iceAll - built - water);
    k += forest * vec3(0.05, 0.3, 0.08) + meadow * vec3(0.45, 0.85, 0.3) + crop * vec3(0.9, 0.8, 0.2) + rock * vec3(0.5) + iceAll * vec3(1.0) + built * vec3(0.9, 0.2, 0.15) + water * vec3(0.1, 0.3, 1.0);
    return k * uAlbedoToX * (uSkyGain + uSunNorm * 0.6);
  }
  if (uGDebug == 2) return (N * 0.5 + 0.5) * uAlbedoToX;
  if (uGDebug == 3) return vec3(rf.sun * sunVis) * uAlbedoToX;
  if (uGDebug == 4) return vec3(rf.sky * ao) * uAlbedoToX;
  return col;
}
`;
