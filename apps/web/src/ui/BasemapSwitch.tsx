import { BASEMAPS } from '../map/style';
import { useApp, type Basemap } from '../state/store';

const CHOICES: Basemap[] = ['topo', 'ign-ortho'];

/** Topo or satellite, one tap away on the map. */
export function BasemapSwitch() {
  const basemap = useApp((s) => s.basemap);
  return (
    <div className="basemap-switch panel" role="radiogroup" aria-label="Fond de carte">
      {CHOICES.map((b) => (
        <button key={b} role="radio" aria-checked={basemap === b} className={`bm-${b} ${basemap === b ? 'on' : ''}`} title={BASEMAPS[b].description} onClick={() => useApp.getState().set({ basemap: b })}>
          <span className="bm-thumb" aria-hidden />
          {BASEMAPS[b].label}
        </button>
      ))}
    </div>
  );
}
