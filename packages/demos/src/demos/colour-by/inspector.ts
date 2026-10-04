// What the sidebar shows: the column in force, how many objects it knows, cannot know, or finds
// disputed, the legend as counts, and the element picked in the view.
//
// Counts come from the rules in the appearance slice (`classes.ts`), so the sheet cannot disagree
// with the picture. A column nothing was applied for is said so rather than shown as zeros.

import { setsSlice } from '@bim-open-viewer/features';
import type { Session } from '@bim-open-viewer/model';
import {
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertyGroup,
  type PropertySheet,
} from '@bim-open-viewer/ui-gratify';
import { storeyOfObject } from '../point-and-read/building.js';
import { chosenColumn, classCounts, classRows } from './classes.js';
import { colourColumns } from './colouring.js';
import { heldIndex } from './held.js';

const columnGroup = (session: Session): PropertyGroup => {
  const column = chosenColumn(session);
  if (column === undefined)
    return propertyGroup('column', 'Colouring', [
      propertyRow('column', 'Coloured by', missingValue('no colouring has been applied yet')),
    ]);
  const rows = classRows(session);
  const counts = classCounts(rows);
  return propertyGroup('column', 'Colouring', [
    propertyRow('column', 'Coloured by', knownValue(colourColumns.find((one) => one.id === column)?.title ?? column)),
    propertyRow('known', 'Objects with a value', knownNumber(counts.known, undefined, 0)),
    propertyRow('missing', 'Objects with no value', knownNumber(counts.missing, undefined, 0)),
    propertyRow('conflicting', 'Objects whose sources disagree', knownNumber(counts.conflicting, undefined, 0)),
  ]);
};

const legendGroup = (session: Session): PropertyGroup =>
  propertyGroup(
    'legend',
    'Legend',
    classRows(session).map((row) =>
      propertyRow(row.ruleId, row.label, knownValue(row.enabled ? String(row.count) : `${String(row.count)} (hidden)`)),
    ),
  );

const pickedGroup = (session: Session): PropertyGroup => {
  const index = heldIndex();
  const key = session.read(setsSlice).selection[0];
  const record = key === undefined ? undefined : index?.records.get(key);
  if (index === undefined || key === undefined || record === undefined)
    return propertyGroup('picked', 'Element', [
      propertyRow('none', 'Picked', missingValue('click an element in the view to read it')),
    ]);
  const storey = storeyOfObject(index, key);
  return propertyGroup('picked', 'Element', [
    propertyRow('name', 'Name', record.name === undefined ? missingValue('the file records no name') : knownValue(record.name)),
    propertyRow(
      'category',
      'Category',
      record.category === undefined ? missingValue('the file records no category') : knownValue(record.category),
    ),
    propertyRow(
      'storey',
      'Storey',
      storey?.name === undefined ? missingValue('nothing links it to a storey') : knownValue(storey.name),
    ),
  ]);
};

// The colour-by sheet.
export const colourBySheet = (session: Session): PropertySheet =>
  propertySheet(
    'Colour by',
    [columnGroup(session), legendGroup(session), pickedGroup(session)],
    'Legends cover the objects that draw something; the rest of the model has nothing to colour.',
  );
