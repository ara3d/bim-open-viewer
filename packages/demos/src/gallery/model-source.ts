// Turning any of the four `ModelSource` kinds into the same five pieces the scene binding and the
// style pass need. Pure apart from the fetch and the file read.
//
// The two derived pieces are the slice's finding in code: `buildInstanceTable` addresses rows by
// the object key of each object ordinal, and `resolveStyles` resolves everything to grey unless it
// is given the appearance each object was loaded with. Neither is produced by the package that owns
// the input, and forgetting the second fails silently and totally.

import {
  colorStride,
  defaultAppearance,
  failure,
  objectKey,
  success,
  type Appearance,
  type Geometry,
  type ModelData,
  type ObjectKey,
  type Result,
} from '@bim-open-viewer/model';
import { detectFormat, loadModel, type ModelDocuments, type ModelProperties } from '@bim-open-viewer/formats';
import type { ModelSource, OpenedModel } from './contracts.js';

// The object key of each object ordinal, in the order `Geometry.instances.objectIndex` counts.
export const objectKeysOf = (model: ModelData): readonly ObjectKey[] =>
  model.objects.map((record) => objectKey(record.ref));

// The appearance each object was loaded with: what its record says, else the colour and opacity of
// the first instance that draws it, else the grey fallback.
//
// A file read through BFAST carries its material colours on the instances and nothing on the
// records, so without the second source every style rule - hiding the spaces, say - resolved the
// rest of the model to the fallback and repainted a brick building grey.
export const baseAppearancesOf = (model: ModelData, geometry?: Geometry): ReadonlyMap<ObjectKey, Appearance> => {
  const fromInstances = new Map<number, Appearance>();
  if (geometry !== undefined) {
    const { count, objectIndex, color, meshIndex } = geometry.instances;
    for (let row = 0; row < count; row++) {
      const object = objectIndex[row] ?? -1;
      if (object < 0 || (meshIndex[row] ?? -1) < 0 || fromInstances.has(object)) continue;
      const at = row * colorStride;
      fromInstances.set(object, {
        color: [color[at] ?? 0.8, color[at + 1] ?? 0.8, color[at + 2] ?? 0.8],
        opacity: color[at + 3] ?? 1,
        visible: true,
      });
    }
  }
  return new Map(
    model.objects.map((record, row) => [
      objectKey(record.ref),
      record.appearance ?? fromInstances.get(row) ?? defaultAppearance,
    ]),
  );
};

// One opened model from its data and geometry, with the derived pieces filled in, and whatever the
// loader read of what the file records.
export const openedModel = (
  modelId: string,
  data: ModelData,
  geometry: OpenedModel['geometry'],
  recorded: { readonly properties?: ModelProperties | undefined; readonly documents?: ModelDocuments | undefined } = {},
): OpenedModel => ({
  modelId,
  ref: data.ref,
  data,
  geometry,
  keys: objectKeysOf(data),
  base: baseAppearancesOf(data, geometry),
  properties: recorded.properties,
  documents: recorded.documents,
});

// Reading the parameter tables costs about half a second and thirteen megabytes on a real model,
// and every demo in the gallery is about what is known rather than only about what is drawn, so the
// gallery always asks. A format that carries none says so in a diagnostic and loads as before.
export const galleryLoadOptions = { properties: true } as const;

// Everything a source comes to. A url is fetched and a file is read by `formats`; a format is
// detected from the bytes and from the name the file arrived under, so a picked `.bfast` with no
// recognisable signature is still read.
export const resolveModelSource = async (source: ModelSource): Promise<Result<OpenedModel>> => {
  if (source.kind === 'data') return success(openedModel(source.id, source.data, source.geometry));
  if (source.kind === 'loaded')
    return success(openedModel(source.id, source.model.data, source.model.geometry, source.model), source.model.diagnostics);
  if (source.kind === 'url') {
    const loaded = await loadModel(source.url, galleryLoadOptions);
    return loaded.ok
      ? success(openedModel(source.id, loaded.value.data, loaded.value.geometry, loaded.value), loaded.diagnostics)
      : failure(loaded.diagnostics);
  }
  const bytes = new Uint8Array(await source.file.arrayBuffer());
  const format = detectFormat(bytes, source.name);
  if (!format.ok) return failure(format.diagnostics);
  const loaded = await loadModel(bytes, { ...galleryLoadOptions, format: format.value });
  return loaded.ok
    ? success(openedModel(source.id, loaded.value.data, loaded.value.geometry, loaded.value), loaded.diagnostics)
    : failure(loaded.diagnostics);
};
