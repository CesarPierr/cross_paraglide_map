import { BREEZE_COLORS } from '../map/controller';
import { useApp } from '../state/store';
import { KIND_LABELS } from './format';

const SPEED_STOPS = [
  ['#cdeeff', '0'],
  ['#4dd9ff', '5'],
  ['#8cff73', '12'],
  ['#ffe040', '22'],
  ['#ff7326', '35'],
  ['#f22673', '50+'],
];

export function Legend() {
  const { overlay, particleColor, layers } = useApp();
  return (
    <div className="legend panel" aria-label="Légende">
      {layers.particles && (
        <div className="legend-block">
          <h4>{particleColor === 'speed' ? 'Particules · vitesse (km/h)' : 'Particules · air montant / descendant'}</h4>
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
              <span style={{ background: '#4073ff' }}>descend</span>
              <span style={{ background: '#d9e6f2', color: '#111' }}>neutre</span>
              <span style={{ background: '#ff8c1a' }}>monte</span>
            </div>
          )}
        </div>
      )}
      {overlay === 'exposure' && (
        <div className="legend-block">
          <h4>Au vent / sous le vent</h4>
          <div className="swatches">
            <span>
              <i style={{ background: '#28d26e' }} /> ascendance dynamique
            </span>
            <span>
              <i style={{ background: '#eb4034' }} /> abri / rotors
            </span>
            <span>
              <i style={{ background: '#ffaa1e' }} /> venturi
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
            <span style={{ background: '#ff3c00' }}>fort</span>
          </div>
        </div>
      )}
      {(overlay === 'convergence' || overlay === 'lift') && (
        <div className="legend-block">
          <h4>{overlay === 'lift' ? 'Ascendances estimées' : 'Convergence calculée'}</h4>
          <div className="ramp">
            <span style={{ background: '#3c78e6' }}>descend</span>
            <span style={{ background: overlay === 'lift' ? '#9adc3c' : '#d65cff' }}>monte</span>
            <span style={{ background: overlay === 'lift' ? '#ff9a3c' : '#e0a0ff', color: '#111' }}>fort</span>
          </div>
        </div>
      )}
      {layers.breezes && (
        <div className="legend-block">
          <h4>Brises documentées</h4>
          <div className="swatches">
            {(['valley', 'slope', 'lake', 'plain-to-mountain', 'pass-transfer', 'downvalley'] as const).map((k) => (
              <span key={k}>
                <i className="line" style={{ background: BREEZE_COLORS[k] }} /> {KIND_LABELS[k]}
              </span>
            ))}
            <span>
              <i className="line" style={{ background: '#f5d0fe' }} /> convergence
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
