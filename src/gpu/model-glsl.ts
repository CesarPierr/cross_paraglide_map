/**
 * GLSL port of the conceptual wind model (src/model/field.ts → evalCell).
 * Keep both in sync: the JS version is the reference (unit-tested, CPU
 * fallback), this one drives the interactive GPU rendering.
 */
import { EARTH_CIRCUMFERENCE } from '../model/grid';
import { RULES } from '../model/rules';

const f = (v: number) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

export const MODEL_GLSL = `
const float PI = 3.141592653589793;
const float CIRC = ${EARTH_CIRCUMFERENCE.toFixed(3)};

uniform highp sampler2D tZ;   // z, gx, gy, tpi
uniform highp sampler2D tV;   // floor, env, axisX, axisY
uniform highp sampler2D tW;   // valley, lakeX, lakeY, water
uniform highp sampler2D tR;   // seaX, seaY, plainX, plainY
uniform highp sampler2D tC;   // curated weight, tx, ty, index
uniform highp sampler2D tB;   // per curated breeze: speedMs, activity, valleyKind, 0
uniform highp sampler2D tInsol;
uniform ivec2 uGrid;
uniform float uPy0;
uniform float uWorldPx;
uniform float uNight;
uniform float uSunElev;
uniform float uSeason;
uniform float uValleyPhase;
uniform float uWaterPhase;
uniform vec2 uG;
uniform float uGSpeed;
uniform float uGKmh;
uniform vec2 uUp;
uniform float uHeightMode;
uniform float uHeightM;
uniform float uBreezeScale;

const float R_SLOPE_MAX = ${f(RULES.slopeBreezeMax)};
const float R_SLOPE_DEPTH = ${f(RULES.slopeBreezeDepth)};
const float R_KATABATIC = ${f(RULES.katabaticMax)};
const float R_VALLEY_MAX = ${f(RULES.valleyBreezeMax)};
const float R_PLAIN_MAX = ${f(RULES.plainBreezeMax)};
const float R_LAKE_MAX = ${f(RULES.lakeBreezeMax)};
const float R_SEA_MAX = ${f(RULES.seaBreezeMax)};
const float R_OVERRIDE = ${f(RULES.synopticOverrideKmh)};
const float R_LEE0 = ${f(RULES.leeAngle[0])};
const float R_LEE1 = ${f(RULES.leeAngle[1])};
const float R_VENTURI = ${f(RULES.venturiGain)};
const float SHELTER[${RULES.shelterSteps.length}] = float[](${RULES.shelterSteps.map(f).join(', ')});
const float CONF[3] = float[](4.0, 8.0, 13.0);

struct Cell {
  vec2 slope; vec2 valley; vec2 curated; vec2 regional; vec2 breeze; vec2 synoptic; vec2 total;
  float elev; float hAgl; float under; float slopeDeg; float aspect; float insol; float level; float depth;
  float cw; float cidx; float wb; float shelter; float lee; float venturi; float chan; float dyn; float thermal; float turb;
};

float cellSize(int j) {
  float my = (uPy0 + float(j) + 0.5) / uWorldPx;
  float lat = atan(sinh(PI * (1.0 - 2.0 * my)));
  return CIRC * cos(lat) / uWorldPx;
}

bool inside(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < uGrid.x && p.y < uGrid.y; }

ivec2 stepCell(ivec2 c, vec2 dir, float d) { return ivec2(floor(vec2(c) + dir * d + 0.5)); }

Cell evalCell(ivec2 c) {
  Cell o;
  vec4 Z = texelFetch(tZ, c, 0);
  vec4 V = texelFetch(tV, c, 0);
  vec4 W = texelFetch(tW, c, 0);
  vec4 R = texelFetch(tR, c, 0);
  vec4 CU = texelFetch(tC, c, 0);
  float z = Z.x;
  float h = uHeightMode < 0.5 ? uHeightM : uHeightM - z;
  o.elev = z;
  o.hAgl = h;
  o.under = h < 0.0 ? 1.0 : 0.0;
  float hh = max(h, 5.0);
  float gmag = length(Z.yz);
  o.slopeDeg = degrees(atan(gmag));
  o.aspect = gmag > 1e-6 ? mod(degrees(atan(-Z.y, -Z.z)) + 360.0, 360.0) : 0.0;
  float insol = texelFetch(tInsol, c, 0).r;
  o.insol = insol;
  float depth = max(V.y - V.x, 150.0);
  float level = (z + hh - V.x) / depth;
  o.level = level;
  o.depth = V.y - V.x;

  // Slope breeze.
  float slopeForce = uNight > 0.5 ? -R_KATABATIC / R_SLOPE_MAX : insol * (0.55 + 0.45 * uSeason) - 0.08;
  float slopeFactor = clamp(sin(atan(gmag)) * 2.2, 0.0, 1.0);
  float slopeSpeed = R_SLOPE_MAX * slopeForce * slopeFactor * exp(-hh / R_SLOPE_DEPTH) * uBreezeScale;
  o.slope = gmag > 1e-6 ? Z.yz / gmag * slopeSpeed : vec2(0.0);

  // Valley breeze.
  float vPhase = uValleyPhase * (uValleyPhase > 0.0 ? uSeason : 1.0);
  float inValley = 1.0 - smoothstep(0.45, 0.95, level);
  float vSpeed = R_VALLEY_MAX * vPhase * W.x * inValley * uBreezeScale;
  o.valley = -V.zw * vSpeed;

  // Plain, lake and sea breezes.
  float plainPhase = max(uValleyPhase, -0.2) * uSeason;
  float wPhase = uWaterPhase * (uWaterPhase > 0.0 ? uSeason : 1.0);
  o.regional = (R_PLAIN_MAX * plainPhase * exp(-hh / 900.0) * R.zw
    + R_LAKE_MAX * wPhase * exp(-hh / 250.0) * W.yz
    + R_SEA_MAX * wPhase * exp(-hh / 700.0) * R.xy) * uBreezeScale;

  // Curated breezes.
  o.cw = 0.0;
  o.cidx = -1.0;
  o.curated = vec2(0.0);
  if (CU.x > 0.0) {
    int idx = int(CU.w + 0.5);
    vec4 B = texelFetch(tB, ivec2(idx, 0), 0);
    float hf = B.z > 0.5 ? 1.0 - smoothstep(0.5, 1.0, level) : exp(-hh / 1200.0);
    o.cw = CU.x * hf;
    o.curated = CU.yz * B.x * B.y * uBreezeScale;
    o.cidx = float(idx);
  }
  vec2 b = o.slope + (o.valley + o.regional) * (1.0 - o.cw) + o.curated * o.cw;

  // Synoptic wind: shelter (Winstral Sx) along the upwind direction.
  float z0 = z + hh;
  float cs = cellSize(c.y);
  float maxTan = -1.0;
  float conf = 0.0;
  if (uGSpeed > 0.05) {
    for (int s = 0; s < ${RULES.shelterSteps.length}; s++) {
      ivec2 p = stepCell(c, uUp, SHELTER[s]);
      if (!inside(p)) break;
      maxTan = max(maxTan, (texelFetch(tZ, p, 0).r - z0) / (SHELTER[s] * cs));
    }
    vec2 perp = vec2(-uUp.y, uUp.x);
    float left = -1e9;
    float right = -1e9;
    for (int q = 0; q < 3; q++) {
      ivec2 l = stepCell(c, perp, CONF[q]);
      ivec2 r = stepCell(c, -perp, CONF[q]);
      if (inside(l)) left = max(left, texelFetch(tZ, l, 0).r - z0);
      if (inside(r)) right = max(right, texelFetch(tZ, r, 0).r - z0);
    }
    conf = smoothstep(120.0, 650.0, min(left, right));
  }
  o.shelter = degrees(atan(maxTan));
  o.lee = uGSpeed > 0.05 ? smoothstep(R_LEE0, R_LEE1, o.shelter) : 0.0;
  o.venturi = conf * (1.0 - o.lee);
  o.chan = W.x * (1.0 - smoothstep(0.35, 0.9, level));
  float along = dot(uG, V.zw);
  vec2 cc = uG + (V.zw * along * 1.15 - uG) * 0.85 * o.chan;
  float fh = (0.3 + 0.7 * smoothstep(-0.1, 1.05, level)) * (0.75 + 0.25 * smoothstep(0.0, 400.0, hh));
  float sf = fh * (1.0 - 0.85 * o.lee) * (1.0 + R_VENTURI * o.venturi);
  float rotor = 0.25 * o.lee * smoothstep(10.0, 30.0, uGKmh) * (1.0 - o.chan);
  o.synoptic = cc * sf - uG * rotor;

  float wb = clamp(1.2 - uGKmh / R_OVERRIDE, 0.15, 1.0);
  wb = max(wb, max(clamp(0.6 * W.x * (1.0 - level), 0.0, 0.8), 0.7 * o.lee));
  o.wb = wb;
  o.breeze = b;
  o.total = b * wb + o.synoptic;
  o.dyn = dot(o.synoptic, Z.yz) * exp(-hh / 350.0);

  float day = uSunElev > 5.0 ? 1.0 : 0.0;
  float elevF = 0.55 + 0.45 * smoothstep(400.0, 2200.0, z);
  float convexF = 0.7 + 0.3 * smoothstep(-40.0, 120.0, Z.w);
  float windF = 1.0 - 0.6 * smoothstep(20.0, 45.0, uGKmh);
  float dayF = max(0.0, uValleyPhase) * 0.5 + 0.5;
  o.thermal = W.w > 0.5 ? 0.0 : day * clamp(insol * uSeason * elevF * convexF * windF * dayF * 1.25, 0.0, 1.0);
  o.turb = clamp(o.lee * smoothstep(8.0, 35.0, uGKmh) + o.venturi * smoothstep(15.0, 45.0, uGKmh) * 0.6, 0.0, 1.0);
  return o;
}
`;

