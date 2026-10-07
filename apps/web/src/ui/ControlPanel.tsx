import { compassFr } from '@brises/model';
import { useState } from 'react';
import type { OverlayMode } from '../engine/cpu-overlays';
import { AIRSPACE_COLORS, BREEZE_COLORS, COLORS } from '../map/palette';
import { BASEMAPS } from '../map/style';
import { useApp, useRuntime, type Basemap, type LayerKey } from '../state/store';
import { getController, getDataClient } from './controller-ref';
import { fmtHour, MONTHS } from './format';
import { IconChevron, IconDownload, IconLayers, IconMountain, IconSpark, IconWind } from './icons';
import { WindDial } from './WindDial';

const PRESETS: { label: string; from: number; kmh: number; hint: string }[] = [
  { label: 'Calme', from: 315, kmh: 0, hint: 'Brises thermiques pures' },
  { label: 'NO faible', from: 315, kmh: 12, hint: 'Régime classique de beau temps' },
  { label: 'Bise', from: 45, kmh: 25, hint: 'Nord-est sec' },
  { label: 'Nord', from: 0, kmh: 20, hint: '' },
  { label: 'Ouest', from: 270, kmh: 20, hint: '' },
  { label: 'Sud-ouest', from: 225, kmh: 20, hint: '' },
  { label: 'Sud · foehn', from: 180, kmh: 35, hint: 'Effet de foehn au nord des crêtes' },
  { label: 'Mistral', from: 335, kmh: 45, hint: 'Alpes du Sud' },
  { label: 'Lombarde', from: 80, kmh: 30, hint: 'Flux d’est depuis l’Italie' },
];

const OVERLAYS: { key: OverlayMode; label: string; hint: string }[] = [
  { key: 'none', label: 'Aucune', hint: '' },
  { key: 'exposure', label: 'Au vent / sous le vent', hint: 'Vert : l’air monte sur le relief · rouge : abri, rotors · orange : venturi' },
  { key: 'thermal', label: 'Potentiel thermique', hint: 'Soleil sur la pente, altitude, reliefs saillants' },
  { key: 'convergence', label: 'Convergences', hint: 'Violet : l’air converge et monte · bleu : il diverge et descend' },
  { key: 'lift', label: 'Ascendances estimées', hint: 'Thermique + dynamique + convergence' },
  { key: 'speed', label: 'Force du vent', hint: 'Vitesse à la hauteur simulée' },
];

const LAYER_GROUPS: { title: string; items: { key: LayerKey; label: string; color?: string }[] }[] = [
  {
    title: 'Vent simulé',
    items: [
      { key: 'particles', label: 'Particules de vent', color: '#7dd3fc' },
      { key: 'comets', label: 'Flux des brises connues', color: BREEZE_COLORS.valley },
      { key: 'thermalColumns', label: 'Colonnes thermiques', color: COLORS.thermal },
    ],
  },
  {
    title: 'Connaissances locales',
    items: [
      { key: 'breezes', label: 'Brises documentées', color: BREEZE_COLORS.valley },
      { key: 'convergences', label: 'Convergences', color: COLORS.convergence },
      { key: 'hazards', label: 'Pièges et dangers', color: COLORS.hazard },
      { key: 'thermals', label: 'Thermiques connus', color: COLORS.thermal },
      { key: 'soaring', label: 'Soaring', color: COLORS.soaring },
      { key: 'routes', label: 'Itinéraires cross', color: COLORS.route },
    ],
  },
  {
    title: 'Sites et espace aérien',
    items: [
      { key: 'takeoffs', label: 'Décos cités par les sources', color: COLORS.takeoff },
      { key: 'landings', label: 'Atterros cités par les sources', color: COLORS.landing },
      { key: 'sitesOfficial', label: 'Sites officiels FFVL', color: COLORS.takeoff },
      { key: 'sitesCommunity', label: 'Sites communautaires (OSM, PGE)', color: COLORS.takeoffCommunity },
      { key: 'airspace', label: 'Espaces aériens et protocoles FFVL', color: AIRSPACE_COLORS.R },
      { key: 'airspaceProtect', label: 'Protection faune et parcs', color: AIRSPACE_COLORS.PROTECT },
      { key: 'airspaceActivity', label: 'Parachutage, treuils, vol à voile', color: AIRSPACE_COLORS.PJE },
    ],
  },
  {
    title: 'Fond',
    items: [
      { key: 'kk7Thermals', label: 'Thermiques kk7 (traces GPS)' },
      { key: 'kk7Skyways', label: 'Skyways kk7' },
      { key: 'hillshade', label: 'Ombrage solaire de l’heure' },
      { key: 'labels', label: 'Noms de lieux et sommets' },
    ],
  },
];

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`cp-section ${open ? 'open' : ''}`}>
      <button className="cp-section-title" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          {icon}
          {title}
        </span>
        <IconChevron size={16} className="chev" />
      </button>
      {open && <div className="cp-section-body">{children}</div>}
    </section>
  );
}

