import { useEffect, useState } from 'react';
import { useApp } from '../state/store';
import { IconLayers, IconMountain, IconWind } from './icons';
import { goTo, useMode, type Mode } from './modes';
import { togglePopover } from './Popovers';

const QUERY = '(max-width: 860px)';

/** Shows a sheet opened from the map (feature, probe, massif): bottom sheet on phones; the desktop panel opens by itself. */
export function showSheet(): void {
  if (isMobileNow()) useApp.getState().set({ mobileSheet: 'browse' });
}

/** Shows the sector / route lists: bottom sheet on phones, left panel on desktop. */
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
export function SheetHandle({ onClose }: { onClose?: () => void } = {}) {
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
      <button className="icon-btn ghost close" onClick={() => (onClose ? onClose() : useApp.getState().set({ mobileSheet: 'none' }))} aria-label="Fermer le panneau">
        ×
      </button>
    </div>
  );
}

export function MobileDock() {
  const mode = useMode();
  const popover = useApp((s) => s.popover);
  if (!useIsMobile()) return null;
  const tabs: { key: Mode | 'layers'; label: string; icon: React.ReactNode; on: boolean; go: () => void }[] = [
    { key: 'carte', label: 'Carte', icon: <IconWind size={18} />, on: mode === 'carte' && !popover, go: () => goTo('carte') },
    { key: 'massifs', label: 'Massifs', icon: <IconMountain size={18} />, on: mode === 'massifs', go: () => goTo('massifs') },
    { key: 'cross', label: 'Cross', icon: <IconRoute />, on: mode === 'cross', go: () => goTo('cross') },
    { key: 'layers', label: 'Calques', icon: <IconLayers size={18} />, on: popover === 'layers', go: () => togglePopover('layers') },
  ];
  return (
    <nav className="mobile-dock panel" aria-label="Navigation">
      {tabs.map((t) => (
        <button key={t.key} className={t.on ? 'active' : ''} aria-pressed={t.on} onClick={t.go}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function IconRoute() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6" />
    </svg>
  );
}
