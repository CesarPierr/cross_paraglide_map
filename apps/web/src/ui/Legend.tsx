import { BREEZE_COLORS, COLORS } from '../map/palette';
import { READABILITY_LABELS } from '../map/tiers';
import { remember, useApp, type Readability } from '../state/store';
import { KIND_LABELS } from './format';

const READABILITY_HINTS: Record<Readability, string> = {
  essentiel: 'À l’échelle d’un massif, ses éléments clés ; le reste vient en zoomant',
  detaille: 'Aussi les éléments secondaires (décos, attéros, thermiques) dès l’échelle du massif',
  tout: 'Tous les éléments, détail compris, à toutes les échelles',
};

/** How much of the atlas the map draws: the essentials, the detail, or everything (remembered in this browser). */
export function ReadabilityControl({ compact = false }: { compact?: boolean }) {
  const readability = useApp((s) => s.readability);
  const pick = (r: Readability) => {
    useApp.getState().set({ readability: r });
    remember('brises.lisibilite', r);
  };
  return (
    <div className={`seg ${compact ? 'small' : ''} readability`} role="radiogroup" aria-label="Lisibilité de la carte">
      {(Object.keys(READABILITY_LABELS) as Readability[]).map((r) => (
        <button key={r} className={readability === r ? 'on' : ''} role="radio" aria-checked={readability === r} title={READABILITY_HINTS[r]} onClick={() => pick(r)}>
          {READABILITY_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

/** The readability control with what each level shows (Calques panel). */
export function ReadabilityBlock() {
  const readability = useApp((s) => s.readability);
  return (
    <>
      <ReadabilityControl />
      <p className="muted small readability-hint">{READABILITY_HINTS[readability]}. Chaque catégorie reste réglable ci-dessous.</p>
    </>
  );
}

/** How the atlas items are drawn: size by importance, bubbles of thermals. */
export function GlyphLegend() {
  return (
    <div className="legend-block">
      <h4>Points de l’atlas</h4>
      <div className="swatches glyphs">
        <span>
          <i className="glyph big" style={{ background: COLORS.hazard }} /> grand symbole, nom en gras : l’essentiel du massif
        </span>
        <span>
          <i className="glyph" style={{ background: COLORS.takeoff }} /> symbole moyen : secondaire, nommé en s’approchant
        </span>
        <span>
          <i className="glyph small" style={{ background: COLORS.thermal }} /> petit symbole : détail (points chauds mesurés, sources fragiles)
        </span>
        <span>
          <i className="sw-bubble">7</i> thermiques regroupés : toucher pour déplier
        </span>
      </div>
    </div>
  );
}

const SPEED_STOPS: [string, string][] = [
  ['#d1edff', '0'],
  ['#54d4ff', '5'],
  ['#8cfa80', '12'],
  ['#ffdb47', '22'],
  ['#ff782e', '35'],
  ['#f52e73', '50+'],
];

/** What the colours and lines of the map mean (shown in the Calques panel). */
/** Legend of the reading of the relief drawn on the map (simulation mode). */
export function OverlayLegend() {
  const overlay = useApp((s) => s.overlay);
  return (
    <>
      {overlay === 'exposure' && (
        <div className="legend-block">
          <h4>Exposition au vent météo</h4>
          <div className="swatches">
            <span>
              <i style={{ background: '#2ad16e' }} /> monte (au vent)
            </span>
            <span>
              <i style={{ background: '#eb4034' }} /> abri, rotors
            </span>
            <span>
              <i style={{ background: '#ffab1f' }} /> venturi
            </span>
          </div>
        </div>
      )}
      {overlay === 'thermal' && (
        <div className="legend-block">
          <h4>Potentiel thermique</h4>
          <div className="ramp">
            <span style={{ background: '#ffe63c' }}>faible</span>
            <span style={{ background: '#ff9a1e' }}>bon</span>
            <span style={{ background: '#ff3c00', color: '#fff' }}>fort</span>
          </div>
        </div>
      )}
      {overlay === 'sun' && (
        <div className="legend-block">
          <h4>Soleil et ombres</h4>
          <div className="swatches">
            <span>
              <i style={{ background: '#ffdb8c' }} /> au soleil
            </span>
            <span>
              <i style={{ background: '#1f2b52' }} /> à l’ombre
            </span>
          </div>
        </div>
      )}
      {(overlay === 'convergence' || overlay === 'lift') && (
        <div className="legend-block">
          <h4>{overlay === 'lift' ? 'Ascendances estimées' : 'Convergence'}</h4>
          <div className="ramp">
            <span style={{ background: '#3c78e6', color: '#fff' }}>descend</span>
            <span style={{ background: overlay === 'lift' ? '#9adc3c' : '#d65cff' }}>monte</span>
            <span style={{ background: overlay === 'lift' ? '#ff9a3c' : '#e8b5ff' }}>fort</span>
          </div>
        </div>
      )}
      {overlay === 'speed' && (
        <div className="legend-block">
          <h4>Force du vent</h4>
          <div className="ramp">
            <span style={{ background: '#408cf2', color: '#fff' }}>calme</span>
            <span style={{ background: '#4dd9bf' }}>12</span>
            <span style={{ background: '#ffd94d' }}>25</span>
            <span style={{ background: '#f24d4d', color: '#fff' }}>45</span>
          </div>
        </div>
      )}
    </>
  );
}

export function LegendBody() {
  const { particleColor, layers } = useApp();
  return (
    <div className="legend-body">
      {layers.particles && (
        <div className="legend-block">
          <h4>{particleColor === 'speed' ? 'Vent simulé (km/h)' : 'Air montant / descendant'}</h4>
          {particleColor === 'speed' ? (
            <div className="ramp">
              {SPEED_STOPS.map(([c, l]) => (
                <span key={l} style={{ background: c }}>
                  {l}
                </span>
              ))}
            </div>
          ) : (
            <div className="ramp">
              <span style={{ background: '#4073ff', color: '#fff' }}>descend</span>
              <span style={{ background: '#dbe6f0' }}>neutre</span>
              <span style={{ background: '#ff8f1f' }}>monte</span>
            </div>
          )}
        </div>
      )}
      <OverlayLegend />
      <GlyphLegend />
      {(layers.breezes || layers.comets) && (
        <div className="legend-block">
          <h4>Brises documentées</h4>
          <div className="swatches">
            {(['valley', 'slope', 'lake', 'plain-to-mountain', 'pass-transfer', 'downvalley'] as const).map((k) => (
              <span key={k}>
                <i className="line" style={{ background: BREEZE_COLORS[k] }} /> {KIND_LABELS[k]}
              </span>
            ))}
            <span>
              <i className="line dashed" style={{ color: BREEZE_COLORS.valley }} /> déduction
            </span>
            <span>
              <i className="band" style={{ background: COLORS.convergence }} /> convergence : les flux se rencontrent et montent
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