/** Pass 1: insolation with cast shadows (time dependent only). */
export const INSOLATION_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D tZ;
uniform ivec2 uGrid;
uniform float uPy0;
uniform float uWorldPx;
uniform vec3 uSun;        // unit vector east, north, up
uniform float uTanEl;
uniform float uAtten;     // low-sun attenuation
uniform vec2 uSunStep;    // grid step towards the sun
out vec4 outColor;
const float PI = 3.141592653589793;
const float CIRC = ${EARTH_CIRCUMFERENCE.toFixed(3)};
const float STEPS[14] = float[](1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 11.0, 15.0, 20.0, 26.0, 34.0, 44.0, 56.0, 70.0);
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 Z = texelFetch(tZ, c, 0);
  vec3 n = vec3(-Z.y, -Z.z, 1.0);
  float cosInc = dot(n, uSun) / length(n);
  if (cosInc <= 0.0 || uAtten <= 0.0) { outColor = vec4(0.0); return; }
  float my = (uPy0 + float(c.y) + 0.5) / uWorldPx;
  float lat = atan(sinh(PI * (1.0 - 2.0 * my)));
  float cs = CIRC * cos(lat) / uWorldPx;
  float z0 = Z.x + 2.0;
  float shade = 0.0;
  for (int s = 0; s < 14; s++) {
    ivec2 p = ivec2(floor(vec2(c) + uSunStep * STEPS[s] + 0.5));
    if (p.x < 0 || p.y < 0 || p.x >= uGrid.x || p.y >= uGrid.y) break;
    float rise = texelFetch(tZ, p, 0).r - z0 - STEPS[s] * cs * uTanEl;
    if (rise > 0.0) {
      shade = max(shade, clamp(rise / 60.0, 0.0, 1.0));
      if (shade >= 1.0) break;
    }
  }
  outColor = vec4(cosInc * (1.0 - shade) * uAtten, 0.0, 0.0, 1.0);
}`;

/** Pass 2: the wind field (MRT). */
export const FIELD_FS = `#version 300 es
precision highp float;
precision highp int;
${MODEL_GLSL}
layout(location = 0) out vec4 outField;   // u, v, dynamic lift, turbulence
layout(location = 1) out vec4 outAux;     // thermal, lee, venturi, insolation
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  Cell o = evalCell(c);
  if (o.under > 0.5) {
    outField = vec4(0.0);
    outAux = vec4(0.0);
    return;
  }
  outField = vec4(o.total, o.dyn, o.turb);
  outAux = vec4(o.thermal, o.lee, o.venturi, o.insol);
}`;

/** Pass 3: convergence (smoothed divergence) and total lift. */
export const LIFT_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D tField;
uniform highp sampler2D tAux;
uniform ivec2 uGrid;
uniform float uPy0;
uniform float uWorldPx;
uniform float uDepth;
out vec4 outLift;   // convergence (m/s), total lift (m/s)
const float PI = 3.141592653589793;
const float CIRC = ${EARTH_CIRCUMFERENCE.toFixed(3)};
vec2 uv(ivec2 p) { return texelFetch(tField, clamp(p, ivec2(0), uGrid - 1), 0).xy; }
float div(ivec2 p, float cs) {
  float dudx = (uv(p + ivec2(1, 0)).x - uv(p - ivec2(1, 0)).x) / (2.0 * cs);
  float dvdy = -(uv(p + ivec2(0, 1)).y - uv(p - ivec2(0, 1)).y) / (2.0 * cs);
  return dudx + dvdy;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float my = (uPy0 + float(c.y) + 0.5) / uWorldPx;
  float cs = CIRC * cos(atan(sinh(PI * (1.0 - 2.0 * my)))) / uWorldPx;
  float d = 4.0 * div(c, cs)
    + 2.0 * (div(c + ivec2(1, 0), cs) + div(c - ivec2(1, 0), cs) + div(c + ivec2(0, 1), cs) + div(c - ivec2(0, 1), cs))
    + div(c + ivec2(1, 1), cs) + div(c + ivec2(-1, 1), cs) + div(c + ivec2(1, -1), cs) + div(c + ivec2(-1, -1), cs);
  float conv = -(d / 16.0) * uDepth;
  vec4 F = texelFetch(tField, c, 0);
  vec4 A = texelFetch(tAux, c, 0);
  float lift = A.x * 2.5 + max(F.z, -1.5) + clamp(conv, -1.5, 2.5);
  outLift = vec4(conv, lift, 0.0, 1.0);
}`;

