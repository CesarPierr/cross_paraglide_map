/**
 * Promise-based client for the wind-model Web Worker.
 */
import type { CuratedBreezeInput } from '../model/curated';
import type { CellResult, ModelParams } from '../model/field';
import type { GridMeta } from '../model/grid';
import type { OverlayMode } from '../model/overlays';
import type { SunPosition } from '../model/sun';
import type { WorkerRequest } from '../model/worker';

export interface FieldMessage {
  field: Float32Array;
  overlay: Blob | null;
  sun: SunPosition;
  solarHour: number;
  ms: number;
}

export interface ProbeMessage {
  cell: CellResult | null;
  curatedName?: string | null;
  convergence?: number;
  water?: number;
  drainKm2?: number;
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
// Distributive Omit so each request variant keeps its own fields.
type RequestBody = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never;

export class ModelClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(new URL('../model/worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent) => {
      const { id, type } = e.data as { id: number; type: string };
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (type === 'error') p.reject(new Error(e.data.message));
      else p.resolve(e.data);
    };
  }

  private call<T>(body: RequestBody, transfer: Transferable[] = []): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ ...body, id }, transfer);
    });
  }

  init(demUrl: string, meta: GridMeta): Promise<{ elevation: Float32Array; ms: number }> {
    return this.call({ type: 'init', demUrl, meta });
  }

  setCurated(breezes: CuratedBreezeInput[]): Promise<void> {
    return this.call({ type: 'curated', breezes });
  }

  compute(params: ModelParams, overlay: OverlayMode): Promise<FieldMessage> {
    return this.call({ type: 'compute', params, overlay });
  }

  probe(lon: number, lat: number): Promise<ProbeMessage> {
    return this.call({ type: 'probe', lon, lat });
  }

  dispose(): void {
    this.worker.terminate();
  }
}
