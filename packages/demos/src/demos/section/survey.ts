// What the open model offers a section, measured on the model itself, and what cut is in force.
//
// The survey is taken once when the demo starts and held, for the reason explode's survey is: `ready`,
// `report`, the panel's `sync` and the inspector are given a session and never the model, and they
// run after every change event. The cut in force is not held here: it is read back out of the
// clipping slice, so a section set by a saved scene or a script shows the same as one set by the bar.

import {
  clippingSlice,
  levelsOf,
  storeyElevations,
  type Level,
  type Placement,
  type SectionSide,
} from '@bim-open-viewer/features';
import { metresPerUnit, type Bounds, type ModelData, type Session, type UpAxis, type Vec3 } from '@bim-open-viewer/model';

// How far above a level's floor a plan cut is made: through the windows of that storey, in metres.
export const planCutMetres = 1.2;

// The share of the model's width and depth a section box keeps, centred.
export const boxShare = 0.6;

// What the open model offers a section.
export type SectionSurvey = {
  readonly up: UpAxis;
  // Storeys with a height, lowest first.
  readonly levels: readonly Level[];
  // The model's extent, or undefined when nothing is drawn.
  readonly bounds: Bounds | undefined;
  // The cut height above a floor, in the model's own units.
  readonly cutOffset: number;
};

const upIndex = (up: UpAxis): 1 | 2 => (up === 'y' ? 1 : 2);

export const surveySection = (
  model: ModelData,
  placements: readonly Placement[],
  bounds: Bounds | undefined,
): SectionSurvey => {
  const up = model.coordinates.up;
  return {
    up,
    levels: levelsOf(model, storeyElevations(model, placements, up)),
    bounds,
    cutOffset: planCutMetres / (metresPerUnit(model.coordinates.units) ?? 1),
  };
};

// The lowest and highest height the model reaches along up: its bounds, else its levels, else none.
export const heightRange = (survey: SectionSurvey): { readonly low: number; readonly high: number } | undefined => {
  if (survey.bounds !== undefined) {
    const axis = upIndex(survey.up);
    return { low: survey.bounds.min[axis], high: survey.bounds.max[axis] };
  }
  const first = survey.levels[0];
  const last = survey.levels[survey.levels.length - 1];
  return first === undefined || last === undefined ? undefined : { low: first.elevation, high: last.elevation };
};

// The plan cut that opens the demo: through the windows of the second lowest level (the ground floor
// when the lowest is a basement), the only level when there is one, and mid-height when the model
// records no storeys.
export const openingElevation = (survey: SectionSurvey): number | undefined => {
  const level = survey.levels[1] ?? survey.levels[0];
  if (level !== undefined) return level.elevation + survey.cutOffset;
  const range = heightRange(survey);
  return range === undefined ? undefined : (range.low + range.high) / 2;
};

// A box over the middle of the model across the ground plane and its full height.
export const middleBox = (survey: SectionSurvey): { readonly min: Vec3; readonly max: Vec3 } | undefined => {
  const bounds = survey.bounds;
  if (bounds === undefined) return undefined;
  const trim = (1 - boxShare) / 2;
  const min: [number, number, number] = [...bounds.min];
  const max: [number, number, number] = [...bounds.max];
  const vertical = upIndex(survey.up);
  for (const axis of [0, 1, 2] as const) {
    if (axis === vertical) continue;
    const size = bounds.max[axis] - bounds.min[axis];
    min[axis] = bounds.min[axis] + size * trim;
    max[axis] = bounds.max[axis] - size * trim;
  }
  return { min, max };
};

// The section in force, read out of the slice.
export type Cut =
  | { readonly kind: 'none' }
  | { readonly kind: 'planes'; readonly elevation: number | undefined; readonly keep: SectionSide | undefined }
  | { readonly kind: 'box'; readonly min: Vec3; readonly max: Vec3 };

// A single half-space whose normal is the up axis is a height cut; any other set of planes is a
// section this demo did not make and has no elevation to quote.
export const cutIn = (session: Session, up: UpAxis): Cut => {
  const state = session.read(clippingSlice);
  if (!state.enabled) return { kind: 'none' };
  const region = state.region;
  if (region.kind === 'box') return { kind: 'box', min: region.min, max: region.max };
  const plane = region.planes[0];
  if (plane === undefined) return { kind: 'none' };
  const axis = upIndex(up);
  const flat = plane.normal.every((component, index) => index === axis || component === 0);
  if (region.planes.length === 1 && flat) {
    if (plane.normal[axis] === -1) return { kind: 'planes', elevation: plane.constant, keep: 'below' };
    if (plane.normal[axis] === 1) return { kind: 'planes', elevation: -plane.constant, keep: 'above' };
  }
  return { kind: 'planes', elevation: undefined, keep: undefined };
};

let held: SectionSurvey | undefined;

// The survey of the model the demo has open, or undefined before it starts and after it is disposed.
export const heldSurvey = (): SectionSurvey | undefined => held;

// Holds what `start` surveyed, so the session-only functions can quote it. Undefined releases it.
export const holdSurvey = (survey: SectionSurvey | undefined): void => {
  held = survey;
};
