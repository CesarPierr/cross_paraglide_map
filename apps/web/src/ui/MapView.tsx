import { mergeAtlasText } from '@brises/shared';
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createDataClient, type DataClient } from '../data/client';
import { MapController } from '../map/controller';
import { useApp, useRuntime } from '../state/store';
import { setController, setDataClient } from './controller-ref';
import { showSheet } from './mobile';
import { openMassif } from './modes';

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let controller: MapController | null = null;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    // The map is created at once (tiles start loading); the data client (API or static files) joins when ready.
    const rt = () => useRuntime.getState();
    const dataReady = createDataClient();
    void dataReady.then((data: DataClient) => {
      if (cancelled) return;
      rt().set({ dataMode: data.mode });
      setDataClient(data);
    });
    controller = new MapController(ref.current!, dataReady, {
      onAtlas: (atlas) => {
        rt().set({ atlas });
        // The text part arrives right after the first render and fills the sheets.
        void dataReady
          .then((data) => data.atlasText())
          .then((text) => rt().set({ atlas: mergeAtlasText(rt().atlas ?? atlas, text) }))
          .catch(() => rt().set({ toast: 'Textes de l’atlas indisponibles : la carte reste utilisable.' }));
      },
      onStatus: (status) => rt().set({ status }),
      onTime: ({ sunAzimuth, sunElevation, solarHour }) => rt().set({ sun: { azimuth: sunAzimuth, elevation: sunElevation }, solarHour }),
      onFeature: (feature) => {
        rt().set({ feature });
        if (feature) showSheet();
      },
      onProbe: (probe) => {
        const prev = rt().probe;
        rt().set({ probe });
        // A new point opens the panel; a refresh of the same point (hour, wind) does not.
        if (probe && (!prev || prev.lon !== probe.lon || prev.lat !== probe.lat)) {
          rt().set({ feature: null });
          showSheet();
        }
      },
      // A sector picked on the map: its page, its schema and the guided presentation.
      // From the chooser, with its guided visit; from a zoomed-out map, its page only.
      onPickMassif: (id) => openMassif(id, useApp.getState().schemaPicking),
      onModuleEvent: (e) => {
        if (e.type === 'status') rt().set({ moduleMessage: e.message });
      },
      onPick: (lngLat) => {
        const plan = rt().plan;
        if (plan?.picking) {
          rt().set({ plan: { ...plan, points: [...plan.points, lngLat], names: [...plan.names, ''] } });
          return;
        }
        const d = rt().draft;
        if (!d) return;
        const multi = d.category === 'breeze' || d.category === 'convergence';
        rt().set({ draft: { ...d, points: multi ? [...d.points, lngLat] : [lngLat], picking: multi } });
        if (!multi) controller?.setPicking(false);
      },
    });
    setController(controller);
    if (import.meta.env.DEV) (window as unknown as { __ctrl: MapController }).__ctrl = controller;
    controller.apply(useApp.getState());
    unsub = useApp.subscribe((s) => controller?.apply(s));
    return () => {
      cancelled = true;
      unsub?.();
      setController(null);
      controller?.dispose();
    };
  }, []);

  return <div ref={ref} className="map" role="application" aria-label="Carte 3D des Alpes françaises" />;
}
