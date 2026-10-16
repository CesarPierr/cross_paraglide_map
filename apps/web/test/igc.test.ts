import { describe, expect, it } from 'vitest';
import { toIgc, TrackRecorder } from '../src/game/igc';

describe('IGC track of a game flight', () => {
  it('writes the headers and one B record per fix, in UTC', () => {
    const text = toIgc(
      [
        { hour: 13, lon: 5.9, lat: 45.3, alt: 1000.4 },
        { hour: 13 + 1 / 3600, lon: -0.5, lat: -1.25, alt: -12 },
      ],
      { year: 2026, month0: 6, day: 15, pilot: 'Pierre', glider: 'EN-B', site: 'Saint-Hilaire' },
    );
    const lines = text.split('\r\n');
    expect(lines[0]).toBe('AXBA001 Brises des Alpes');
    expect(lines).toContain('HFDTEDATE:150726,01');
    expect(lines).toContain('HFPLTPILOTINCHARGE:Pierre');
    // 13h legal time in July = 11h UTC; 45.3° = 45° 18.000'; 5.9° = 5° 54.000'.
    expect(lines).toContain('B1100004518000N00554000EA0100001000');
    expect(lines).toContain('B1100010115000S00030000WA-0012-0012');
    expect(text.endsWith('\r\n')).toBe(true);
  });
  it('keeps one fix per second', () => {
    const r = new TrackRecorder();
    for (let t = 0; t < 5; t += 0.25) if (r.due(t)) r.push(t, { hour: 12, lon: 6, lat: 45, alt: 1500 });
    expect(r.fixes.length).toBe(5);
    r.clear();
    expect(r.fixes.length).toBe(0);
  });
});
