/**
 * The game's world: the site's 3D map (IGN orthophotos, Sentinel-2 elsewhere, terrain,
 * buildings) seen through a free camera at the pilot's eyes or behind him, and a three.js
 * layer in the same WebGL context for what MapLibre does not draw: the sky and the light
 * (sky.ts: physically based sky, haze and relighting of the landscape, cloud shadows),
 * the cumulus, the glider, the thermals (when shown) and windsocks on the take-offs and
 * landings. World objects are positioned in metres east/north/up around an anchor near
 * the camera, the projection matrix being composed in double precision, so a wing a few
 * metres away does not jitter; the cockpit (first person) is drawn last in its own frame.
 *
 * The custom layer's frame: offscreen work (atmosphere tables, cloud shadow map, clouds
 * at reduced resolution), then the landscape relit and hazed and the sky behind it, the
 * three.js objects, the clouds composited against the terrain's depth, the sun's glare,
 * and the cockpit or the chase view.
 */
import { Map as MlMap, Marker, setMaxParallelImageRequests, MercatorCoordinate, type CustomLayerInterface, type HillshadeLayerSpecification, type LayerSpecification, type MapOptions, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { buildStyle } from '../map/style';
import type { AtlasFeature } from '@brises/shared';
import type { CloudInfo } from './airmass';
import type { GliderState } from './flight';
import type { LocalFrame } from './geo';
import { buildGlider, type GliderModel } from './glider';
import { Sky, type FrameInfo } from './sky';
import { ThermalFlows, Vultures } from './life';
import { Forest } from './trees';

export type ViewMode = 'first' | 'third';

export interface Head {
  /** Look direction relative to the pilot (rad): + = right, + = up. */
  yaw: number;
  pitch: number;
}

const DEG = 180 / Math.PI;
/**
 * Pilot's eyes in the glider frame: seated and leaning back, about 0.3 m above and behind
 * the carabiners, so risers, brake handles and the pod sit in the lower part of the view.
 */
const EYE = [0, 0.32, 0.34] as const;

function gameStyle(): StyleSpecification {
  const style = buildStyle();
  // Sentinel-2 only as a low-resolution backdrop (outside France and while IGN loads).
  (style.sources.s2 as { maxzoom?: number }).maxzoom = 12;
  style.sources.ofm = { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © OpenMapTiles © OpenStreetMap' };
  style.layers = style.layers
    .filter((l) => l.type !== 'background' || l.id === 'background')
    .map((l) => (l.id === 'hillshade' ? { ...l, paint: { ...(l as HillshadeLayerSpecification).paint, 'hillshade-exaggeration': 0.28 } } : l))
    // Where imagery is still loading: a dull land colour rather than night blue (it is hazed like the rest).
    .map((l) => (l.id === 'background' ? { ...l, paint: { 'background-color': '#5d6352' } } : l)) as LayerSpecification[];
  style.layers.push({
    id: 'buildings',
    type: 'fill-extrusion',
    source: 'ofm',
    'source-layer': 'building',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': '#d9d2c5',
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.92,
    },
  });
  style.sky = {
    'sky-color': '#3f7bc8',
    'horizon-color': '#cfdff0',
    'fog-color': '#dbe6f1',
    'sky-horizon-blend': 0.7,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.35,
    'atmosphere-blend': 0,
  };
  return style;
}

/** Rotation of the glider frame (x right, y up, z back) into east/north/up, with its attitude. */
export function gliderQuaternion(heading: number, bank: number, pitch: number, out = new THREE.Quaternion()): THREE.Quaternion {
  const qh = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -heading);
  const qb = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -bank);
  const qp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch);
  return out.copy(qh).multiply(qb).multiply(qr).multiply(qp);
}

/** A name tag: text on a transparent plane (turned towards the camera every frame). */
function nameTag(name: string): THREE.Mesh {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const ctx = cv.getContext('2d')!;
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeText(name, 128, 32);
  ctx.fillStyle = '#fff';
  ctx.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  return m;
}