/** Probe: 8 texels, each a group of 4 values of the cell breakdown. */
export const PROBE_FS = `#version 300 es
precision highp float;
precision highp int;
${MODEL_GLSL}
uniform ivec2 uCell;
uniform highp sampler2D tLift;
out vec4 outColor;
void main() {
  int k = int(gl_FragCoord.x);
  Cell o = evalCell(uCell);
  vec4 L = texelFetch(tLift, uCell, 0);
  if (k == 0) outColor = vec4(o.total, o.synoptic);
  else if (k == 1) outColor = vec4(o.slope, o.valley);
  else if (k == 2) outColor = vec4(o.curated, o.regional);
  else if (k == 3) outColor = vec4(o.elev, o.hAgl, o.slopeDeg, o.aspect);
  else if (k == 4) outColor = vec4(o.insol, o.level, o.depth, o.cw);
  else if (k == 5) outColor = vec4(o.cidx, o.wb, o.shelter, o.lee);
  else if (k == 6) outColor = vec4(o.venturi, o.chan, o.dyn, o.thermal);
  else outColor = vec4(o.turb, L.x, o.under, L.y);
}`;

/** Downsampled thermal maxima for hotspot picking: max thermal and its offset in the block. */
export const HOTSPOT_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D tAux;
uniform ivec2 uGrid;
uniform int uBlock;
out vec4 outColor;
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * uBlock;
  float best = 0.0;
  vec2 at = vec2(0.0);
  for (int j = 0; j < 8; j++) {
    if (j >= uBlock) break;
    for (int i = 0; i < 8; i++) {
      if (i >= uBlock) break;
      ivec2 p = min(b + ivec2(i, j), uGrid - 1);
      float t = texelFetch(tAux, p, 0).x;
      if (t > best) { best = t; at = vec2(p); }
    }
  }
  outColor = vec4(best, at, 1.0);
}`;

/** Samples fields at a list of cells (one texel per point). */
export const SAMPLE_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D tField;
uniform highp sampler2D tAux;
uniform highp sampler2D tLift;
uniform ivec2 uCells[64];
out vec4 outColor;
void main() {
  ivec2 c = uCells[int(gl_FragCoord.x)];
  vec4 F = texelFetch(tField, c, 0);
  vec4 A = texelFetch(tAux, c, 0);
  vec4 L = texelFetch(tLift, c, 0);
  outColor = vec4(A.x, L.y, length(F.xy), A.y);
}`;
