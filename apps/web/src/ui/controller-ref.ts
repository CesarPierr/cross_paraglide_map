import type { DataClient } from '../data/client';
import type { MapController } from '../map/controller';

/** Singletons shared with UI components that need imperative actions. */
let controller: MapController | null = null;
let dataClient: DataClient | null = null;

export const setController = (c: MapController | null) => {
  controller = c;
};
export const getController = () => controller;

export const setDataClient = (d: DataClient) => {
  dataClient = d;
};
export const getDataClient = () => dataClient;
