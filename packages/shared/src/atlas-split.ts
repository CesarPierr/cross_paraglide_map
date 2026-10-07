/**
 * The atlas travels in two parts. The core (geometry, names, numbers, source
 * titles) is all the map and the wind model need, so
 * the app becomes interactive with it alone. The text (descriptions, source
 * notes, labelled facts, sector summaries, tips, synoptic effects, figures) is fetched right
 * after, in the background, and merged in place.
 *
 * The documented breezes are also rasterised by the model from `curated`,
 * whose paths repeat the breeze geometries: the core drops them and
 * `inflateAtlas` copies them back from the features.
 */
import type { Atlas, AtlasFigure, AtlasSynopticEffect, AtlasTourStep } from './atlas';

export interface AtlasText {
  generatedAt: string;
  /** Description of each feature. */
  features: Record<string, string>;
  /** Labelled facts of each feature (hours, orientation, route points…). */
  details: Record<string, Record<string, string>>;
  sources: Record<string, string>;
  massifs: Record<string, { summary: string; tips: string[]; synoptic: AtlasSynopticEffect[] }>;
  figures: AtlasFigure[];
  tours: Record<string, AtlasTourStep[]>;
}

export function splitAtlas(a: Atlas): { core: Atlas; text: AtlasText } {
  const text: AtlasText = { generatedAt: a.generatedAt, features: {}, details: {}, sources: {}, massifs: {}, figures: a.figures ?? [], tours: a.tours ?? {} };
  const features = Object.fromEntries(
    Object.entries(a.features).map(([cat, list]) => [
      cat,
      list.map((f) => {
        if (f.properties.description) text.features[f.properties.id] = f.properties.description;
        if (f.properties.details) text.details[f.properties.id] = f.properties.details;
        return { ...f, properties: { ...f.properties, description: '', details: undefined } };
      }),
    ]),
  ) as Atlas['features'];
  const sources = Object.fromEntries(
    Object.entries(a.sources).map(([id, s]) => {
      if (s.notes) text.sources[id] = s.notes;
      return [id, { ...s, notes: undefined }];
    }),
  );
  const massifs = a.massifs.map((m) => {
    text.massifs[m.id] = { summary: m.summary, tips: m.tips, synoptic: m.synoptic };
    return { ...m, summary: '', tips: [], synoptic: [] };
  });
  const paths = new Map(a.features.breezes.map((f) => [f.properties.id, JSON.stringify(f.geometry.coordinates)]));
  const curated = a.curated.map((c) => (paths.get(c.id) === JSON.stringify(c.coords) ? { ...c, coords: [] } : c));
  const core: Atlas = { ...a, features, sources, massifs, curated, figures: [], tours: {} };
  return { core, text };
}

/** Restores the breeze paths the core leaves out of `curated`. */
export function inflateAtlas(core: Atlas): Atlas {
  const paths = new Map(core.features.breezes.map((f) => [f.properties.id, f.geometry.coordinates as [number, number][]]));
  for (const c of core.curated) if (!c.coords.length) c.coords = paths.get(c.id) ?? [];
  return core;
}

/** Merges the text into the atlas objects in place; returns a new top-level object so views re-render. */
export function mergeAtlasText(a: Atlas, t: AtlasText): Atlas {
  for (const list of Object.values(a.features))
    for (const f of list) {
      const d = t.features[f.properties.id];
      if (d) f.properties.description = d;
      const x = t.details?.[f.properties.id];
      if (x) f.properties.details = x;
    }
  for (const [id, notes] of Object.entries(t.sources)) if (a.sources[id]) a.sources[id].notes = notes;
  for (const m of a.massifs) {
    const x = t.massifs[m.id];
    if (x) Object.assign(m, x);
  }
  return { ...a, figures: t.figures, tours: t.tours ?? {}, textLoaded: true };
}
