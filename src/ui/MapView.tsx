import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapController } from '../map/controller';
import { useApp, useRuntime } from '../state/store';
import { setController } from './controller-ref';

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rt = useRuntime.getState();
    const controller = new MapController(ref.current!, {
      onAtlas: (atlas) => rt.set({ atlas }),
      onStatus: (status) => useRuntime.getState().set({ status }),
      onField: ({ sun, solarHour, ms }) => {
        useRuntime.getState().set({ sun, solarHour, computeMs: ms });
        controller.setSun(sun.azimuth, sun.elevation);
      },
      onFeatureClick: (id) => {
        useRuntime.getState().set({ selectedFeature: id });
        if (id) useApp.getState().set({ panelOpen: true });
      },
      onProbe: (probe) => useRuntime.getState().set({ probe }),
    });
    setController(controller);
    let prev = useApp.getState();
    controller.apply(prev, null);
    const unsub = useApp.subscribe((s) => {
      controller.apply(s, prev);
      prev = s;
    });
    return () => {
      unsub();
      setController(null);
      controller.dispose();
    };
  }, []);

  return <div ref={ref} className="map" role="application" aria-label="Carte 3D des Alpes françaises" />;
}
