// The three public buildings as demo fixtures: how each one's file is fetched from where the site
// serves it, and the credit its licence asks for.
//
// This is separate from the demo so that every demo can list the buildings (`_shared/fixtures.ts`)
// without importing the public-buildings demo and its inspector.

import { loadModel } from '@bim-open-viewer/formats';
import { diagnostic, failure, success, type Result } from '@bim-open-viewer/model';
import type { DemoFixture, ModelSource } from '../../gallery/contracts.js';
import { galleryLoadOptions } from '../../gallery/model-source.js';
import { publicBuildings, publicSamplesCommit, publicSamplesPath, type PublicBuilding, type PublicModel } from './buildings.js';

// The model id one discipline model is opened under.
export const publicModelId = (building: PublicBuilding, model: PublicModel): string =>
  `${building.id}/${model.file.replace(/\.bos$/u, '')}`;

// One discipline model, fetched from where the site serves it and loaded under its own id.
export const loadPublicModel = async (building: PublicBuilding, model: PublicModel): Promise<Result<ModelSource>> => {
  const id = publicModelId(building, model);
  const url = `${publicSamplesPath}${model.file}`;
  const loaded = await loadModel(url, {
    ...galleryLoadOptions,
    format: 'bos',
    ref: { id, revision: publicSamplesCommit.slice(0, 7), source: url },
  });
  return loaded.ok ? success({ kind: 'loaded', id, model: loaded.value }, loaded.diagnostics) : failure(loaded.diagnostics);
};

// A building as a fixture: its first model, with the credit its licence asks for.
export const publicBuildingFixture = (building: PublicBuilding): DemoFixture => ({
  id: building.id,
  title: building.title,
  basis: 'source-backed',
  credit: { text: building.attribution, licence: building.licence.name, licenceUrl: building.licence.url },
  source: () => {
    const first = building.models[0];
    return first === undefined
      ? Promise.resolve(failure([diagnostic('public-buildings/no-model', `${building.id} lists no model`)]))
      : loadPublicModel(building, first);
  },
});

// Every public building, in the order `buildings.ts` lists them.
export const publicBuildingFixtures: readonly DemoFixture[] = publicBuildings.map(publicBuildingFixture);
