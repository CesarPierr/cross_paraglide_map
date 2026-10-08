/**
 * GLSL port of the conceptual wind model (src/model/field.ts → evalCell).
 * Keep both in sync: the JS version is the reference (unit-tested, CPU
 * fallback), this one drives the interactive GPU rendering.
 */
import { EARTH_CIRCUMFERENCE } from '@brises/model';
import { RULES, SUN_SAMPLES_MAX } from '@brises/model';

const f = (v: number) => (Number.isInteger(v) ? `${v}.0` : `${v}`);

export const MODEL_GLSL = `
const float PI = 3.141592653589793;
const float CIRC = ${EARTH_CIRCUMFERENCE.toFixed(3)};

uniform highp sampler2D tZ;   // z, gx, gy, tpi
uniform highp sampler2D tV;   // floor, env, axisX, axisY
uniform highp sampler2D tW;   // valley, lakeX, lakeY, water
uniform highp sampler2D tR;   // seaX, seaY, plainX, plainY
uniform highp sampler2D tC;   // curated layers main, cond: (index + weight, flow angle) × 2 (curated.ts → packCuratedLayers)
uniform highp sampler2D tC2;  // curated thin layer (slope, katabatic): index + weight, flow angle; documented hazard: index + weight
uniform highp sampler2D tB;   // per curated breeze: speedMs, activity, layer kind (0 deep, 1 valley, 2 slope, 3 katabatic), 0;
                              // then from uHazBase, per documented hazard: 0, activity, effect (0 lee, 1 venturi, 2 turbulence), 0
uniform int uHazBase;
uniform highp sampler2D tInsol;
uniform ivec2 uGrid;
uniform float uPy0;
uniform float uWorldPx;
uniform float uNight;
uniform float uSunElev;
uniform float uSeason;
uniform float uValleyPhase;
uniform float uWaterPhase;
uniform float uThermalDecline;   // field.ts → thermalDecline
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
const float R_VALLEY_JET = ${f(RULES.valleyProfile[0])};
const float R_VALLEY_TOP = ${f(RULES.valleyProfile[1])};
const float R_ANTI = ${f(RULES.valleyAntiwind)};
const vec4 R_ANTI_ZONE = vec4(${RULES.valleyAntiwindZone.map(f).join(', ')});
const vec2 R_CUR_SLOPE = vec2(${RULES.curatedSlopeLayer.map(f).join(', ')});
const vec2 R_CUR_KATA = vec2(${RULES.curatedKatabaticLayer.map(f).join(', ')});
const vec2 R_SUN_H = vec2(${RULES.thermalSunHours.map(f).join(', ')});
const float R_CUR_DEEP = ${f(RULES.curatedDeepDepth)};
const float R_CUR_ALIGN = ${f(RULES.curatedAlignWeight)};
const float R_PLAIN_MAX = ${f(RULES.plainBreezeMax)};
const float R_LAKE_MAX = ${f(RULES.lakeBreezeMax)};
const float R_SEA_MAX = ${f(RULES.seaBreezeMax)};
const float R_OVERRIDE = ${f(RULES.synopticOverrideKmh)};
const float R_LEE0 = ${f(RULES.leeAngle[0])};
const float R_LEE1 = ${f(RULES.leeAngle[1])};
const float R_VENTURI = ${f(RULES.venturiGain)};
const float R_LEE_SHARE = ${f(RULES.leeHeightShare)};
const float SHELTER[${RULES.shelterSteps.length}] = float[](${RULES.shelterSteps.map(f).join(', ')});
const float CONF[3] = float[](4.0, 8.0, 13.0);

struct Cell {
  vec2 slope; vec2 valley; vec2 curated; vec2 regional; vec2 breeze; vec2 synoptic; vec2 total;
  float elev; float hAgl; float under; float slopeDeg; float aspect; float insol; float level; float depth;
  float cw; float cidx; float wb; float shelter; float lee; float venturi; float chan; float dyn; float thermal; float turb;
  float hidx; float hw;
};

float cellSize(int j) {
  float my = (uPy0 + float(j) + 0.5) / uWorldPx;
  float lat = atan(sinh(PI * (1.0 - 2.0 * my)));
  return CIRC * cos(lat) / uWorldPx;
}

bool inside(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < uGrid.x && p.y < uGrid.y; }

ivec2 stepCell(ivec2 c, vec2 dir, float d) { return ivec2(floor(vec2(c) + dir * d + 0.5)); }

// Packed curated layer (index + weight, angle) → index, weight, unit direction.
struct Cur { int idx; float w; vec2 t; };
Cur unpackCur(vec2 v) {
  Cur r;
  r.idx = v.x < 0.0 ? -1 : int(floor(v.x));
  r.w = v.x < 0.0 ? 0.0 : fract(v.x);
  r.t = vec2(cos(v.y), sin(v.y));
  return r;
}

// Along-valley wind vs height (field.ts → valleyProfile).
float valleyProfile(float zeta) {
  float core = 1.0 - smoothstep(R_VALLEY_JET, R_VALLEY_TOP, zeta);
  float anti = R_ANTI * smoothstep(R_ANTI_ZONE.x, R_ANTI_ZONE.y, zeta) * (1.0 - smoothstep(R_ANTI_ZONE.z, R_ANTI_ZONE.w, zeta));
  return core - anti;
}

Cell evalCell(ivec2 c) {
  Cell o;
  vec4 Z = texelFetch(tZ, c, 0);
  vec4 V = texelFetch(tV, c, 0);
  vec4 W = texelFetch(tW, c, 0);
  vec4 R = texelFetch(tR, c, 0);
  vec4 CU = texelFetch(tC, c, 0);
  vec4 CT = texelFetch(tC2, c, 0);
  float z = Z.x;
  float h = uHeightMode < 0.5 ? uHeightM : uHeightM - z;
  o.elev = z;
  o.hAgl = h;
  o.under = h < 0.0 ? 1.0 : 0.0;
  float hh = max(h, 5.0);
  float gmag = length(Z.yz);
  o.slopeDeg = degrees(atan(gmag));
  o.aspect = gmag > 1e-6 ? mod(degrees(atan(-Z.y, -Z.z)) + 360.0, 360.0) : 0.0;
  vec2 IN = texelFetch(tInsol, c, 0).rg;   // insolation, sunshine hours since sunrise
  float insol = IN.x;
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

  // Valley breeze: jet in the lower valley, zero at crest height, weak antiwind above.
  float vPhase = uValleyPhase * (uValleyPhase > 0.0 ? uSeason : 1.0);
  float vProfile = valleyProfile(level);
  float vSpeed = R_VALLEY_MAX * vPhase * W.x * vProfile * uBreezeScale;
  o.valley = -V.zw * vSpeed;

  // Plain, lake and sea breezes.
  float plainPhase = max(uValleyPhase, -0.2) * uSeason;
  float wPhase = uWaterPhase * (uWaterPhase > 0.0 ? uSeason : 1.0);
  // Not added to the valley wind inside valley channels (field.ts).
  o.regional = (R_PLAIN_MAX * plainPhase * exp(-hh / 900.0) * R.zw
    + R_LAKE_MAX * wPhase * exp(-hh / 250.0) * W.yz
    + R_SEA_MAX * wPhase * exp(-hh / 700.0) * R.xy) * (1.0 - W.x) * uBreezeScale;

  // Curated breezes (field.ts): main layer, or the conditional one when its condition holds.
  o.cw = 0.0;
  o.cidx = -1.0;
  o.curated = vec2(0.0);
  Cur curM = unpackCur(CU.xy);
  Cur curC = unpackCur(CU.zw);
  float actM = curM.idx >= 0 ? texelFetch(tB, ivec2(curM.idx, 0), 0).y : 0.0;
  float actC = curC.idx >= 0 ? texelFetch(tB, ivec2(curC.idx, 0), 0).y : 0.0;
  if (curC.idx >= 0 && curC.w * actC > curM.w * actM * (1.0 - actC)) curM = curC;
  if (curM.idx >= 0) {
    vec4 B = texelFetch(tB, ivec2(curM.idx, 0), 0);
    // hf: override weight, vf: speed factor with height.
    float hf = 1.0;
    float vf = max(exp(-hh / R_CUR_DEEP), vProfile);
    if (B.z > 0.5) {
      hf = 1.0 - smoothstep(R_ANTI_ZONE.z, R_ANTI_ZONE.w, level);
      vf = vProfile;
    }
    o.cw = curM.w * hf * B.y;
    o.curated = curM.t * B.x * B.y * vf * uBreezeScale;
    o.cidx = float(curM.idx);
    // Generic valley wind turned to the documented sense, or following its hours.
    float agree = dot(-V.zw, curM.t) * uValleyPhase;
    if (agree < 0.0) o.valley *= 1.0 - 2.0 * smoothstep(0.0, R_CUR_ALIGN, curM.w * B.y);
    else if (uValleyPhase > 0.0) o.valley *= 1.0 - smoothstep(0.0, R_CUR_ALIGN, curM.w) * (1.0 - B.y);
  }
  vec2 b = o.slope + (o.valley + o.regional) * (1.0 - o.cw) + o.curated * o.cw;
  // Thin layer: documented slope / katabatic breeze near the ground.
  Cur curT = unpackCur(CT.xy);
  if (curT.idx >= 0) {
    vec4 B = texelFetch(tB, ivec2(curT.idx, 0), 0);
    vec2 lay = B.z > 2.5 ? R_CUR_KATA : R_CUR_SLOPE;
    float tw = curT.w * B.y * (1.0 - smoothstep(lay.x, lay.y, hh));
    vec2 tv = curT.t * B.x * B.y * uBreezeScale;
    b = b * (1.0 - tw) + tv * tw;
    if (tw > o.cw) {
      o.curated = tv;
      o.cidx = float(curT.idx);
      o.cw = tw;
    }
  }

  // Synoptic wind: shelter (Winstral Sx) along the upwind direction.
  float z0 = z + hh;
  float zs = z + hh * R_LEE_SHARE;  // the lee hugs the slope (field.ts)
  float cs = cellSize(c.y);
  float maxTan = -1.0;
  float conf = 0.0;
  if (uGSpeed > 0.05) {
    for (int s = 0; s < ${RULES.shelterSteps.length}; s++) {
      ivec2 p = stepCell(c, uUp, SHELTER[s]);
      if (!inside(p)) break;
      maxTan = max(maxTan, (texelFetch(tZ, p, 0).r - zs) / (SHELTER[s] * cs));
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
  float convexF = 0.55 + 0.45 * smoothstep(-60.0, 140.0, Z.w);
  float windF = 1.0 - 0.6 * smoothstep(20.0, 45.0, uGKmh);
  // Onset per slope from the sunshine it received since sunrise (field.ts → thermalOnset).
  float dayF = smoothstep(R_SUN_H.x, R_SUN_H.y, IN.y) * uThermalDecline;
  o.thermal = W.w > 0.5 ? 0.0 : day * clamp(insol * uSeason * elevF * convexF * windF * dayF, 0.0, 1.0);
  o.turb = clamp(o.lee * smoothstep(8.0, 35.0, uGKmh) + o.venturi * smoothstep(15.0, 45.0, uGKmh) * 0.6, 0.0, 1.0);
  // Documented hazards matching the synoptic wind (field.ts).
  o.hidx = -1.0;
  o.hw = 0.0;
  if (CT.z >= 0.0) {
    float hi = floor(CT.z);
    vec4 HB = texelFetch(tB, ivec2(uHazBase + int(hi), 0), 0);
    float a = fract(CT.z) * HB.y;
    if (a > 0.0) {
      o.hidx = hi;
      o.hw = a;
      if (HB.z < 0.5) { o.lee = max(o.lee, a); o.turb = max(o.turb, 0.8 * a); }
      else if (HB.z < 1.5) { o.venturi = max(o.venturi, a); o.turb = max(o.turb, 0.5 * a); }
      else o.turb = max(o.turb, 0.8 * a);
    }
  }
  return o;
}
`;

