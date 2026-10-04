// The public buildings' files, fetched from ara3d/bim-open-data at the pinned commit and served
// under `samples/` next to `gallery.html`. They are never committed here.
//
// One Vite plugin does both halves: the dev server (`npm run gallery`) answers `/samples/<file>`,
// and the pages build (`npm run pages`) copies every file into `dist-pages/samples/`. Either way a
// file is downloaded once into `artifacts/public-samples/<commit>/` (git-ignored) and read from there
// afterwards, so a rebuild works offline once the cache is filled, and moving the pin fetches anew.
//
// The list of files and the pin are in `src/demos/public-buildings/buildings.ts`. Vite bundles a
// configuration's local imports, which is what lets this file import TypeScript.

import { createReadStream } from 'node:fs';
import { copyFile, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  publicSampleFiles,
  publicSamplesCommit,
  publicSamplesOrigin,
  publicSamplesPath,
} from '../src/demos/public-buildings/buildings.ts';

const repoDir = fileURLToPath(new URL('../../../', import.meta.url));
const cacheDir = join(repoDir, 'artifacts', 'public-samples', publicSamplesCommit);

const exists = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

// The cached copy of one file, downloaded first if the cache does not hold it.
const cached = async (name) => {
  const path = join(cacheDir, name);
  if (await exists(path)) return path;
  const url = `${publicSamplesOrigin}${name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetching ${url} answered ${String(response.status)} ${response.statusText}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await mkdir(cacheDir, { recursive: true });
  // Written beside and renamed, so an interrupted download never leaves a short file in the cache.
  const partial = `${path}.partial`;
  await writeFile(partial, bytes);
  await rename(partial, path);
  return path;
};

const contentType = (name) => (name.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'application/octet-stream');

export const publicSamples = () => ({
  name: 'public-samples',
  configureServer(server) {
    server.middlewares.use(`/${publicSamplesPath}`, (request, response, next) => {
      const name = basename(decodeURIComponent((request.url ?? '').split('?')[0] ?? ''));
      // Only the listed files: the path never addresses anything else on the machine.
      if (!publicSampleFiles.includes(name)) return next();
      cached(name).then(
        async (path) => {
          response.setHeader('content-type', contentType(name));
          response.setHeader('content-length', String((await stat(path)).size));
          createReadStream(path).pipe(response);
        },
        (error) => {
          response.statusCode = 502;
          response.end(error instanceof Error ? error.message : String(error));
        },
      );
      return undefined;
    });
  },
  async writeBundle(options) {
    if (options.dir === undefined) return;
    const target = join(options.dir, publicSamplesPath);
    await mkdir(target, { recursive: true });
    for (const name of publicSampleFiles) await copyFile(await cached(name), join(target, name));
    this.info(`copied ${String(publicSampleFiles.length)} public sample files from bim-open-data@${publicSamplesCommit.slice(0, 7)}`);
  },
});
