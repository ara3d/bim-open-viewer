/// <reference types="vite/client" />
// What the host serving the gallery can open.
//
// The dev server (`npm run gallery`) hands private models out of the machine's own folders; the
// static site (`npm run pages`, published to GitHub Pages) is files and nothing else. The pages
// build sets `VITE_GALLERY_STATIC`, and every fixture that needs the dev server is dropped from the
// pickers, along with any demo left with none. A demo is left out rather than shown failing.
//
// The static site also drops a generated fixture from any demo that still has a real one: a visitor
// came to see a building, and the generated one exists for the gaps and conflicts the dev gallery
// studies. A demo with no real fixture is left out of the static site altogether: the site shows
// real buildings, and the dev gallery still has the demo.

import type { Demo, DemoFixture } from './contracts.js';

// True in the static site build.
export const staticSite: boolean = import.meta.env['VITE_GALLERY_STATIC'] === 'true';

// The fixtures of one demo as the static site offers them.
export const staticFixtures = (fixtures: readonly DemoFixture[]): readonly DemoFixture[] => {
  return fixtures.filter((fixture) => fixture.servedLocally !== true && fixture.basis !== 'synthetic');
};

// The demos as this host can run them: each with only the fixtures it can open, and none without one.
export const hostedDemos = (demos: readonly Demo[], isStatic: boolean = staticSite): readonly Demo[] =>
  isStatic
    ? demos.map((demo) => ({ ...demo, fixtures: staticFixtures(demo.fixtures) })).filter((demo) => demo.fixtures.length > 0)
    : demos;
