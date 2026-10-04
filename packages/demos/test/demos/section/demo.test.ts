// Everything here runs on the generated building, which is the demo's second fixture, and on a
// model with no storeys; the real buildings are read from files the browser opens.

import { clippingSlice, placementsOf } from '@bim-open-viewer/features';
import { identityMatrix, objectRef, type Bounds, type ModelData, type ModelRef } from '@bim-open-viewer/model';
import { afterEach, describe, expect, it } from 'vitest';
import { demo, sectionReady, sectionReport, startSection } from '../../../src/demos/section/index.js';
import { sectionSheet } from '../../../src/demos/section/inspector.js';
import { sectionApp, sectionPanelSpec, type SectionDoc } from '../../../src/demos/section/panels.js';
import {
  cutIn,
  heldSurvey,
  holdSurvey,
  middleBox,
  surveySection,
} from '../../../src/demos/section/survey.js';
import { sessionForFeatures } from '../_d2-support/fake-session.js';
import { headlessPanel } from '../_d2-support/panel-harness.js';

const session = () => sessionForFeatures(demo.features);

const generatedBuilding = async (): Promise<ModelData> => {
  const source = await demo.fixtures.find((fixture) => fixture.basis === 'synthetic')?.source();
  if (source?.ok !== true || source.value.kind !== 'data') throw new Error('the generated building did not open');
  return source.value.data;
};

const bounds: Bounds = { min: [0, 0, 0], max: [50, 20, 12] };

const flatModel = (count: number): ModelData => {
  const ref: ModelRef = { id: 'flat', revision: '1' };
  return {
    ref,
    coordinates: { units: 'metres', up: 'z', registration: { kind: 'unknown' } },
    objects: Array.from({ length: count }, (_, index) => ({
      ref: objectRef(ref, `flat:${index}`),
      transform: identityMatrix,
    })),
  };
};

// Opens the demo on the generated building, with the survey the viewer would give it.
const opened = async () => {
  const live = session();
  const building = await generatedBuilding();
  const started = startSection(live, building, placementsOf(building), bounds);
  if (!started.ok) throw new Error('the demo did not start');
  return { live, building, started: started.value };
};

afterEach(() => holdSurvey(undefined));

describe('the section demo', () => {
  it('states what it is', () => {
    expect(demo.id).toBe('section');
    expect(demo.chapter).toBe('cut-and-arrange');
    expect(demo.briefIds).toEqual(['F11']);
    expect(demo.features.map((feature) => feature.id)).toEqual(['clipping', 'navigation-aids']);
    expect(demo.panels.map((panel) => panel.id)).toEqual(['section-bar']);
  });

  it('refuses to start when no model is open', () => {
    const started = startSection(session(), undefined);
    expect(started.ok).toBe(false);
    if (!started.ok) expect(started.diagnostics[0]?.code).toBe('section/no-model');
  });

  it('refuses to start on a model with no storeys and no bounds', () => {
    const started = startSection(session(), flatModel(3));
    expect(started.ok).toBe(false);
    if (!started.ok) expect(started.diagnostics[0]?.code).toBe('section/no-extent');
  });

  it('cuts mid-height when the model records no storeys', () => {
    const live = session();
    startSection(live, flatModel(3), [], bounds);
    expect(cutIn(live, 'z')).toEqual({ kind: 'planes', elevation: 6, keep: 'below' });
  });
});

