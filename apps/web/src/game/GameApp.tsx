/**
 * « Jeu » tab: a paraglider simulator over the site's 3D map, flying in the site's own
 * wind model (breezes, relief, documented hazards) with thermals and cumulus drawn from
 * it. Start menu (time, season, wind, air mass), first/third-person flight with brakes
 * on the keyboard (A/Q left, E/D right) or two sliders on a touch screen, a pause screen
 * with what the sources say about the place.
 */
import { mergeAtlasText, type Atlas, type AtlasFeature, type FlyingSite } from '@brises/shared';
import { Grid, type GridMeta } from '@brises/model';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createDataClient } from '../data/client';
import { setUiMode } from '../ui/modes';
import { makeRng, randomWeather, type Scenario } from './airmass';
import { fetchDayWeather, weatherAt, type DayWeather } from './forecast';
import { fold, listTakeoffs, type Takeoff } from './takeoffs';
import { WINGS, type WingParams } from './flight';
import { normalizeRoomCode, randomRoomCode } from './net';
import { GameEngine, SAINT_HILAIRE, type FlightEnd, type Hud, type NearbyInfo } from './engine';
import type { ViewMode } from './world';
import './game.css';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
const compass = (deg: number) => COMPASS[Math.round(deg / 22.5) % 16];

interface Settings {
  takeoffId: string;
  month0: number;
  hour: number;
  windFrom: number;
  windKmh: number;
  instability: number;
  humidity: number;
  randomWeather: boolean;
  /** Today's forecast at the take-off drives the wind and the air mass (forecast.ts). */
  forecastWeather: boolean;
  showThermals: boolean;
  view: ViewMode;
  wing: WingParams['id'];
  start: 'air' | 'forward' | 'reverse';
  mass: number;
  /** Cross-country task: id of a documented route, null for free flight. */
  routeId: string | null;
  /** Flying with friends: room code shared with them, pilot name. */
  multi: boolean;
  room: string;
  pilotName: string;
}

const DEFAULTS: Settings = {
  takeoffId: SAINT_HILAIRE.id,
  month0: new Date().getMonth(),
  hour: 13,
  windFrom: 0,
  windKmh: 8,
  instability: 0.55,
  humidity: 0.5,
  randomWeather: true,
  forecastWeather: false,
  showThermals: false,
  view: 'first',
  wing: 'B',
  start: 'air',
  mass: 95,
  routeId: null,
  multi: false,
  room: '',
  pilotName: '',
};

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('brises.game') ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/** One-shot request from the map (« Voler d'ici »): where to start. */
function readGoto(): { lon: number; lat: number; name?: string } | null {
  try {
    const g = JSON.parse(localStorage.getItem('brises.game.goto') ?? 'null') as { lon: number; lat: number; name?: string; t: number } | null;
    // Valid for a minute: opening the game later starts from the last take-off again.
    return g && Date.now() - g.t < 60000 ? g : null;
  } catch {
    return null;
  }
}

