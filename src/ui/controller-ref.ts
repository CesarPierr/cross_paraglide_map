import type { MapController } from '../map/controller';

/** The single map controller instance, shared with UI components that need imperative actions. */
let current: MapController | null = null;

export const setController = (c: MapController | null) => {
  current = c;
};
export const getController = () => current;
