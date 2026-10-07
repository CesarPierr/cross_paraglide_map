import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

function supportsWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

const root = createRoot(document.getElementById('root')!);
if (!supportsWebGL2()) {
  root.render(
    <div className="fatal">
      <h1>WebGL 2 indisponible</h1>
      <p>Cette carte 3D a besoin de WebGL 2 (navigateurs récents : Chrome, Firefox, Safari 15+, Edge). Activez l’accélération matérielle ou essayez un autre navigateur.</p>
    </div>,
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
