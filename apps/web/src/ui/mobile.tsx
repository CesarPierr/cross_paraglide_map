/**
 * Phone layout: the map fills the screen and one bottom sheet at a time holds
 * everything else (lists, massif page, details, layers, guided visit). The
 * sheet has three heights (peek, half, full), dragged by its handle; the time
 * bar shows only when no sheet is open, and the visit hides the rest of the
 * chrome so the map and its text share the screen.
 */
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { BASEMAPS } from '../map/style';
import { remember, useApp } from '../state/store';
import { getController } from './controller-ref';
import { IconLayers, IconMountain, IconWind } from './icons';
import { goTo, useMode, type Mode } from './modes';
import { togglePopover } from './Popovers';

const QUERY = '(max-width: 860px)';

/** Shows a sheet opened from the map (feature, probe, massif): bottom sheet on phones; the desktop panel opens by itself. */
export function showSheet(): void {
  if (isMobileNow()) {
    useApp.getState().set({ mobileSheet: 'browse', popover: null });
    useSheet.getState().setSnap('half');
  }
}

/** Shows the sector / route lists: bottom sheet on phones, left panel on desktop. */
export function showBrowse(): void {
  if (isMobileNow()) {
    useApp.getState().set({ mobileSheet: 'browse', popover: null });
    useSheet.getState().setSnap('half');
  } else useApp.getState().set({ browseOpen: true });
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

// ---------- Bottom sheet ----------

export type Snap = 'peek' | 'half' | 'full';

export const useSheet = create<{ snap: Snap; setSnap: (snap: Snap) => void }>((set) => ({
  snap: 'half',
  setSnap: (snap) => set({ snap }),
}));

/** Room kept above the sheet (top bar) and below it (navigation bar), in px. */
const TOP = 64;
const DOCK = 72;

/** Height of the sheet for a snap, in px. During the visit the top bar and the dock step aside. */
export function sheetHeight(snap: Snap, visit: boolean): number {
  const h = window.innerHeight;
  const full = h - (visit ? 56 : TOP + DOCK) - 8;
  const peek = visit ? 148 : 112;
  if (snap === 'full') return Math.round(full);
  if (snap === 'peek') return peek;
  return Math.round(Math.min(full, Math.max(peek + 60, h * (visit ? 0.5 : 0.48))));
}

/** Keeps the sheet height (CSS variable on the app root) in step with the snap, the visit and the window. */
export function useSheetLayout(visit: boolean): void {
  const snap = useSheet((s) => s.snap);
  const [, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty('--sheet-h', `${sheetHeight(snap, visit)}px`);
  });
}

/**
 * Grab bar of a bottom sheet: drag it to resize (it settles on the nearest of
 * the three heights), tap it to switch between half and full, cross to close.
 */
export function SheetHandle({ onClose, visit = false, closeLabel = 'Fermer le panneau', children }: { onClose?: () => void; visit?: boolean; closeLabel?: string; children?: React.ReactNode }) {
  const { snap, setSnap } = useSheet();
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const root = document.documentElement;
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: sheetHeight(snap, visit), moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    root.classList.add('sheet-dragging');
    const h = Math.max(sheetHeight('peek', visit) - 40, Math.min(sheetHeight('full', visit), d.h - dy));
    root.style.setProperty('--sheet-h', `${h}px`);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    root.classList.remove('sheet-dragging');
    if (!d) return;
    if (!d.moved) {
      setSnap(snap === 'full' ? 'half' : snap === 'half' ? 'full' : 'half');
      return;
    }
    const h = d.h - (e.clientY - d.y);
    const snaps: Snap[] = ['peek', 'half', 'full'];
    const best = snaps.reduce((a, b) => (Math.abs(sheetHeight(b, visit) - h) < Math.abs(sheetHeight(a, visit) - h) ? b : a));
    setSnap(best);
    // Same snap as before: the height variable must come back from the dragged value.
    root.style.setProperty('--sheet-h', `${sheetHeight(best, visit)}px`);
  };
  return (
    <div className="sheet-handle">
      <button
        className="grab"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          drag.current = null;
          root.classList.remove('sheet-dragging');
        }}
        aria-label={snap === 'full' ? 'Réduire le panneau' : 'Agrandir le panneau'}
      >
        <span />
      </button>
      {children}
      <button className="icon-btn ghost close" onClick={() => (onClose ? onClose() : useApp.getState().set({ mobileSheet: 'none' }))} aria-label={closeLabel}>
        ×
      </button>
    </div>
  );
}

// ---------- Navigation bar and map buttons ----------

export function MobileDock() {
  const mode = useMode();
  const popover = useApp((s) => s.popover);
  if (!useIsMobile()) return null;
  const tabs: { key: Mode | 'layers'; label: string; icon: React.ReactNode; on: boolean; go: () => void }[] = [
    { key: 'carte', label: 'Carte', icon: <IconWind size={18} />, on: mode === 'carte' && !popover, go: () => goTo('carte') },
    { key: 'massifs', label: 'Massifs', icon: <IconMountain size={18} />, on: mode === 'massifs', go: () => goTo('massifs') },
    { key: 'cross', label: 'Cross', icon: <IconRoute />, on: mode === 'cross', go: () => goTo('cross') },
    {
      key: 'layers',
      label: 'Calques',
      icon: <IconLayers size={18} />,
      on: popover === 'layers',
      go: () => {
        togglePopover('layers');
        useSheet.getState().setSnap('half');
      },
    },
  ];
  return (
    <nav className="mobile-dock" aria-label="Navigation">
      {tabs.map((t) => (
        <button key={t.key} className={t.on ? 'active' : ''} aria-pressed={t.on} onClick={t.go}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Phone map buttons, top right: base map (one tap to the other) and 2D / 3D. Pinch, twist and two-finger tilt do the rest. */
export function MobileRail() {
  const basemap = useApp((s) => s.basemap);
  // 3D = the relief and a tilted view; 2D = a flat map seen from above (much lighter for a phone).
  const relief = useApp((s) => s.exaggeration > 0);
  if (!useIsMobile()) return null;
  const other = basemap === 'topo' ? 'ign-ortho' : 'topo';
  const toggle3d = () => {
    const on = !relief;
    useApp.getState().set({ exaggeration: on ? 1.3 : 0 });
    remember('brises.relief', on ? '3d' : '2d');
    getController()?.map.easeTo({ pitch: on ? 55 : 0, duration: 700 });
  };
  return (
    <div className="mobile-rail">
      <button className={`rail-btn bm-${other}`} onClick={() => useApp.getState().set({ basemap: other })} aria-label={`Fond ${BASEMAPS[other].label}`}>
        <span className="bm-thumb" aria-hidden />
        <small>{BASEMAPS[other].label}</small>
      </button>
      <button className="rail-btn text" onClick={toggle3d} aria-label={relief ? 'Carte à plat (2D)' : 'Relief en 3D'} aria-pressed={relief}>
        {relief ? '2D' : '3D'}
      </button>
    </div>
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
