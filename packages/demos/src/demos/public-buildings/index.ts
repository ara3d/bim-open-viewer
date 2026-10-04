// Public buildings: three openly licensed real buildings, each drawn with every discipline model
// that has geometry, and an element read back by clicking it.
//
// A fixture opens the building's first file; `start` opens the rest into the same scene. Every
// file is loaded under its own model id, because a BOS load names every model "model" and two
// models with one id would share object keys. A federated building is one file holding several
// source models, told apart by each entity's `Document`; they are drawn and named by document.

import { appearanceFeature, editsFeature, setsFeature, setsSlice } from '@bim-open-viewer/features';
import { documentOfObject, loadModel } from '@bim-open-viewer/formats';
import {
  diagnostic,
  disposable,
  emptyBounds,
  failure,
  isEmptyBounds,
  success,
  type AnyFeature,
  type Disposable,
  styleRule,
  unionBounds,
  type Bounds,
  type ObjectKey,
  type Result,
  type Session,
  type StyleRule,
} from '@bim-open-viewer/model';
import {
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertyGroup,
  type PropertySheet,
} from '@bim-open-viewer/ui-gratify';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo, DemoFixture, GalleryViewer, ModelSource, OpenedModel } from '../../gallery/contracts.js';
import { galleryLoadOptions } from '../../gallery/model-source.js';
import { inspectIndexOf, noModelDocuments, storeyOfObject, type InspectIndex } from '../point-and-read/building.js';
import { propertyGroupsOf } from '../point-and-read/inspector.js';
import {
  publicBuildings,
  publicSamplesCommit,
  publicSamplesNotice,
  publicSamplesPath,
  type DisciplineColour,
  type PublicBuilding,
  type PublicModel,
} from './buildings.js';

export const publicBuildingsFeatures: readonly AnyFeature[] = [editsFeature, setsFeature, appearanceFeature];

// The model id one discipline model is opened under.
export const publicModelId = (building: PublicBuilding, model: PublicModel): string =>
  `${building.id}/${model.file.replace(/\.bos$/u, '')}`;

