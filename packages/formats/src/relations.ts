/**
 * The relations a BOS file records between its entities, as columns over object rows.
 *
 * `Relations.parquet` has one row per relation: `EntityA`, `EntityB` and `RelationType`, an ordinal
 * of the schema's `RelationType` enum. A relation reads "A is <kind> B": a wall is contained in a
 * storey, a window fills an opening, a layer is a layer of a wall. The decode keeps the ordinal and
 * maps each side to an object row, -1 when the entity is not an object of this model, so a reader
 * joins on integers and never on strings.
 *
 * Containment is the relation the viewer leans on: it is how a real IFC file says which storey an
 * element sits on, where a Revit export writes a level property instead. The BFAST reader turns it
 * into each object's `parentId`, so storeys, levels and sections work off one link however the file
 * recorded it.
 */

import { parquetInteger } from './properties.js';

// The kinds of the schema's `RelationType` enum, in ordinal order. The names are the enum's.
export const relationKinds = [
  'partOf',
  'memberOf',
  'containedIn',
  'hostedBy',
  'childOf',
  'hasLayer',
  'hasMaterial',
  'connectsTo',
  'hasConnector',
  'boundedBy',
  'traverseTo',
  'voids',
  'fills',
  'covers',
  'serves',
] as const;

export type RelationKind = (typeof relationKinds)[number];

// The ordinal a kind is stored as, or undefined for a kind the schema does not have.
export const relationOrdinal = (kind: RelationKind): number => relationKinds.indexOf(kind);

// The kind an ordinal stands for, or undefined for one this reader does not know.
export const relationKindOf = (ordinal: number): RelationKind | undefined => relationKinds[ordinal];

// Every relation of a model, columnar: row `i` says object `from[i]` is `kind[i]` object `to[i]`.
export type ModelRelations = {
  readonly count: number;
  /** The `RelationType` ordinal of each relation, kept even when this reader has no name for it. */
  readonly kind: Int32Array;
  /** Object row of `EntityA`, -1 when that entity is not an object of this model. */
  readonly from: Int32Array;
  /** Object row of `EntityB`, -1 when that entity is not an object of this model. */
  readonly to: Int32Array;
};

// A model that records no relations.
export const noModelRelations: ModelRelations = {
  count: 0,
  kind: new Int32Array(0),
  from: new Int32Array(0),
  to: new Int32Array(0),
};

// The object row an entity index maps to, or -1 for an entity that is not an object here.
const rowOf = (rowOfEntity: Int32Array, entity: number | undefined): number =>
  entity === undefined || entity < 0 || entity >= rowOfEntity.length ? -1 : (rowOfEntity[entity] ?? -1);

/**
 * Decodes the rows of `Relations.parquet`. `rowOfEntity` is the object row of each entity index,
 * -1 where the entity is not an object, which is what `bfastEntityRows` builds.
 *
 * A row whose type is not an integer is kept with kind -1 rather than dropped, so the count the
 * file declares is the count a reader sees.
 */
export function modelRelationsFrom(
  rows: readonly Readonly<Record<string, unknown>>[],
  rowOfEntity: Int32Array,
): ModelRelations {
  const count = rows.length;
  const kind = new Int32Array(count);
  const from = new Int32Array(count);
  const to = new Int32Array(count);
  for (let row = 0; row < count; row += 1) {
    const source = rows[row];
    kind[row] = parquetInteger(source?.['RelationType']) ?? -1;
    from[row] = rowOf(rowOfEntity, parquetInteger(source?.['EntityA']));
    to[row] = rowOf(rowOfEntity, parquetInteger(source?.['EntityB']));
  }
  return { count, kind, from, to };
}

// The rows of one kind, in file order.
export const relationRowsOfKind = (relations: ModelRelations, kind: RelationKind): readonly number[] => {
  const ordinal = relationOrdinal(kind);
  const found: number[] = [];
  for (let row = 0; row < relations.count; row += 1) if (relations.kind[row] === ordinal) found.push(row);
  return found;
};

/**
 * The container of each object row under one kind of relation: `containerOf[object]` is the object
 * row it is contained in (or hosted by, or a member of), -1 when the file records none. The first
 * relation that names an object wins, so a file that lists an element under two storeys keeps the
 * one it wrote first rather than the last, which is the order a reader of the file would see.
 */
export const containersOf = (relations: ModelRelations, objects: number, kind: RelationKind = 'containedIn'): Int32Array => {
  const container = new Int32Array(objects).fill(-1);
  for (const row of relationRowsOfKind(relations, kind)) {
    const from = relations.from[row] ?? -1;
    const to = relations.to[row] ?? -1;
    if (from < 0 || to < 0 || from >= objects || container[from] !== -1) continue;
    container[from] = to;
  }
  return container;
};