function mul4(a: ArrayLike<number>, b: ArrayLike<number>, out: Float64Array): Float64Array {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export class GameWorld {
  readonly map: MlMap;
  private renderer: THREE.WebGLRenderer | null = null;
  private worldScene = new THREE.Scene();
  private cockpitScene = new THREE.Scene();
  private worldCam = new THREE.Camera();
  private cockpitCam = new THREE.PerspectiveCamera(70, 1, 0.03, 60);
  readonly glider: GliderModel;
  private gliderWorld = new THREE.Group();
  /** Third person: the glider drawn in its own pass (MapLibre's near plane would clip it). */
  private chaseScene = new THREE.Scene();
  private chaseCam = new THREE.PerspectiveCamera(66, 1, 0.5, 400);
  private chaseSun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  private chaseHemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b6a55, 1.1);
  /** Phones and small screens: fewer ray-marching steps, clouds at a third of the resolution. */
  readonly lowQuality = typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700);
  readonly sky: Sky;
  /** Share of the sun reaching the pilot through the clouds (0..1). */
  private sunlight = 1;
  private sunBase = { glider: 2.2 };
  /** Last conditions given to setAtmosphere (re-applied when the cumulus base moves). */
  private conditions: { azimuth: number; elevation: number; humidity: number; instability: number; cover: number } | null = null;
  /** Median cumulus base (m): the top of the hazy convective layer. */
  private hazeTop = 0;
  /** The landscape pass works (MapLibre's terrain depth found): MapLibre's fog stays off. */
  private groundPass = false;
  /** This frame's camera for the sky passes, from prerender to render. */
  private frameInfo: FrameInfo | null = null;
  /** Rising red motes in the thermals (when shown) and vultures. */
  readonly flows: ThermalFlows;
  readonly vultures: Vultures;
  private socks = new THREE.Group();
  /** Forests near the ground, task cylinders, the other pilots (absolute local metres, in `rel`). */
  readonly forest: Forest;
  private taskGroup = new THREE.Group();
  private peers = new Map<string, { model: GliderModel; group: THREE.Group; label: THREE.Mesh }>();
  /** World objects in absolute local metres, shifted by -anchor every frame. */
  private rel = new THREE.Group();
  private sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  private cockpitSun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  private hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b6a55, 1.1);
  private cockpitHemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b6a55, 1.2);
  private qInv = new THREE.Quaternion();
  private eye = new THREE.Vector3();
  private lastFrame = performance.now();
  private wind: [number, number] = [0, 0];
  /** Pause « point topo »: map from above, interactive. */
  topo = false;
  private pilotMarker: Marker | null = null;
  private anchor = { x: 0, y: 0, z: 0 };
  private fovDeg = 66;
  view: ViewMode = 'first';
  ready: Promise<void>;
  private loaded = false;

  constructor(
    container: HTMLElement,
    readonly frame: LocalFrame,
    start: { x: number; y: number; z: number },
  ) {
    const [lon, lat] = frame.toLngLat(start.x, start.y);
    setMaxParallelImageRequests(24);
    this.map = new MlMap({
      container,
      style: gameStyle(),
      center: [lon, lat],
      // Straight down at first: few tiles to wait for; the free camera takes over at once.
      zoom: 13,
      pitch: 0,
      maxPitch: 180,
      interactive: true,
      attributionControl: { compact: true },
      fadeDuration: 0,
      // Turning the head back finds its tiles in the cache.
      maxTileCacheSize: 3000,
      canvasContextAttributes: { antialias: true },
    } as MapOptions);
    // Handlers exist but stay off while flying; the topo pause turns pan and zoom on.
    for (const h of [this.map.dragPan, this.map.scrollZoom, this.map.boxZoom, this.map.dragRotate, this.map.keyboard, this.map.doubleClickZoom, this.map.touchZoomRotate, this.map.touchPitch]) h.disable();
    // The sky and the clouds need float render targets (half floats are enough); without
    // them MapLibre's sky and fog stay and the clouds are drawn straight into the frame.
    const gl = this.map.getCanvas().getContext('webgl2');
    const floatTargets = !!gl && !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.sky = new Sky(this.lowQuality, floatTargets);
    this.glider = buildGlider();
    this.gliderWorld.add(this.glider.root);
    this.flows = new ThermalFlows(this.lowQuality ? 1200 : 2600);
    // Griffon vultures: common in the southern Prealps, rarer northwards.
    this.vultures = new Vultures(frame.lat0 < 44.9 ? 0.75 : frame.lat0 < 45.4 ? 0.45 : 0.2);
    this.forest = new Forest(this.lowQuality ? 1500 : 4000);
    this.rel.add(this.flows.points, this.vultures.group, this.socks, this.forest.group, this.taskGroup);
    this.worldScene.add(this.rel);
    this.chaseScene.add(this.gliderWorld, this.chaseSun, this.chaseHemi);
    this.chaseCam.up.set(0, 0, 1);
    this.worldScene.add(this.hemi, this.sun);
    this.cockpitScene.add(this.cockpitHemi, this.cockpitSun);
    this.ready = new Promise((resolve) => {
      // The style is enough to start: tiles keep streaming while flying.
      this.map.once('style.load', () => {
        this.map.setTerrain({ source: 'terrain', exaggeration: 1 });
        // A free camera: the point it looks at may be in the air (looking at the horizon).
        this.map.setCenterClampedToGround(false);
        this.map.setVerticalFieldOfView(this.fovDeg);
        // Detail near the pilot, decaying fast towards the horizon, and a bounded tile count:
        // looking at the horizon MapLibre would otherwise queue a thousand tiles and the
        // ones under the wing would wait behind the far ones.
        this.map.setSourceTileLodParams(4, 2.5, 'ign-ortho');
        this.map.setSourceTileLodParams(3, 1.5, 's2');
        this.map.setSourceTileLodParams(6, 3, 'terrain');
        this.map.addLayer(this.layer());
        this.loaded = true;
        resolve();
      });
    });
    this.setView('first');
  }

  setView(v: ViewMode): void {
    this.view = v;
    (v === 'first' ? this.cockpitScene : this.gliderWorld).add(this.glider.root);
    this.glider.pilot.visible = v === 'third';
  }

  /**
   * Light of the hour: sun direction and colour, sky and haze, imagery brightness (dawn and
   * dusk darken and warm the landscape), shading of the relief from the real sun.
   */
  setAtmosphere(azimuth: number, elevation: number, humidity: number, instability: number, cover = 0): void {
    this.conditions = { azimuth, elevation, humidity, instability, cover };
    const a = azimuth / DEG;
    const e = elevation / DEG;
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)).normalize();
    this.sun.position.copy(dir);
    // The haze fills the convective layer, up to about the cumulus base (from the clouds in
    // view, else the air mass's formula for a valley floor).
    const hazeTop = this.hazeTop > 0 ? this.hazeTop : 1400 + (1 - humidity) * 2800;
    const k = this.sky.setLight(dir, elevation, humidity, instability, cover, hazeTop, this.anchor.z + this.eye.z);
    // The three.js objects in the same light and through the same camera as the sky and
    // the landscape: radiances per unit of sun illuminance, the renderer's exposure and ACES
    // curve those of the passes. Sun: its irradiance after its path through the air; sky:
    // its irradiance on a horizontal surface; below: the ground's bounce.
    if (this.renderer) this.renderer.toneMappingExposure = k.exposure;
    const s = k.sun;
    const sm = Math.max(s.r, s.g, s.b, 1e-6);
    this.sun.color.setRGB(s.r / sm, s.g / sm, s.b / sm, THREE.LinearSRGBColorSpace);
    this.sun.intensity = sm * (1 - 0.1 * cover);
    this.sunBase.glider = this.sun.intensity;
    this.cockpitSun.color.copy(this.sun.color);
    this.cockpitSun.intensity = this.sun.intensity;
    const sky = k.skyIrrCam;
    const hm = Math.max(sky.r, sky.g, sky.b, 1e-6);
    for (const h of [this.hemi, this.cockpitHemi, this.chaseHemi]) {
      h.color.setRGB(sky.r / hm, sky.g / hm, sky.b / hm, THREE.LinearSRGBColorSpace);
      h.groundColor.setRGB((Math.PI * k.ground.r) / hm, (Math.PI * k.ground.g) / hm, (Math.PI * k.ground.b) / hm, THREE.LinearSRGBColorSpace);
      h.intensity = hm;
    }
    this.chaseSun.position.copy(dir);
    this.chaseSun.color.copy(this.sun.color);
    this.chaseSun.intensity = this.sun.intensity;
    // The sky is above (z up here; three.js's default would put it in the north).
    this.hemi.position.set(0, 0, 1);
    this.chaseHemi.position.set(0, 0, 1);
    if (!this.loaded) return;
    this.applyMapLight(azimuth, elevation, humidity, cover);
  }

  /**
   * MapLibre's side of the light: its sky and fog (seen only when the landscape pass cannot
   * run: then they carry the haze), the imagery left neutral for the relighting (or graded
   * when MapLibre's fog is the only haze), the relief shaded by the real sun.
   */
  private applyMapLight(azimuth: number, elevation: number, humidity: number, cover: number): void {
    const k = this.sky.light;
    if (!k) return;
    const hex = (c: THREE.Color) => `#${c.getHexString()}`;
    const own = this.groundPass;
    this.map.setSky({
      'sky-color': hex(k.skyHex),
      'horizon-color': hex(k.horizonHex),
      'fog-color': hex(k.horizonHex),
      'sky-horizon-blend': 0.6 + 0.2 * humidity,
      'horizon-fog-blend': 0.45 + 0.35 * humidity,
      'fog-ground-blend': own ? 1 : 0.22 + 0.45 * humidity,
      'atmosphere-blend': 0,
    });
    const day = k.day;
    for (const id of ['bm-ign-ortho', 'bm-s2']) {
      this.map.setPaintProperty(id, 'raster-brightness-max', own ? 1 : 0.5 + 0.5 * (0.35 + 0.65 * day));
      this.map.setPaintProperty(id, 'raster-saturation', own ? 0 : -0.15 + 0.15 * day - 0.15 * humidity - 0.15 * cover);
      this.map.setPaintProperty(id, 'raster-contrast', own ? 0 : -0.05 - 0.12 * humidity);
    }
    // Relief: Lambert shading from the real sun (true slopes), darkening only: a slope turned
    // away from the sun loses the direct light's share of its illumination, a slope facing a
    // low sun keeps it all; the landscape pass brings flat ground back to the photo's level,
    // so slopes facing a low sun come out brighter than the plain, as they are.
    const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const sunShare = lum(k.sunIrr) / Math.max(1e-5, lum(k.sunIrr) + lum(k.skyIrr));
    // MapLibre blends the shade in sRGB: losing the sun's share of the light (linear) is a
    // darkening of 1 − (1 − share)^(1/2.2) there.
    const alpha = Math.min(0.85, 1 - Math.pow(1 - 0.95 * sunShare * (1 - 0.3 * cover), 1 / 2.2));
    const alt = Math.max(1.5, elevation);
    const flat = Math.max(0, 1 - 2 * Math.sin((alt * Math.PI) / 180));
    this.sky.hillFlat = own ? 1 - alpha * flat : 1;
    this.map.setPaintProperty('hillshade', 'hillshade-method', 'basic');
    this.map.setPaintProperty('hillshade', 'hillshade-illumination-anchor', 'map');
    this.map.setPaintProperty('hillshade', 'hillshade-illumination-direction', azimuth);
    this.map.setPaintProperty('hillshade', 'hillshade-illumination-altitude', alt);
    this.map.setPaintProperty('hillshade', 'hillshade-exaggeration', own ? 0.5 : 0.42 + 0.18 * (1 - day));
    this.map.setPaintProperty('hillshade', 'hillshade-shadow-color', own ? `rgba(0, 0, 0, ${alpha.toFixed(3)})` : `rgba(14, 22, 44, ${(0.42 + 0.3 * (1 - day)) * (1 - 0.35 * cover)})`);
    this.map.setPaintProperty('hillshade', 'hillshade-highlight-color', own ? 'rgba(255, 255, 255, 0)' : `rgba(255, 240, 215, ${(0.07 + 0.22 * (1 - day)).toFixed(3)})`);
  }

  setWind(u: number, v: number): void {
    this.wind = [u, v];
  }

  private layer(): CustomLayerInterface {
    return {
      id: 'game-3d',
      type: 'custom',
      renderingMode: '3d',
      onAdd: (map, gl) => {
        this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
        this.renderer.autoClear = false;
        // The glider, the birds and the trees through the same filmic curve and exposure as the sky.
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = this.sky.light?.exposure ?? 4.2;
      },
      // Offscreen work before MapLibre binds and clears the frame (no extra store/reload of
      // the multisampled frame on tiled GPUs): atmosphere tables, shadow map, clouds.
      prerender: (gl, opts) => {
        const r = this.renderer;
        if (!r || this.topo) return;
        this.setProjection(opts.defaultProjectionData.mainMatrix as ArrayLike<number>);
        r.resetState();
        r.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        const f = this.makeFrameInfo(gl, opts.nearZ, opts.farZ);
        this.frameInfo = f;
        this.sky.prepare(r, f);
        r.setRenderTarget(null);
      },
      render: (gl, opts) => {
        const r = this.renderer;
        if (!r) return;
        this.setProjection(opts.defaultProjectionData.mainMatrix as ArrayLike<number>);
        // MapLibre's depth range for its 3D layers, read before three.js draws anything.
        const dr = gl.getParameter(gl.DEPTH_RANGE) as Float32Array;
        r.resetState();
        // The canvas may have been resized since three.js read its size.
        r.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        const f = this.frameInfo;
        if (this.topo || !f) {
          r.render(this.worldScene, this.worldCam);
          return;
        }
        f.depthRange[0] = dr[0];
        f.depthRange[1] = dr[1];
        this.sky.drawBackground(r, f);
        if (this.sky.groundActive !== this.groundPass) {
          // The landscape pass started (or stopped) working: MapLibre's fog and grading follow.
          this.groundPass = this.sky.groundActive;
          const c = this.conditions;
          if (c) setTimeout(() => this.applyMapLight(c.azimuth, c.elevation, c.humidity, c.cover), 0);
          setTimeout(() => this.setCloudShadows(), 0);
        }
        r.render(this.worldScene, this.worldCam);
        this.sky.drawClouds(r, f);
        this.sky.drawGlare(r, f);
        this.frameInfo = null;
        if (this.view === 'first') {
          r.clearDepth();
          r.render(this.cockpitScene, this.cockpitCam);
        } else if (this.view === 'third') {
          r.clearDepth();
          r.render(this.chaseScene, this.chaseCam);
        }
      },
    };
  }

  /** World camera: MapLibre's projection composed with the anchor's local frame, in double precision. */
  private setProjection(mainMatrix: ArrayLike<number>): void {
    const [lon, lat] = this.frame.toLngLat(this.anchor.x, this.anchor.y);
    const mc = MercatorCoordinate.fromLngLat([lon, lat], this.anchor.z);
    const s = mc.meterInMercatorCoordinateUnits();
    const local = new Float64Array([s, 0, 0, 0, 0, -s, 0, 0, 0, 0, s, 0, mc.x, mc.y, mc.z, 1]);
    const m = mul4(mainMatrix, local, new Float64Array(16));
    this.worldCam.projectionMatrix.fromArray(Array.from(m));
    this.worldCam.projectionMatrixInverse.copy(this.worldCam.projectionMatrix).invert();
  }

  /**
   * The camera of this frame for the sky passes: its position (where MapLibre's view rays
   * converge, in metres around the anchor), the far-plane vectors from which each pixel's
   * ray is interpolated, the near/far planes and the terrain depth MapLibre rendered.
   */
  private makeFrameInfo(gl: WebGL2RenderingContext, near: number, far: number): FrameInfo {
    const inv = this.worldCam.projectionMatrixInverse;
    const f = this.fi;
    const f0 = this.fiTmp[0].set(0, 0, 1).applyMatrix4(inv);
    const n0 = this.fiTmp[1].set(0, 0, -1).applyMatrix4(inv);
    // Camera centre: the view axis extended back from the near plane by near/(far−near) of its length.
    f.eye.copy(n0).sub(this.fiTmp[2].copy(f0).sub(n0).multiplyScalar(near / (far - near)));
    f.dirBase.copy(f0).sub(f.eye);
    f.dirX.set(1, 0, 1).applyMatrix4(inv).sub(f0);
    f.dirY.set(0, 1, 1).applyMatrix4(inv).sub(f0);
    const terrain = (this.map as unknown as { terrain?: { _fboDepthTexture?: { texture?: WebGLTexture } } }).terrain;
    f.width = gl.drawingBufferWidth;
    f.height = gl.drawingBufferHeight;
    f.anchor = this.anchor;
    f.near = near;
    f.far = far;
    f.depthRange[0] = 0;
    f.depthRange[1] = 1;
    // MapLibre's terrain depth (an internal: without it the landscape pass is skipped and
    // MapLibre's own fog carries the haze).
    f.terrainDepth = terrain?._fboDepthTexture?.texture ?? null;
    f.fovY = (this.fovDeg * Math.PI) / 180;
    return f;
  }

  private fi: FrameInfo = {
    cam: this.worldCam,
    width: 1,
    height: 1,
    eye: new THREE.Vector3(),
    anchor: { x: 0, y: 0, z: 0 },
    dirBase: new THREE.Vector3(),
    dirX: new THREE.Vector3(),
    dirY: new THREE.Vector3(),
    near: 1,
    far: 1000,
    depthRange: [0, 1],
    terrainDepth: null,
    fovY: 1,
  };
  private fiTmp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  /**
   * Places the camera for this frame and the glider in the world. Returns the camera
   * position (for the cloud white-out and the sound).
   */
  frameUpdate(st: GliderState, head: Head): void {
    if (!this.loaded || this.topo) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const q = gliderQuaternion(st.heading, st.bank, st.pitch);
    this.anchor = { x: st.x, y: st.y, z: st.z };
    this.rel.position.set(-st.x, -st.y, -st.z);
    this.gliderWorld.position.set(0, 0, 0);
    this.gliderWorld.quaternion.copy(q);
    this.glider.update(st);
    let eye: THREE.Vector3;
    let fwd: THREE.Vector3;
    let up: THREE.Vector3;
    if (this.view === 'first') {
      // The head keeps the horizon steadier than the harness: about a third of the bank and
      // half of the pendulum pitch are compensated (the risers tilt in the view), and the
      // body sinks a little in the harness under load.
      const qHead = new THREE.Quaternion().setFromEuler(new THREE.Euler(head.pitch + 0.5 * st.pitch, -head.yaw, 0.35 * st.bank, 'YXZ'));
      const qCam = q.clone().multiply(qHead);
      const sag = 0.05 * Math.min(3, Math.max(0, st.load - 1));
      eye = new THREE.Vector3(0, EYE[1] - sag, EYE[2]).applyQuaternion(q);
      fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(qCam);
      up = new THREE.Vector3(0, 1, 0).applyQuaternion(qCam);
      this.cockpitCam.position.set(0, EYE[1] - sag, EYE[2]);
      this.cockpitCam.quaternion.copy(qHead);
      // The cockpit is drawn in the glider's frame: the sun and the sky's zenith follow its attitude.
      const qi = this.qInv.copy(q).invert();
      this.cockpitSun.position.copy(this.sun.position).applyQuaternion(qi);
      this.cockpitHemi.position.set(0, 0, 1).applyQuaternion(qi);
    } else {
      // Chase camera: behind the glider, orbiting with the arrows.
      const yaw = st.heading + head.yaw;
      const dist = 22;
      const el = 0.18 + head.pitch * -0.6;
      eye = new THREE.Vector3(-Math.sin(yaw) * dist * Math.cos(el), -Math.cos(yaw) * dist * Math.cos(el), 3 + dist * Math.sin(el));
      const target = new THREE.Vector3(0, 0, 3.5);
      fwd = target.clone().sub(eye).normalize();
      up = new THREE.Vector3(0, 0, 1);
      this.chaseCam.position.copy(eye);
      this.chaseCam.lookAt(target);
    }
    this.eye.copy(eye);
    this.sky.frame(this.anchor, eye, this.wind[0], this.wind[1], dt);
    // Under a cloud the glider is in the shade: its sun light dims (ray towards the sun).
    this.sunlight += (this.sky.sunlightAt(st.x, st.y, st.z + 5) - this.sunlight) * Math.min(1, dt * 1.5);
    const sunI = this.sunBase.glider * (0.08 + 0.92 * this.sunlight);
    this.cockpitSun.intensity = sunI;
    this.chaseSun.intensity = sunI;
    const bearing = Math.atan2(fwd.x, fwd.y) * DEG;
    const pitch = Math.acos(Math.max(-1, Math.min(1, -fwd.z))) * DEG;
    const p = pitch / DEG;
    const b = bearing / DEG;
    const u0 = new THREE.Vector3(Math.sin(b) * Math.cos(p), Math.cos(b) * Math.cos(p), Math.sin(p));
    const roll = Math.atan2(new THREE.Vector3().crossVectors(u0, up).dot(fwd), u0.dot(up)) * DEG;
    const [lon, lat] = this.frame.toLngLat(st.x + eye.x, st.y + eye.y);
    const alt = st.z + eye.z;
    this.placeCamera(lon, lat, alt, fwd, bearing, pitch, -roll);
    const c = this.map.getCanvas();
    this.cockpitCam.aspect = c.width / Math.max(1, c.height);
    this.cockpitCam.fov = this.fovDeg;
    this.cockpitCam.updateProjectionMatrix();
    this.chaseCam.aspect = this.cockpitCam.aspect;
    this.chaseCam.fov = this.fovDeg;
    this.chaseCam.updateProjectionMatrix();
    this.flows.setScale((c.clientHeight || 600) / (2 * Math.tan((this.fovDeg * Math.PI) / 360)));
    const ground = this.groundAt(st.x, st.y);
    if (ground !== null) this.forest.update(this.map, this.frame, st.x, st.y, st.z - ground);
    // Name tags of the other pilots face the camera and keep a readable size.
    const camWorld = new THREE.Vector3(st.x + eye.x, st.y + eye.y, st.z + eye.z);
    for (const p of this.peers.values()) {
      const lp = p.group.position;
      const d = camWorld.distanceTo(lp);
      p.label.position.set(lp.x, lp.y, lp.z + 10 + d * 0.012);
      p.label.scale.setScalar(Math.max(1, d * 0.012));
      p.label.up.set(0, 0, 1);
      p.label.lookAt(camWorld);
    }
  }

  /** Cross-country task: one cylinder per turn point, the next one brighter. */
  setTask(points: { x: number; y: number; r: number; name: string }[] | null, next = 0): void {
    this.taskGroup.clear();
    if (!points) return;
    points.forEach((p, i) => {
      const ground = this.groundAt(p.x, p.y) ?? 1000;
      const h = 2600;
      const geo = new THREE.CylinderGeometry(p.r, p.r, h, 48, 1, true);
      geo.rotateX(Math.PI / 2);
      const isNext = i === next;
      const done = i < next;
      const mat = new THREE.MeshBasicMaterial({ color: done ? 0x4ade80 : isNext ? 0xfacc15 : 0xf59e0b, transparent: true, opacity: isNext ? 0.22 : done ? 0.06 : 0.1, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p.x, p.y, ground - 100 + h / 2);
      m.frustumCulled = false;
      this.taskGroup.add(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r, isNext ? 6 : 3, 6, 64), new THREE.MeshBasicMaterial({ color: isNext ? 0xfacc15 : 0xf59e0b, transparent: true, opacity: isNext ? 0.8 : 0.4 }));
      ring.position.set(p.x, p.y, ground + 40);
      ring.frustumCulled = false;
      this.taskGroup.add(ring);
    });
  }

  /** The other pilots (multiplayer), in this pilot's local frame. */
  setPeers(list: { id: string; name: string; x: number; y: number; z: number; heading: number; bank: number; pitch: number; collapse: number; brakeL: number; brakeR: number }[]): void {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      let e = this.peers.get(p.id);
      if (!e) {
        // A colour per pilot, stable for its id.
        let h = 0;
        for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const col = new THREE.Color().setHSL((h % 360) / 360, 0.75, 0.5);
        const model = buildGlider({ main: col.getHex(), stripe: 0xf4f1ea, under: 0xb8b2aa });
        const group = new THREE.Group();
        group.add(model.root);
        const label = nameTag(p.name);
        this.rel.add(group, label);
        e = { model, group, label };
        this.peers.set(p.id, e);
      }
      e.group.position.set(p.x, p.y, p.z);
      e.group.quaternion.copy(gliderQuaternion(p.heading, p.bank, p.pitch));
      e.model.update({ brakeL: p.brakeL, brakeR: p.brakeR, collapse: { side: 1, amount: p.collapse, frontal: 0, cravat: 0, cravatSide: 0 }, ears: 0 } as unknown as GliderState);
    }
    for (const [id, e] of this.peers) {
      if (seen.has(id)) continue;
      this.rel.remove(e.group, e.label);
      this.peers.delete(id);
    }
  }

  /**
   * Camera at (lon, lat, alt) looking along `fwd`. MapLibre picks the tile detail from the
   * point it looks at (the "centre"): placed on the horizon it would be kilometres away
   * and the ground under the wing blurry. The centre is set ~1.2 km ahead instead, so the
   * tiles near the pilot load at full detail and the detail decays towards the horizon.
   */
  private placeCamera(lon: number, lat: number, alt: number, fwd: THREE.Vector3, bearing: number, pitch: number, roll: number): void {
    const D = 1200;
    const kx = 111320 * Math.cos((lat * Math.PI) / 180);
    const center: [number, number] = [lon + (fwd.x * D) / kx, lat + (fwd.y * D) / 111320];
    const elevation = alt + fwd.z * D;
    const h = this.map.getCanvas().clientHeight || 600;
    const ctcd = 0.5 / Math.tan((this.fovDeg * Math.PI) / 360) * h;
    // Metres per pixel such that the camera is D metres from the centre, then the zoom.
    const mpp = D / ctcd;
    const zoom = Math.log2((40075016.686 * Math.cos((center[1] * Math.PI) / 180)) / (512 * mpp));
    this.map.jumpTo({ center, zoom, elevation, bearing, pitch: Math.min(179, Math.max(1, pitch)), roll });
  }

  setFov(deg: number): void {
    this.fovDeg = deg;
    this.map.setVerticalFieldOfView(deg);
  }

  /** Ground elevation from the loaded terrain tiles (≈10 m), null where not loaded yet. */
  groundAt(x: number, y: number): number | null {
    if (!this.loaded) return null;
    return this.map.queryTerrainElevation(this.frame.toLngLat(x, y));
  }


  setClouds(list: CloudInfo[]): void {
    this.sky.setClouds(list, this.anchor);
    // The haze's top follows the cumulus base (median of the clouds in view).
    if (list.length >= 3) {
      const bases = list.map((c) => c.base).sort((a, b) => a - b);
      const top = bases[bases.length >> 1] + 150;
      const c = this.conditions;
      if (Math.abs(top - this.hazeTop) > 120 && c) {
        this.hazeTop = top;
        this.setAtmosphere(c.azimuth, c.elevation, c.humidity, c.instability, c.cover);
      } else if (this.hazeTop === 0) this.hazeTop = top;
    }
    this.setCloudShadows();
  }

  /**
   * Fallback cloud shadows (when the landscape pass cannot read the terrain depth): soft
   * discs draped on the terrain by a fill layer. Otherwise the landscape pass shades the
   * terrain from the clouds' shadow map and the layer is removed.
   */
  private setCloudShadows(): void {
    if (!this.loaded) return;
    if (this.groundPass) {
      if (this.map.getLayer('cloud-shadows')) this.map.removeLayer('cloud-shadows');
      if (this.map.getSource('cloud-shadows')) this.map.removeSource('cloud-shadows');
      return;
    }
    const feats: GeoJSON.Feature[] = [];
    const ground = (x: number, y: number) => this.groundAt(x, y) ?? 800;
    for (const sh of this.sky.shadows(ground)) {
      for (const [f, a] of [
        [1.15, 0.33],
        [0.85, 0.33],
        [0.55, 0.34],
      ] as const) {
        const ring: [number, number][] = [];
        for (let i = 0; i <= 24; i++) {
          const ang = (i / 24) * Math.PI * 2;
          ring.push(this.frame.toLngLat(sh.x + Math.cos(ang) * sh.r * f, sh.y + Math.sin(ang) * sh.r * f * 0.9));
        }
        feats.push({ type: 'Feature', properties: { k: sh.k * a }, geometry: { type: 'Polygon', coordinates: [ring] } });
      }
    }
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: feats };
    const src = this.map.getSource('cloud-shadows') as { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined;
    if (src?.setData) src.setData(data);
    else {
      this.map.addSource('cloud-shadows', { type: 'geojson', data });
      this.map.addLayer(
        { id: 'cloud-shadows', type: 'fill', source: 'cloud-shadows', paint: { 'fill-color': '#0b1626', 'fill-opacity': ['get', 'k'] as never, 'fill-antialias': false } },
        this.map.getLayer('buildings') ? 'buildings' : undefined,
      );
    }
  }

  /** Windsocks on take-offs and landings, oriented by the model's wind near the ground. */
  setSocks(list: { x: number; y: number; ground: number; u: number; v: number }[]): void {
    this.socks.clear();
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xdedede });
    const sockMat = new THREE.MeshLambertMaterial({ color: 0xff5a1f });
    for (const s of list) {
      const g = new THREE.Group();
      g.position.set(s.x, s.y, s.ground);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 8, 6), poleMat);
      pole.rotation.x = Math.PI / 2;
      pole.position.z = 4;
      g.add(pole);
      const speed = Math.hypot(s.u, s.v);
      // A real sock is horizontal from ~20 km/h, limp under 5.
      const droop = Math.max(0, 1 - speed / 5.5) * 1.2;
      const sock = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3, 10, 1, true), sockMat);
      sock.geometry.translate(0, -1.5, 0);
      const dir = Math.atan2(s.u, s.v);
      sock.position.z = 7.8;
      sock.rotation.set(0, 0, 0);
      sock.rotateZ(-dir);
      sock.rotateX(-Math.PI / 2 + droop);
      g.add(sock);
      g.scale.setScalar(1.6);
      this.socks.add(g);
    }
  }

  /** Pause « point topo »: the map from above, topographic, pan and zoom, documented places. */
  setTopo(on: boolean, pilot?: { x: number; y: number; heading: number }, features: AtlasFeature[] = []): void {
    if (!this.loaded || on === this.topo) return;
    this.topo = on;
    const m = this.map;
    const handlers = [m.dragPan, m.scrollZoom, m.touchZoomRotate, m.doubleClickZoom];
    if (on && pilot) {
      const [lon, lat] = this.frame.toLngLat(pilot.x, pilot.y);
      m.setCenterClampedToGround(true);
      m.setLayoutProperty('bm-topo', 'visibility', 'visible');
      m.setPaintProperty('bm-topo', 'raster-opacity', 0.9);
      m.jumpTo({ center: [lon, lat], zoom: 13, pitch: 0, bearing: 0, roll: 0 });
      handlers.forEach((h) => h.enable());
      const color = ['match', ['get', 'category'], 'hazards', '#e11d48', 'thermals', '#f59e0b', 'breezes', '#0284c7', 'convergences', '#c026d3', 'soaring', '#16a34a', 'takeoffs', '#1d4ed8', 'landings', '#15803d', '#475569'];
      m.addSource('topo-feats', { type: 'geojson', data: { type: 'FeatureCollection', features: features as GeoJSON.Feature[] } });
      m.addLayer({ id: 'topo-lines', type: 'line', source: 'topo-feats', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': color as never, 'line-width': 3, 'line-opacity': 0.85 } });
      m.addLayer({ id: 'topo-points', type: 'circle', source: 'topo-feats', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': color as never, 'circle-radius': 6, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      m.addLayer({
        id: 'topo-labels',
        type: 'symbol',
        source: 'topo-feats',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 14 },
        paint: { 'text-color': '#0f172a', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
      });
      const el = document.createElement('div');
      el.className = 'game-pilot-marker';
      el.style.transform = `rotate(${pilot.heading * DEG}deg)`;
      this.pilotMarker = new Marker({ element: el, rotationAlignment: 'map' }).setLngLat([lon, lat]).setRotation(pilot.heading * DEG).addTo(m);
    } else {
      handlers.forEach((h) => h.disable());
      m.setLayoutProperty('bm-topo', 'visibility', 'none');
      for (const id of ['topo-labels', 'topo-points', 'topo-lines']) if (m.getLayer(id)) m.removeLayer(id);
      if (m.getSource('topo-feats')) m.removeSource('topo-feats');
      this.pilotMarker?.remove();
      this.pilotMarker = null;
      m.setCenterClampedToGround(false);
    }
  }

  /** Centres the topo map on a place. */
  topoFocus(lon: number, lat: number): void {
    if (this.topo) this.map.easeTo({ center: [lon, lat], zoom: Math.max(this.map.getZoom(), 13.5), duration: 600 });
  }

  dispose(): void {
    this.sky.dispose();
    this.renderer?.dispose();
    this.map.remove();
  }
}
