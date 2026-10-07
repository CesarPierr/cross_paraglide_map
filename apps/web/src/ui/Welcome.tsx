/**
 * First visit: three ways in (discover a massif, fly today, plan a cross)
 * and the level of detail. Re-opened from the help button. Choices are
 * remembered in this browser only.
 */
import { compassFr } from '@brises/model';
import { LEVELS, type Level } from '../glossary';
import { remember, useApp, useRuntime } from '../state/store';
import { getController, getDataClient } from './controller-ref';
import { showBrowse } from './mobile';

/** Level → layers shown by default (everything stays one tap away). */
const LEVEL_LAYERS: Record<Level, Partial<Record<string, boolean>>> = {
  decouverte: { routes: false, airspace: false, sitesCommunity: false, soaring: false },
  pilote: { routes: false, airspace: false },
  expert: { routes: true, airspace: true },
};

function close(level: Level) {
  remember('brises.welcomed', '1');
  remember('brises.level', level);
  const s = useApp.getState();
  s.set({ welcomeOpen: false, level, layers: { ...s.layers, ...LEVEL_LAYERS[level] } as typeof s.layers });
}

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
    useRuntime.getState().set({ toast: `Vent prévu aujourd’hui à ${h.hour}h : ${h.speedKmh < 3 ? 'calme' : `${compassFr(h.fromDeg)} ${h.speedKmh} km/h`}. Touchez un endroit de la carte pour lire l’aérologie locale.` });
  } catch {
    useRuntime.getState().set({ toast: 'Prévision indisponible : réglez le vent à droite, puis touchez un endroit de la carte.' });
  }
}

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
        <p className="lead">
          Brises, thermiques, convergences et pièges de chaque massif, simulés selon l’heure et le vent, et sourcés auprès des clubs, écoles et fiches FFVL.
        </p>
        <div className="welcome-levels" role="radiogroup" aria-label="Votre pratique">
          {LEVELS.map((l) => (
            <button key={l.key} role="radio" aria-checked={level === l.key} className={level === l.key ? 'on' : ''} onClick={() => useApp.getState().set({ level: l.key })}>
              <b>{l.label}</b>
              <small>{l.hint}</small>
            </button>
          ))}
        </div>
        <div className="welcome-ways">
          <button onClick={() => pick(() => useApp.getState().set({ schemaPicking: true }))}>
            <b>Découvrir un massif</b>
            <small>Choisissez-le sur la carte : schéma de ses brises, thermiques et pièges, puis visite guidée.</small>
          </button>
          <button onClick={() => pick(() => void flyToday())}>
            <b>Voler aujourd’hui</b>
            <small>Le vent prévu est appliqué ; touchez un endroit pour lire l’aérologie et les sources à proximité.</small>
          </button>
          <button
            onClick={() =>
              pick(() => {
                useApp.getState().set({ browseTab: 'routes' });
                showBrowse();
              })
            }
          >
            <b>Préparer un cross</b>
            <small>Itinéraires documentés pas à pas, ou tracez le vôtre : relances, pièges et brises sur chaque tronçon.</small>
          </button>
        </div>
        <button className="link-btn" onClick={() => close(level)}>
          Juste explorer la carte
        </button>
        <p className="muted small">Outil pédagogique, pas une prévision : vérifiez toujours la météo, les balises et les consignes locales.</p>
      </div>
    </div>
  );
}
