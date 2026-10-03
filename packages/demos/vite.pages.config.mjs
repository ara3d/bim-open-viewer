// Builds the static site published to GitHub Pages: the landing page (`index.html`) and the demo
// gallery (`gallery.html`), as plain files in `dist-pages/` at the repository root.
//
// It is the gallery's configuration with three changes: a relative base, so the files work under
// https://ara3d.github.io/bim-open-viewer/ or any other path; both pages as inputs; and
// `VITE_GALLERY_STATIC`, which drops every fixture that needs the dev server's private models
// (`src/gallery/hosting.ts`).
//
// Run from the repository root: npm run pages
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import gallery from './vite.gallery.config.mjs';

const demosDir = fileURLToPath(new URL('./', import.meta.url));
const pagesOutDir = fileURLToPath(new URL('../../dist-pages/', import.meta.url));

export default mergeConfig(
  gallery,
  defineConfig({
    base: './',
    define: { 'import.meta.env.VITE_GALLERY_STATIC': JSON.stringify('true') },
    build: {
      outDir: pagesOutDir,
      emptyOutDir: true,
      // The viewer and three.js are one large chunk by design; the default warning says nothing new.
      chunkSizeWarningLimit: 4096,
      rollupOptions: {
        input: {
          index: `${demosDir}index.html`,
          gallery: `${demosDir}gallery.html`,
        },
      },
    },
  }),
);
