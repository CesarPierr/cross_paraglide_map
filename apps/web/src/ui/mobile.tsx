import { useEffect, useState } from 'react';
import { useApp, useRuntime, type MobileSheet } from '../state/store';
import { IconLayers, IconMountain, IconWind } from './icons';

const QUERY = '(max-width: 860px)';

/** Shows the sector / sheet panel: bottom sheet on phones, left panel on desktop. */
export function showBrowse(): void {
  useApp.getState().set(isMobileNow() ? { mobileSheet: 'browse' } : { browseOpen: true });
}

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
      <button className={schema ? 'active' : ''} onClick={() => useApp.getState().set(schema ? { schemaMassif: null, tourStep: null } : { schemaPicking: true, mobileSheet: 'none' })} aria-label={schema ? 'Revenir à la vue 3D' : 'Choisir un massif pour la vue schéma'}>
        <IconLayers size={18} />
        <span>{schema ? 'Vue 3D' : 'Schéma'}</span>
      </button>
    </nav>
  );
}
