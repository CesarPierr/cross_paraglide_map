/** Extent of the wind-model grid: the French Alps with some foreland margin. [west, south, east, north] */
export const DEM_BBOX: [number, number, number, number] = [4.85, 43.55, 7.85, 46.5];

/**
 * Web-Mercator zoom level of the model grid. At z9 one cell is ~305 m in
 * Mercator units, i.e. ~216 m on the ground at 45°N: enough to resolve the
 * main valleys while keeping the in-browser computation under a second.
 */
export const DEM_ZOOM = 9;
