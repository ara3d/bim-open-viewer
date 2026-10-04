// The three colourings this demo can apply, each built once from one table so its rules and its
// legend can never disagree.
//
// Two of them read a string column - the category the model records and the storey an object hangs
// under - and one reads a fact, the nominal width of a door. The fact is the interesting one,
// because a width can be recorded, absent, or reported differently by two sources, and those are
// three different answers. A door whose sources disagree is left out of the ramp and given its own
// colour, so the count against "no width recorded" means what it says.
//
// The colours here are analytical: they carry meaning and never change with the gallery theme.

import {
  categoryStyling,
  numericStyling,
  type CategoryPalette,
  type Legend,
  type LegendEntry,
  type NumericScale,
} from '@bim-open-viewer/features';
import {
  diagnostic,
  failure,
  filterRows,
  stringAt,
  stringColumn,
  stringColumnOf,
  styleRule,
  success,
  table,
  type Color,
  type ObjectKey,
  type Result,
  type StyleRule,
  type Table,
} from '@bim-open-viewer/model';
import {
  hideWallsRule,
  objectTable,
  type CommandCall,
  type InspectIndex,
} from '../point-and-read/building.js';

// Which column the building is coloured by.
export type ColourColumnId = 'category' | 'storey' | 'doorWidth';

// The columns the picker offers, in the order it lists them.
export const colourColumns: readonly { readonly id: ColourColumnId; readonly title: string }[] = [
  { id: 'category', title: 'Category' },
  { id: 'storey', title: 'Storey' },
  { id: 'doorWidth', title: 'Door width' },
];

// The colour a value nobody recorded gets. Grey is not a low value on a scale; it is no answer.
export const missingColour: Color = [0.55, 0.55, 0.55];

// The colour a value whose sources disagree gets. It is neither of the readings.
export const conflictingColour: Color = [0.85, 0.2, 0.65];

// The ends of the door-width ramp.
export const widthLow: Color = [0.9, 0.93, 0.7];
export const widthHigh: Color = [0.1, 0.35, 0.55];

// The colours the category swatches take, most common value first. Twelve, so a legend at its
// limit gives every named entry a colour of its own.
const categoryColours: readonly Color[] = [
  [0.12, 0.47, 0.71],
  [1, 0.5, 0.05],
  [0.17, 0.63, 0.17],
  [0.84, 0.15, 0.16],
  [0.58, 0.4, 0.74],
  [0.55, 0.34, 0.29],
  [0.89, 0.47, 0.76],
  [0.74, 0.74, 0.13],
  [0.09, 0.75, 0.81],
  [0.68, 0.78, 0.91],
  [1, 0.73, 0.47],
  [0.6, 0.87, 0.54],
];

// The colour of the entry that stands for every value past the named ones.
export const otherColour: Color = [0.78, 0.78, 0.8];

// The most values a legend names; the rest are folded into one "Other" entry.
export const maxNamedValues = 12;

// The value and label of that folded entry. The value cannot be a real category or storey name.
export const otherValue = '(other values)';
export const otherLabel = 'Other';

// The legend the disputed doors are listed under, which is what tells a class row it is a conflict.
export const conflictingLegendId = 'colour-by/conflicting';

// The name a colouring's rules and legend are held under.
export const legendIdOf = (column: ColourColumnId): string => `colour-by/${column}`;

// What one colouring is: the rules that apply it, the legends that explain it, and whether the
// walls have to go so the objects it colours can be seen.
export type Colouring = {
  readonly column: ColourColumnId;
  readonly title: string;
  readonly hideWalls: boolean;
  readonly rules: readonly StyleRule[];
  readonly legends: readonly Legend[];
};

