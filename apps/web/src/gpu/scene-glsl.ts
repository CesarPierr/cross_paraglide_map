/** GLSL for the 3D scene layers (particles, breeze comets, thermal bubbles) and the draped analysis. */
import { EARTH_CIRCUMFERENCE } from '@brises/model';

/** Shared vertex-side helpers: grid ↔ mercator, ground height, projection. */
export const SCENE_COMMON = `
const float PI = 3.141592653589793;
const float CIRC = ${EARTH_CIRCUMFERENCE.toFixed(3)};
uniform mat4 uMatrix;
uniform vec4 uGridMerc;     // grid mercator bounds minX, minY, maxX, maxY
uniform vec2 uGridSize;     // cells
uniform highp sampler2D tHeight;  // MapLibre rendered terrain heights (m, exaggerated)
uniform vec4 uHeightBounds; // its mercator bounds
uniform float uHeightOn;
uniform highp sampler2D tZ;       // model DEM fallback
uniform float uExag;
uniform vec2 uViewport;     // half drawing-buffer size

vec2 toMerc(vec2 cell) { return uGridMerc.xy + cell / uGridSize * (uGridMerc.zw - uGridMerc.xy); }

float metersToMerc(float my) { return cosh(PI * (1.0 - 2.0 * my)) / CIRC; }

float groundAt(vec2 m) {
  if (uHeightOn > 0.5) {
    vec2 huv = vec2((m.x - uHeightBounds.x) / (uHeightBounds.z - uHeightBounds.x), (uHeightBounds.w - m.y) / (uHeightBounds.w - uHeightBounds.y));
    if (huv.x > 0.0 && huv.y > 0.0 && huv.x < 1.0 && huv.y < 1.0) {
      vec4 h = texture(tHeight, huv);
      if (h.a > 0.5) return h.r;
    }
  }
  vec2 uv = (m - uGridMerc.xy) / (uGridMerc.zw - uGridMerc.xy);
  return max(texture(tZ, uv).r, 0.0) * uExag;
}

vec4 projectM(vec2 m, float zMeters) { return uMatrix * vec4(m, zMeters * metersToMerc(m.y), 1.0); }

/** Screen-space ribbon expansion of point c0 towards c1. */
vec4 ribbon(vec4 c0, vec4 c1, float side, float widthPx, bool flip) {
  vec2 s0 = c0.xy / c0.w * uViewport;
  vec2 s1 = c1.xy / c1.w * uViewport;
  vec2 dir = s1 - s0;
  if (flip) dir = -dir;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  c0.xy += normal * side * widthPx / uViewport * c0.w;
  return c0;
}

vec3 speedRamp(float kmh) {
  vec3 c0 = vec3(0.82, 0.93, 1.00);
  vec3 c1 = vec3(0.33, 0.83, 1.00);
  vec3 c2 = vec3(0.55, 0.98, 0.50);
  vec3 c3 = vec3(1.00, 0.86, 0.28);
  vec3 c4 = vec3(1.00, 0.47, 0.18);
  vec3 c5 = vec3(0.96, 0.18, 0.45);
  if (kmh < 5.0) return mix(c0, c1, kmh / 5.0);
  if (kmh < 12.0) return mix(c1, c2, (kmh - 5.0) / 7.0);
  if (kmh < 22.0) return mix(c2, c3, (kmh - 12.0) / 10.0);
  if (kmh < 35.0) return mix(c3, c4, (kmh - 22.0) / 13.0);
  // Legend (ui/Legend.tsx): 0, 5, 12, 22, 35, 50+ km/h — full pink at 50 km/h.
  return mix(c4, c5, clamp((kmh - 35.0) / 15.0, 0.0, 1.0));
}

vec3 liftRamp(float w) {
  if (w < 0.0) return mix(vec3(0.86, 0.91, 1.0), vec3(0.25, 0.47, 1.0), clamp(-w / 2.0, 0.0, 1.0));
  return mix(vec3(0.88, 0.96, 0.86), vec3(1.0, 0.56, 0.12), clamp(w / 3.0, 0.0, 1.0));
}
`;

const PCG = `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd(inout uint s) { s = pcg(s); return float(s) / 4294967295.0; }
`;

