import type { FlightLogChunk, FlightLogStart } from '@brises/shared';
import { describe, expect, it } from 'vitest';
import { FlightLog, type LogTransport } from '../src/game/flight-log';

const start = (): FlightLogStart => ({ client: 'abcdefgh12', build: 'test', takeoffId: 'a/b', takeoffName: 'B', lon: 6, lat: 45, scenario: {}, options: {}, device: {} });

/** A fake API: records the chunks, fails while `down`. */
function fake() {
  const t = { opened: 0, chunks: [] as FlightLogChunk[], down: false };
  const transport: LogTransport = {
    async open() {
      t.opened++;
      if (t.down) throw new Error('down');
      return 'id-1';
    },
    async send(_id, chunk) {
      if (t.down) return false;
      t.chunks.push(structuredClone(chunk));
      return true;
    },
  };
  return { t, transport };
}

describe('flight log', () => {
  it('takes a row every half second of game time, rounded, opens the log once', async () => {
    const { t, transport } = fake();
    const log = new FlightLog(start, transport);
    for (let k = 0; k < 40; k++) {
      const time = 100 + k * 0.1;
      if (log.due(time)) log.row(time, [0, 12.3456, -1234.567]);
    }
    await log.flush();
    expect(t.opened).toBe(1);
    const rows = t.chunks.flatMap((c) => c.rows);
    expect(rows.length).toBe(8);
    expect(rows[0]).toEqual([0, 0, 12.35, -1234.6]);
    expect(rows[1][0]).toBeCloseTo(0.5, 5);
  });

  it('keeps the rows while the API is away and sends them in order once it is back', async () => {
    const { t, transport } = fake();
    const log = new FlightLog(start, transport);
    log.row(0, [0]);
    await log.flush();
    t.down = true;
    for (let k = 1; k < 300; k++) log.row(k * 0.5, [0]);
    log.event(10, 'collapse-left');
    await log.flush();
    t.down = false;
    log.end(150, { kind: 'crash', reason: 'impact' });
    await log.flush();
    const rows = t.chunks.flatMap((c) => c.rows.map((r) => r[0]));
    expect(rows.length).toBe(300);
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
    expect(t.chunks.map((c) => c.seq)).toEqual(t.chunks.map((_, i) => i));
    expect(t.chunks.every((c) => c.rows.length <= 120)).toBe(true);
    const events = t.chunks.flatMap((c) => c.events);
    expect(events.map((e) => e.kind)).toEqual(['collapse-left', 'end']);
    expect(t.chunks[t.chunks.length - 1].end).toEqual({ kind: 'crash', reason: 'impact' });
    // Nothing is recorded after the end.
    log.row(200, [0]);
    expect(log.due(200)).toBe(false);
  });
});