// The distinct non-empty values of a string column with how many rows hold each, most common first;
// values with equal counts keep the order they first appear in.
export const rankedValues = (
  source: Table,
  name: string,
): readonly { readonly value: string; readonly count: number }[] => {
  const column = stringColumnOf(source, name);
  if (column === undefined) return [];
  const counts = new Map<string, number>();
  for (let row = 0; row < source.rowCount; row += 1) {
    const value = stringAt(column, row);
    if (value !== undefined && value !== '') counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count })).sort((left, right) => right.count - left.count);
};

// The rows of the object table that draw something. A legend over the whole table would be mostly
// entries for objects with nothing to colour: 38,947 objects on Schependomlaan, 5,978 drawn.
export const drawnTable = (index: InspectIndex): Table =>
  filterRows(objectTable(index), (row) => index.records.get(index.keys[row] ?? '')?.representation !== undefined);

// The lowest point of each storey name along the model's up axis, for the names the index knows it for.
const elevationsOf = (index: InspectIndex): ReadonlyMap<string, number> => {
  const axis = index.model.coordinates.up === 'y' ? 1 : 2;
  const found = new Map<string, number>();
  for (const storey of index.storeys) {
    const low = storey.bounds.min[axis];
    if (low === undefined || !Number.isFinite(low)) continue;
    found.set(storey.name, Math.min(found.get(storey.name) ?? Infinity, low));
  }
  return found;
};

// Storey names in elevation order where the index knows an elevation, and name order for the rest,
// which follow the ones with an elevation.
const inStoreyOrder = (names: readonly string[], elevations: ReadonlyMap<string, number>): readonly string[] =>
  [...names].sort((left, right) => {
    const lowLeft = elevations.get(left);
    const lowRight = elevations.get(right);
    if (lowLeft !== undefined && lowRight !== undefined && lowLeft !== lowRight) return lowLeft - lowRight;
    if ((lowLeft === undefined) !== (lowRight === undefined)) return lowLeft === undefined ? 1 : -1;
    return left.localeCompare(right);
  });

