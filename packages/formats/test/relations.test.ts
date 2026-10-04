import { describe, expect, it } from 'vitest';
import {
  containersOf,
  modelRelationsFrom,
  relationKindOf,
  relationOrdinal,
  relationRowsOfKind,
} from '../src/relations.js';

// Entities 0 and 1 are a storey and a wall; entity 2 is a wall; entity 3 is not an object (-1).
const rowOfEntity = Int32Array.from([0, 1, 2, -1]);

const rows = [
  { EntityA: 1, EntityB: 0, RelationType: 2 }, // wall 1 contained in storey 0
  { EntityA: 2, EntityB: 0, RelationType: 2 }, // wall 2 contained in storey 0
  { EntityA: 2, EntityB: 1, RelationType: 2 }, // a second container for wall 2, listed later
  { EntityA: 3, EntityB: 0, RelationType: 2 }, // a non-object contained in the storey
  { EntityA: 1, EntityB: 2, RelationType: 7 }, // wall 1 connects to wall 2
  { EntityA: 1, EntityB: 2, RelationType: 'x' }, // a type the reader cannot read
];

describe('modelRelationsFrom', () => {
  it('names the kinds in the order of the schema enum', () => {
    expect(relationOrdinal('containedIn')).toBe(2);
    expect(relationKindOf(12)).toBe('fills');
    expect(relationKindOf(99)).toBeUndefined();
  });

  it('maps each side to an object row, -1 for an entity that is not an object', () => {
    const found = modelRelationsFrom(rows, rowOfEntity);
    expect(found.count).toBe(6);
    expect([...found.from]).toEqual([1, 2, 2, -1, 1, 1]);
    expect([...found.to]).toEqual([0, 0, 1, 0, 2, 2]);
    expect([...found.kind]).toEqual([2, 2, 2, 2, 7, -1]);
  });

  it('lists the rows of one kind in file order', () => {
    const found = modelRelationsFrom(rows, rowOfEntity);
    expect(relationRowsOfKind(found, 'containedIn')).toEqual([0, 1, 2, 3]);
    expect(relationRowsOfKind(found, 'connectsTo')).toEqual([4]);
    expect(relationRowsOfKind(found, 'fills')).toEqual([]);
  });

  it('gives each object its first container and no other', () => {
    const found = containersOf(modelRelationsFrom(rows, rowOfEntity), 3);
    expect([...found]).toEqual([-1, 0, 0]);
  });
});
