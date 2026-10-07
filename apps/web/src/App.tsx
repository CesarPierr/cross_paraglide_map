import { useEffect } from 'react';
import { AboutModal } from './ui/AboutModal';
import { ControlPanel } from './ui/ControlPanel';
import { ContributionPanel } from './ui/Feedback';
import { IconHelp, IconMenu } from './ui/icons';
import { MobileDock, schemaHere, useIsMobile } from './ui/mobile';
import { NavPad } from './ui/NavPad';
import { SCHEMA_PHASES } from './state/store';
import { SearchBox } from './ui/Search';
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
        // Close what is on top first, then leave the schema view.
        if (rt.feature || rt.draft) rt.set({ feature: null, draft: null });
        else if (s.schemaMassif) s.set({ schemaMassif: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Always-visible banner of the schema view, with the way back to 3D. */
function SchemaBanner() {
  const { schemaMassif, schemaPhase } = useApp();
  const atlas = useRuntime((r) => r.atlas);
  if (!schemaMassif) return null;
  const m = atlas?.massifs.find((x) => x.id === schemaMassif);
  const phase = SCHEMA_PHASES.find((p) => p.key === schemaPhase);
  return (
    <div className="schema-banner panel" role="status">
      <span>
        Vue schéma · <b>{m?.shortName ?? schemaMassif}</b> · {phase?.label.toLowerCase()}
      </span>
      <button className="btn small primary" onClick={() => useApp.getState().set({ schemaMassif: null })}>
        Revenir en 3D
      </button>
    </div>
  );
}

function SchemaToggle() {
  const schema = useApp((s) => s.schemaMassif);
  return (
    <button
      className={`btn small schema-toggle ${schema ? 'active' : ''}`}
      onClick={() => (schema ? useApp.getState().set({ schemaMassif: null }) : schemaHere() || useRuntime.getState().set({ toast: 'Centrez la carte sur un massif pour l’afficher en schéma.' }))}
      title={schema ? 'Revenir à la vue 3D live' : 'Vue schéma du massif au centre de la carte'}
    >
      {schema ? 'Vue 3D live' : 'Vue schéma'}
    </button>
  );
}

export default function App() {
  const { panelOpen, set } = useApp();
  const mobile = useIsMobile();
  useShortcuts();
  return (
    <div className={`app ${mobile ? 'is-mobile' : ''}`}>
      <MapView />
      <header className="topbar panel">
        {!mobile && (
          <button className="icon-btn" onClick={() => set({ panelOpen: !panelOpen })} aria-label={panelOpen ? 'Masquer les panneaux' : 'Afficher les panneaux'}>
            <IconMenu />
          </button>
        )}
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
        <SearchBox />
        {!mobile && <SchemaToggle />}
        <button className="icon-btn" onClick={() => set({ aboutOpen: true })} aria-label="Aide et méthodologie">
          <IconHelp />
        </button>
      </header>
      <Sidebar />
      <ControlPanel />
      <TimeBar />
      <Legend />
      <MobileDock />
      <NavPad />
      <SchemaBanner />
      <ProbeCard />
      <ContributionPanel />
      <AboutModal />
      <LoadingVeil />
      <Toast />
    </div>
  );
}
