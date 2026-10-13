import { colorStride, type Geometry } from './mesh.js';
import type { ModelData, ObjectRecord } from './objects.js';
import type { Appearance } from './style.js';

// The appearance each object was loaded with, when its record says nothing: the colour and
// opacity of the first instance that draws it.
//
// A file read through BFAST or BOS carries its material colours on the instances and nothing on
// the records. The style pass resolves every object from its record's appearance, so a record
// without one resolved to the grey fallback and the first restyle repainted a brick building grey.
// Filling the records at load time makes every reader and every caller see the loaded colours.

/** Appearance by object row, from the first drawn instance of each object. */
export const instanceAppearances = (geometry: Geometry): ReadonlyMap<number, Appearance> => {
  const found = new Map<number, Appearance>();
  const { count, objectIndex, color, meshIndex } = geometry.instances;
  for (let row = 0; row < count; row++) {
    const object = objectIndex[row] ?? -1;
    if (object < 0 || (meshIndex[row] ?? -1) < 0 || found.has(object)) continue;
    const at = row * colorStride;
    found.set(object, {
      color: [color[at] ?? 0.8, color[at + 1] ?? 0.8, color[at + 2] ?? 0.8],
      opacity: color[at + 3] ?? 1,
      visible: true,
    });
  }
  return found;
};

/** The same records, each one that lacks an appearance given the one its instances carry. */
export const withLoadedAppearances = (data: ModelData, geometry: Geometry): ModelData => {
  if (data.objects.every((record) => record.appearance !== undefined)) return data;
  const fromInstances = instanceAppearances(geometry);
  if (fromInstances.size === 0) return data;
  const objects: ObjectRecord[] = data.objects.map((record, row) => {
    if (record.appearance !== undefined) return record;
    const appearance = fromInstances.get(row);
    return appearance === undefined ? record : { ...record, appearance };
  });
  return { ...data, objects };
};
