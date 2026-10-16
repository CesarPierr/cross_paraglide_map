/** Promise-based client of the game's model worker (see `game-worker.ts`). */
import type { CuratedBreezeInput, CuratedHazardInput, GridMeta, ModelParams } from '@brises/model';
import type { GameWorkerRequest, ModelAir } from './game-worker';

export interface PotentialGrid {
  cols: number;
  rows: number;
  lon: Float32Array;
  lat: Float32Array;
  thermal: Float32Array;
  elevation: Float32Array;
  /** Direction each cell's slope faces (deg), its steepness (deg), the model's lee (0..1). */
  aspect: Float32Array;
  slope: Float32Array;
  lee: Float32Array;
}

export interface SunInfo {
  sunElevation: number;
  sunAzimuth: number;
  season: number;
  decline: number;
}

type Body = GameWorkerRequest extends infer R ? (R extends GameWorkerRequest ? Omit<R, 'id'> : never) : never;

export class GameModel {
  private worker = new Worker(new URL('./game-worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.type === 'error') p.reject(new Error(e.data.message));
      else p.resolve(e.data);
    };
  }

  private call<T>(body: Body): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ ...body, id });
    });
  }

  init(demUrl: string, meta: GridMeta, breezes: CuratedBreezeInput[], hazards: CuratedHazardInput[], center: [number, number], radiusM: number): Promise<{ ms: number }> {
    return this.call({ type: 'init', demUrl, meta, breezes, hazards, center, radiusM });
  }
  time(params: ModelParams): Promise<SunInfo> {
    return this.call({ type: 'time', params });
  }
  async sample(params: ModelParams, points: { lon: number; lat: number; alt: number }[]): Promise<(ModelAir | null)[]> {
    const r = await this.call<{ air: (ModelAir | null)[] }>({ type: 'sample', params, points });
    return r.air;
  }
  potential(params: ModelParams, bbox: [number, number, number, number], aglM: number): Promise<PotentialGrid> {
    return this.call({ type: 'potential', params, bbox, aglM });
  }
  dispose(): void {
    this.worker.terminate();
  }
}
