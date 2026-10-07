import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createDataClient, type DataClient } from '../data/client';
import { MapController } from '../map/controller';
import { useApp, useRuntime } from '../state/store';
import { setController, setDataClient } from './controller-ref';

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let controller: MapController | null = null;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    void createDataClient().then((data: DataClient) => {
      if (cancelled) return;
      const rt = () => useRuntime.getState();
      rt().set({ dataMode: data.mode });
      setDataClient(data);
      controller = new MapController(ref.current!, data, {
        onAtlas: (atlas) => rt().set({ atlas }),
        onStatus: (status) => rt().set({ status }),
        onTime: ({ sunAzimuth, sunElevation, solarHour }) => rt().set({ sun: { azimuth: sunAzimuth, elevation: sunElevation }, solarHour }),
        onFeature: (feature) => {
          rt().set({ feature });
          if (feature) useApp.getState().set(window.matchMedia('(max-width: 860px)').matches ? { mobileSheet: 'browse' } : { panelOpen: true });
        },
        onProbe: (probe) => rt().set({ probe }),
        onModuleEvent: (e) => {
          if (e.type === 'status') rt().set({ moduleMessage: e.message });
        },
        onPick: (lngLat) => {
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
    });
    return () => {
      cancelled = true;
      unsub?.();
      setController(null);
      controller?.dispose();
    };
  }, []);

  return <div ref={ref} className="map" role="application" aria-label="Carte 3D des Alpes françaises" />;
}
