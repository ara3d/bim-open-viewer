// The colour-by demo on the generated building and on a model built to look like a real one: many
// categories, most of them drawing nothing.

import { appearanceSlice } from '@bim-open-viewer/features';
import {
  emptyInstances,
  identityMatrix,
  objectRef,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
} from '@bim-open-viewer/model';
import { afterEach, describe, expect, it } from 'vitest';
import { applyColumn } from '../../../src/demos/colour-by/apply.js';
import { chosenColumn, classCounts, classRows } from '../../../src/demos/colour-by/classes.js';
import { maxNamedValues, otherLabel } from '../../../src/demos/colour-by/colouring.js';
import { heldIndex, offeredColumns } from '../../../src/demos/colour-by/held.js';
import { colourByReady, colourByReport, demo, startColourBy } from '../../../src/demos/colour-by/index.js';
import { colourBySheet } from '../../../src/demos/colour-by/inspector.js';
import { colourBarApp, colourBarSpec, legendApp, legendSpec } from '../../../src/demos/colour-by/panels.js';
import { inspectIndexOf, type InspectIndex } from '../../../src/demos/point-and-read/building.js';
import { sessionForFeatures } from '../_d2-support/fake-session.js';
import { headlessPanel } from '../_d2-support/panel-harness.js';

const session = () => sessionForFeatures(demo.features);

const generatedIndex = async (): Promise<InspectIndex> => {
  const source = await demo.fixtures[demo.fixtures.length - 1]?.source();
  if (source?.ok !== true || source.value.kind !== 'data') throw new Error('the generated building did not open');
  return inspectIndexOf(source.value.data, source.value.geometry);
};

// A model of `categories` categories with `perCategory` objects each, of which category n draws
// n + 1, plus one storey object per storey that the objects hang under.
const bigModel = (categories: number, perCategory: number, storeys: number): InspectIndex => {
  const ref: ModelRef = { id: 'big', revision: '1' };
  const objects: ObjectRecord[] = [];
  const add = (id: string, rest: Omit<ObjectRecord, 'ref' | 'transform'>): void => {
    objects.push({ ref: objectRef(ref, id), transform: identityMatrix, ...rest });
  };
  for (let storey = 0; storey < storeys; storey += 1)
    add(`s${storey}`, { name: `Level ${storey}`, category: 'IFCBUILDINGSTOREY' });
  for (let category = 0; category < categories; category += 1)
    for (let at = 0; at < perCategory; at += 1)
      add(`c${category}-${at}`, {
        name: `Thing ${category}-${at}`,
        category: `CATEGORY${String(category).padStart(2, '0')}`,
        parentId: `s${category % storeys}`,
        ...(at <= category ? { representation: at } : {}),
      });
  const model: ModelData = {
    ref,
    coordinates: { units: 'unknown', up: 'z', registration: { kind: 'unknown' } },
    objects,
  };
  return inspectIndexOf(model, { meshes: [], instances: emptyInstances(0) });
};

// A test that started a demo releases it through the disposable; this guards one that did not.
afterEach(() => {
  expect(heldIndex()).toBeUndefined();
});

const colourRules = (live: ReturnType<typeof session>) =>
  live.read(appearanceSlice).rules.filter((rule) => rule.id.startsWith('colour-by/'));

