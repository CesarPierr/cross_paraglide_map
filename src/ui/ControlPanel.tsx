import { useState } from 'react';
import { BASEMAPS } from '../map/style';
import type { OverlayMode } from '../model/overlays';
import { useApp, type Basemap, type LayerKey } from '../state/store';
import { getController } from './controller-ref';
import { fetchRidgeWind } from './forecast';
import { fmtHour } from './format';
import { WindDial } from './WindDial';

const PRESETS: { label: string; from: number; kmh: number; hint: string }[] = [
  { label: 'Calme', from: 315, kmh: 0, hint: 'Brises thermiques pures' },
  { label: 'NO faible', from: 315, kmh: 12, hint: 'Régime classique de beau temps' },
  { label: 'Bise', from: 45, kmh: 25, hint: 'Nord-est, air sec' },
  { label: 'Nord', from: 0, kmh: 20, hint: '' },
  { label: 'Ouest', from: 270, kmh: 20, hint: '' },
  { label: 'Sud-Ouest', from: 225, kmh: 20, hint: '' },
  { label: 'Sud / foehn', from: 180, kmh: 35, hint: 'Effet de foehn au nord des crêtes' },
  { label: 'Mistral', from: 335, kmh: 45, hint: 'Alpes du Sud' },
  { label: 'Lombarde', from: 80, kmh: 30, hint: 'Flux d’est depuis l’Italie' },
];

const OVERLAYS: { key: OverlayMode; label: string; hint: string }[] = [
  { key: 'none', label: 'Aucune', hint: '' },
  { key: 'exposure', label: 'Au vent / sous le vent', hint: 'Vert : ascendance dynamique · Rouge : abri, rotors · Orange : venturi' },
  { key: 'thermal', label: 'Potentiel thermique', hint: 'Soleil sur la pente, altitude, reliefs saillants' },
  { key: 'convergence', label: 'Convergences calculées', hint: 'Violet : air qui converge et monte · Bleu : divergence' },
  { key: 'lift', label: 'Ascendances estimées', hint: 'Thermique + dynamique + convergence (m/s)' },
  { key: 'speed', label: 'Force du vent', hint: 'Vitesse du vent à la hauteur choisie' },
];

const LAYERS: { key: LayerKey; label: string; group: 'vent' | 'spots' | 'fond' }[] = [
  { key: 'particles', label: 'Particules de vent 3D', group: 'vent' },
  { key: 'comets', label: 'Flux animés des brises connues', group: 'vent' },
  { key: 'thermalColumns', label: 'Colonnes thermiques animées', group: 'vent' },
  { key: 'breezes', label: 'Tracés des brises documentées', group: 'vent' },
  { key: 'convergences', label: 'Convergences documentées', group: 'vent' },
  { key: 'thermals', label: 'Thermiques connus', group: 'spots' },
  { key: 'soaring', label: 'Spots de soaring', group: 'spots' },
  { key: 'takeoffs', label: 'Décollages', group: 'spots' },
  { key: 'landings', label: 'Atterrissages', group: 'spots' },
  { key: 'hazards', label: 'Pièges et dangers', group: 'spots' },
  { key: 'routes', label: 'Itinéraires cross', group: 'spots' },
  { key: 'kk7Thermals', label: 'Thermiques kk7 (traces GPS)', group: 'fond' },
  { key: 'kk7Skyways', label: 'Skyways kk7', group: 'fond' },
  { key: 'hillshade', label: 'Ombrage solaire de l’heure', group: 'fond' },
  { key: 'labels', label: 'Noms (villes, sommets)', group: 'fond' },
];

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`cp-section ${open ? 'open' : ''}`}>
      <button className="cp-section-title" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        <span className="chev" aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="cp-section-body">{children}</div>}
    </section>
  );
}