/** The take-off nearest to a point, within 1.5 km. */
function nearestTakeoff(list: Takeoff[], p: { lon: number; lat: number }): Takeoff | null {
  let best: Takeoff | null = null;
  let bestD = 1.5;
  for (const t of list) {
    const d = Math.hypot((t.lon - p.lon) * 78, (t.lat - p.lat) * 111);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function TakeoffPicker({ list, value, pending, onPick }: { list: Takeoff[] | null; value: Takeoff; pending: string | null; onPick: (t: Takeoff) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => {
    if (!list) return [];
    const words = fold(q).split(/\s+/).filter(Boolean);
    return list.filter((t) => words.every((w) => fold(`${t.name} ${t.massif}`).includes(w))).slice(0, 40);
  }, [list, q]);
  return (
    <div className="game-field game-takeoff">
      <span>Déco</span>
      <div>
        <button className="gt-current" onClick={() => setOpen(!open)} disabled={pending !== null}>
          {pending !== null ? (
            <>
              <strong>{pending}</strong>
              <small>recherche du décollage…</small>
            </>
          ) : (
            <>
              <strong>{value.name}</strong>
              <small>
                {value.massif} · {Math.round(value.alt)} m · {value.orientation}
              </small>
            </>
          )}
        </button>
        {open && (
          <div className="gt-pop">
            <input autoFocus placeholder={list ? `Chercher parmi ${list.length} décos des Alpes…` : 'Chargement des décos…'} value={q} onChange={(e) => setQ(e.target.value)} />
            <ul>
              {hits.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => {
                      onPick(t);
                      setOpen(false);
                    }}
                  >
                    <strong>{t.name}</strong>
                    <small>
                      {t.massif} · {Math.round(t.alt)} m · {t.orientation}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Menu({ onStart, error, takeoffs, routes }: { onStart: (s: Settings, t: Takeoff) => void; error: string | null; takeoffs: Takeoff[] | null; routes: AtlasFeature[] }) {
  const [s, setS] = useState<Settings>(loadSettings);
  const set = (p: Partial<Settings>) => setS((o) => ({ ...o, ...p }));
  // Today's forecast at the take-off, when chosen.
  const [dayWx, setDayWx] = useState<{ key: string; status: 'ready' | 'error'; list: DayWeather[]; message?: string } | null>(null);
  // « Voler d'ici » from a take-off sheet of the map: the nearest take-off of the list,
  // until the pilot picks another one.
  const [goto, setGoto] = useState(readGoto);
  const gotoTakeoff = useMemo(() => (goto && takeoffs ? nearestTakeoff(takeoffs, goto) : null), [goto, takeoffs]);
  const takeoff = gotoTakeoff ?? takeoffs?.find((t) => t.id === s.takeoffId) ?? SAINT_HILAIRE;
  const wxKey = s.forecastWeather ? `${takeoff.lat.toFixed(2)},${takeoff.lon.toFixed(2)}` : '';
  useEffect(() => {
    if (!wxKey) return;
    const ac = new AbortController();
    const [lat, lon] = wxKey.split(',').map(Number);
    // Until the answer comes, a key other than wxKey reads as loading.
    fetchDayWeather(lat, lon, ac.signal)
      .then((list) => setDayWx({ key: wxKey, status: list.length ? 'ready' : 'error', list, message: list.length ? undefined : 'plus de prévision pour aujourd’hui' }))
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setDayWx({ key: wxKey, status: 'error', list: [], message: e instanceof Error ? e.message : String(e) });
      });
    return () => ac.abort();
  }, [wxKey]);
  const wxNow = s.forecastWeather && dayWx?.key === wxKey && dayWx.status === 'ready' ? weatherAt(dayWx.list, s.hour) : undefined;
  // Documented routes starting within 8 km of the take-off.
  const nearRoutes = useMemo(
    () =>
      routes
        .filter((r) => r.geometry.type === 'LineString')
        .map((r) => {
          const [lon, lat] = (r.geometry.coordinates as [number, number][])[0];
          return { r, d: Math.hypot((lon - takeoff.lon) * 78, (lat - takeoff.lat) * 111) };
        })
        .filter((x) => x.d < 8)
        .sort((a, b) => a.d - b.d),
    [routes, takeoff],
  );
  const routeOk = s.routeId && nearRoutes.some((x) => x.r.properties.id === s.routeId);
  const hh = Math.floor(s.hour);
  const label = (v: number, words: string[]) => words[Math.min(words.length - 1, Math.floor(v * words.length))];
  return (
    <div className="game-menu">
      <div className="game-card">
        <h2>Simulateur de vol</h2>
        <p className="game-lead">
          Le vent, les brises, les effets du relief et les dangers documentés sont ceux du modèle du site ; les thermiques naissent là où il place le potentiel thermique et où des thermiques sont décrits ou mesurés.
        </p>
        <TakeoffPicker
          list={takeoffs}
          value={takeoff}
          pending={goto && !takeoffs ? (goto.name ?? 'Décollage demandé') : null}
          onPick={(t) => {
            setGoto(null);
            set({ takeoffId: t.id });
          }}
        />
        <label className="game-field">
          <span>Aile</span>
          <select value={s.wing} onChange={(e) => set({ wing: e.target.value as WingParams['id'] })}>
            {Object.values(WINGS).map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="game-field">
          <span>Poids total volant</span>
          <input type="range" min={70} max={115} step={5} value={s.mass} onChange={(e) => set({ mass: +e.target.value })} />
          <b>{s.mass} kg</b>
        </label>
        <label className="game-field">
          <span>Mois</span>
          <select value={s.month0} onChange={(e) => set({ month0: +e.target.value })}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="game-field">
          <span>Heure de départ</span>
          <input type="range" min={8} max={19} step={0.25} value={s.hour} onChange={(e) => set({ hour: +e.target.value })} />
          <b>
            {hh}h{String(Math.round((s.hour - hh) * 60)).padStart(2, '0')}
          </b>
        </label>
        <label className="game-check">
          <input type="checkbox" checked={s.forecastWeather} onChange={(e) => set({ forecastWeather: e.target.checked, randomWeather: e.target.checked ? false : s.randomWeather, month0: e.target.checked ? new Date().getMonth() : s.month0 })} /> Météo du jour : la prévision AROME au décollage, aujourd’hui (vent aux crêtes, stabilité de l’air, base des cumulus)
        </label>
        {s.forecastWeather && (
          <p className="game-wx">
            {!dayWx || dayWx.key !== wxKey
              ? 'Chargement de la prévision…'
              : dayWx.status === 'error' || !wxNow
                ? `Prévision indisponible (${dayWx.message ?? 'erreur'}) : la météo aléatoire sera utilisée.`
                : `À ${wxNow.hour} h : vent ${compass(wxNow.windFrom)} ${wxNow.windKmh} km/h aux crêtes${wxNow.lapseRate !== null ? `, ${wxNow.lapseRate.toLocaleString('fr-FR')} °C/km entre 1500 et 3000 m (masse d’air ${label(wxNow.instability, ['stable', 'faible', 'moyenne', 'bonne', 'instable'])})` : ''}${wxNow.cloudBaseM !== null ? `, base des cumulus ≈ ${Math.round(wxNow.cloudBaseM / 50) * 50} m` : ''}${wxNow.cloudCover !== null ? `, ciel couvert à ${Math.round(wxNow.cloudCover)} %` : ''}. Données Open-Meteo.`}
          </p>
        )}
        <label className="game-check">
          <input type="checkbox" checked={s.randomWeather} disabled={s.forecastWeather} onChange={(e) => set({ randomWeather: e.target.checked })} /> Météo aléatoire : tirée selon la saison au décollage, puis elle évolue (le vent tourne et forcit, la masse d’air respire, les cumulus se développent l’après-midi)
        </label>
        {!s.randomWeather && !s.forecastWeather && (
          <>
        <label className="game-field">
          <span>Vent météo</span>
          <input type="range" min={0} max={337.5} step={22.5} value={s.windFrom} onChange={(e) => set({ windFrom: +e.target.value })} />
          <b>{compass(s.windFrom)}</b>
        </label>
        <label className="game-field">
          <span>Force</span>
          <input type="range" min={0} max={40} step={1} value={s.windKmh} onChange={(e) => set({ windKmh: +e.target.value })} />
          <b>{s.windKmh} km/h</b>
        </label>
        <label className="game-field">
          <span>Masse d’air</span>
          <input type="range" min={0} max={1} step={0.05} value={s.instability} onChange={(e) => set({ instability: +e.target.value })} />
          <b>{label(s.instability, ['stable', 'faible', 'moyenne', 'bonne', 'instable'])}</b>
        </label>
        <label className="game-field">
          <span>Humidité</span>
          <input type="range" min={0} max={1} step={0.05} value={s.humidity} onChange={(e) => set({ humidity: +e.target.value })} />
          <b>{label(s.humidity, ['sec (bleu)', 'cumulus hauts', 'cumulus', 'cumulus bas'])}</b>
        </label>
          </>
        )}
        <label className="game-check">
          <input type="checkbox" checked={s.showThermals} onChange={(e) => set({ showThermals: e.target.checked })} /> Afficher les thermiques
        </label>
        <div className="game-seg" role="radiogroup" aria-label="Mode">
          <button className={!s.routeId ? 'on' : ''} onClick={() => set({ routeId: null })}>
            Vol libre
          </button>
          <button className={s.routeId ? 'on' : ''} disabled={!nearRoutes.length} title={nearRoutes.length ? '' : 'Aucun itinéraire documenté ne part de ce déco'} onClick={() => set({ routeId: nearRoutes[0]?.r.properties.id ?? null })}>
            Manche de cross {nearRoutes.length ? `(${nearRoutes.length})` : ''}
          </button>
        </div>
        {s.routeId && (
          <label className="game-field">
            <span>Itinéraire</span>
            <select value={routeOk ? s.routeId : ''} onChange={(e) => set({ routeId: e.target.value })}>
              {nearRoutes.map(({ r }) => (
                <option key={r.properties.id} value={r.properties.id}>
                  {r.properties.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="game-check">
          <input type="checkbox" checked={s.multi} onChange={(e) => set({ multi: e.target.checked, room: s.room || randomRoomCode() })} /> Voler avec des amis (même code de salon, même déco conseillé)
        </label>
        {s.multi && (
          <div className="game-multi">
            <label className="game-field">
              <span>Code du salon</span>
              <input value={s.room} maxLength={12} onChange={(e) => set({ room: normalizeRoomCode(e.target.value) })} />
              <button onClick={() => set({ room: randomRoomCode() })}>Nouveau</button>
            </label>
            <label className="game-field">
              <span>Ton nom</span>
              <input value={s.pilotName} maxLength={24} placeholder="Pilote" onChange={(e) => set({ pilotName: e.target.value })} />
            </label>
          </div>
        )}
        <div className="game-seg" role="radiogroup" aria-label="Départ">
          {(
            [
              ['air', 'En l’air'],
              ['forward', 'Déco face pente'],
              ['reverse', 'Déco face voile'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} className={s.start === v ? 'on' : ''} onClick={() => set({ start: v })}>
              {l}
            </button>
          ))}
        </div>
        <div className="game-seg" role="radiogroup" aria-label="Vue">
          {(['first', 'third'] as const).map((v) => (
            <button key={v} className={s.view === v ? 'on' : ''} onClick={() => set({ view: v })}>
              {v === 'first' ? 'Première personne' : 'Troisième personne'}
            </button>
          ))}
        </div>
        {error && <p className="game-error">{error}</p>}
        <div className="game-actions">
          <button
            className="game-go"
            disabled={goto !== null && !takeoffs}
            onClick={() =>
              onStart(
                {
                  ...s,
                  takeoffId: takeoff.id,
                  routeId: routeOk ? s.routeId : null,
                  // Today's forecast, or random weather if it could not be had.
                  ...(s.forecastWeather ? (wxNow ? { windFrom: wxNow.windFrom, windKmh: wxNow.windKmh, instability: wxNow.instability, humidity: wxNow.humidity, randomWeather: false, month0: new Date().getMonth() } : { randomWeather: true, forecastWeather: false }) : {}),
                },
                takeoff,
              )
            }
          >
            Voler
          </button>
          <button className="game-quit" onClick={() => setUiMode('explore')}>
            Quitter
          </button>
        </div>
        <Keys />
      </div>
    </div>
  );
}

function Keys() {
  return isTouch() ? (
    <p className="game-keys">Glisse les deux curseurs latéraux pour les freins, fais glisser le paysage pour tourner la tête.</p>
  ) : (
    <p className="game-keys">
      <kbd>A</kbd>/<kbd>Q</kbd> frein gauche + / − · <kbd>E</kbd>/<kbd>D</kbd> frein droit + / − · <kbd>S</kbd>/<kbd>F</kbd> sellette gauche / droite · <kbd>Espace</kbd> accélérateur (progressif) · au déco : <kbd>Z</kbd> courir / tirer les A, <kbd>Espace</kbd> se retourner, <kbd>X</kbd> affaler la voile, <kbd>R</kbd> recommencer · <kbd>O</kbd> oreilles · <kbd>X</kbd> en vol : stabilo (cravate) · flèches : tête · <kbd>C</kbd> regard devant · <kbd>V</kbd> vue · <kbd>T</kbd> thermiques ·{' '}
      <kbd>P</kbd> pause et infos · <kbd>M</kbd> son · <kbd>+</kbd>/<kbd>−</kbd> temps accéléré
    </p>
  );
}

function MultiPanel({ m, onSend }: { m: NonNullable<Hud['multi']>; onSend: (t: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="game-multi-hud">
      <div className="gm-head">
        Salon <b>{m.room}</b> · {m.status === 'open' ? `${m.pilots.length + 1} en vol` : m.status === 'reconnecting' ? 'reconnexion…' : 'connexion…'}
      </div>
      <ul>
        {m.pilots.map((p) => (
          <li key={p.name + p.distKm.toFixed(2)}>
            {p.name} · {p.distKm.toFixed(1)} km · {p.dz >= 0 ? '+' : ''}
            {Math.round(p.dz)} m
          </li>
        ))}
      </ul>
      {m.chat.length > 0 && (
        <div className="gm-chat">
          {m.chat.map((c, i) => (
            <p key={i} className={c.self ? 'self' : ''}>
              <b>{c.name}</b> {c.text}
            </p>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSend(text.trim());
          setText('');
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        <input value={text} maxLength={200} placeholder="Message (Entrée)" onChange={(e) => setText(e.target.value)} />
      </form>
    </div>
  );
}

function Vario({ h }: { h: Hud }) {
  const v = h.vario;
  const cls = v > 0.3 ? 'up' : v < -2 ? 'down' : '';
  return (
    <div className="game-vario">
      <div className={`gv-main ${cls}`}>
        {v >= 0 ? '+' : '−'}
        {Math.abs(v).toFixed(1)}
        <small>m/s</small>
      </div>
      <div className="gv-row">
        <span>{Math.round(h.alt)} m</span>
        <span>sol {Math.round(h.agl)} m</span>
      </div>
      <div className="gv-row">
        <span>{Math.round(h.airKmh)} km/h air</span>
        <span>{Math.round(h.groundKmh)} sol</span>
      </div>
    </div>
  );
}

function WindRose({ h }: { h: Hud }) {
  // Arrow drawn relative to the heading: where the wind blows to, seen from the pilot.
  const rel = h.windFrom + 180 - h.heading;
  return (
    <div className="game-wind" title="Vent du modèle à ta position">
      <svg viewBox="-20 -20 40 40" width="46" height="46">
        <circle r="18" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.35)" />
        <g transform={`rotate(${rel})`}>
          <path d="M0 -13 L5 4 L0 1 L-5 4 Z" fill="#7dd3fc" />
        </g>
      </svg>
      <span>
        {compass(h.windFrom)} {Math.round(h.windKmh)} km/h
      </span>
    </div>
  );
}

function BrakeBar({ side, v, pressure, soft, touch, onChange }: { side: 'L' | 'R'; v: number; pressure: number; soft: boolean; touch: boolean; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = (e: React.PointerEvent) => {
    if (!touch || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    onChange(Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
  };
  return (
    <div
      ref={ref}
      className={`game-brake ${side === 'L' ? 'left' : 'right'} ${touch ? 'touch' : ''} ${soft ? 'soft' : ''}`}
      title={soft ? 'La pression mollit : la voile approche de la fermeture, freinez un peu (pilotage actif)' : undefined}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag(e);
      }}
      onPointerMove={(e) => e.buttons && drag(e)}
      aria-label={side === 'L' ? 'Frein gauche' : 'Frein droit'}
    >
      <div className="gb-fill" style={{ height: `${v * 100}%`, background: v > 0.85 ? '#fb7185' : v > 0.6 ? '#fbbf24' : '#38bdf8' }} />
      <em>{pressure.toFixed(1)} kg</em>
      <span>{side === 'L' ? (touch ? 'G' : 'A/Q') : touch ? 'D' : 'E/D'}</span>
      <b>{Math.round(v * 100)}%</b>
    </div>
  );
}

function Pause({ engine, onResume, onRestart, onMenu }: { engine: GameEngine; onResume: () => void; onRestart: () => void; onMenu: () => void }) {
  const [items] = useState<NearbyInfo[]>(() => engine.nearby(10));
  const [open, setOpen] = useState<string | null>(null);
  const [topo, setTopo] = useState(engine.topo);
  const toggleTopo = () => {
    engine.setTopo(!topo);
    setTopo(!topo);
  };
  const w = engine.air;
  const CAT: Record<string, string> = { thermals: 'Thermique', breezes: 'Brise', hazards: 'Danger', convergences: 'Convergence', soaring: 'Dynamique', takeoffs: 'Déco', landings: 'Atterro', routes: 'Itinéraire' };
  return (
    <div className={`game-pause ${topo ? 'topo' : ''}`}>
      <div className="game-card wide">
        <div className="gp-head">
          <h2>{topo ? 'Point topo' : 'Pause — ce que disent les sources ici'}</h2>
          <div className="game-actions">
            <button className="game-go" onClick={onResume}>
              Reprendre
            </button>
            <button className={topo ? 'on' : ''} onClick={toggleTopo}>
              {topo ? 'Fermer la carte' : 'Carte topo'}
            </button>
            <button onClick={onRestart}>Recommencer</button>
            <button onClick={onMenu}>Menu</button>
          </div>
        </div>
        <p className="gp-weather">
          Météo du moment : vent {compass(w.windFrom)} {Math.round(w.windKmh)} km/h en altitude · masse d’air {w.instability < 0.3 ? 'stable' : w.instability < 0.55 ? 'moyenne' : w.instability < 0.75 ? 'bonne' : 'instable'} · plafond ≈ {Math.round(w.ceiling(800) / 50) * 50} m sur les reliefs moyens
          {w.cloudBase(800) < w.ceiling(800) ? ` · base des cumulus ≈ ${Math.round(w.cloudBase(800) / 50) * 50} m` : ' · thermiques bleus'}
        </p>
        <ul className="gp-list">
          {items.slice(0, 60).map((it) => (
            <li key={it.category + it.id} className={open === it.id ? 'open' : ''}>
              <button
                onClick={() => {
                  setOpen(open === it.id ? null : it.id);
                  if (topo) engine.world.topoFocus(it.lon, it.lat);
                }}
              >
                <span className={`gp-cat c-${it.category}`}>{CAT[it.category] ?? it.category}</span>
                <span className="gp-name">{it.name}</span>
                <span className="gp-dist">
                  {it.distKm.toFixed(1)} km {compass(it.bearing)}
                </span>
              </button>
              {open === it.id && <p>{it.description || 'Pas de description.'}</p>}
            </li>
          ))}
        </ul>
        <Keys />
      </div>
    </div>
  );
}

export default function GameApp() {
  const box = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [phase, setPhase] = useState<'menu' | 'loading' | 'flying'>('menu');
  const [status, setStatus] = useState<string | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [end, setEnd] = useState<FlightEnd | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Data for the model, fetched once (the browser cache has it if the map was opened).
  const [data] = useState<Promise<{ atlas: Atlas; meta: GridMeta; url: string }>>(() =>
    createDataClient().then(async (d) => {
      const [atlas, meta] = await Promise.all([d.atlas(), d.demMeta()]);
      const text = await d.atlasText().catch(() => null);
      return { atlas: text ? mergeAtlasText(atlas, text) : atlas, meta, url: d.demUrl() };
    }),
  );
  /** The running engine, for rendering; the ref serves the event handlers. */
  const [eng, setEng] = useState<GameEngine | null>(null);
  const [takeoffs, setTakeoffs] = useState<Takeoff[] | null>(null);
  const [routes, setRoutes] = useState<AtlasFeature[]>([]);
  const touch = isTouch();

  useEffect(() => {
    let alive = true;
    void data.then(async ({ atlas, meta }) => {
      const ffvl = await fetch(new URL('data/sites-ffvl.json', document.baseURI).href)
        .then((r) => (r.ok ? (r.json() as Promise<FlyingSite[]>) : []))
        .catch(() => [] as FlyingSite[]);
      const grid = new Grid(meta);
      // Inside the model's grid, with a margin for the thermal window.
      const inGrid = (lon: number, lat: number) => {
        const [x, y] = grid.toGrid(lon, lat);
        return x > 20 && y > 20 && x < grid.width - 20 && y < grid.height - 20;
      };
      if (alive) {
        setTakeoffs(listTakeoffs(atlas, ffvl, inGrid));
        setRoutes(atlas.features.routes ?? []);
      }
    });
    return () => {
      alive = false;
    };
  }, [data]);

  const startFlight = async (s: Settings, takeoff: Takeoff) => {
    try {
      localStorage.setItem('brises.game', JSON.stringify(s));
      localStorage.removeItem('brises.game.goto');
    } catch {
      /* private mode */
    }
    setPhase('loading');
    setError(null);
    setStatus('Chargement des données…');
    try {
      const { atlas, meta, url } = await data;
      const now = new Date();
      const seed = (now.getTime() & 0xffffff) ^ 0x5bd1e995;
      const w = s.randomWeather ? randomWeather(s.month0, makeRng(seed + 17)) : s;
      const scenario: Scenario = {
        month0: s.month0,
        day: s.forecastWeather ? new Date().getDate() : 15,
        hour: s.hour,
        windFrom: w.windFrom,
        windKmh: w.windKmh,
        instability: w.instability,
        humidity: w.humidity,
        randomWeather: s.randomWeather,
        timeScale: 1,
        seed,
      };
      engineRef.current?.dispose();
      const engine = new GameEngine(box.current!, scenario, atlas, { meta, url }, takeoff, { onHud: setHud, onStatus: setStatus, onEnd: setEnd }, { view: s.view, showThermals: s.showThermals, wing: s.wing, start: s.start, mass: s.mass, routeId: s.routeId, multi: s.multi && s.room.length >= 4 ? { room: s.room, name: s.pilotName.trim() || 'Pilote' } : null });
      engineRef.current = engine;
      setEng(engine);
      if (import.meta.env.DEV) (window as unknown as { __game: GameEngine }).__game = engine;
      await engine.load();
      setPhase('flying');
    } catch (e) {
      setError(`Impossible de lancer le vol : ${e instanceof Error ? e.message : String(e)}`);
      setPhase('menu');
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng || (e.target as HTMLElement).closest('input, select, textarea')) return;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      if (!e.repeat) eng.keyDown(e.key);
    };
    const up = (e: KeyboardEvent) => engineRef.current?.keyUp(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const toMenu = () => {
    engineRef.current?.dispose();
    engineRef.current = null;
    setEng(null);
    setHud(null);
    setEnd(null);
    setPhase('menu');
  };
  // Look around by dragging on a touch screen.
  const lookStart = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="game-app">
      <div
        ref={box}
        className="game-map"
        onPointerDown={(e) => (lookStart.current = { x: e.clientX, y: e.clientY })}
        onPointerMove={(e) => {
          if (!lookStart.current || !e.buttons || !engineRef.current) return;
          engineRef.current.look((e.clientX - lookStart.current.x) * 0.006, -(e.clientY - lookStart.current.y) * 0.006);
          lookStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (lookStart.current = null)}
      />
      {hud && phase === 'flying' && (
        <>
          <div className="game-whiteout" style={{ opacity: Math.min(0.97, hud.whiteout) }} />
          <div className="game-hud-top">
            <Vario h={hud} />
            <WindRose h={hud} />
            <div className="game-info">
              <span>{hud.clock}</span>
              <span>
                vol {Math.floor(hud.flightS / 60)} min · {hud.distKm.toFixed(1)} km
              </span>
              <span>plafond ≈ {Math.round(hud.ceiling / 50) * 50} m{hud.cloudBase ? ` · base ${Math.round(hud.cloudBase / 50) * 50} m` : ' · thermiques bleus'}</span>
              <span>aile EN-{hud.wing}</span>
              {hud.timeScale > 1 && <span>temps ×{hud.timeScale}</span>}
              {hud.load > 1.6 && <span className="warn">{hud.load.toFixed(1)} g</span>}
            </div>
            <div className="game-buttons">
              <button onClick={() => eng?.setView(hud.view === 'first' ? 'third' : 'first')} title="Vue (V)">
                {hud.view === 'first' ? '3e pers.' : '1re pers.'}
              </button>
              <button onClick={() => eng?.toggleThermals()} className={hud.showThermals ? 'on' : ''} title="Thermiques (T)">
                Thermiques
              </button>
              <button onClick={() => eng?.setPaused(!eng.paused)} title="Pause et infos (P)">
                {hud.paused ? 'Reprendre' : 'Pause'}
              </button>
            </div>
          </div>
          {(hud.incident || hud.hazard) && (
            <div className="game-alert">
              {hud.incident && <strong>{hud.incident}</strong>}
              {hud.hazard && <span>Zone documentée : {hud.hazard}</span>}
            </div>
          )}
          {hud.multi && <MultiPanel m={hud.multi} onSend={(t) => eng?.sendChat(t)} />}
          {hud.task && (
            <div className={`game-task ${hud.task.goal ? 'goal' : ''}`}>
              <span className="gt-name">{hud.task.name}</span>
              {hud.task.goal ? (
                <strong>But atteint · {hud.task.clock}</strong>
              ) : (
                <>
                  <span className="gt-arrow" style={{ transform: `rotate(${hud.task.relBearing}deg)` }} aria-hidden>
                    ▲
                  </span>
                  <strong>
                    Balise {hud.task.index}/{hud.task.count} : {hud.task.next}
                  </strong>
                  <span>
                    {hud.task.distKm.toFixed(1)} km · finesse {hud.task.glide ? hud.task.glide.toFixed(1) : '—'} · {hud.task.doneKm.toFixed(1)}/{hud.task.totalKm.toFixed(1)} km · {hud.task.clock}
                  </span>
                </>
              )}
            </div>
          )}
          {hud.launch && (
            <div className="game-launch">
              <strong>{hud.launch.hint}</strong>
              <div className="gl-row">
                <span>voile {hud.launch.theta}°</span>
                <span>côté {hud.launch.phi > 0 ? '+' : ''}{hud.launch.phi}°</span>
                <span>vitesse air {hud.launch.airKmh} km/h</span>
              </div>
              <div className="gl-gauge" aria-hidden>
                <i style={{ transform: `rotate(${hud.launch.phi}deg) translateY(-${Math.round(Math.sin((Math.min(hud.launch.theta, 120) * Math.PI) / 180) * 28)}px)` }} />
              </div>
              {touch && (
                <div className="gl-touch">
                  <button onPointerDown={() => eng?.setLaunchInput(true, false)} onPointerUp={() => eng?.setLaunchInput(false, false)} onPointerLeave={() => eng?.setLaunchInput(false, false)}>
                    {hud.launch.facingWing ? 'Tirer les A' : 'Courir'}
                  </button>
                  {hud.launch.facingWing && <button onClick={() => eng?.setLaunchInput(false, true)}>Se retourner</button>}
                  <button onPointerDown={() => eng?.setLaunchInput(false, false, true)} onPointerUp={() => eng?.setLaunchInput(false, false, false)} onPointerLeave={() => eng?.setLaunchInput(false, false, false)}>
                    Affaler
                  </button>
                  {(hud.launch.phase === 'aborted' || hud.launch.phase === 'ready') && <button onClick={() => eng?.relaunch()}>Recommencer</button>}
                </div>
              )}
            </div>
          )}
          {hud.landing && (
            <div className="game-launch landing">
              <strong>{hud.landing.hint}</strong>
              <div className="gl-row">
                <span>course {Math.round(hud.landing.speedKmh)} km/h</span>
              </div>
              {touch && (
                <div className="gl-touch">
                  <button onPointerDown={() => eng?.setLaunchInput(false, false, true)} onPointerUp={() => eng?.setLaunchInput(false, false, false)} onPointerLeave={() => eng?.setLaunchInput(false, false, false)}>
                    Affaler
                  </button>
                </div>
              )}
            </div>
          )}
          <BrakeBar side="L" v={hud.brakeL} pressure={hud.pressureL} soft={hud.pressureWarn > 0.5} touch={touch} onChange={(v) => eng?.setBrake('L', v)} />
          <BrakeBar side="R" v={hud.brakeR} pressure={hud.pressureR} soft={hud.pressureWarn > 0.5} touch={touch} onChange={(v) => eng?.setBrake('R', v)} />
          {touch && (
            <button className={`game-bar ${hud.speedbar > 0.5 ? 'on' : ''}`} onPointerDown={() => eng?.setSpeedbar(1)} onPointerUp={() => eng?.setSpeedbar(0)} onPointerLeave={() => eng?.setSpeedbar(0)}>
              Accélérateur
            </button>
          )}
          <div className="game-barind" title="Accélérateur (Espace) et oreilles (O)">
            <span>Accélérateur</span>
            <i>
              <b style={{ width: `${hud.speedbar * 100}%` }} />
            </i>
            {hud.ears && <strong>Oreilles</strong>}
            <span title="Sellette : S à gauche, F à droite">Sellette</span>
            <i className="gw" aria-label={`Sellette ${hud.weight < -0.1 ? 'à gauche' : hud.weight > 0.1 ? 'à droite' : 'au centre'}`}>
              <b style={{ left: `${50 + hud.weight * 50}%` }} />
            </i>
          </div>
          {touch && (
            <button className={`game-ears ${hud.ears ? 'on' : ''}`} onClick={() => eng?.toggleEars()}>
              Oreilles
            </button>
          )}
          {hud.paused && eng && !end && (
            <Pause
              engine={eng}
              onResume={() => eng.setPaused(false)}
              onRestart={() => {
                eng.restart();
                setEnd(null);
              }}
              onMenu={toMenu}
            />
          )}
        </>
      )}
      {end && eng && (
        <div className="game-pause">
          <div className="game-card">
            <h2>{end.kind === 'landed' ? 'Posé !' : end.kind === 'hard' ? 'Posé, un peu dur' : end.kind === 'launch' ? 'Décollage raté' : 'Crash'}</h2>
            {end.task && (
              <p className="game-task-result">
                Manche « {end.task.name} » : {end.task.goal ? `but en ${end.task.time}` : `${end.task.madeKm.toFixed(1)} km validés sur ${end.task.totalKm.toFixed(1)} (balises ${end.task.tagged}/${end.task.count})`}
              </p>
            )}
            {end.kind === 'launch' ? (
              <p>{end.reason}</p>
            ) : (
            <p>
              {Math.round(end.flightS / 60)} min de vol · {end.distKm.toFixed(1)} km · plus haut {Math.round(end.maxAlt)} m · contact à {end.vz.toFixed(1)} m/s et {Math.round(end.groundKmh)} km/h sol
            </p>
            )}
            <div className="game-actions">
              <button
                className="game-go"
                onClick={() => {
                  eng.restart();
                  setEnd(null);
                }}
              >
                Revoler
              </button>
              <button onClick={toMenu}>Menu</button>
            </div>
          </div>
        </div>
      )}
      {phase === 'menu' && <Menu onStart={startFlight} error={error} takeoffs={takeoffs} routes={routes} />}
      {phase === 'loading' && (
        <div className="game-menu">
          <div className="game-card narrow">
            <div className="spinner" />
            <p>{status ?? 'Chargement…'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