/** Particle state update: advect in grid cells, respawn near the camera inside the view. */
export const PARTICLE_UPDATE_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D tState;   // cell x, cell y, age 0..1, lifetime s
uniform highp sampler2D tField;
uniform vec2 uGridSize;
uniform vec4 uView;     // spawn bounds in cells
uniform vec3 uCam;      // camera ground position (cells) and height (cells)
uniform float uDt;
uniform float uAccel;   // cells per (m/s) per second
uniform uint uFrame;
uniform float uReset;
uniform float uPy0;
uniform float uWorldPx;
out vec4 outState;
const float PI = 3.141592653589793;
${PCG}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(tState, c, 0);
  vec2 p = s.xy;
  float age = s.z + uDt / max(s.w, 0.1);
  float life = s.w;
  bool dead = age >= 1.0 || uReset > 0.5 || p.x < 0.0 || p.y < 0.0 || p.x >= uGridSize.x || p.y >= uGridSize.y;
  if (!dead) {
    vec4 f = texture(tField, p / uGridSize);
    // Cells shrink towards the north: scale by the latitude ratio within the grid.
    float my = (uPy0 + p.y) / uWorldPx;
    float myc = (uPy0 + uGridSize.y * 0.5) / uWorldPx;
    float k = cosh(PI * (1.0 - 2.0 * my)) / cosh(PI * (1.0 - 2.0 * myc));
    p += vec2(f.x, -f.y) * k * uDt * uAccel;
    if (p.x < uView.x || p.x > uView.z || p.y < uView.y || p.y > uView.w) dead = true;
    // Calm air: recycle faster so particles go where things happen.
    if (length(f.xy) < 0.25) age += uDt * 0.8;
  }
  if (dead) {
    uint seed = uint(c.x) * 1973u + uint(c.y) * 9277u + uFrame * 26699u;
    vec2 q = p;
    for (int t = 0; t < 10; t++) {
      q = uView.xy + vec2(rnd(seed), rnd(seed)) * (uView.zw - uView.xy);
      vec2 d = q - uCam.xy;
      float w = min(1.0, uCam.z * uCam.z * 2.5 / (dot(d, d) + 1e-6));
      if (rnd(seed) < w) break;
    }
    p = q;
    age = rnd(seed) * 0.25;
    life = 1.6 + rnd(seed) * 2.6;
  }
  outState = vec4(p, age, life);
}`;

export const TRAIL = 10;

/** Particle ribbons: streamline integrated backwards from the head on the GPU. */
export const PARTICLE_VS = `#version 300 es
precision highp float;
precision highp int;
${SCENE_COMMON}
uniform highp sampler2D tState;
uniform highp sampler2D tField;
uniform highp sampler2D tLift;
uniform int uStateW;
uniform float uTrailStep;   // cells per (m/s) per trail step
uniform float uHeight;
uniform float uAsl;
uniform float uWidth;
uniform float uColorMode;
uniform float uLiftZ;
uniform float uTime;
uniform float uZoomAlpha;
out vec4 vColor;
out float vSide;
const int T = ${TRAIL};

vec4 fieldAt(vec2 cell) { return texture(tField, cell / uGridSize); }

vec4 project(vec2 cell, float turb, float lift) {
  vec2 m = toMerc(cell);
  float ground = groundAt(m);
  float z = uAsl > 0.5 ? max(uHeight * uExag, ground + 25.0 * uExag) : ground + uHeight * uExag;
  z += clamp(lift, -2.0, 3.0) * uLiftZ * uExag;
  return projectM(m, z);
}

