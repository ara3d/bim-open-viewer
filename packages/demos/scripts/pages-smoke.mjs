// Checks the built static site the way GitHub Pages will serve it: plain files, no dev server, no
// private model. Serves `dist-pages/` with `vite preview`, opens the landing page and every demo
// it lists in a headless browser with software WebGL, and fails if a demo does not draw or any
// page logs an error or a failed request.
//
// Every link on the landing page is visited: each demo on its first fixture, and each public
// building, which is the public-buildings demo on that building's fixture.
//
// It also keeps what it saw: `docs/images/landing.png` (the README's picture) and one thumbnail
// per page in `packages/demos/public/thumbnails/static/`: `<demo>.png` for a demo, which the static
// gallery's index shows, and `<demo>--<fixture>.png` for a building, which the landing page shows.
// A rebuild is needed for new thumbnails to reach the site.
//
// Run from the repository root after `npm run pages`: npm run pages:smoke

import { mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const demosDir = fileURLToPath(new URL('../', import.meta.url));
const repoDir = fileURLToPath(new URL('../../../', import.meta.url));
const configFile = join(demosDir, 'vite.pages.config.mjs');
const thumbnailDir = join(demosDir, 'public', 'thumbnails', 'static');
const landingShot = join(repoDir, 'docs', 'images', 'landing.png');
const port = Number(process.env.PAGES_PORT ?? 5191);

// The same readiness the gallery smoke waits for: the page publishes `window.demo`.
const readyExpression = 'window.demo !== undefined && (window.demo.ready === true || typeof window.demo.error === "string")';
const settleMs = 1500;
const timeoutMs = 120_000;

// Every error a page reports: uncaught exceptions, console errors, and responses of 400 or more.
const watch = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`exception: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${String(response.status())}: ${response.url()}`);
  });
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? ''})`));
  return errors;
};

const settle = (frame) =>
  frame.evaluate(
    (ms) =>
      new Promise((done) => {
        setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(done)), ms);
      }),
    settleMs,
  );

// Waits for a frame's demo and returns what it said.
const demoState = async (frame) => {
  await frame.waitForFunction(readyExpression, undefined, { timeout: timeoutMs });
  await settle(frame);
  return frame.evaluate(() => ({ error: window.demo.error ?? null, report: window.demo.report() }));
};

const sizeKb = async (path) => Math.round((await stat(path)).size / 1024);

const main = async () => {
  const server = await preview({ configFile, preview: { port, strictPort: true, host: '127.0.0.1' } });
  const origin = `http://127.0.0.1:${String(port)}`;
  const browser = await chromium.launch({
    channel: process.env.PAGES_BROWSER_CHANNEL ?? 'msedge',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const failures = [];
  try {
    await mkdir(thumbnailDir, { recursive: true });
    await mkdir(join(repoDir, 'docs', 'images'), { recursive: true });

    // The landing page, with its framed demo drawn.
    const page = await browser.newPage({ viewport: { width: 1200, height: 860 } });
    const landingErrors = watch(page);
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    const frameElement = await page.waitForSelector('.stage iframe');
    const framed = await frameElement.contentFrame();
    const framedState = await demoState(framed);
    if (framedState.error !== null) failures.push(`landing frame: ${String(framedState.error)}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: landingShot });
    const searches = await page.$$eval('.demo-actions a', (links) => links.map((one) => new URL(one.href).search));
    const targets = [...new Set(searches)]
      .map((search) => new URLSearchParams(search))
      .filter((params) => params.get('demo') !== null)
      .map((params) => ({ demo: params.get('demo'), fixture: params.get('fixture') }));
    const buildings = targets.filter((target) => target.fixture !== null).length;
    console.log(
      `landing: ${String(targets.length - buildings)} demos and ${String(buildings)} buildings listed, frame ${framedState.error === null ? 'drew' : 'failed'}, ${String(await sizeKb(landingShot))} KB picture`,
    );
    for (const message of landingErrors) failures.push(`landing: ${message}`);
    await page.close();
    if (targets.length === 0) failures.push('landing: no demos listed');

    // Each demo, and each building, on its own page.
    for (const target of targets) {
      const id = target.fixture === null ? target.demo : `${target.demo}--${target.fixture}`;
      const query = new URLSearchParams({ demo: target.demo, ...(target.fixture === null ? {} : { fixture: target.fixture }) });
      const one = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      const errors = watch(one);
      const shot = join(thumbnailDir, `${id}.png`);
      try {
        await one.goto(`${origin}/gallery.html?${query.toString()}`, { waitUntil: 'load' });
        const state = await demoState(one.mainFrame());
        if (state.error !== null) throw new Error(String(state.error));
        await (await one.waitForSelector('.gallery-viewport')).screenshot({ path: shot });
        // A building's page has to show the credit its licence asks for.
        if (target.fixture !== null && (await one.$('.credit-line')) === null) throw new Error('no credit line on the page');
        const report = Object.entries(state.report)
          .slice(0, 4)
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(', ');
        console.log(`ok   ${id}: ${report}`);
      } catch (cause) {
        await rm(shot, { force: true });
        failures.push(`${id}: ${cause instanceof Error ? cause.message : String(cause)}`);
        console.log(`FAIL ${id}`);
      }
      for (const message of errors) failures.push(`${id}: ${message}`);
      await one.close();
    }
  } finally {
    await browser.close();
    await new Promise((done) => server.httpServer.close(done));
  }
  for (const failure of failures) console.log(`  ${failure}`);
  console.log(failures.length === 0 ? 'pages smoke passed' : `pages smoke failed: ${String(failures.length)} problem(s)`);
  process.exitCode = failures.length === 0 ? 0 : 1;
};

await main();
