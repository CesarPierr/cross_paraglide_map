import { useEffect } from 'react';
import { AboutModal } from './ui/AboutModal';
import { ControlPanel } from './ui/ControlPanel';
import { ContributionPanel } from './ui/Feedback';
import { IconHelp, IconMenu } from './ui/icons';
import { MobileDock, useIsMobile } from './ui/mobile';
import { NavPad } from './ui/NavPad';
import { MassifTour } from './ui/Tour';
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
        else if (s.tourStep !== null) s.set({ tourStep: null });
        else if (s.schemaPicking) s.set({ schemaPicking: false });
        else if (s.schemaMassif) s.set({ schemaMassif: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Always-visible banner of the schema view, with the way back to 3D. */
function SchemaBanner() {
  const { schemaMassif, schemaPhase, schemaPicking, schema3d, schemaWind, tourStep } = useApp();
  const atlas = useRuntime((r) => r.atlas);
  if (schemaPicking)
    return (
      <div className="schema-banner panel" role="status">
        <span>Touchez le massif à afficher en schéma</span>
        <button className="btn small ghost" onClick={() => useApp.getState().set({ schemaPicking: false })}>
          Annuler
        </button>
      </div>
    );
  if (!schemaMassif) return null;
  const m = atlas?.massifs.find((x) => x.id === schemaMassif);
  const phase = SCHEMA_PHASES.find((p) => p.key === schemaPhase);
  return (
    <div className="schema-banner panel" role="status">
      <span>
        Vue schéma · <b>{m?.shortName ?? schemaMassif}</b> · {phase?.label.toLowerCase()}
      </span>
      <div className="seg small" role="radiogroup" aria-label="Relief">
        <button className={!schema3d ? 'on' : ''} onClick={() => useApp.getState().set({ schema3d: false })} role="radio" aria-checked={!schema3d}>
          2D
        </button>
        <button className={schema3d ? 'on' : ''} onClick={() => useApp.getState().set({ schema3d: true })} role="radio" aria-checked={schema3d}>
          3D
        </button>
      </div>
      <button className={`btn small ghost ${schemaWind ? 'on' : ''}`} aria-pressed={schemaWind} onClick={() => useApp.getState().set({ schemaWind: !schemaWind })} title="Vent simulé sous le schéma">
        Particules {schemaWind ? 'on' : 'off'}
      </button>
      {tourStep === null && (
        <button className="btn small" onClick={() => useApp.getState().set({ tourStep: 0 })}>
          Présente-moi ce massif
        </button>
      )}
      <button className="btn small primary" onClick={() => useApp.getState().set({ schemaMassif: null, tourStep: null })}>
        Vue live
      </button>
    </div>
  );
}

function IconSliders() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

function SchemaToggle() {
  const schema = useApp((s) => s.schemaMassif);
  return (
    <button
      className={`btn small schema-toggle ${schema ? 'active' : ''}`}
      onClick={() => useApp.getState().set(schema ? { schemaMassif: null, tourStep: null } : { schemaPicking: !useApp.getState().schemaPicking })}
      title={schema ? 'Revenir à la vue 3D live' : 'Choisir un massif à afficher en schéma'}
    >
      {schema ? 'Vue 3D live' : 'Vue schéma'}
    </button>
  );
}

export default function App() {
  const { panelOpen, browseOpen, selectedMassif, schemaMassif, set } = useApp();
  const feature = useRuntime((r) => r.feature);
  const mobile = useIsMobile();
  const sideOpen = !mobile && (browseOpen || !!feature || !!schemaMassif || !!selectedMassif);
  const ctrlOpen = !mobile && panelOpen;
  useShortcuts();
  return (
    <div className={`app ${mobile ? 'is-mobile' : ''} ${sideOpen ? 'side-open' : ''} ${ctrlOpen ? 'ctrl-open' : ''}`}>
      <MapView />
      <header className="topbar panel">
        {!mobile && (
          <button className={`icon-btn ${browseOpen ? 'on' : ''}`} onClick={() => set({ browseOpen: !browseOpen })} aria-label="Liste des massifs" title="Massifs">
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
        {!mobile && (
          <button className={`icon-btn ${panelOpen ? 'on' : ''}`} onClick={() => set({ panelOpen: !panelOpen })} aria-label={panelOpen ? 'Masquer les réglages' : 'Afficher les réglages'} title="Réglages">
            <IconSliders />
          </button>
        )}
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
      <MassifTour />
      <ProbeCard />
      <ContributionPanel />
      <AboutModal />
      <LoadingVeil />
      <Toast />
    </div>
  );
}