// One discipline model, fetched from where the site serves it and loaded under its own id.
const loadPublicModel = async (building: PublicBuilding, model: PublicModel): Promise<Result<ModelSource>> => {
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
const fixtureOf = (building: PublicBuilding): DemoFixture => ({
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

export const publicBuildingFixtures: readonly DemoFixture[] = publicBuildings.map(fixtureOf);

// One open file and the lookups the sheet reads.
type HeldModel = { readonly model: PublicModel; readonly opened: OpenedModel; readonly index: InspectIndex };

// What the demo has open. Module state, like point-and-read's index, because the sheet is a pure
// function of the session and the session does not hold the loaded tables.
type Held = { readonly building: PublicBuilding; readonly models: readonly HeldModel[] };

let held: Held | undefined;

// The building whose first model the viewer opened.
const buildingOf = (opened: OpenedModel | undefined): PublicBuilding | undefined =>
  opened === undefined
    ? undefined
    : publicBuildings.find((building) =>
        building.models[0] === undefined ? false : publicModelId(building, building.models[0]) === opened.modelId,
      );

const heldModelOf = (model: PublicModel, opened: OpenedModel): HeldModel => ({
  model,
  opened,
  index: inspectIndexOf(opened.data, opened.geometry, { properties: opened.properties, documents: opened.documents }),
});

// How opaque the first model, the architecture, is drawn when other disciplines are drawn inside it.
export const ghostOpacity = 0.1;

const ruleId = (name: string): string => `public-buildings/${name}`;

// The keys of a model's objects that draw something.
const drawnKeys = (one: HeldModel): readonly ObjectKey[] =>
  one.opened.data.objects.flatMap((record, row) => (record.representation === undefined ? [] : [one.opened.keys[row] ?? '']));

// One discipline as drawn: a whole single-discipline file, or one source model of a federated file.
type Part = {
  readonly id: string;
  readonly discipline: string;
  readonly colour: DisciplineColour | undefined;
  readonly model: HeldModel;
  // How many objects the part has, and the keys of those that draw something.
  readonly objects: number;
  readonly keys: readonly ObjectKey[];
};

// The title of the source document an object row came from, when the file names one.
const documentTitleOf = (one: HeldModel, row: number): string | undefined => {
  const documents = one.opened.documents ?? noModelDocuments;
  const document = documentOfObject(documents, row);
  return document < 0 ? undefined : documents.title[document];
};

// The parts of one open file. A file with no parts is one part; a federated file is one part per
// listed document, and an object whose document is not listed belongs to none.
const partsOfModel = (one: HeldModel): readonly Part[] => {
  if (one.model.parts === undefined)
    return [
      {
        id: one.model.file,
        discipline: one.model.discipline,
        colour: one.model.colour,
        model: one,
        objects: one.opened.data.objects.length,
        keys: drawnKeys(one),
      },
    ];
  return one.model.parts.map((part) => {
    const rows = one.opened.data.objects.flatMap((_record, row) => (documentTitleOf(one, row) === part.document ? [row] : []));
    return {
      id: `${one.model.file}#${part.document}`,
      discipline: part.discipline,
      colour: part.colour,
      model: one,
      objects: rows.length,
      keys: rows.flatMap((row) => (one.opened.data.objects[row]?.representation === undefined ? [] : [one.opened.keys[row] ?? ''])),
    };
  });
};

const partsOf = (now: Held): readonly Part[] => now.models.flatMap(partsOfModel);

// How the building is drawn: spaces hidden, because their volumes enclose every room and hide what
// is in it; each coloured discipline in its colour; and, when there is more than one discipline,
// the uncoloured one, the architecture, ghosted so the systems inside it show.
export const publicBuildingRules = (now: Held): readonly StyleRule[] => {
  const spaces = now.models.flatMap((one) =>
    drawnKeys(one).filter((key) => one.index.records.get(key)?.category === 'IFCSPACE'),
  );
  const parts = partsOf(now);
  return [
    styleRule(ruleId('spaces'), 'Spaces hidden', spaces, { visible: false }, 10),
    ...parts.flatMap((part) => {
      if (part.colour !== undefined)
        return [styleRule(ruleId(part.id), `${part.discipline} in ${part.colour.name}`, part.keys, { color: part.colour.rgb }, 5)];
      return parts.length > 1
        ? [styleRule(ruleId(`ghost-${part.id}`), `${part.discipline} ghosted`, part.keys, { opacity: ghostOpacity }, 5)]
        : [];
    }),
  ];
};

// The box the coloured disciplines occupy, which is what the camera frames when there are any: the
// whole site of a federated building puts its systems too far away to see.
export const colouredBounds = (now: Held): Bounds | undefined => {
  const box = partsOf(now)
    .filter((part) => part.colour !== undefined)
    .flatMap((part) => part.keys.flatMap((key) => {
      const found = part.model.index.bounds.get(key);
      return found === undefined ? [] : [found];
    }))
    .reduce(unionBounds, emptyBounds);
  return isEmptyBounds(box) ? undefined : box;
};

// Opens the building's other models, in order, into the scene that holds its first.
const openRest = async (viewer: GalleryViewer, building: PublicBuilding): Promise<Result<readonly OpenedModel[]>> => {
  const sources = await Promise.all(building.models.slice(1).map((model) => loadPublicModel(building, model)));
  for (const source of sources) {
    if (!source.ok) return failure(source.diagnostics);
    const opened = await viewer.open(source.value);
    if (!opened.ok) return failure(opened.diagnostics);
  }
  return success(viewer.opened());
};

const start = async (viewer: GalleryViewer): Promise<Result<Disposable>> => {
  const building = buildingOf(viewer.opened()[0]);
  if (building === undefined)
    return failure([diagnostic('public-buildings/unknown-model', 'The viewer opened a model that is not one of the public buildings.')]);
  const opened = await openRest(viewer, building);
  if (!opened.ok) return failure(opened.diagnostics);
  const now: Held = {
    building,
    models: building.models.flatMap((model) => {
      const found = opened.value.find((one) => one.modelId === publicModelId(building, model));
      return found === undefined ? [] : [heldModelOf(model, found)];
    }),
  };
  const rules = publicBuildingRules(now);
  const styled = viewer.dispatch('appearance.addRules', { rules });
  if (!styled.ok) return failure(styled.diagnostics);
  const framed = colouredBounds(now);
  if (framed !== undefined) viewer.flyTo(framed);
  held = now;
  // A click reads what is under the pointer; a click on nothing clears the reading.
  const read = (event: PointerEvent): void => {
    const hit = viewer.pick(event.clientX, event.clientY);
    viewer.dispatch('sets.select', { members: hit === undefined ? [] : [hit.key], mode: 'replace' });
  };
  viewer.canvas.addEventListener('pointerdown', read);
  return success(
    disposable(() => {
      viewer.canvas.removeEventListener('pointerdown', read);
      for (const rule of rules) viewer.dispatch('appearance.removeRule', { id: rule.id });
      viewer.dispatch('sets.clear', {});
      held = undefined;
    }),
  );
};

// The selected object and the discipline model it is in.
const pickedOf = (session: Session): { readonly key: ObjectKey; readonly in: HeldModel } | undefined => {
  const key = session.read(setsSlice).selection[0];
  const found = key === undefined ? undefined : held?.models.find((one) => one.index.rowOf.has(key));
  return key === undefined || found === undefined ? undefined : { key, in: found };
};

// What the sheet says about one part: its size and how it is drawn.
const drawnAs = (parts: readonly Part[], part: Part): string => {
  const objects = `${String(part.objects)} objects`;
  if (part.colour !== undefined) return `${objects}, drawn in ${part.colour.name}`;
  return parts.length > 1 ? `${objects}, ghosted` : objects;
};

const buildingGroup = (now: Held): PropertyGroup =>
  propertyGroup('building', now.building.title, [
    propertyRow('summary', 'What it is', knownValue(now.building.summary)),
    propertyRow('credit', 'Credit', knownValue(now.building.attribution)),
    propertyRow('licence', 'Licence', knownValue(now.building.licence.name)),
    propertyRow('notice', 'Notice', knownValue(`${publicSamplesPath}${publicSamplesNotice}`)),
    propertyRow('source', 'Source IFC files', knownValue(now.building.upstream)),
    ...partsOf(now).map((part, _row, parts) =>
      propertyRow(`model-${part.id}`, part.discipline, knownValue(drawnAs(parts, part), part.model.model.file)),
    ),
    propertyRow('spaces', 'Spaces', knownValue('hidden: their volumes enclose the rooms')),
    ...(now.building.omitted === undefined ? [] : [propertyRow('omitted', 'Not drawn', knownValue(now.building.omitted))]),
  ]);

// The discipline of the picked object: its source model's when the file is federated.
const disciplineOf = (one: HeldModel, key: ObjectKey): string => {
  const row = one.index.rowOf.get(key) ?? -1;
  const title = documentTitleOf(one, row);
  return one.model.parts?.find((part) => part.document === title)?.discipline ?? one.model.discipline;
};

const pickedGroups = (session: Session): readonly PropertyGroup[] => {
  const picked = pickedOf(session);
  if (picked === undefined)
    return [propertyGroup('picked', 'Element', [propertyRow('none', 'Picked', missingValue('click an element in the view to read it'))])];
  const { index } = picked.in;
  const record = index.records.get(picked.key);
  const storey = storeyOfObject(index, picked.key);
  return [
    propertyGroup('picked', 'Element', [
      propertyRow('name', 'Name', record?.name === undefined ? missingValue('the file records no name') : knownValue(record.name)),
      propertyRow(
        'category',
        'Category',
        record?.category === undefined ? missingValue('the file records no category') : knownValue(record.category),
      ),
      propertyRow('model', 'Model', knownValue(disciplineOf(picked.in, picked.key), picked.in.model.file)),
      propertyRow('storey', 'Storey', storey?.name === undefined ? missingValue('nothing links it to a storey') : knownValue(storey.name)),
    ]),
    ...propertyGroupsOf(index, picked.key),
  ];
};

export const publicBuildingsSheet = (session: Session): PropertySheet => {
  const now = held;
  if (now === undefined) return propertySheet('Public building', [], 'Opening the models.');
  return propertySheet(now.building.title, [buildingGroup(now), ...pickedGroups(session)], now.building.summary);
};

// True once every model of the building is open.
export const publicBuildingsReady = (): boolean =>
  held !== undefined && held.models.length === held.building.models.length;

export const publicBuildingsReport = (session: Session): DemoReport => {
  const now = held;
  const picked = pickedOf(session);
  return {
    building: now?.building.id ?? 'none',
    models: now?.models.length ?? 0,
    objects: now?.models.reduce((total, one) => total + one.opened.data.objects.length, 0) ?? 0,
    propertyRows: now?.models.reduce((total, one) => total + one.index.properties.rows, 0) ?? 0,
    picked: picked === undefined ? 'none' : (picked.in.index.records.get(picked.key)?.name ?? picked.key),
  };
};

export const demo: Demo = {
  id: 'public-buildings',
  chapter: 'inspect',
  title: 'Public buildings',
  question: 'What does a real, openly licensed building hold, discipline by discipline?',
  briefIds: ['F06'],
  features: publicBuildingsFeatures,
  fixtures: publicBuildingFixtures,
  panels: [],
  inspector: publicBuildingsSheet,
  start,
  ready: publicBuildingsReady,
  report: publicBuildingsReport,
  source: 'packages/demos/src/demos/public-buildings',
  verify: 'npm run pages && npm run pages:smoke',
};
