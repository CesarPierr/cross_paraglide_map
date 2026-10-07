import { useEffect } from 'react';
import { AboutModal } from './ui/AboutModal';
import { ControlPanel } from './ui/ControlPanel';
import { ContributionPanel } from './ui/Feedback';
import { IconHelp, IconMenu } from './ui/icons';
import { Legend } from './ui/Legend';
import { MapView } from './ui/MapView';
import { ProbeCard } from './ui/ProbeCard';
import { Sidebar } from './ui/Sidebar';
import { TimeBar } from './ui/TimeBar';
import { useApp, useRuntime } from './state/store';

function StatusPill() {
  const status = useRuntime((r) => r.status);
  const moduleMessage = useRuntime((r) => r.moduleMessage);
  const mode = useRuntime((r) => r.dataMode);
  if (status.phase === 'error') return <span className="status err" title={status.message}>erreur</span>;
  if (status.phase !== 'ready') return <span className="status busy">{status.message ?? 'chargement…'}</span>;
  return (
    <span className="status ok" title={mode === 'api' ? 'Données servies par le serveur' : 'Mode autonome (fichiers statiques)'}>
      {moduleMessage ?? (mode === 'api' ? 'en ligne' : 'autonome')}
    </span>
  );
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
      else if (e.key === 'Escape') useRuntime.getState().set({ feature: null, draft: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  const { panelOpen, set } = useApp();
  useShortcuts();
  return (
    <div className="app">
      <MapView />
      <header className="topbar panel">
        <button className="icon-btn" onClick={() => set({ panelOpen: !panelOpen })} aria-label={panelOpen ? 'Masquer les panneaux' : 'Afficher les panneaux'}>
          <IconMenu />
        </button>
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
        </div>
        <StatusPill />
        <button className="icon-btn" onClick={() => set({ aboutOpen: true })} aria-label="Aide et méthodologie">
          <IconHelp />
        </button>
      </header>
      <Sidebar />
      <ControlPanel />
      <TimeBar />
      <Legend />
      <ProbeCard />
      <ContributionPanel />
      <AboutModal />
      <LoadingVeil />
      <Toast />
    </div>
  );
}
