/**
 * First visit on a device: what the site is, where its knowledge comes from,
 * what it is good for and where it stops; then, on request, a one-minute tour
 * of the interface that points at each part of the screen and shows it at work.
 * Re-opened from the help window. Remembered in this browser only.
 */
import { useEffect, useState } from 'react';
import { remember, useApp, useRuntime } from '../state/store';
import { getController } from './controller-ref';
import { isMobileNow, useIsMobile } from './mobile';
import { goTo, openMassif } from './modes';

function finish() {
  remember('brises.welcomed', '1');
  useApp.getState().set({ welcomeOpen: false, popover: null });
}

interface TourStep {
  title: string;
  text: string;
  /** Element pointed at (desktop / phone); none: a card in the middle. */
  target?: string;
  mobileTarget?: string;
  /** What the step shows on the map, run when it opens. */
  run?: () => void;
}

const SAINT_HILAIRE: [number, number] = [5.8866, 45.3103];

const STEPS: TourStep[] = [
  {
    title: 'La carte vit selon l’heure',
    text: 'Les traits colorés qui défilent sont les brises simulées à partir du relief et des récits de pilotes ; les spirales orange, les thermiques ; les bulles qui montent, leurs colonnes. Rien n’est figé : tout dépend de l’heure, du mois et du vent.',
    run: () => {
      goTo('carte');
      useApp.getState().set({ hour: 15, synopticKmh: 0, playing: false });
      getController()?.map.easeTo({ center: [5.9, 45.3], zoom: 10.3, pitch: 55, bearing: -15, duration: 1500 });
    },
  },
  {
    title: 'L’heure et la saison',
    text: 'Faites glisser l’heure : les brises de pente démarrent avec le soleil, la brise de vallée s’établit en fin de matinée, tout s’inverse le soir. ▶ fait défiler la journée ; le mois change la hauteur du soleil.',
    target: '.timebar',
  },
  {
    title: 'Le vent météo',
    text: 'Par défaut l’air est calme : seules les brises jouent. Choisissez un régime (nord, sud, foehn…) pour voir comment il se combine au relief, ou appliquez la prévision du jour.',
    target: '.wind-chip',
  },
  {
    title: 'Touchez un endroit',
    text: 'Exemple à Saint-Hilaire : le vent au sol et en altitude, le thermique et la convergence attendus, puis ce que disent les clubs, les fiches FFVL et les récits à moins de 3 km, avec leurs sources.',
    target: '.sidebar',
    run: () => {
      goTo('carte');
      const c = getController();
      void c?.probe(SAINT_HILAIRE[0], SAINT_HILAIRE[1], true);
      // On a phone the point stays visible between the card (top) and the sheet (bottom).
      const phone = isMobileNow();
      c?.map.easeTo({ center: SAINT_HILAIRE, zoom: 11.2, duration: 1200, ...(phone ? { padding: { top: 230, bottom: Math.round(window.innerHeight * 0.5), left: 10, right: 10 } } : {}) });
    },
  },
  {
    title: 'Les massifs',
    text: 'Les Alpes sont découpées en 45 secteurs. De loin, la carte devient un schéma : touchez un massif pour ouvrir sa page.',
    target: '.mode-tabs',
    mobileTarget: '.mobile-dock',
    run: () => goTo('massifs'),
  },
  {
    title: 'La page d’un massif',
    text: 'Son schéma pour une journée type (matin, midi, après-midi, soir), ses brises, thermiques, pièges et sources. « Présente-moi ce massif » lance une visite guidée : du global au détail, avec les lieux cités épinglés sur la carte.',
    target: '.sidebar',
    run: () => openMassif('chartreuse', false),
  },
  {
    title: 'Les calques',
    text: 'Afficher ou masquer le vent animé, l’aérologie locale, les sites de vol et les espaces aériens ; la légende des couleurs est ici.',
    target: '.popover',
    run: () => {
      goTo('carte');
      useApp.getState().set({ popover: 'layers' });
    },
  },
  {
    title: 'Le cross',
    text: 'Les grands itinéraires documentés, lus tronçon par tronçon : relances, pièges, brises de face ou de dos. Vous pouvez aussi tracer le vôtre.',
    target: '.sidebar',
    run: () => {
      useApp.getState().set({ popover: null });
      goTo('cross');
    },
  },
  {
    title: 'Chercher',
    text: 'Un déco, un village, une brise, un massif : la recherche vous y emmène.',
    target: '.searchbox',
    run: () => goTo('carte'),
  },
  {
    title: 'À vous',
    text: 'Le bouton ? rouvre cette présentation et la méthode détaillée. Chaque élément de la carte cite ses sources : en cas de doute, ouvrez-les. Bons vols !',
    target: '.topbar .icon-btn[aria-label="Aide et méthodologie"]',
  },
];

