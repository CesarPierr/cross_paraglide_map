/**
 * First visit: four ways in (discover a massif, fly today, simulate a day, plan a cross)
 * and the level of detail. Re-opened from the help button. Choices are
 * remembered in this browser only.
 */
import { compassFr } from '@brises/model';
import { LEVELS, type Level } from '../glossary';
import { remember, useApp, useRuntime } from '../state/store';
import { getController, getDataClient } from './controller-ref';
import { goTo } from './modes';

/** Level → layers shown by default (everything stays one tap away). */
const LEVEL_LAYERS: Record<Level, Partial<Record<string, boolean>>> = {
  decouverte: { routes: false, airspace: false, sitesCommunity: false, soaring: false },
  pilote: { routes: false, airspace: false },
  // Routes are read in the Cross tab (one at a time), not drawn all over the map.
  expert: { routes: false, airspace: true },
};

function close(level: Level) {
  remember('brises.welcomed', '1');
  remember('brises.level', level);
  const s = useApp.getState();
  s.set({ welcomeOpen: false, level, layers: { ...s.layers, ...LEVEL_LAYERS[level] } as typeof s.layers });
}

/** Today's forecast wind at the map centre (one cached request, shared through the server). */
async function flyToday() {
  const c = getController();
  const w = getDataClient()?.weather();
  if (!c || !w) return;
  const center = c.map.getCenter();
  try {
    const hours = await w.synoptic(center.lat, center.lng);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const h = hours.find((x) => x.time.startsWith(today) && x.hour === Math.max(10, Math.min(17, now.getHours()))) ?? hours[0];
    useApp.getState().set({ synopticFrom: h.fromDeg, synopticKmh: h.speedKmh, month0: now.getMonth(), day: now.getDate(), hour: h.hour });
    useRuntime.getState().set({ toast: `Vent prévu aujourd’hui à ${h.hour}h : ${h.speedKmh < 3 ? 'calme' : `${compassFr(h.fromDeg)} ${h.speedKmh} km/h`}. Touchez un endroit pour lire l’aérologie locale et la prévision du point.` });
  } catch {
    useRuntime.getState().set({ toast: 'Prévision indisponible : réglez le vent depuis la barre de l’heure, puis touchez un endroit.' });
  }
}

/** A typical summer day with the natural breezes only; the wind stays the user's choice. */
function simulateDay() {
  useApp.getState().set({ synopticKmh: 0, hour: 15, month0: 6, day: 15, popover: 'conditions' });
  useRuntime.getState().set({ toast: 'Journée d’été type, sans vent météo : jouez l’heure en bas, ajoutez un vent si vous voulez, touchez un endroit pour le lire.' });
}

/** The four ways in, short enough to read on a phone at a glance. */
const WAYS: { title: string; hint: string; icon: string; go: () => void }[] = [
  { title: 'Découvrir un massif', hint: 'Ses brises, thermiques et pièges, avec une visite guidée.', icon: '⛰', go: () => goTo('massifs') },
  { title: 'Voler aujourd’hui', hint: 'Le vent prévu est appliqué ; touchez un endroit pour le lire.', icon: '☀', go: () => void flyToday() },
  { title: 'Simuler une journée', hint: 'Les brises heure par heure, puis le vent de votre choix.', icon: '◷', go: simulateDay },
  { title: 'Préparer un cross', hint: 'Itinéraires pas à pas, ou tracez le vôtre.', icon: '↝', go: () => goTo('cross') },
];

export function Welcome() {
  const { welcomeOpen, level } = useApp();
  if (!welcomeOpen) return null;
  const pick = (go: () => void) => {
    close(useApp.getState().level);
    go();
  };
  return (
    <div className="welcome-veil" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome panel">
        <h2 id="welcome-title">Comprendre l’air des Alpes avant de voler</h2>
        <p className="lead">Brises, thermiques et pièges de chaque massif, simulés selon l’heure et le vent, sourcés auprès des clubs, écoles et fiches FFVL.</p>
        <p className="welcome-label" id="welcome-level">
          Votre pratique
        </p>
        <div className="welcome-levels" role="radiogroup" aria-labelledby="welcome-level">
          {LEVELS.map((l) => (
            <button key={l.key} role="radio" aria-checked={level === l.key} className={level === l.key ? 'on' : ''} onClick={() => useApp.getState().set({ level: l.key })} title={l.hint}>
              <b>{l.label}</b>
              <small>{l.hint}</small>
            </button>
          ))}
        </div>
        <p className="welcome-label">Par où commencer</p>
        <div className="welcome-ways">
          {WAYS.map((w) => (
            <button key={w.title} onClick={() => pick(w.go)}>
              <span className="way-icon" aria-hidden>
                {w.icon}
              </span>
              <b>{w.title}</b>
              <small>{w.hint}</small>
            </button>
          ))}
        </div>
        <button className="link-btn explore" onClick={() => close(level)}>
          Juste explorer la carte
        </button>
        <p className="muted small">Outil pédagogique, pas une prévision : vérifiez toujours la météo, les balises et les consignes locales.</p>
      </div>
    </div>
  );
}
