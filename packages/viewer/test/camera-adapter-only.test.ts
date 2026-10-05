// One place writes a view onto a three camera: `src/adapters/camera.ts`. Four demo hosts once kept
// their own ten-line copy, and the fix that re-cuts the depth planes around the scene (TKT-161)
// reached the adapter and none of the copies, so every demo page clipped after a dolly (TKT-164).
// This test reads every source file under `packages/*/src` and fails on a line that sets a camera's
// near, far or field of view, or rebuilds its projection matrix, anywhere but the adapter. The
// eslint rule in `eslint.config.js` says the same thing to the editor; this is the gate.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const packagesDir = join(repositoryRoot, 'packages');

// The one file allowed to write a projection onto a camera.
const adapter = 'packages/viewer/src/adapters/camera.ts';

// The retired alpha viewer rebuilds its projection matrix on resize. It is excluded from the V2
// lint and build and is not extended, so it keeps that one call; it sets no plane itself.
const alphaAllowance: ReadonlySet<string> = new Set(['packages/core/src/viewer.ts']);

// A write to `.near`, `.far` or `.fov` (not a comparison), or a projection-matrix rebuild.
const planeWrite = /\.(near|far|fov)\s*=(?!=)/;
const projectionRebuild = /\.updateProjectionMatrix\(\)/;

const isSource = (name: string): boolean => (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.d.ts');

// Every source file under `packages/<name>/src`, as repository-relative paths with forward slashes.
const sourceFiles = (): readonly string[] => {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist') walk(path);
      } else if (entry.isFile() && isSource(entry.name)) found.push(relative(repositoryRoot, path).split(sep).join('/'));
    }
  };
  for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    try {
      walk(join(packagesDir, pkg.name, 'src'));
    } catch {
      // A package without a src folder has nothing to scan.
    }
  }
  return found.sort();
};

type Offence = { readonly file: string; readonly line: number; readonly text: string };

// The offending lines of one file, given which patterns apply to it.
export const offencesIn = (file: string, source: string, patterns: readonly RegExp[]): readonly Offence[] =>
  source
    .split(/\r?\n/)
    .flatMap((text, index) =>
      patterns.some((pattern) => pattern.test(text)) ? [{ file, line: index + 1, text: text.trim() }] : [],
    );

const patternsFor = (file: string): readonly RegExp[] => {
  if (file === adapter) return [];
  if (alphaAllowance.has(file)) return [planeWrite];
  return [planeWrite, projectionRebuild];
};

describe('the camera adapter is the only place a view is written onto a three camera', () => {
  it('scans the demo hosts, so the guard reads what it is meant to read', () => {
    const files = sourceFiles();
    expect(files).toContain(adapter);
    expect(files).toContain('packages/demos/src/gallery/viewer.ts');
    expect(files).toContain('packages/demos/src/ambient-occlusion/stage.ts');
  });

  it('finds the writes in the adapter, so a silent pattern cannot pass everything', () => {
    const source = readFileSync(join(repositoryRoot, adapter), 'utf8');
    expect(offencesIn(adapter, source, [planeWrite]).length).toBeGreaterThan(0);
    expect(offencesIn(adapter, source, [projectionRebuild]).length).toBeGreaterThan(0);
  });

  it('finds no plane write or projection rebuild outside the adapter', () => {
    const offences = sourceFiles().flatMap((file) =>
      offencesIn(file, readFileSync(join(repositoryRoot, file), 'utf8'), patternsFor(file)),
    );
    const report = offences.map((one) => `${one.file}:${one.line}: ${one.text}`).join('\n');
    expect(report, `write the view through applyPerspective or applyOrthographic from ${adapter} instead`).toBe('');
  });
});
