// Putting a colouring on the building: the one place that turns a column choice into commands.

import { failure, success, type Result, type Session } from '@bim-open-viewer/model';
import { runCalls, type InspectIndex } from '../point-and-read/building.js';
import { colouringCalls, colouringOf, type ColourColumnId } from './colouring.js';

// Colours the building by one column, replacing whatever colouring was in force. Returns how many
// rules the colouring holds.
export const applyColumn = (session: Session, index: InspectIndex, column: ColourColumnId): Result<number> => {
  const colouring = colouringOf(index, column);
  if (!colouring.ok) return failure(colouring.diagnostics);
  const applied = runCalls(session, colouringCalls(index, colouring.value));
  return applied.ok ? success(colouring.value.rules.length) : failure(applied.diagnostics);
};
