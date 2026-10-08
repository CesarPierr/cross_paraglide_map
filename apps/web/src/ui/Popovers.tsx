/**
 * On-demand panel "Calques" (layer families, legend, options), opened from the
 * map; a bottom sheet on phones. The wind is set in the simulation mode, which the
 * wind chip of the time bar opens.
 */
import { compassFr } from '@brises/model';
import { useApp } from '../state/store';
import { LayersPanel } from './ControlPanel';
import { IconLayers, IconWind } from './icons';
import { isMobileNow, SheetHandle, useIsMobile, useSheet } from './mobile';
import { setUiMode } from './modes';

export type PopoverKey = 'layers';

export function togglePopover(k: PopoverKey): void {
  const s = useApp.getState();
  s.set({ popover: s.popover === k ? null : k, mobileSheet: 'none' });
}

/** The current synoptic wind, as a button to the simulation, where it is set. */
export function WindChip() {
  const { synopticFrom, synopticKmh, heatwave, uiMode, forecastDay } = useApp();
  const open = () => {
    setUiMode('simulate');
    // Phone: the settings sheet comes back if it was closed.
    if (isMobileNow()) {
      useApp.getState().set({ mobileSheet: 'browse', popover: null });
      useSheet.getState().setSnap('half');
    }
  };
  return (
    <button className={`wind-chip ${uiMode === 'simulate' ? 'on' : ''}`} onClick={open} title={uiMode === 'simulate' ? 'Réglages du vent' : 'Régler le vent : mode Simulation'}>
      <IconWind size={15} />
      <span>{synopticKmh < 3 ? 'Vent calme' : `${compassFr(synopticFrom)} ${synopticKmh} km/h`}</span>
      {forecastDay !== null && <small>prévu</small>}
      {heatwave && <small>canicule</small>}
    </button>
  );
}

/** Map-side button for the layers panel. */
export function MapTools() {
  const popover = useApp((s) => s.popover);
  const mobile = useIsMobile();
  if (mobile) return null;
  return (
    <div className="map-tools">
      <button className={`btn small ${popover === 'layers' ? 'primary' : ''}`} onClick={() => togglePopover('layers')} aria-expanded={popover === 'layers'}>
        <IconLayers size={15} /> Calques
      </button>
    </div>
  );
}

export function Popover() {
  const popover = useApp((s) => s.popover);
  const mobile = useIsMobile();
  if (!popover) return null;
  const close = () => useApp.getState().set({ popover: null });
  return (
    <div className={`popover panel pop-${popover} ${mobile ? 'as-sheet' : ''}`} role="dialog" aria-label="Calques">
      {mobile ? (
        <SheetHandle onClose={close} />
      ) : (
        <div className="popover-head">
          <b>Calques</b>
          <button className="icon-btn ghost" onClick={close} aria-label="Fermer">
            ×
          </button>
        </div>
      )}
      <LayersPanel />
    </div>
  );
}
