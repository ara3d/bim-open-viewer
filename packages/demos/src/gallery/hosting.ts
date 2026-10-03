/// <reference types="vite/client" />
// What the host serving the gallery can open.
//
// The dev server (`npm run gallery`) hands private models out of the machine's own folders; the
// static site (`npm run pages`, published to GitHub Pages) is files and nothing else. The pages
// build sets `VITE_GALLERY_STATIC`, and every fixture that needs the dev server is dropped from the
// pickers, along with any demo left with none. A demo is left out rather than shown failing.

import type { Demo } from './contracts.js';

// True in the static site build.
export const staticSite: boolean = import.meta.env['VITE_GALLERY_STATIC'] === 'true';

// The demos as this host can run them: each with only the fixtures it can open, and none without one.
export const hostedDemos = (demos: readonly Demo[], isStatic: boolean = staticSite): readonly Demo[] =>
  isStatic
    ? demos
        .map((demo) => ({ ...demo, fixtures: demo.fixtures.filter((fixture) => fixture.servedLocally !== true) }))
        .filter((demo) => demo.fixtures.length > 0)
    : demos;