describe('the opening cut', () => {
  it('lands 1.2 above the second lowest level, keeping below', async () => {
    const { live, building } = await opened();
    const levels = surveySection(building, placementsOf(building), bounds).levels;
    expect(levels.length).toBeGreaterThanOrEqual(2);
    const second = levels[1];
    const cut = cutIn(live, 'z');
    expect(cut.kind).toBe('planes');
    if (cut.kind !== 'planes' || second === undefined) return;
    expect(cut.elevation).toBeCloseTo(second.elevation + 1.2, 6);
    expect(cut.keep).toBe('below');
    expect(live.dispatched.map((each) => each.name)).toEqual(['clipping.sectionAt']);
    expect(live.dispatched[0]?.input).toMatchObject({ axis: 'z', keep: 'below' });
  });

  it('is ready once the slice is enabled, and not before or after', async () => {
    const live = session();
    expect(sectionReady(live)).toBe(false);
    const building = await generatedBuilding();
    const started = startSection(live, building, placementsOf(building), bounds);
    if (!started.ok) throw new Error('the demo did not start');
    expect(sectionReady(live)).toBe(true);
    started.value.dispose();
    expect(sectionReady(live)).toBe(false);
    expect(heldSurvey()).toBeUndefined();
    expect(live.read(clippingSlice).enabled).toBe(false);
  });

  it('reports the cut and the levels', async () => {
    const { live, building } = await opened();
    const levels = surveySection(building, placementsOf(building), bounds).levels;
    const report = sectionReport(live);
    expect(report.regionKind).toBe('planes');
    expect(report.keep).toBe('below');
    expect(report.levels).toBe(levels.length);
    expect(report.lowest).toBe(levels[0]?.elevation);
    expect(report.highest).toBe(levels[levels.length - 1]?.elevation);
    expect(report.elevation).toBeCloseTo((levels[1]?.elevation ?? 0) + 1.2, 6);
  });
});

describe('the section bar', () => {
  it('offers a chip per level, the slider, both sides and the two buttons', async () => {
    const { live } = await opened();
    const doc = sectionPanelSpec.sync?.(live, sectionApp.init) ?? sectionApp.init;
    const panel = headlessPanel({ ...sectionApp, init: doc }, 900, 240);
    const labels = panel.controls().map((node) => node.label);
    for (const chip of doc.levels) expect(labels).toContain(chip.name);
    expect(labels).toEqual(expect.arrayContaining(['Cut height', 'Keep above', 'Keep below', 'Section box', 'Clear']));
    panel.dispose();
  });

  it('changes the elevation when a level chip is pressed', async () => {
    const { live } = await opened();
    const doc = sectionPanelSpec.sync?.(live, sectionApp.init) ?? sectionApp.init;
    const first = doc.levels[0];
    if (first === undefined) throw new Error('no levels');
    const panel = headlessPanel({ ...sectionApp, init: doc }, 900, 240);
    expect(panel.press(first.name)).toBe(true);
    expect(panel.doc().elevation).toBeCloseTo(first.elevation + 1.2, 6);
    sectionPanelSpec.onCommit?.(panel.doc(), doc, live);
    const cut = cutIn(live, 'z');
    expect(cut.kind === 'planes' ? cut.elevation : undefined).toBeCloseTo(first.elevation + 1.2, 6);
    panel.dispose();
  });

  it('sets the elevation along the model height when the slider is dragged', async () => {
    const { live } = await opened();
    const doc = sectionPanelSpec.sync?.(live, sectionApp.init) ?? sectionApp.init;
    const panel = headlessPanel({ ...sectionApp, init: doc }, 900, 240);
    expect(panel.dragX('Cut height', 0.5)).toBe(true);
    expect(panel.doc().elevation).toBeGreaterThan(doc.low);
    expect(panel.doc().elevation).toBeLessThan(doc.high);
    panel.dispose();
  });

  it('flips the kept side, and dispatches only what changed', async () => {
    const { live } = await opened();
    const doc = sectionPanelSpec.sync?.(live, sectionApp.init) ?? sectionApp.init;
    const panel = headlessPanel({ ...sectionApp, init: doc }, 900, 240);
    expect(panel.press('Keep above')).toBe(true);
    expect(panel.doc().keep).toBe('above');
    const before = live.dispatched.length;
    sectionPanelSpec.onCommit?.(panel.doc(), doc, live);
    expect(live.dispatched.length).toBe(before + 1);
    expect(cutIn(live, 'z')).toMatchObject({ kind: 'planes', keep: 'above' });
    sectionPanelSpec.onCommit?.(panel.doc(), panel.doc(), live);
    expect(live.dispatched.length).toBe(before + 1);
    panel.dispose();
  });

  it('reads an applied cut back out of the slice', async () => {
    const { live } = await opened();
    live.dispatch('clipping.sectionAt', { elevation: 7.5, axis: 'z', keep: 'above' });
    const synced = sectionPanelSpec.sync?.(live, sectionApp.init);
    expect(synced?.elevation).toBe(7.5);
    expect(synced?.keep).toBe('above');
    expect(synced?.kind).toBe('planes');
  });
});