export function ControlPanel() {
  const s = useApp();
  const [forecastMsg, setForecastMsg] = useState<string | null>(null);

  const loadForecast = async () => {
    const c = getController();
    if (!c) return;
    const center = c.map.getCenter();
    setForecastMsg('Chargement de la prévision…');
    try {
      const hours = await fetchRidgeWind(center.lat, center.lng);
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const target = Math.round(s.hour);
      const h = hours.find((x) => x.time.startsWith(today) && x.hour === target) ?? hours[0];
      s.set({ synopticFrom: h.fromDeg, synopticKmh: h.speedKmh, month0: Number(h.time.slice(5, 7)) - 1, day: Number(h.time.slice(8, 10)) });
      setForecastMsg(
        `Prévision ${h.time.slice(8, 10)}/${h.time.slice(5, 7)} ${fmtHour(h.hour)} au centre de la vue : 850 hPa ${Math.round(h.w850[1])} km/h du ${Math.round(h.w850[0])}°, 700 hPa ${Math.round(h.w700[1])} km/h du ${Math.round(h.w700[0])}° → crêtes ${h.speedKmh} km/h.`,
      );
    } catch (e) {
      setForecastMsg(`Prévision indisponible (${e instanceof Error ? e.message : 'erreur'})`);
    }
  };

  return (
    <aside className={`control-panel panel ${s.panelOpen ? '' : 'collapsed'}`} aria-label="Réglages de la simulation">
      <Section title="Vent météo (synoptique)">
        <div className="wind-row">
          <WindDial fromDeg={s.synopticFrom} speedKmh={s.synopticKmh} onChange={(d) => s.set({ synopticFrom: d })} />
          <div className="wind-sliders">
            <label className="field">
              <span>
                Force à ~2200 m : <b>{s.synopticKmh} km/h</b>
              </span>
              <input type="range" min={0} max={60} step={1} value={s.synopticKmh} onChange={(e) => s.set({ synopticKmh: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span>
                Brises thermiques : <b>×{s.breezeScale.toFixed(1)}</b>
              </span>
              <input type="range" min={0} max={2} step={0.1} value={s.breezeScale} onChange={(e) => s.set({ breezeScale: Number(e.target.value) })} />
            </label>
          </div>
        </div>
        <div className="chips" role="group" aria-label="Situations types">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={`chip ${s.synopticKmh === p.kmh && (p.kmh === 0 || s.synopticFrom === p.from) ? 'active' : ''}`}
              title={p.hint}
              onClick={() => s.set({ synopticFrom: p.from, synopticKmh: p.kmh })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn ghost small" onClick={() => void loadForecast()}>
          ⤓ Vent prévu aujourd’hui (Open‑Meteo)
        </button>
        {forecastMsg && <p className="hint">{forecastMsg}</p>}
      </Section>

      <Section title="Hauteur de la simulation">
        <div className="seg" role="radiogroup">
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
              Hauteur sol : <b>{s.heightAgl} m</b>
            </span>
            <input type="range" min={20} max={1500} step={10} value={s.heightAgl} onChange={(e) => s.set({ heightAgl: Number(e.target.value) })} />
          </label>
        ) : (
          <label className="field">
            <span>
              Altitude : <b>{s.heightAsl} m</b>
            </span>
            <input type="range" min={500} max={4500} step={50} value={s.heightAsl} onChange={(e) => s.set({ heightAsl: Number(e.target.value) })} />
          </label>
        )}
      </Section>

      <Section title="Analyse drapée sur le relief">
        <div className="radio-list" role="radiogroup">
          {OVERLAYS.map((o) => (
            <label key={o.key} className={`radio ${s.overlay === o.key ? 'on' : ''}`}>
              <input type="radio" name="overlay" checked={s.overlay === o.key} onChange={() => s.set({ overlay: o.key })} />
              <span>
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Calques">
        {(['vent', 'spots', 'fond'] as const).map((g) => (
          <div key={g} className="layer-group">
            <h4>{g === 'vent' ? 'Vent' : g === 'spots' ? 'Spots & connaissances locales' : 'Fond & données externes'}</h4>
            {LAYERS.filter((l) => l.group === g).map((l) => (
              <label key={l.key} className="toggle">
                <input type="checkbox" checked={s.layers[l.key]} onChange={() => s.toggleLayer(l.key)} />
                <span className="switch" aria-hidden />
                <span>{l.label}</span>
              </label>
            ))}
          </div>
        ))}
      </Section>

      <Section title="Affichage" defaultOpen={false}>
        <div className="basemaps">
          {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
            <button key={b} className={`basemap ${s.basemap === b ? 'on' : ''}`} onClick={() => s.set({ basemap: b })} title={BASEMAPS[b].description}>
              {BASEMAPS[b].label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>
            Exagération du relief : <b>×{s.exaggeration.toFixed(1)}</b>
          </span>
          <input type="range" min={1} max={2} step={0.1} value={s.exaggeration} onChange={(e) => s.set({ exaggeration: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>
            Particules : <b>{s.particleCount.toLocaleString('fr-FR')}</b>
          </span>
          <input type="range" min={2000} max={40000} step={1000} value={s.particleCount} onChange={(e) => s.set({ particleCount: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>
            Vitesse d’animation : <b>×{s.particleSpeed.toFixed(1)}</b>
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
