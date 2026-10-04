import { describe, expect, it } from 'vitest';
import {
  boundsCorners,
  cameraPose,
  emptyBounds,
  metresZUpLocal,
  perspective,
  subVec3,
  viewDistance,
  viewState,
  type Bounds,
  type ViewState,
} from '@bim-open-viewer/model';
import { cameraBasis, dollyPose, orbitPose } from '../src/camera.js';
import { depthRangeFor, fitBounds, setProjectionKind, withDepthRange } from '../src/projection.js';
import { dot } from '../src/vec.js';

const zUp = [0, 0, 1] as const;

// A building-sized box, well away from the origin as a real model is.
const box: Bounds = { min: [1000, 2000, 0], max: [1060, 2040, 25] };

// The depth of every corner of the box in front of the camera, along its view direction.
const cornerDepths = (view: ViewState, bounds: Bounds): readonly number[] => {
  const { forward } = cameraBasis(view.camera);
  return boundsCorners(bounds).map((corner) => dot(subVec3(corner, view.camera.position), forward));
};

// Nothing of the box is clipped: every corner lies short of the far plane and beyond the near one.
// A perspective camera cannot see behind itself, so a corner behind it, or within ten centimetres of
// it (as close as anyone walks to a wall), is not asked to be in front of the near plane.
const holdsBox = (view: ViewState, bounds: Bounds): boolean =>
  cornerDepths(view, bounds).every(
    (depth) =>
      depth < view.projection.far &&
      (depth > view.projection.near || (view.projection.kind === 'perspective' && depth <= 0.1)),
  );

// Fits the box, insisting on a result.
const framed = (view: ViewState, bounds: Bounds): ViewState => {
  const result = fitBounds(view, bounds, { aspect: 1.6, padding: 1.05 });
  if (result === undefined) throw new Error('expected a view that fits the box');
  return result;
};

// The view dollied by the factor, then re-cut around the box as a renderer does before drawing.
const dollied = (view: ViewState, factor: number, bounds: Bounds): ViewState =>
  withDepthRange({ ...view, camera: dollyPose(view.camera, factor, { minPolar: 0.01, maxPolar: 3, minDistance: 0.01, maxDistance: 1e7 }) }, bounds);

const start = viewState(cameraPose([0, -100, 50], [0, 0, 0], [...zUp]), perspective(50), metresZUpLocal);

describe('depthRangeFor', () => {
  it('has no planes for an empty box', () => {
    expect(depthRangeFor(start.camera, 'perspective', emptyBounds)).toBeUndefined();
    expect(withDepthRange(start, emptyBounds)).toBe(start);
  });

  it('brackets the box tightly from a camera outside it', () => {
    const view = framed(start, box);
    const depths = cornerDepths(view, box);
    expect(view.projection.near).toBeLessThan(Math.min(...depths));
    expect(view.projection.far).toBeGreaterThan(Math.max(...depths));
    // Tight: the near plane is most of the way out to the box, not down at a fixed floor.
    expect(view.projection.near).toBeGreaterThan(Math.min(...depths) * 0.8);
  });

  it('keeps a perspective near plane in front of the camera when the camera is inside the box', () => {
    const inside = withDepthRange(
      { ...start, camera: cameraPose([1030, 2020, 2], [1060, 2020, 2], [...zUp]) },
      box,
    );
    expect(inside.projection.near).toBeGreaterThan(0);
    expect(inside.projection.near).toBeLessThan(0.1);
    expect(inside.projection.far).toBeGreaterThan(Math.max(...cornerDepths(inside, box)));
  });

  it('lets an orthographic near plane follow the box behind the camera', () => {
    const flat = setProjectionKind(start, 'orthographic');
    const inside = withDepthRange({ ...flat, camera: cameraPose([1030, 2020, 2], [1060, 2020, 2], [...zUp]) }, box);
    expect(inside.projection.near).toBeLessThan(0);
    expect(holdsBox(inside, box)).toBe(true);
  });

  it('returns the same view when the planes already fit', () => {
    const view = framed(start, box);
    expect(withDepthRange(view, box)).toBe(view);
  });
});

describe('a framed box under zoom', () => {
  it('stays between the planes while a perspective camera dollies in and out by many steps', () => {
    let view = framed(start, box);
    expect(holdsBox(view, box)).toBe(true);
    // In: fourteen steps of 0.7 take the camera from outside the box to deep inside it.
    for (let step = 0; step < 14; step++) {
      view = dollied(view, 0.7, box);
      expect(holdsBox(view, box), `zoomed in, step ${String(step)}, distance ${String(viewDistance(view.camera))}`).toBe(true);
    }
    expect(viewDistance(view.camera)).toBeLessThan(1);
    // Out: twenty steps of 1.5 take it to a hundred times the framing distance.
    for (let step = 0; step < 20; step++) {
      view = dollied(view, 1.5, box);
      expect(holdsBox(view, box), `zoomed out, step ${String(step)}, distance ${String(viewDistance(view.camera))}`).toBe(true);
    }
    expect(viewDistance(view.camera)).toBeGreaterThan(1000);
  });

  it('stays between the planes while an orthographic camera dollies through the box', () => {
    let view = framed(setProjectionKind(start, 'orthographic'), box);
    for (let step = 0; step < 15; step++) {
      view = dollied(view, 0.6, box);
      expect(holdsBox(view, box), `step ${String(step)}`).toBe(true);
    }
  });

  it('stays between the planes while the camera orbits a close target', () => {
    let view = dollied(framed(start, box), 0.3, box);
    for (let step = 0; step < 8; step++) {
      view = withDepthRange({ ...view, camera: orbitPose(view.camera, [...zUp], Math.PI / 4, 0.1) }, box);
      expect(holdsBox(view, box), `orbit step ${String(step)}`).toBe(true);
    }
  });

  it('keeps the depth buffer usable: the planes never span more than ten thousand to one', () => {
    let view = framed(start, box);
    for (let step = 0; step < 14; step++) {
      view = dollied(view, 0.7, box);
      expect(view.projection.far / view.projection.near).toBeLessThanOrEqual(1.0e4 + 1);
    }
  });
});
