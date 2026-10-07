import { AboutModal } from './ui/AboutModal';
import { ControlPanel } from './ui/ControlPanel';
import { Legend } from './ui/Legend';
import { MapView } from './ui/MapView';
import { ProbeCard } from './ui/ProbeCard';
import { Sidebar } from './ui/Sidebar';
import { TimeBar } from './ui/TimeBar';
import { useApp, useRuntime } from './state/store';

function StatusPill() {
  const status = useRuntime((r) => r.status);
  const ms = useRuntime((r) => r.computeMs);
  if (status.phase === 'ready')
    return (
      <span className="status ok" title="Dernier calcul du modèle">
        modèle à jour{ms ? ` · ${Math.round(ms)} ms` : ''}
      </span>
    );
  if (status.phase === 'computing') return <span className="status busy">calcul du vent…</span>;
  if (status.phase === 'error') return <span className="status err">erreur : {status.message}</span>;
  return <span className="status busy">{status.message ?? 'chargement…'}</span>;
}

function LoadingVeil() {
  const status = useRuntime((r) => r.status);
  const first = useRuntime((r) => r.sun === null);
  if (!first || status.phase === 'error') return null;
  return (
    <div className="veil" role="status">
      <div className="spinner" />
      <p>{status.message ?? 'Chargement…'}</p>
    </div>
  );
}

export default function App() {
  const { panelOpen, set } = useApp();
  return (
    <div className="app">
      <MapView />
      <header className="topbar panel">
        <button className="icon-btn" onClick={() => set({ panelOpen: !panelOpen })} aria-label={panelOpen ? 'Masquer les panneaux' : 'Afficher les panneaux'}>
          ☰
        </button>
        <div className="brand">
          <span className="logo" aria-hidden>
            ⟿
          </span>
          <div>
            <h1>Brises des Alpes</h1>
            <p>Aérologie 3D des Alpes françaises pour le cross</p>
          </div>
        </div>
        <StatusPill />
        <button className="icon-btn" onClick={() => set({ aboutOpen: true })} aria-label="Aide et méthodologie">
          ?
        </button>
      </header>
      <Sidebar />
      <ControlPanel />
      <TimeBar />
      <Legend />
      <ProbeCard />
      <AboutModal />
      <LoadingVeil />
    </div>
  );
}