/** One-paragraph reading of the simulated situation. */
function Situation() {
  const s = useApp();
  const sun = useRuntime((r) => r.sun);
  const kmh = s.synopticKmh;
  const day = sun && sun.elevation > 3;
  let breeze: string;
  if (!day) breeze = 'Nuit : brises descendantes, air stable en vallée.';
  else if (s.hour < 10.5) breeze = 'Matin : les pentes au soleil s’activent, les vallées basculent vers la brise montante.';
  else if (s.hour < 12.5) breeze = 'Fin de matinée : brises montantes en place, les grandes vallées forcissent.';
  else if (s.hour < 17.5) breeze = 'Après‑midi : brises de vallée établies (souvent 15–30 km/h dans les grands axes), convergences actives sur les crêtes.';
  else breeze = 'Fin de journée : les brises faiblissent, restitution sur les faces ouest, bascule vers la brise descendante au coucher.';
  const wind =
    kmh < 5
      ? 'Sans vent météo, le relief et le soleil pilotent tout.'
      : kmh < 15
        ? `Vent météo faible de ${compassFr(s.synopticFrom)} : il décale les convergences et renforce les brises dans le même sens.`
        : kmh < 30
          ? `Vent de ${compassFr(s.synopticFrom)} ${kmh} km/h : faces au vent porteuses en dynamique, zones sous le vent à éviter.`
          : `Vent fort de ${compassFr(s.synopticFrom)} ${kmh} km/h : les brises sont écrasées, turbulences sous le vent et venturis marqués.`;
  return (
    <div className="situation">
      <p className="situation-head">
        {fmtHour(Math.round(s.hour * 4) / 4)} · {MONTHS[s.month0]} · {kmh < 3 ? 'vent calme' : `${compassFr(s.synopticFrom)} ${kmh} km/h`}
      </p>
      <p>{breeze}</p>
      <p>{wind}</p>
    </div>
  );
}