describe('the section box and clear', () => {
  it('covers the middle 60 percent across and the full height', async () => {
    const { live } = await opened();
    const doc = sectionPanelSpec.sync?.(live, sectionApp.init) ?? sectionApp.init;
    const asked: SectionDoc = { ...doc, boxAsked: 1 };
    sectionPanelSpec.onCommit?.(asked, doc, live);
    const cut = cutIn(live, 'z');
    expect(cut.kind).toBe('box');
    if (cut.kind !== 'box') return;
    expect(cut.min[0]).toBeCloseTo(10, 6);
    expect(cut.max[0]).toBeCloseTo(40, 6);
    expect(cut.min[1]).toBeCloseTo(4, 6);
    expect(cut.max[1]).toBeCloseTo(16, 6);
    expect(cut.min[2]).toBe(0);
    expect(cut.max[2]).toBe(12);
  });

  it('puts the box over the horizontal axes of a y-up model', () => {
    const survey = surveySection({ ...flatModel(1), coordinates: { units: 'metres', up: 'y', registration: { kind: 'unknown' } } }, [], bounds);
    const box = middleBox(survey);
    expect(box?.min[0]).toBeCloseTo(10, 6);
    expect(box?.min[1]).toBe(0);
    expect(box?.min[2]).toBeCloseTo(2.4, 6);
    expect(box?.max[1]).toBe(20);
  });

  it('disables the section when clear is pressed', async () => {
    const { live } = await opened();
    const doc = sectionPanelSpec.sync?.(live, sectionApp.init) ?? sectionApp.init;
    sectionPanelSpec.onCommit?.({ ...doc, clearAsked: 1 }, doc, live);
    expect(live.read(clippingSlice).enabled).toBe(false);
    expect(sectionPanelSpec.sync?.(live, doc)?.kind).toBe('none');
  });
});

describe('the inspector sheet', () => {
  it('quotes the cut in force and the levels found', async () => {
    const { live, building } = await opened();
    const sheet = sectionSheet(live);
    expect(sheet.title).toBe('Section');
    const cut = sheet.groups.find((group) => group.id === 'cut');
    expect(cut?.rows.find((row) => row.key === 'kind')?.value.text).toBe('Height cut');
    expect(cut?.rows.find((row) => row.key === 'keep')?.value.text).toBe('Below');
    const levels = sheet.groups.find((group) => group.id === 'levels');
    expect(levels?.rows).toHaveLength(surveySection(building, placementsOf(building), bounds).levels.length);
  });

  it('quotes the box corners', async () => {
    const { live } = await opened();
    live.dispatch('clipping.setBox', { min: [0, 0, 0], max: [1, 2, 3] });
    const cut = sectionSheet(live).groups.find((group) => group.id === 'cut');
    expect(cut?.rows.find((row) => row.key === 'kind')?.value.text).toBe('Box');
    expect(cut?.rows.find((row) => row.key === 'max')?.value.text).toBe('1.00, 2.00, 3.00');
  });

  it('says how many levels a model records when it has none', () => {
    const live = session();
    startSection(live, flatModel(2), [], bounds);
    const levels = sectionSheet(live).groups.find((group) => group.id === 'levels');
    expect(levels?.rows[0]?.value.missingReason).toContain('0 levels');
  });
});
