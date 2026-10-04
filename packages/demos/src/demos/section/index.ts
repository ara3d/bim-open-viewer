// Demo "Section": cut the model open at a storey or with a box.
//
// The opening sequence is a plain function of the session and the model it opened, so it can be run
// and asserted without a canvas; `start` is the contract's wrapper around it. The section lives in
// the clipping slice; the renderer draws the cut faces solid (core's section cap), so a cut wall
// reads as a solid cut rather than a hollow shell.

import {
  clippingFeature,
  clippingSlice,
  navigationAidsFeature,
  type Placement,
} from '@bim-open-viewer/features';
import {
  diagnostic,
  disposable,
  failure,
  success,
  type Bounds,
  type Disposable,
  type ModelData,
  type Result,
  type Session,
} from '@bim-open-viewer/model';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo } from '../../gallery/contracts.js';
import { defaultFixtures } from '../_shared/fixtures.js';
import { sectionSheet } from './inspector.js';
import { sectionPanels } from './panels.js';
import { cutIn, heldSurvey, holdSurvey, openingElevation, surveySection } from './survey.js';

// Surveys the open model, opens a plan cut through the ground floor's windows, and hands back the
// way to lift the section again.
export const startSection = (
  session: Session,
  model: ModelData | undefined,
  placements: readonly Placement[] = [],
  bounds?: Bounds,
): Result<Disposable> => {
  if (model === undefined)
    return failure([diagnostic('section/no-model', 'No model is open, so there is nothing to cut.', [])]);
  const survey = surveySection(model, placements, bounds);
  const elevation = openingElevation(survey);
  if (elevation === undefined)
    return failure([
      diagnostic(
        'section/no-extent',
        'The model records no storeys and has no bounds, so there is no height to cut at.',
        [],
      ),
    ]);
  const applied = session.dispatch('clipping.sectionAt', { elevation, axis: survey.up, keep: 'below' });
  if (!applied.ok) return failure(applied.diagnostics);
  holdSurvey(survey);
  return success(
    disposable(() => {
      holdSurvey(undefined);
      session.dispatch('clipping.clear', {});
    }),
    applied.diagnostics,
  );
};

// True once the clipping slice is enabled and the demo knows what it surveyed.
export const sectionReady = (session: Session): boolean =>
  heldSurvey() !== undefined && session.read(clippingSlice).enabled;

// What a browser smoke reads back: the cut in force and what the model offers it. Lowest and highest
// are the elevations of the lowest and highest level, zero when the model records none.
export const sectionReport = (session: Session): DemoReport => {
  const survey = heldSurvey();
  const cut = cutIn(session, survey?.up ?? 'z');
  const levels = survey?.levels ?? [];
  return {
    regionKind: cut.kind,
    elevation: cut.kind === 'planes' ? (cut.elevation ?? 0) : 0,
    keep: cut.kind === 'planes' ? (cut.keep ?? '') : '',
    levels: levels.length,
    lowest: levels[0]?.elevation ?? 0,
    highest: levels[levels.length - 1]?.elevation ?? 0,
  };
};

export const demo: Demo = {
  id: 'section',
  chapter: 'cut-and-arrange',
  title: 'Section',
  question: 'Cut it open: a plan at any storey, or a section box.',
  briefIds: ['F11'],
  features: [clippingFeature, navigationAidsFeature],
  fixtures: defaultFixtures,
  panels: sectionPanels,
  inspector: sectionSheet,
  start: (viewer) =>
    Promise.resolve(startSection(viewer, viewer.opened()[0]?.data, viewer.placements(), viewer.bounds())),
  ready: sectionReady,
  report: sectionReport,
  source: 'packages/demos/src/demos/section',
  verify: 'npx vitest run --root packages/demos test/demos/section',
};
