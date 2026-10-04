// The building the demo has coloured, and the columns it offers for it.
//
// Module state, like the other Inspect demos', because a panel and the sheet are pure functions of
// the session and the session does not hold the tables a colouring is built from.

import type { InspectIndex } from '../point-and-read/building.js';
import { colourColumns, type ColourColumnId } from './colouring.js';

let held: InspectIndex | undefined;

// Says which building the demo is colouring; called with nothing when the demo is disposed.
export const holdIndex = (index: InspectIndex | undefined): void => {
  held = index;
};

// The building being coloured, or undefined while the demo is not running.
export const heldIndex = (): InspectIndex | undefined => held;

// Whether any door of the building has a recorded nominal width. A model read from a file records
// none, and a chip for a colouring that could only say "no width recorded" would mislead.
const hasWidthFact = (index: InspectIndex): boolean =>
  index.keys.some((key) => index.facts.get(key)?.get('nominalWidth') !== undefined);

// The columns worth offering for a building, in the picker's order.
export const offeredColumns = (index: InspectIndex | undefined): readonly ColourColumnId[] =>
  colourColumns
    .map((column) => column.id)
    .filter((id) => id !== 'doorWidth' || (index !== undefined && hasWidthFact(index)));