/**
 * Pass 1 (time dependent only): instantaneous insolation with cast shadows (r) and
 * sunshine received since sunrise, in hours of full sun on the slope, without cast
 * shadows (g; field.ts → computeTimeContext, sun path from sun.ts → sunSamples).
 */
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
uniform vec4 uSunS[${SUN_SAMPLES_MAX}];   // sun path since sunrise: unit vector, weight (h)
uniform int uSunN;
out vec4 outColor;
const float PI = 3.141592653589793;
const float CIRC = ${EARTH_CIRCUMFERENCE.toFixed(3)};
const float STEPS[14] = float[](1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 11.0, 15.0, 20.0, 26.0, 34.0, 44.0, 56.0, 70.0);
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 Z = texelFetch(tZ, c, 0);
  vec3 n = vec3(-Z.y, -Z.z, 1.0);
  float inv = 1.0 / length(n);
  float sunH = 0.0;
  for (int i = 0; i < ${SUN_SAMPLES_MAX}; i++) {
    if (i >= uSunN) break;
    float cs = dot(n, uSunS[i].xyz) * inv;
    if (cs > 0.0) sunH += uSunS[i].w * cs;
  }
  float cosInc = dot(n, uSun) * inv;
  if (cosInc <= 0.0 || uAtten <= 0.0) { outColor = vec4(0.0, sunH, 0.0, 1.0); return; }
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
  outColor = vec4(cosInc * (1.0 - shade) * uAtten, sunH, 0.0, 1.0);
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

/** Probe: 9 texels, each a group of 4 values of the cell breakdown. */
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
  else if (k == 7) outColor = vec4(o.turb, L.x, o.under, L.y);
  else outColor = vec4(o.hidx, o.hw, 0.0, 0.0);
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
