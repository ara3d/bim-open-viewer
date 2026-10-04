// Colour by: the building painted by category or by storey, with a legend that counts what each
// colour stands for and switches it off.
//
// The opening sequence is a function of the session and the index of the open model, so it can be
// run and asserted without a canvas; `start` is the contract's wrapper that builds the index from
// the opened model and listens for clicks.

import { appearanceFeature, appearanceSlice, editsFeature, setsFeature, setsSlice } from '@bim-open-viewer/features';
import { diagnostic, disposable, failure, success, type Disposable, type Result, type Session } from '@bim-open-viewer/model';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo, GalleryViewer } from '../../gallery/contracts.js';
import { defaultFixtures } from '../_shared/fixtures.js';
import { inspectIndexOf, runCalls, type InspectIndex } from '../point-and-read/building.js';
import { applyColumn } from './apply.js';
import { chosenColumn, classCounts, classRows } from './classes.js';
import { resetCalls } from './colouring.js';
import { heldIndex, holdIndex } from './held.js';
import { colourBySheet } from './inspector.js';
import { colourByPanels } from './panels.js';

// Colours the building by category and holds its index until the returned disposable runs.
export const startColourBy = (session: Session, index: InspectIndex): Result<Disposable> => {
  const applied = applyColumn(session, index, 'category');
  if (!applied.ok) return failure(applied.diagnostics);
  holdIndex(index);
  return success(
    disposable(() => {
      holdIndex(undefined);
      runCalls(session, resetCalls());
    }),
  );
};

const start = (viewer: GalleryViewer): Promise<Result<Disposable>> => {
  const opened = viewer.opened()[0];
  if (opened === undefined) return Promise.resolve(failure([diagnostic('colour-by/no-model', 'No model is open, so there is nothing to colour.', [])]));
  const index = inspectIndexOf(opened.data, opened.geometry, { properties: opened.properties, documents: opened.documents });
  const started = startColourBy(viewer, index);
  if (!started.ok) return Promise.resolve(started);
  // A click reads what is under the pointer; a click on nothing clears the reading.
  const read = (event: PointerEvent): void => {
    const hit = viewer.pick(event.clientX, event.clientY);
    viewer.dispatch('sets.select', { members: hit === undefined ? [] : [hit.key], mode: 'replace' });
  };
  viewer.canvas.addEventListener('pointerdown', read);
  return Promise.resolve(
    success(
      disposable(() => {
        viewer.canvas.removeEventListener('pointerdown', read);
        started.value.dispose();
      }),
    ),
  );
};

// True once a colour-by rule is in the appearance slice.
export const colourByReady = (session: Session): boolean =>
  session.read(appearanceSlice).rules.some((rule) => rule.id.startsWith('colour-by/'));

// What a browser smoke reads back: the column, the counts, the legend's size, and the picked element.
export const colourByReport = (session: Session): DemoReport => {
  const rows = classRows(session);
  const counts = classCounts(rows);
  const key = session.read(setsSlice).selection[0];
  const record = key === undefined ? undefined : heldIndex()?.records.get(key);
  return {
    column: chosenColumn(session) ?? 'none',
    known: counts.known,
    missing: counts.missing,
    conflicting: counts.conflicting,
    legendEntries: rows.length,
    picked: key === undefined ? 'none' : (record?.name ?? key),
  };
};

export const demo: Demo = {
  id: 'colour-by',
  chapter: 'inspect',
  title: 'Colour by',
  question: 'Which is which? Colour the building by category or by storey.',
  briefIds: ['F08'],
  features: [editsFeature, setsFeature, appearanceFeature],
  fixtures: defaultFixtures,
  panels: colourByPanels,
  inspector: colourBySheet,
  start,
  ready: colourByReady,
  report: colourByReport,
  source: 'packages/demos/src/demos/colour-by',
  verify: 'npx vitest run --root packages/demos test/demos/colour-by',
};
