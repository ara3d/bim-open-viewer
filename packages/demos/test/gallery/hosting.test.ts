import { describe, expect, it } from 'vitest';
import { success } from '@bim-open-viewer/model';
import { hostedDemos } from '../../src/gallery/hosting.js';
import { demo as placeholder } from '../../src/demos/_shared/placeholder.js';
import type { Demo, DemoFixture } from '../../src/gallery/contracts.js';

const fixture = (id: string, servedLocally?: boolean, basis: DemoFixture['basis'] = 'synthetic'): DemoFixture => ({
  id,
  title: id,
  basis,
  servedLocally,
  source: () => Promise.resolve(success({ kind: 'url', id, url: `/fixtures/${id}` })),
});

const withFixtures = (id: string, fixtures: readonly DemoFixture[]): Demo => ({ ...placeholder, id, fixtures });

describe('hosted demos', () => {
  const demos = [
    withFixtures('both', [fixture('private', true), fixture('generated')]),
    withFixtures('private-only', [fixture('private', true)]),
  ];

  it('keeps every fixture when the dev server can hand out private models', () => {
    expect(hostedDemos(demos, false)).toBe(demos);
  });

  it('drops server-only and generated fixtures, and any demo left without one, on the static site', () => {
    expect(hostedDemos(demos, true)).toEqual([]);
  });

  it('keeps the real fixtures of a demo on the static site', () => {
    const demo = withFixtures('mixed', [fixture('private', true), fixture('real', false, 'source-backed'), fixture('generated')]);
    expect(hostedDemos([demo], true)[0]?.fixtures.map((one) => one.id)).toEqual(['real']);
    expect(hostedDemos([demo], false)[0]?.fixtures.map((one) => one.id)).toEqual(['private', 'real', 'generated']);
  });
});
