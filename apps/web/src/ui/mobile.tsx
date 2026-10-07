import { useEffect, useState } from 'react';
import { useApp, useRuntime, type MobileSheet } from '../state/store';
import { getController } from './controller-ref';
import { IconLayers, IconMountain, IconWind } from './icons';

/** Opens the schematic view of the sector under the map centre (the smallest one containing it). */
export function schemaHere(): boolean {
  const atlas = useRuntime.getState().atlas;
  const c = getController()?.map.getCenter();
  if (!atlas || !c) return false;
  const hit = atlas.massifs
    .filter((m) => m.id !== 'alpes-francaises' && c.lng >= m.bbox[0] && c.lng <= m.bbox[2] && c.lat >= m.bbox[1] && c.lat <= m.bbox[3])
    .sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]))[0];
  if (!hit) return false;
  useRuntime.getState().set({ feature: null });
  useApp.getState().set({ schemaMassif: hit.id, selectedMassif: hit.id, ...(isMobileNow() ? { mobileSheet: 'browse' as const } : { panelOpen: true }) });
  return true;
}

const QUERY = '(max-width: 860px)';

/** True on phone-sized screens, where panels become bottom sheets (one at a time). */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

export const isMobileNow = () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches;

/** Grab bar of a bottom sheet: tap to expand / shrink, cross to close. */
export function SheetHandle() {
  const [tall, setTall] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('sheet-tall', tall);
    return () => document.documentElement.classList.remove('sheet-tall');
  }, [tall]);
  return (
    <div className="sheet-handle">
      <button className="grab" onClick={() => setTall(!tall)} aria-label={tall ? 'Réduire le panneau' : 'Agrandir le panneau'}>
        <span />
      </button>
      <button className="icon-btn ghost close" onClick={() => useApp.getState().set({ mobileSheet: 'none' })} aria-label="Fermer le panneau">
        ×
      </button>
    </div>
  );
}

function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
    </svg>
  );
}

const TABS: { key: Exclude<MobileSheet, 'none'>; label: string; icon: React.ReactNode }[] = [
  { key: 'browse', label: 'Massifs', icon: <IconMountain size={18} /> },
  { key: 'settings', label: 'Vent & couches', icon: <IconWind size={18} /> },
  { key: 'legend', label: 'Légende', icon: <IconBook /> },
];

/** Bottom navigation on phones: one sheet at a time, the map stays visible above. */
export function MobileDock() {
  const sheet = useApp((s) => s.mobileSheet);
  const schema = useApp((s) => s.schemaMassif);
  const feature = useRuntime((r) => r.feature);
  if (!useIsMobile()) return null;
  return (
    <nav className="mobile-dock panel" aria-label="Panneaux">
      {TABS.map((t) => {
        const active = sheet === t.key;
        const label = t.key === 'browse' && (feature || schema) ? (feature ? 'Fiche' : 'Schéma') : t.label;
        return (
          <button key={t.key} className={active ? 'active' : ''} aria-pressed={active} onClick={() => useApp.getState().set({ mobileSheet: active ? 'none' : t.key })}>
            {t.icon}
            <span>{label}</span>
          </button>
        );
      })}
      <button className={schema ? 'active' : ''} onClick={() => (schema ? useApp.getState().set({ schemaMassif: null }) : schemaHere() || useApp.getState().set({ mobileSheet: 'browse' }))} aria-label={schema ? 'Revenir à la vue 3D' : 'Choisir un massif pour la vue schéma'}>
        <IconLayers size={18} />
        <span>{schema ? 'Vue 3D' : 'Schéma'}</span>
      </button>
    </nav>
  );
}
