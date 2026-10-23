/**
 * Input of the canopy's cloth simulation (scripts/blender/canopy-sim.py): the wing of the
 * game (apps/web/src/game/glider-shape.ts, the same code) sampled on the basis grid for each
 * brake level, as JSON: points [x, y, z] by column then row, the ballooned flying shape.
 *
 *   npx tsx scripts/blender/canopy-export.ts > canopy-states.json
 */
import { BASIS_COLS, BASIS_LEVELS, BASIS_ROWS, basisColumn, basisTw, newDeform, wingPoint } from '../../apps/web/src/game/glider-shape';

const states = BASIS_LEVELS.map((b) => {
  const d = newDeform();
  d.brake[0] = d.brake[1] = b;
  const pts: number[][] = [];
  const p = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < BASIS_COLS; i++) {
    const { a, v, cw } = basisColumn(i);
    for (let j = 0; j < BASIS_ROWS; j++) {
      wingPoint(d, a, basisTw(j), v, 0, 0, cw, p);
      pts.push([+p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5)]);
    }
  }
  return { brake: b, pts };
});
process.stdout.write(JSON.stringify({ cols: BASIS_COLS, rows: BASIS_ROWS, states }));