void main() {
  int id = gl_InstanceID;
  vec4 st = texelFetch(tState, ivec2(id % uStateW, id / uStateW), 0);
  int idx = gl_VertexID / 2;
  float side = (gl_VertexID % 2 == 0) ? -1.0 : 1.0;
  vec2 p = st.xy;
  vec2 pPrev = p;
  vec4 f0 = fieldAt(p);
  for (int i = 0; i < T; i++) {
    if (i >= idx) break;
    vec4 f = fieldAt(p);
    pPrev = p;
    p -= vec2(f.x, -f.y) * uTrailStep;
  }
  vec4 fp = fieldAt(p);
  vec2 pNext = p - vec2(fp.x, -fp.y) * uTrailStep;
  float lift = texture(tLift, p / uGridSize).y;
  vec4 c0 = project(p, fp.w, lift);
  vec4 c1 = idx < T ? project(pNext, fp.w, lift) : project(pPrev, fp.w, lift);
  float t = float(idx) / float(T);
  // Turbulent air (lee, venturi): the ribbon wobbles.
  float wob = sin(uTime * 11.0 + float(id) * 1.7 + t * 9.0) * fp.w * 2.6;
  gl_Position = ribbon(c0, c1, side, uWidth * (1.0 - 0.72 * t) + abs(wob) * 0.4, idx >= T);
  gl_Position.xy += vec2(wob, -wob) / uViewport * gl_Position.w * 0.6;

  float speed = length(f0.xy);
  float age = st.z;
  float lifeAlpha = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.78, 1.0, age));
  float calm = smoothstep(0.15, 1.0, speed);
  vec3 col = uColorMode > 0.5 ? liftRamp(texture(tLift, st.xy / uGridSize).y) : speedRamp(speed * 3.6);
  float a = lifeAlpha * calm * (1.0 - t) * 0.92 * uZoomAlpha;
  vColor = vec4(col * a, a);
  vSide = side;
}`;

export const RIBBON_FS = `#version 300 es
precision highp float;
in vec4 vColor;
in float vSide;
out vec4 fragColor;
void main() {
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  fragColor = vColor * (0.35 + 0.65 * edge);
}`;

/** Breeze comets: CPU supplies trail points (cells) with their neighbour. */
export const COMET_VS = `#version 300 es
precision highp float;
${SCENE_COMMON}
in vec2 aPos;
in vec2 aNext;
in vec4 aColor;     // rgb, alpha
in vec2 aMeta;      // t along trail (0 head), side
uniform float uHeight;
uniform float uWidth;
out vec4 vColor;
out float vSide;
void main() {
  vec2 m0 = toMerc(aPos);
  vec2 m1 = toMerc(aNext);
  vec4 c0 = projectM(m0, groundAt(m0) + uHeight * uExag);
  vec4 c1 = projectM(m1, groundAt(m1) + uHeight * uExag);
  float t = aMeta.x;
  gl_Position = ribbon(c0, c1, aMeta.y, uWidth * (1.0 - 0.8 * t), false);
  float a = aColor.a * (1.0 - t) * (1.0 - t);
  vColor = vec4(mix(vec3(1.0), aColor.rgb, 0.35 + 0.65 * t) * a, a);
  vSide = aMeta.y;
}`;

/** Thermal bubbles rising and spiralling above hotspots, drifting downwind. */
export const BUBBLE_VS = `#version 300 es
precision highp float;
precision highp int;
${SCENE_COMMON}
uniform vec4 uHot[96];       // mercator x, y, strength, seed
uniform int uPerHot;
uniform float uTime;
uniform vec2 uDrift;         // mercator offset per metre of climb (downwind tilt)
uniform float uSize;
out vec4 vColor;
out vec2 vUv;
void main() {
  int h = gl_InstanceID / uPerHot;
  int b = gl_InstanceID % uPerHot;
  vec4 hot = uHot[h];
  float strength = hot.z;
  float fb = float(b) / float(uPerHot);
  float phase = fract(uTime * (0.05 + 0.05 * strength) + fb + hot.w);
  float top = 350.0 + 1900.0 * strength;
  float climb = phase * top;
  float ang = phase * 9.0 + fb * 6.2831 + hot.w * 20.0;
  float radius = (25.0 + 110.0 * phase) * metersToMerc(hot.y);
  vec2 m = hot.xy + vec2(cos(ang), sin(ang)) * radius + uDrift * climb;
  float ground = groundAt(hot.xy);
  float zc = ground + (20.0 + climb) * uExag;
  vec4 c = projectM(m, zc);
  // World-sized bubbles (radius ~40-120 m): project a point above to get the on-screen size.
  vec4 cu = projectM(m, zc + (40.0 + 80.0 * phase) * (0.6 + 0.4 * strength) * uExag);
  float px = clamp(length((cu.xy / cu.w - c.xy / c.w) * uViewport), 1.2, uSize * 3.0);
  vec2 corner = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1) * 2.0 - 1.0;
  c.xy += corner * px / uViewport * c.w;
  gl_Position = c;
  vUv = corner;
  float a = smoothstep(0.0, 0.12, phase) * (1.0 - smoothstep(0.7, 1.0, phase)) * (0.35 + 0.65 * strength);
  vec3 col = mix(vec3(1.0, 0.96, 0.82), vec3(1.0, 0.58, 0.2), phase * 0.8);
  vColor = vec4(col * a, a);
}`;

export const BUBBLE_FS = `#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vUv;
out vec4 fragColor;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float ring = smoothstep(1.0, 0.75, r) * (0.55 + 0.45 * smoothstep(0.2, 0.75, r));
  fragColor = vColor * ring;
}`;

/** Draped analysis: quad covering the grid inside a terrain tile, colour-mapped from the engine fields. */
export const DRAPE_VS = `#version 300 es
precision highp float;
uniform vec4 uRect;   // clip-space rect of the grid in this tile: x0, y0 (north-west), x1, y1 (south-east)
out vec2 vUv;
void main() {
  vec2 corner = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1);
  vUv = corner;
  gl_Position = vec4(mix(uRect.xy, uRect.zw, corner), 0.0, 1.0);
}`;

export const DRAPE_FS = `#version 300 es
precision highp float;
uniform highp sampler2D tField;
uniform highp sampler2D tAux;
uniform highp sampler2D tLift;
uniform int uMode;      // 1 exposure, 2 thermal, 3 convergence, 4 lift, 5 speed
uniform float uWindOn;
uniform float uGKmh;
uniform float uOpacity;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec4 F = texture(tField, vUv);
  vec4 A = texture(tAux, vUv);
  vec4 L = texture(tLift, vUv);
  vec3 col = vec3(0.0);
  float a = 0.0;
  if (uMode == 1) {
    float lee = A.y * uWindOn;
    float ven = A.z * smoothstep(10.0, 30.0, uGKmh);
    if (lee > 0.3) {
      col = vec3(0.92, 0.25, 0.2);
      a = 0.55 * smoothstep(0.3, 1.0, lee) * (0.4 + 0.6 * smoothstep(10.0, 30.0, uGKmh));
    } else if (F.z > 0.25) {
      float s = smoothstep(0.25, 2.5, F.z);
      col = vec3(0.16 + 0.12 * (1.0 - s), 0.82, 0.43);
      a = 0.2 + 0.5 * s;
    }
    if (ven > 0.15 && ven * 0.6 > a) {
      col = vec3(1.0, 0.67, 0.12);
      a = 0.6 * ven;
    }
  } else if (uMode == 2) {
    float t = A.x;
    if (t > 0.35) {
      float s = smoothstep(0.35, 0.9, t);
      col = vec3(1.0, (230.0 - 170.0 * s) / 255.0, 60.0 * (1.0 - s) / 255.0);
      a = 0.08 + 0.6 * s * s;
    }
  } else if (uMode == 3) {
    float c = L.x;
    if (c > 0.12) {
      float s = smoothstep(0.12, 1.4, c);
      col = vec3(0.84, (60.0 + 40.0 * (1.0 - s)) / 255.0, 1.0);
      a = 0.15 + 0.65 * s;
    } else if (c < -0.25) {
      col = vec3(0.24, 0.47, 0.9);
      a = 0.35 * smoothstep(0.25, 1.5, -c);
    }
  } else if (uMode == 4) {
    float l = L.y;
    if (l > 0.3) {
      float s = smoothstep(0.3, 3.5, l);
      col = vec3((80.0 + 175.0 * s) / 255.0, (220.0 - 60.0 * s) / 255.0, 0.24);
      a = 0.15 + 0.6 * s;
    } else if (l < -0.4) {
      col = vec3(0.2, 0.43, 0.92);
      a = 0.45 * smoothstep(0.4, 2.0, -l);
    }
  } else if (uMode == 5) {
    float kmh = length(F.xy) * 3.6;
    vec3 c0 = vec3(0.25, 0.55, 0.95);
    vec3 c1 = vec3(0.3, 0.85, 0.75);
    vec3 c2 = vec3(1.0, 0.85, 0.3);
    vec3 c3 = vec3(0.95, 0.3, 0.3);
    col = kmh < 12.0 ? mix(c0, c1, kmh / 12.0) : kmh < 25.0 ? mix(c1, c2, (kmh - 12.0) / 13.0) : mix(c2, c3, clamp((kmh - 25.0) / 20.0, 0.0, 1.0));
    a = 0.2 + 0.4 * smoothstep(3.0, 40.0, kmh);
  }
  a *= uOpacity;
  fragColor = vec4(col * a, a);
}`;
