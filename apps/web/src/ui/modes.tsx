/**
 * The three ways through the app: the live map, the massifs (sector map →
 * massif page with its schema and guided visit), and cross-country routes.
 * Opening a massif always shows its schema on the map; closing it returns to
 * the live map. There is no separate "schema view" to toggle.
 */
import { useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { showBrowse, showSheet } from './mobile';

export type Mode = 'carte' | 'massifs' | 'cross';

export function useMode(): Mode {
  const { schemaPicking, schemaMassif, browseOpen, browseTab } = useApp();
  if (schemaPicking || schemaMassif) return 'massifs';
  if (browseOpen && browseTab === 'routes') return 'cross';
  return 'carte';
}

export function goTo(mode: Mode): void {
  const s = useApp.getState();
  useRuntime.getState().set({ feature: null });
  getController()?.clearProbe();
  const base = { schemaMassif: null, selectedMassif: null, tourStep: null, popover: null } as const;
  if (mode === 'carte') s.set({ ...base, schemaPicking: false, browseOpen: false, mobileSheet: 'none' });
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
