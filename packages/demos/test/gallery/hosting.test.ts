import { describe, expect, it } from 'vitest';
import { success } from '@bim-open-viewer/model';
import { hostedDemos } from '../../src/gallery/hosting.js';
import { demo as placeholder } from '../../src/demos/_shared/placeholder.js';
import type { Demo, DemoFixture } from '../../src/gallery/contracts.js';

const fixture = (id: string, servedLocally?: boolean): DemoFixture => ({
  id,
  title: id,
  basis: 'synthetic',
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

  it('drops server-only fixtures, and any demo left without one, on the static site', () => {
    const hosted = hostedDemos(demos, true);
    expect(hosted.map((one) => one.id)).toEqual(['both']);
    expect(hosted[0]?.fixtures.map((one) => one.id)).toEqual(['generated']);
  });
});