// What a swatch calls an IFC category: "IFCWALLSTANDARDCASE" reads as "Wall standard case". A name
// that is not an IFC class is shown as recorded. The legend's value stays the raw category, so the
// rule still matches the column; only the label changes.
export const categoryLabel = (value: string): string => {
  const match = /^IFC([A-Z0-9]+)$/u.exec(value);
  if (match === null) return value;
  const words = (match[1] ?? '').toLowerCase().replace(/(element|standard|case|part|proxy|segment|fitting|terminal|member)/gu, ' $1 ');
  const text = words.replace(/\s+/gu, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const paletteOf = (
  values: readonly string[],
  colours: readonly Color[],
  title: string,
  absent: string,
  folded: boolean,
): CategoryPalette => ({
  title,
  entries: [
    ...values.map((value, index) => ({
      value,
      label: categoryLabel(value),
      color: colours[index % colours.length] ?? missingColour,
    })),
    ...(folded ? [{ value: otherValue, label: otherLabel, color: otherColour }] : []),
  ],
  missing: { value: '', label: absent, color: missingColour },
});

// The table with the column's values past the named ones replaced by the folded entry's value.
const foldedTable = (source: Table, name: string, named: ReadonlySet<string>): Table => {
  const keys = stringColumnOf(source, 'key');
  const column = stringColumnOf(source, name);
  if (keys === undefined || column === undefined) return source;
  const values = Array.from({ length: source.rowCount }, (_unused, row) => {
    const value = stringAt(column, row);
    return value === undefined || value === '' || named.has(value) ? (value ?? '') : otherValue;
  });
  return table([
    ['key', keys],
    [name, stringColumn(values)],
  ]);
};

const widthScale: NumericScale = {
  title: 'Door nominal width',
  min: 700,
  max: 1050,
  low: widthLow,
  high: widthHigh,
  bands: 4,
  missing: { value: '', label: 'No width recorded', color: missingColour },
};

// The doors whose two sources report different nominal widths. They are left out of the ramp, so
// the ramp's missing count is doors nobody measured and nothing else.
export const disputedWidthDoors = (index: InspectIndex): readonly ObjectKey[] =>
  index.keys.filter((key) => index.facts.get(key)?.get('nominalWidth')?.observation.kind === 'conflicting');

// One swatch for the disputed doors, and the legend that names it.
const disputedStyling = (index: InspectIndex): { readonly rule: StyleRule; readonly legend: Legend } => {
  const entry: LegendEntry = { value: 'conflicting', label: 'Sources disagree', color: conflictingColour };
  return {
    rule: styleRule(`${conflictingLegendId}/conflicting`, entry.label, disputedWidthDoors(index), { color: conflictingColour }, 5),
    legend: {
      kind: 'category',
      id: conflictingLegendId,
      title: 'Disputed',
      entries: [entry],
      missing: { value: '', label: 'Not disputed', color: missingColour },
    },
  };
};

const categoryColouring = (index: InspectIndex, column: 'category' | 'storey'): Result<Colouring> => {
  const drawn = drawnTable(index);
  const ranked = rankedValues(drawn, column);
  const kept = ranked.slice(0, maxNamedValues).map((one) => one.value);
  const folded = ranked.length > kept.length;
  const values = column === 'storey' ? inStoreyOrder(kept, elevationsOf(index)) : kept;
  const palette = paletteOf(
    values,
    categoryColours,
    column === 'category' ? 'Category' : 'Storey',
    column === 'category' ? 'No category recorded' : 'No storey link recorded',
    folded,
  );
  const source = folded ? foldedTable(drawn, column, new Set(kept)) : drawn;
  const styled = categoryStyling(legendIdOf(column), source, 'key', column, palette);
  if (!styled.ok) return failure(styled.diagnostics);
  return success({
    column,
    title: palette.title,
    hideWalls: false,
    rules: styled.value.rules,
    legends: [styled.value.legend],
  });
};

const widthColouring = (index: InspectIndex): Result<Colouring> => {
  const disputed = new Set(disputedWidthDoors(index));
  const source = drawnTable(index);
  const keys = stringColumnOf(source, 'key');
  const categories = stringColumnOf(source, 'category');
  if (keys === undefined || categories === undefined)
    return failure([
      diagnostic('colour-by/missing-column', 'The object table needs a "key" and a "category" column.', ['columns']),
    ]);
  const doors = filterRows(
    source,
    (row) => stringAt(categories, row) === 'Door' && !disputed.has(stringAt(keys, row) ?? ''),
  );
  const styled = numericStyling(legendIdOf('doorWidth'), doors, 'key', 'nominalWidthMm', widthScale);
  if (!styled.ok) return failure(styled.diagnostics);
  const marked = disputedStyling(index);
  return success({
    column: 'doorWidth',
    title: widthScale.title,
    hideWalls: true,
    rules: [...styled.value.rules, marked.rule],
    legends: [styled.value.legend, marked.legend],
  });
};

// The colouring for one column, built from the building's own table.
export const colouringOf = (index: InspectIndex, column: ColourColumnId): Result<Colouring> =>
  column === 'doorWidth' ? widthColouring(index) : categoryColouring(index, column);

// What applying a colouring dispatches: everything already applied is removed first, so switching
// column leaves nothing of the previous one behind.
export const colouringCalls = (index: InspectIndex, colouring: Colouring): readonly CommandCall[] => [
  { command: 'appearance.clear', input: {} },
  ...colouring.legends.map((legend) => ({
    command: 'appearance.addRules',
    input: {
      rules: colouring.rules.filter((rule) => rule.id.startsWith(`${legend.id}/`)),
      legend,
    },
  })),
  ...(colouring.hideWalls
    ? [{ command: 'appearance.addRules', input: { rules: [hideWallsRule(index)] } }]
    : []),
];

// What the demo undoes when it is disposed.
export const resetCalls = (): readonly CommandCall[] => [
  { command: 'appearance.clear', input: {} },
  { command: 'sets.clear', input: {} },
];
