/** Map icons drawn on canvas at runtime (no sprite sheet to host). */
import type { Map as MlMap } from 'maplibre-gl';

type Draw = (ctx: CanvasRenderingContext2D, s: number) => void;

const ICONS: Record<string, { size: number; draw: Draw }> = {
  // Chevron pointing to +x (east); MapLibre rotates it along the line.
  'breeze-arrow': {
    size: 32,
    draw: (c, s) => {
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = 'rgba(0,0,0,0.45)';
      c.lineWidth = s * 0.22;
      const path = () => {
        c.beginPath();
        c.moveTo(s * 0.3, s * 0.22);
        c.lineTo(s * 0.68, s * 0.5);
        c.lineTo(s * 0.3, s * 0.78);
      };
      path();
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = s * 0.12;
      path();
      c.stroke();
    },
  },
  takeoff: {
    size: 40,
    draw: (c, s) => {
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.12);
      c.lineTo(s * 0.88, s * 0.82);
      c.lineTo(s * 0.12, s * 0.82);
      c.closePath();
      c.fillStyle = '#16a34a';
      c.fill();
      c.lineWidth = s * 0.07;
      c.strokeStyle = '#ffffff';
      c.stroke();
    },
  },
  landing: {
    size: 36,
    draw: (c, s) => {
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
      c.fillStyle = '#2563eb';
      c.fill();
      c.lineWidth = s * 0.08;
      c.strokeStyle = '#ffffff';
      c.stroke();
      c.fillStyle = '#ffffff';
      c.font = `bold ${s * 0.42}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('A', s / 2, s / 2 + s * 0.02);
    },
  },
  'takeoff-community': {
    size: 40,
    draw: (c, s) => {
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.16);
      c.lineTo(s * 0.86, s * 0.8);
      c.lineTo(s * 0.14, s * 0.8);
      c.closePath();
      c.fillStyle = 'rgba(134, 239, 172, 0.9)';
      c.fill();
      c.lineWidth = s * 0.06;
      c.strokeStyle = '#14532d';
      c.stroke();
    },
  },
  'landing-community': {
    size: 34,
    draw: (c, s) => {
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2);
      c.fillStyle = 'rgba(147, 197, 253, 0.9)';
      c.fill();
      c.lineWidth = s * 0.07;
      c.strokeStyle = '#1e3a8a';
      c.stroke();
    },
  },
  hazard: {
    size: 40,
    draw: (c, s) => {
      c.beginPath();
      c.moveTo(s * 0.5, s * 0.1);
      c.lineTo(s * 0.92, s * 0.86);
      c.lineTo(s * 0.08, s * 0.86);
      c.closePath();
      c.fillStyle = '#f59e0b';
      c.fill();
      c.lineWidth = s * 0.06;
      c.strokeStyle = '#1f2937';
      c.stroke();
      c.fillStyle = '#1f2937';
      c.font = `bold ${s * 0.48}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('!', s / 2, s * 0.6);
    },
  },
  thermal: {
    size: 40,
    draw: (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.45);
      g.addColorStop(0, '#fff7d6');
      g.addColorStop(0.45, '#fb923c');
      g.addColorStop(1, 'rgba(234,88,12,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.45, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = s * 0.06;
      c.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.2) {
        const r = s * 0.04 + a * s * 0.022;
        const x = s / 2 + Math.cos(a) * r;
        const y = s / 2 + Math.sin(a) * r;
        if (a === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    },
  },
  soaring: {
    size: 40,
    draw: (c, s) => {
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
      c.fillStyle = '#0d9488';
      c.fill();
      c.lineWidth = s * 0.06;
      c.strokeStyle = '#ffffff';
      c.stroke();
      c.lineWidth = s * 0.08;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(s * 0.22, s * 0.62);
      c.quadraticCurveTo(s * 0.5, s * 0.18, s * 0.78, s * 0.5);
      c.stroke();
      c.beginPath();
      c.moveTo(s * 0.62, s * 0.36);
      c.lineTo(s * 0.8, s * 0.5);
      c.lineTo(s * 0.6, s * 0.58);
      c.stroke();
    },
  },
};

export function addIcons(map: MlMap): void {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  for (const [name, { size, draw }] of Object.entries(ICONS)) {
    if (map.hasImage(name)) continue;
    const px = Math.round(size * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    draw(ctx, px);
    map.addImage(name, ctx.getImageData(0, 0, px, px), { pixelRatio: ratio * 1.6 });
  }
}
