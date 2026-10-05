// Where three.js and the pure packages meet for picking and the HUD: a pointer turned into a ray,
// and a world point turned into canvas pixels. The view is written onto the camera by the viewer
// package's `applyPerspective`.

import { projectToScreen, rayThroughNdc, type Ray, type ScreenPoint } from '@bim-open-viewer/render';
import type { Matrix4, Vec3 } from '@bim-open-viewer/model';
import { Matrix4 as ThreeMatrix4, type PerspectiveCamera } from 'three';

// A three matrix as the model package's column-major sixteen.
export const matrixOf = (source: ThreeMatrix4): Matrix4 => {
  const e = source.elements;
  return [
    e[0] ?? 0, e[1] ?? 0, e[2] ?? 0, e[3] ?? 0,
    e[4] ?? 0, e[5] ?? 0, e[6] ?? 0, e[7] ?? 0,
    e[8] ?? 0, e[9] ?? 0, e[10] ?? 0, e[11] ?? 0,
    e[12] ?? 0, e[13] ?? 0, e[14] ?? 0, e[15] ?? 0,
  ];
};

// A point in the canvas's own pixels, measured from its top-left corner.
export const pointInCanvas = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): ScreenPoint | undefined => {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return undefined;
  return { x: clientX - rect.left, y: clientY - rect.top };
};

// The size of a drawing surface in CSS pixels; what an `HTMLCanvasElement` reports as its client size.
export type CanvasSize = { readonly clientWidth: number; readonly clientHeight: number };

// The world ray through a canvas point, or undefined when the camera's matrices cannot be inverted.
export const rayThroughCanvasPoint = (
  camera: PerspectiveCamera,
  canvas: CanvasSize,
  point: ScreenPoint,
): Ray | undefined => {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return undefined;
  const x = (point.x / width) * 2 - 1;
  const y = -((point.y / height) * 2 - 1);
  const inverse = new ThreeMatrix4().multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  return rayThroughNdc(matrixOf(inverse), x, y);
};

// A world point in canvas pixels, or undefined when it is behind the camera or off the drawing.
export const projectToCanvas = (
  camera: PerspectiveCamera,
  canvas: CanvasSize,
  point: Vec3,
): ScreenPoint | undefined => {
  const viewProjection = new ThreeMatrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return projectToScreen(matrixOf(viewProjection), point, canvas.clientWidth, canvas.clientHeight);
};
