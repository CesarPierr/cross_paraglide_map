import { useEffect } from 'react';
import { AboutModal } from './ui/AboutModal';
import { BasemapSwitch } from './ui/BasemapSwitch';
import { ContributionPanel } from './ui/Feedback';
import { IconHelp } from './ui/icons';
import { MapView } from './ui/MapView';
import { MobileDock, useIsMobile } from './ui/mobile';
import { goTo, ModeTabs } from './ui/modes';
import { NavPad } from './ui/NavPad';
import { MapTools, Popover } from './ui/Popovers';
import { SearchBox } from './ui/Search';
import { Sidebar } from './ui/Sidebar';
import { TimeBar } from './ui/TimeBar';
import { MassifTour } from './ui/Tour';
import { Welcome } from './ui/Welcome';
import { useApp, useRuntime } from './state/store';

function StatusPill() {
  const status = useRuntime((r) => r.status);
  const moduleMessage = useRuntime((r) => r.moduleMessage);
  const mode = useRuntime((r) => r.dataMode);
  if (status.phase === 'error') return <span className="status err" title={status.message}>erreur</span>;
  if (status.phase !== 'ready') return <span className="status busy">{status.message ?? 'chargement…'}</span>;
  if (moduleMessage) return <span className="status busy">{moduleMessage}</span>;
  return <span className="status-dot ok" title={mode === 'api' ? 'En ligne : données servies par le serveur' : 'Mode autonome (fichiers statiques)'} aria-label={mode === 'api' ? 'en ligne' : 'autonome'} />;
}

function LoadingVeil() {
  const status = useRuntime((r) => r.status);
  if (status.phase === 'ready' || status.phase === 'error') return null;
  return (
    <div className="veil" role="status">
      <div className="spinner" />
      <p>{status.message ?? 'Chargement…'}</p>
    </div>
  );
}

function Toast() {
  const toast = useRuntime((r) => r.toast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => useRuntime.getState().set({ toast: null }), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);
  return toast ? (
    <div className="toast" role="status">
      {toast}
    </div>
  ) : null;
}

/** Keyboard: space = play/pause, ←/→ = ±15 min, Esc = close sheets. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable], [role="slider"]')) return;
      const s = useApp.getState();
      if (e.key === ' ') {
        e.preventDefault();
        s.set({ playing: !s.playing });
      } else if (e.key === 'ArrowRight' && e.shiftKey) s.set({ hour: Math.min(22, s.hour + 0.25), playing: false });
      else if (e.key === 'ArrowLeft' && e.shiftKey) s.set({ hour: Math.max(5, s.hour - 0.25), playing: false });
      else if (e.key === 'Escape') {
        const rt = useRuntime.getState();
        // Close what is on top first: popover, sheet, visit, then back to the map.
        if (s.popover) s.set({ popover: null });
        else if (rt.feature || rt.draft) rt.set({ feature: null, draft: null });
        else if (s.tourStep !== null) s.set({ tourStep: null });
        else goTo('carte');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Always-visible banner of the schema view, with the way back to 3D. */
export default function App() {
  const { browseOpen, schemaMassif, schemaPicking, set } = useApp();
  const feature = useRuntime((r) => r.feature);
  const probe = useRuntime((r) => r.probe);
  const mobile = useIsMobile();
  const sideOpen = !mobile && (browseOpen || schemaPicking || !!feature || !!probe || !!schemaMassif);
  useShortcuts();
  return (
    <div className={`app ${mobile ? 'is-mobile' : ''} ${sideOpen ? 'side-open' : ''}`}>
      <MapView />
      <header className="topbar panel">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32" width="22" height="22">
              <path d="M2 26 L11 12 L16 19 L21 10 L30 26 Z" fill="rgba(255,255,255,0.25)" />
              <path d="M3 13 C9 8 14 16 21 11 S29 8 30 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h1>Brises des Alpes</h1>
            <p>Aérologie 3D pour le cross</p>
          </div>
          <StatusPill />
        </div>
        {!mobile && <ModeTabs />}
        <SearchBox />
        <button className="icon-btn" onClick={() => set({ aboutOpen: true })} aria-label="Aide et méthodologie">
          <IconHelp />
        </button>
      </header>
      <Sidebar />
      <TimeBar />
      <MapTools />
      <BasemapSwitch />
      <Popover />
      <MobileDock />
      <NavPad />
      <MassifTour />
      <Welcome />
      <ContributionPanel />
      <AboutModal />
      <LoadingVeil />
      <Toast />
    </div>
  );
}
