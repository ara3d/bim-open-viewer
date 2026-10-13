import { describe, expect, it } from 'vitest';
import { identityMatrix } from '../src/math.js';
import { instanceRecords, noMesh, type Geometry } from '../src/mesh.js';
import { objectRef, type ModelRef } from '../src/identity.js';
import { metresZUpLocal } from '../src/coordinates.js';
import { instanceAppearances, withLoadedAppearances } from '../src/loaded-appearance.js';
import type { ModelData } from '../src/objects.js';

const ref: ModelRef = { id: 'sample', revision: '1' };

const geometry: Geometry = {
  meshes: [],
  instances: instanceRecords([
    { meshIndex: 0, transform: identityMatrix, color: [1, 0, 0], opacity: 0.5, objectIndex: 0 },
    { meshIndex: 0, transform: identityMatrix, color: [0, 1, 0], opacity: 1, objectIndex: 0 },
    { meshIndex: noMesh, transform: identityMatrix, color: [0, 0, 1], opacity: 1, objectIndex: 1 },
    { meshIndex: 0, transform: identityMatrix, color: [0, 0, 1], opacity: 1, objectIndex: 2 },
  ]),
};

const data: ModelData = {
  ref,
  coordinates: metresZUpLocal,
  objects: [
    { ref: objectRef(ref, 'a'), transform: identityMatrix, representation: 0 },
    { ref: objectRef(ref, 'b'), transform: identityMatrix },
    { ref: objectRef(ref, 'c'), transform: identityMatrix, representation: 3, appearance: { color: [1, 1, 1], opacity: 1, visible: false } },
  ],
};

describe('instanceAppearances', () => {
  it('takes the first drawn instance of each object and skips rows without a mesh', () => {
    const found = instanceAppearances(geometry);
    expect(found.get(0)).toEqual({ color: [1, 0, 0], opacity: 0.5, visible: true });
    expect(found.has(1)).toBe(false);
    expect(found.get(2)?.color).toEqual([0, 0, 1]);
  });
});

describe('withLoadedAppearances', () => {
  it('fills records that lack an appearance and keeps the ones that have one', () => {
    const filled = withLoadedAppearances(data, geometry);
    expect(filled.objects[0]?.appearance).toEqual({ color: [1, 0, 0], opacity: 0.5, visible: true });
    expect(filled.objects[1]?.appearance).toBeUndefined();
    expect(filled.objects[2]?.appearance?.visible).toBe(false);
    expect(filled.objects[2]).toBe(data.objects[2]);
  });

  it('returns the same data when no record lacks an appearance or nothing is drawn', () => {
    const complete: ModelData = { ...data, objects: data.objects.map((record) => ({ ...record, appearance: { color: [0, 0, 0], opacity: 1, visible: true } })) };
    expect(withLoadedAppearances(complete, geometry)).toBe(complete);
    const undrawn: Geometry = { meshes: [], instances: instanceRecords([]) };
    expect(withLoadedAppearances(data, undrawn)).toBe(data);
  });
});
