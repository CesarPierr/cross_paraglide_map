/**
 * Two modes of use. Exploring: the live map, the massifs (sector map → massif page
 * with its schema and guided visit) and cross-country routes, with what the sources
 * say. Simulating: the synoptic wind, the reading of the relief (exposure, thermals,
 * convergences…) and the forecast, in one panel. Opening a massif, a visit or a
 * route goes back to exploring; there is no separate "schema view" to toggle.
 */
import { IconMountain, IconWind } from './icons';
import { remember, useApp, useRuntime, type AppState } from '../state/store';
import { getController } from './controller-ref';
import { isMobileNow, showBrowse, showSheet, useSheet } from './mobile';

/** Switches between exploring the knowledge and simulating the wind. */
export function setUiMode(m: AppState['uiMode']): void {
  const s = useApp.getState();
  if (s.uiMode === m) return;
  remember('brises.uimode', m);
  useRuntime.getState().set({ feature: null });
  getController()?.clearProbe();
  if (m === 'simulate') {
    s.set({ uiMode: m, schemaMassif: null, selectedMassif: null, schemaPicking: false, tourStep: null, popover: null, browseOpen: false, overlay: s.simOverlay });
    if (isMobileNow()) {
      s.set({ mobileSheet: 'browse' });
      useSheet.getState().setSnap('half');
    }
  } else s.set({ uiMode: m, simOverlay: s.overlay === 'none' ? s.simOverlay : s.overlay, overlay: 'none', mobileSheet: 'none' });
}

export function UiModeSwitch() {
  const uiMode = useApp((s) => s.uiMode);
  return (
    <div className="ui-mode-switch" role="radiogroup" aria-label="Mode">
      <button role="radio" aria-checked={uiMode === 'explore'} className={uiMode === 'explore' ? 'on' : ''} onClick={() => setUiMode('explore')} title="Massifs, visites, itinéraires et ce que disent les sources">
        <IconMountain size={15} /> Explorer
      </button>
      <button role="radio" aria-checked={uiMode === 'simulate'} className={uiMode === 'simulate' ? 'on' : ''} onClick={() => setUiMode('simulate')} title="Vent météo, lecture du relief, prévision">
        <IconWind size={15} /> Simuler
      </button>
    </div>
  );
}

export type Mode = 'carte' | 'massifs' | 'cross';

export function useMode(): Mode {
  const { schemaPicking, schemaMassif, browseOpen, browseTab } = useApp();
  if (schemaPicking || schemaMassif) return 'massifs';
  if (browseOpen && browseTab === 'routes') return 'cross';
  return 'carte';
}

export function goTo(mode: Mode): void {
  setUiMode('explore');
  const s = useApp.getState();
  useRuntime.getState().set({ feature: null });
  getController()?.clearProbe();
  const base = { schemaMassif: null, selectedMassif: null, tourStep: null, popover: null } as const;
  if (mode === 'carte') {
    s.set({ ...base, schemaPicking: false, browseOpen: false, mobileSheet: 'none' });
    // Back to the bare map: no margin left over from a panel that is gone.
    getController()?.map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 500 });
  }
  else if (mode === 'massifs') {
    s.set({ ...base, schemaPicking: true, browseOpen: true, browseTab: 'massifs' });
    showBrowse();
  } else {
    s.set({ ...base, schemaPicking: false, browseOpen: true, browseTab: 'routes' });
    showBrowse();
  }
}

/** Opens a massif: its page in the panel and its schema on the map (optionally the guided visit). */
export function openMassif(id: string, visit = false): void {
  setUiMode('explore');
  useRuntime.getState().set({ feature: null });
  getController()?.clearProbe();
  useApp.getState().set({ schemaMassif: id, selectedMassif: id, schemaPicking: false, popover: null, tourStep: visit ? 0 : null });
  showSheet();
}

const TABS: { key: Mode; label: string; hint: string }[] = [
  { key: 'carte', label: 'Carte', hint: 'Vent et aérologie en direct' },
  { key: 'massifs', label: 'Massifs', hint: 'Choisir un massif : schéma et présentation' },
  { key: 'cross', label: 'Cross', hint: 'Itinéraires documentés et traceur' },
];

export function ModeTabs() {
  const mode = useMode();
  const uiMode = useApp((s) => s.uiMode);
  if (uiMode !== 'explore') return null;
  return (
    <nav className="mode-tabs" role="tablist" aria-label="Navigation">
      {TABS.map((t) => (
        <button key={t.key} role="tab" aria-selected={mode === t.key} className={mode === t.key ? 'on' : ''} title={t.hint} onClick={() => goTo(t.key)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