describe('the colour-by demo', () => {
  it('states what it is', () => {
    expect(demo.id).toBe('colour-by');
    expect(demo.chapter).toBe('inspect');
    expect(demo.briefIds).toEqual(['F08']);
    expect(demo.panels.map((panel) => panel.id)).toEqual(['colour-by-bar', 'colour-by-legend']);
  });

  it('colours by category when it starts, and is then ready', async () => {
    const live = session();
    expect(colourByReady(live)).toBe(false);
    const started = startColourBy(live, await generatedIndex());
    expect(started.ok).toBe(true);
    expect(colourByReady(live)).toBe(true);
    expect(chosenColumn(live)).toBe('category');
    if (started.ok) started.value.dispose();
  });

  it('colours only the objects that draw something', () => {
    const index = bigModel(5, 6, 2);
    const live = session();
    const started = startColourBy(live, index);
    const targeted = new Set(colourRules(live).flatMap((rule) => rule.targets));
    const drawn = index.keys.filter((key) => index.records.get(key)?.representation !== undefined);
    expect(drawn.length).toBe(1 + 2 + 3 + 4 + 5);
    expect([...targeted].sort()).toEqual([...drawn].sort());
    if (started.ok) started.value.dispose();
  });

  it('replaces the rules when the column is switched', () => {
    const index = bigModel(4, 5, 3);
    const live = session();
    const started = startColourBy(live, index);
    const before = colourRules(live).map((rule) => rule.id);
    expect(applyColumn(live, index, 'storey').ok).toBe(true);
    const after = colourRules(live).map((rule) => rule.id);
    expect(chosenColumn(live)).toBe('storey');
    expect(before.every((id) => id.startsWith('colour-by/category/'))).toBe(true);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((id) => id.startsWith('colour-by/storey/'))).toBe(true);
    if (started.ok) started.value.dispose();
  });

  it('caps a legend at twelve named entries and folds the rest into Other', () => {
    const index = bigModel(30, 32, 4);
    const live = session();
    const started = startColourBy(live, index);
    const rows = classRows(live);
    const known = rows.filter((row) => row.state === 'known');
    expect(known).toHaveLength(maxNamedValues + 1);
    expect(known[maxNamedValues]?.label).toBe(otherLabel);
    // Most drawn first: category 29 draws 30 objects, category 28 draws 29.
    expect(known.slice(0, 3).map((row) => row.count)).toEqual([30, 29, 28]);
    // The folded categories are the 18 smallest, drawing 1 to 18 objects.
    expect(known[maxNamedValues]?.count).toBe((18 * 19) / 2);
    expect(classCounts(rows).known).toBe((30 * 31) / 2);
    if (started.ok) started.value.dispose();
  });

  it('lists storeys lowest first and keeps no Other entry when they all fit', () => {
    const index = bigModel(6, 8, 3);
    const live = session();
    const started = startColourBy(live, index);
    applyColumn(live, index, 'storey');
    const labels = classRows(live)
      .filter((row) => row.state === 'known')
      .map((row) => row.label);
    expect(labels).toEqual(['Level 0', 'Level 1', 'Level 2']);
    if (started.ok) started.value.dispose();
  });

  it('leaves no colour-by rule once disposed', async () => {
    const live = session();
    const started = startColourBy(live, await generatedIndex());
    expect(heldIndex()).toBeDefined();
    if (started.ok) started.value.dispose();
    expect(colourRules(live)).toEqual([]);
    expect(heldIndex()).toBeUndefined();
    expect(colourByReady(live)).toBe(false);
  });

  it('reports the column, the counts and the legend size', () => {
    const live = session();
    const started = startColourBy(live, bigModel(3, 4, 2));
    const report = colourByReport(live);
    expect(report.column).toBe('category');
    expect(report.known).toBe(1 + 2 + 3);
    expect(report.legendEntries).toBeGreaterThanOrEqual(3);
    expect(report.picked).toBe('none');
    if (started.ok) started.value.dispose();
  });
});

describe('the inspector sheet', () => {
  it('says nothing is applied before the demo starts', () => {
    const rows = colourBySheet(session()).groups.find((group) => group.id === 'column')?.rows;
    expect(rows?.[0]?.value.state).toBe('missing');
  });

  it('gives the column, its counts, the legend and the picked element', () => {
    const live = session();
    const index = bigModel(3, 4, 2);
    const started = startColourBy(live, index);
    const picked = index.keys.find((key) => index.records.get(key)?.category === 'CATEGORY02');
    live.dispatch('sets.select', { members: picked === undefined ? [] : [picked], mode: 'replace' });
    const sheet = colourBySheet(live);
    const column = sheet.groups.find((group) => group.id === 'column');
    expect(column?.rows.find((row) => row.key === 'column')?.value.text).toBe('Category');
    expect(column?.rows.find((row) => row.key === 'known')?.value.text).toBe('6');
    expect(sheet.groups.find((group) => group.id === 'legend')?.rows.length).toBeGreaterThanOrEqual(3);
    const element = sheet.groups.find((group) => group.id === 'picked');
    expect(element?.rows.find((row) => row.key === 'category')?.value.text).toBe('CATEGORY02');
    expect(element?.rows.find((row) => row.key === 'storey')?.value.text).toBe('Level 0');
    if (started.ok) started.value.dispose();
  });
});

describe('the panels', () => {
  it('offers door width only for a building with a width recorded', async () => {
    expect(offeredColumns(undefined)).toEqual(['category', 'storey']);
    expect(offeredColumns(bigModel(2, 2, 2))).toEqual(['category', 'storey']);
    expect(offeredColumns(await generatedIndex())).toContain('doorWidth');
  });

  it('applies the column whose chip is pressed', () => {
    const live = session();
    const started = startColourBy(live, bigModel(4, 5, 3));
    const panel = headlessPanel(colourBarApp);
    expect(panel.controls().filter((node) => node.role === 'button').map((node) => node.label)).toEqual([
      'Category',
      'Storey',
    ]);
    const before = panel.doc();
    expect(panel.press('Storey')).toBe(true);
    colourBarSpec.onCommit?.(panel.doc(), before, live);
    expect(chosenColumn(live)).toBe('storey');
    expect(colourBarSpec.sync?.(live, before)?.column).toBe('storey');
    panel.dispose();
    if (started.ok) started.value.dispose();
  });

  it('switches a swatch off when its legend row is pressed', () => {
    const live = session();
    const started = startColourBy(live, bigModel(3, 4, 2));
    const synced = legendSpec.sync?.(live, legendApp.init) ?? legendApp.init;
    const first = synced.rows[0];
    if (first === undefined) throw new Error('the legend has no rows');
    const view = headlessPanel({ ...legendApp, init: synced });
    expect(view.press(first.label)).toBe(true);
    legendSpec.onCommit?.(view.doc(), synced, live);
    expect(classRows(live).find((row) => row.ruleId === first.ruleId)?.enabled).toBe(false);
    const again = legendSpec.sync?.(live, view.doc());
    expect(again?.rows.find((row) => row.ruleId === first.ruleId)?.enabled).toBe(false);
    view.dispose();
    if (started.ok) started.value.dispose();
  });
});
