/**
 * On-demand panels: "Conditions" (synoptic wind, heatwave, reading height),
 * opened from the time bar, and "Calques" (layer families, legend, options),
 * opened from the map. One at a time; bottom sheets on phones.
 */
import { compassFr } from '@brises/model';
import { useApp } from '../state/store';
import { ConditionsPanel, LayersPanel } from './ControlPanel';
import { IconLayers, IconWind } from './icons';
import { SheetHandle, useIsMobile } from './mobile';

export type PopoverKey = 'conditions' | 'layers';

export function togglePopover(k: PopoverKey): void {
  const s = useApp.getState();
  s.set({ popover: s.popover === k ? null : k, mobileSheet: 'none' });
}

/** The current synoptic wind, as a button that opens the conditions. */
export function WindChip() {
  const { synopticFrom, synopticKmh, heatwave, popover } = useApp();
  return (
    <button className={`wind-chip ${popover === 'conditions' ? 'on' : ''}`} onClick={() => togglePopover('conditions')} aria-expanded={popover === 'conditions'} title="Vent météo, canicule, hauteur de lecture">
      <IconWind size={15} />
      <span>{synopticKmh < 3 ? 'Vent calme' : `${compassFr(synopticFrom)} ${synopticKmh} km/h`}</span>
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
    <div className={`popover panel pop-${popover} ${mobile ? 'as-sheet' : ''}`} role="dialog" aria-label={popover === 'conditions' ? 'Conditions' : 'Calques'}>
      {mobile ? (
        <SheetHandle onClose={close} />
      ) : (
        <div className="popover-head">
          <b>{popover === 'conditions' ? 'Conditions' : 'Calques'}</b>
          <button className="icon-btn ghost" onClick={close} aria-label="Fermer">
            ×
          </button>
        </div>
      )}
      {popover === 'conditions' ? <ConditionsPanel /> : <LayersPanel />}
    </div>
  );
}
