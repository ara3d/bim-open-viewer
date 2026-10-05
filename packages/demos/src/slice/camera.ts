// Where three.js and the render package meet for picking: a pointer position turned into the ray
// the render package picks with. The view is written onto the camera by the viewer package's
// `applyPerspective`.

import { rayThroughNdc, type Ray } from '@bim-open-viewer/render';
import type { Matrix4 } from '@bim-open-viewer/model';
import { Matrix4 as ThreeMatrix4, type PerspectiveCamera } from 'three';

// A three matrix as the model package's column-major sixteen. Indexing `elements` is checked, so
// every element is defaulted; there is no conversion in either package.
export const matrixOf = (source: ThreeMatrix4): Matrix4 => {
  const e = source.elements;
  return [
    e[0] ?? 0, e[1] ?? 0, e[2] ?? 0, e[3] ?? 0,
    e[4] ?? 0, e[5] ?? 0, e[6] ?? 0, e[7] ?? 0,
    e[8] ?? 0, e[9] ?? 0, e[10] ?? 0, e[11] ?? 0,
    e[12] ?? 0, e[13] ?? 0, e[14] ?? 0, e[15] ?? 0,
  ];
};

// The world ray through a point given in client coordinates, or undefined when the camera's
// matrices cannot be inverted into one.
export const rayThroughPoint = (
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Ray | undefined => {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const inverse = new ThreeMatrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  return rayThroughNdc(matrixOf(inverse), x, y);
};