/** Rectangle of the element a step points at, followed while the layout moves. */
function useTargetRect(selector: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    let raf = 0;
    let last = '-';
    const tick = () => {
      const el = selector ? document.querySelector(selector) : null;
      const r = el?.getBoundingClientRect();
      const key = r ? `${r.left},${r.top},${r.width},${r.height}` : '';
      if (key !== last) {
        last = key;
        setRect(r && r.width > 0 ? r : null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return rect;
}

function SiteTour({ onEnd }: { onEnd: () => void }) {
  const [i, setI] = useState(0);
  const mobile = useIsMobile();
  const step = STEPS[i];
  const selector = mobile ? (step.mobileTarget ?? step.target) : step.target;
  const rect = useTargetRect(selector);
  useEffect(() => {
    step.run?.();
  }, [step]);
  const last = i === STEPS.length - 1;
  // The card sits away from what it points at: below it, above it, or in the middle.
  const pad = 8;
  const style: React.CSSProperties = {};
  if (rect && !mobile) {
    const width = 360;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (rect.height > H * 0.45) {
      // A tall panel: the card beside it, at its top.
      style.left = rect.right + 16 + width < W ? rect.right + 16 : Math.max(12, rect.left - width - 16);
      style.top = Math.max(12, Math.min(rect.top, H - 260));
    } else {
      style.left = Math.min(Math.max(12, rect.left), W - width - 12);
      if (rect.bottom + 12 + 220 < H) style.top = rect.bottom + 12;
      else style.bottom = Math.min(H - 12 - 200, H - rect.top + 12);
    }
  }
  // Phone: the card pinned top or bottom, away from what it points at; with nothing to point at, at the bottom so the map shows.
  const placement = mobile ? (rect && rect.top + rect.height / 2 > window.innerHeight / 2 ? 'top' : 'bottom') : rect ? 'free' : 'center';
  return (
    <div className="site-tour" role="dialog" aria-modal="true" aria-label="Visite du site">
      {rect ? <div className="spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} /> : <div className="spot-none" />}
      <div className={`tour-card panel at-${placement}`} style={style}>
        <p className="tour-card-count">
          {i + 1} / {STEPS.length}
        </p>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-card-nav">
          <button className="link-btn" onClick={onEnd}>
            Passer
          </button>
          <span />
          {i > 0 && (
            <button className="btn small ghost" onClick={() => setI(i - 1)}>
              Précédent
            </button>
          )}
          <button className="btn small primary" onClick={() => (last ? onEnd() : setI(i + 1))}>
            {last ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Welcome() {
  const welcomeOpen = useApp((s) => s.welcomeOpen);
  const stats = useRuntime((r) => r.atlas?.stats);
  const [touring, setTouring] = useState(false);
  if (!welcomeOpen) return null;
  if (touring)
    return (
      <SiteTour
        onEnd={() => {
          setTouring(false);
          finish();
        }}
      />
    );
  const n = (k: string, fallback: string) => (stats && typeof stats[k as keyof typeof stats] === 'number' ? String(stats[k as keyof typeof stats]) : fallback);
  return (
    <div className="welcome-veil" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome panel">
        <h2 id="welcome-title">Bienvenue sur Brises des Alpes</h2>
        <p className="lead">
          Une carte 3D de l’aérologie des Alpes françaises pour le parapente : comment l’air circule dans chaque massif, heure par heure, et ce qu’en disent ceux qui y volent.
        </p>

        <section className="welcome-block">
          <h3>Ce qu’elle rassemble</h3>
          <p>
            Fiches de sites FFVL, topos et documents de clubs et d’écoles, blogs et récits de cross, forums, cartes des parcs naturels, et les points chauds mesurés sur les traces GPS des pilotes (thermal.kk7.ch).
            Chaque élément cite ses sources et dit s’il est rapporté ou déduit.
          </p>
          <ul className="welcome-figures">
            <li>
              <b>{n('massifs', '46')}</b> secteurs
            </li>
            <li>
              <b>{n('breezes', '270')}</b> brises
            </li>
            <li>
              <b>{n('thermals', '1100')}</b> thermiques
            </li>
            <li>
              <b>{n('sources', '1600')}</b> sources
            </li>
          </ul>
        </section>

        <section className="welcome-block">
          <h3>Pour quoi faire</h3>
          <ul className="welcome-uses">
            <li>Comprendre un massif avant d’y voler : sa visite guidée part du relief et raconte la journée de l’air jusqu’aux pièges.</li>
            <li>Voir où ça monte à 15 h en juillet, et ce que change un vent de nord ou de sud.</li>
            <li>Préparer un cross : relances, transitions et brises de face, tronçon par tronçon.</li>
          </ul>
        </section>

        <section className="welcome-block warning">
          <h3>Ses limites</h3>
          <p>
            C’est un outil pour apprendre, pas une prévision. Le vent est un modèle simplifié, certaines informations sont des déductions (signalées), et la réalité du jour peut tout changer :
            vérifiez toujours la météo, les balises, les consignes locales et les espaces aériens.
          </p>
        </section>

        <div className="welcome-actions">
          <button className="btn primary" onClick={() => setTouring(true)}>
            Visite du site (1 min)
          </button>
          <button className="btn ghost" onClick={finish}>
            Explorer directement
          </button>
        </div>
        <button
          className="link-btn method"
          onClick={() => {
            finish();
            useApp.getState().set({ aboutOpen: true });
          }}
        >
          Méthode détaillée et sources
        </button>
      </div>
    </div>
  );
}
