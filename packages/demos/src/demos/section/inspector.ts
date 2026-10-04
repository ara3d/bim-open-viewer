// What the sidebar shows: the cut in force, then the levels the survey found.
//
// A model with no storey objects has no levels, and a level the model gives no height has no chip.
// The sheet says how many levels the model records instead of leaving an empty list unexplained.

import type { Session, Vec3 } from '@bim-open-viewer/model';
import {
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertyRow,
  type PropertySheet,
} from '@bim-open-viewer/ui-gratify';
import { cutIn, heldSurvey, type Cut, type SectionSurvey } from './survey.js';

const corner = (point: Vec3): string => point.map((component) => component.toFixed(2)).join(', ');

const cutRows = (cut: Cut): readonly PropertyRow[] => {
  switch (cut.kind) {
    case 'none':
      return [propertyRow('kind', 'Section', missingValue('no section is in force'))];
    case 'box':
      return [
        propertyRow('kind', 'Section', knownValue('Box')),
        propertyRow('min', 'Lower corner', knownValue(corner(cut.min))),
        propertyRow('max', 'Upper corner', knownValue(corner(cut.max))),
      ];
    case 'planes':
      return [
        propertyRow('kind', 'Section', knownValue('Height cut')),
        propertyRow(
          'elevation',
          'Elevation',
          cut.elevation === undefined
            ? missingValue('these planes were not set as a cut along the up axis')
            : knownNumber(cut.elevation),
        ),
        propertyRow(
          'keep',
          'Kept side',
          cut.keep === undefined ? missingValue('not a single height cut') : knownValue(cut.keep === 'below' ? 'Below' : 'Above'),
        ),
      ];
  }
};

// One row per level with its elevation, or one row saying how many the model records when none can
// be listed.
const levelRows = (survey: SectionSurvey | undefined): readonly PropertyRow[] => {
  if (survey === undefined)
    return [propertyRow('levels', 'Levels', missingValue('no model is open, so nothing has been surveyed'))];
  if (survey.levels.length === 0)
    return [propertyRow('levels', 'Levels', missingValue('the model records 0 levels with a height'))];
  return survey.levels.map((level, index) =>
    propertyRow(`level-${index}`, level.name, knownNumber(level.elevation)),
  );
};

// The section sheet: the cut in force, then the levels it can be moved to.
export const sectionSheet = (session: Session): PropertySheet => {
  const survey = heldSurvey();
  return propertySheet(
    'Section',
    [
      propertyGroup('cut', 'Cut in force', cutRows(cutIn(session, survey?.up ?? 'z'))),
      propertyGroup('levels', 'Levels found', levelRows(survey)),
    ],
    'A section hides nothing in the document: it is clipping parameters, and the cut faces are drawn solid.',
  );
};