export function ControlPanel() {
  const s = useApp();
  const [forecastMsg, setForecastMsg] = useState<string | null>(null);

  const loadForecast = async () => {
    const c = getController();
    const w = getDataClient()?.weather();
    if (!c || !w) return;
    const center = c.map.getCenter();
    setForecastMsg('Chargement de la prévision…');
    try {
      const hours = await w.synoptic(center.lat, center.lng);
      const today = new Date().toISOString().slice(0, 10);
      const h = hours.find((x) => x.time.startsWith(today) && x.hour === Math.round(s.hour)) ?? hours[0];
      s.set({ synopticFrom: h.fromDeg, synopticKmh: h.speedKmh, month0: Number(h.time.slice(5, 7)) - 1, day: Number(h.time.slice(8, 10)) });
      const l = h.levels ?? {};
      setForecastMsg(
        `Prévu le ${h.time.slice(8, 10)}/${h.time.slice(5, 7)} à ${h.hour}h au centre de la vue : ${l['850hPa'] ? `1500 m ${compassFr(l['850hPa'][0])} ${Math.round(l['850hPa'][1])} km/h, ` : ''}${l['700hPa'] ? `3000 m ${compassFr(l['700hPa'][0])} ${Math.round(l['700hPa'][1])} km/h` : ''}.`,
      );
    } catch (e) {
      setForecastMsg(`Prévision indisponible (${e instanceof Error ? e.message : 'erreur'}).`);
    }
  };

  return (
    <aside className={`control-panel panel ${s.panelOpen ? '' : 'collapsed'}`} aria-label="Réglages de la simulation">
      <Situation />
      <Section title="Vent météo" icon={<IconWind size={16} />}>
        <div className="wind-row">
          <WindDial fromDeg={s.synopticFrom} speedKmh={s.synopticKmh} onChange={(d) => s.set({ synopticFrom: d })} />
          <div className="wind-sliders">
            <label className="field">
              <span>
                Vent aux crêtes <b>{s.synopticKmh} km/h</b>
              </span>
              <input type="range" min={0} max={60} step={1} value={s.synopticKmh} onChange={(e) => s.set({ synopticKmh: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span>
                Brises thermiques <b>×{s.breezeScale.toFixed(1)}</b>
              </span>
              <input type="range" min={0} max={2} step={0.1} value={s.breezeScale} onChange={(e) => s.set({ breezeScale: Number(e.target.value) })} />
            </label>
          </div>
        </div>
        <div className="chips" role="group" aria-label="Situations types">
          {PRESETS.map((p) => (
            <button key={p.label} className={`chip ${s.synopticKmh === p.kmh && (p.kmh === 0 || s.synopticFrom === p.from) ? 'active' : ''}`} title={p.hint} onClick={() => s.set({ synopticFrom: p.from, synopticKmh: p.kmh })}>
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn ghost small" onClick={() => void loadForecast()}>
          <IconDownload size={15} /> Vent prévu (Open‑Meteo)
        </button>
        {forecastMsg && <p className="hint">{forecastMsg}</p>}
      </Section>

      <Section title="Hauteur simulée" icon={<IconMountain size={16} />}>
        <div className="seg" role="radiogroup" aria-label="Référence de hauteur">
          <button className={s.heightMode === 'agl' ? 'on' : ''} onClick={() => s.set({ heightMode: 'agl' })} role="radio" aria-checked={s.heightMode === 'agl'}>
            Au‑dessus du sol
          </button>
          <button className={s.heightMode === 'asl' ? 'on' : ''} onClick={() => s.set({ heightMode: 'asl' })} role="radio" aria-checked={s.heightMode === 'asl'}>
            Altitude fixe
          </button>
        </div>
        {s.heightMode === 'agl' ? (
          <label className="field">
            <span>
              Hauteur sol <b>{s.heightAgl} m</b>
            </span>
            <input type="range" min={20} max={1500} step={10} value={s.heightAgl} onChange={(e) => s.set({ heightAgl: Number(e.target.value) })} />
          </label>
        ) : (
          <label className="field">
            <span>
              Altitude <b>{s.heightAsl} m</b>
            </span>
            <input type="range" min={500} max={4500} step={50} value={s.heightAsl} onChange={(e) => s.set({ heightAsl: Number(e.target.value) })} />
          </label>
        )}
      </Section>

      <Section title="Analyse sur le relief" icon={<IconSpark size={16} />}>
        <div className="radio-list" role="radiogroup">
          {OVERLAYS.map((o) => (
            <label key={o.key} className={`radio ${s.overlay === o.key ? 'on' : ''}`}>
              <input type="radio" name="overlay" checked={s.overlay === o.key} onChange={() => s.set({ overlay: o.key })} />
              <span>
                {o.label}
                {o.hint && s.overlay === o.key && <small>{o.hint}</small>}
              </span>
            </label>
          ))}
        </div>
        {s.overlay !== 'none' && (
          <label className="field">
            <span>
              Opacité <b>{Math.round(s.overlayOpacity * 100)} %</b>
            </span>
            <input type="range" min={0.2} max={1} step={0.05} value={s.overlayOpacity} onChange={(e) => s.set({ overlayOpacity: Number(e.target.value) })} />
          </label>
        )}
      </Section>

      <Section title="Calques" icon={<IconLayers size={16} />}>
        {LAYER_GROUPS.map((g) => (
          <div key={g.title} className="layer-group">
            <h4>{g.title}</h4>
            {g.items.map((l) => (
              <label key={l.key} className="toggle">
                <input type="checkbox" checked={s.layers[l.key]} onChange={() => s.toggleLayer(l.key)} />
                <span className="switch" aria-hidden />
                {l.color && <i className="swatch" style={{ background: l.color }} />}
                <span>{l.label}</span>
              </label>
            ))}
          </div>
        ))}
      </Section>

      <Section title="Affichage" defaultOpen={false}>
        <div className="basemaps" role="radiogroup" aria-label="Fond de carte">
          {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
            <button key={b} className={`basemap bm-${b} ${s.basemap === b ? 'on' : ''}`} onClick={() => s.set({ basemap: b })} title={BASEMAPS[b].description} role="radio" aria-checked={s.basemap === b}>
              <span className="bm-thumb" aria-hidden />
              {BASEMAPS[b].label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>
            Relief exagéré <b>×{s.exaggeration.toFixed(1)}</b>
          </span>
          <input type="range" min={1} max={2} step={0.1} value={s.exaggeration} onChange={(e) => s.set({ exaggeration: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>
            Particules <b>{s.particleCount.toLocaleString('fr-FR')}</b>
          </span>
          <input type="range" min={2000} max={40000} step={1000} value={s.particleCount} onChange={(e) => s.set({ particleCount: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>
            Vitesse d’animation <b>×{s.particleSpeed.toFixed(1)}</b>
          </span>
          <input type="range" min={0.3} max={3} step={0.1} value={s.particleSpeed} onChange={(e) => s.set({ particleSpeed: Number(e.target.value) })} />
        </label>
        <div className="seg" role="radiogroup" aria-label="Couleur des particules">
          <button className={s.particleColor === 'speed' ? 'on' : ''} onClick={() => s.set({ particleColor: 'speed' })}>
            Couleur : vitesse
          </button>
          <button className={s.particleColor === 'lift' ? 'on' : ''} onClick={() => s.set({ particleColor: 'lift' })}>
            Couleur : ascendance
          </button>
        </div>
      </Section>
    </aside>
  );
}
