/**
 * A cross-country task built from a documented route of the atlas: its turn points in
 * order, cylinders to tag, the clock from take-off, and the score — time to goal, or the
 * distance made good along the course when landing out (the usual competition rule).
 */
import type { AtlasFeature } from '@brises/shared';
import type { LocalFrame } from './geo';

export interface TurnPoint {
  name: string;
  x: number;
  y: number;
  /** Cylinder radius (m). */
  r: number;
}

export interface Task {
  id: string;
  name: string;
  points: TurnPoint[];
  /** Index of the next point to tag. */
  next: number;
  /** Game time of each tag (s). */
  tags: number[];
  /** Length of each leg between cylinder centres (m). */
  legs: number[];
  goalT: number | null;
}

/** "Start - Tâches blanches (position estimée) → B1 - …" → clean names. */
function pointNames(details: Record<string, string> | undefined, n: number): string[] {
  const raw = details?.Points?.split('→').map((p) => p.replace(/\(.*?\)/g, '').trim()) ?? [];
  return Array.from({ length: n }, (_, i) => raw[i] || (i === 0 ? 'Départ' : i === n - 1 ? 'But' : `B${i}`));
}

export function taskFromRoute(f: AtlasFeature, frame: LocalFrame, radius = 400): Task | null {
  if (f.geometry.type !== 'LineString' || f.geometry.coordinates.length < 2) return null;
  const coords = f.geometry.coordinates;
  const names = pointNames(f.properties.details, coords.length);
  const points = coords.map(([lon, lat], i) => {
    const [x, y] = frame.toXY(lon, lat);
    return { name: names[i], x, y, r: radius };
  });
  const legs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  return { id: f.properties.id, name: f.properties.name, points, next: 0, tags: [], legs, goalT: null };
}

/** Tags the next cylinder when the pilot is inside it. Returns the point just tagged, if any. */
export function advanceTask(task: Task, x: number, y: number, t: number): TurnPoint | null {
  if (task.goalT !== null) return null;
  const p = task.points[task.next];
  if (!p || Math.hypot(x - p.x, y - p.y) > p.r) return null;
  task.tags.push(t);
  task.next++;
  if (task.next >= task.points.length) task.goalT = t;
  return p;
}

/** Distance made good along the course (m): legs completed plus progress on the current one. */
export function distanceMadeGood(task: Task, x: number, y: number): number {
  if (task.next === 0) return 0;
  let d = task.legs.slice(0, task.next - 1).reduce((a, b) => a + b, 0);
  if (task.goalT !== null) return task.legs.reduce((a, b) => a + b, 0);
  const next = task.points[task.next];
  const leg = task.legs[task.next - 1];
  const remaining = Math.max(0, Math.hypot(x - next.x, y - next.y) - next.r);
  d += Math.max(0, Math.min(leg, leg - remaining));
  return d;
}

export function taskLength(task: Task): number {
  return task.legs.reduce((a, b) => a + b, 0);
}
