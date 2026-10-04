// The static site's front page: what the viewer is, one demo running in a frame with the demos and
// the buildings as chips that swap what the frame shows, the three buildings with their credits,
// how to put the viewer in a page of your own, and the family it belongs to.
//
// The demo list comes from the gallery's own discovery, so a demo added under `src/demos` appears
// here with no edit, and a demo that needs the private model is absent here exactly when it is
// absent from the gallery. The frame opens the gallery in its embedded form (`embed=1`), which hides
// the gallery's own bar: this page is the bar.

import '../gallery/styles/tokens.css';
import './landing.css';
import mark from '../../../../docs/brand/viewer-mark.svg?raw';
import markUrl from '../../../../docs/brand/viewer-mark.svg?url';
import type { Demo } from '../gallery/contracts.js';
import { discoveredDemos } from '../gallery/discovery.js';
import { button, el, link } from '../gallery/elements.js';
import { demoRoute, embedded, routeHref, withFixture } from '../gallery/routes.js';
import { demo as publicBuildingsDemo } from '../demos/public-buildings/index.js';
import {
  publicBuildings,
  publicSamplesNotice,
  publicSamplesPath,
  type PublicBuilding,
} from '../demos/public-buildings/buildings.js';

const repository = 'https://github.com/ara3d/bim-open-viewer';
const family = 'https://github.com/ara3d/bim-open-toolkit';

// What the frame opens first.
const openingDemoId = 'colour-by';
const openingBuildingId = 'schependomlaan';

// The order the chips list the demos in: the tour a first visit should take. A demo not named here
// follows, in discovery order.
const tour: readonly string[] = ['point-and-read', 'colour-by', 'section', 'explode-and-grid', 'public-buildings', 'environment', 'capture'];

// What a chip calls a demo, where the demo's own title is longer than a chip wants.
const chipTitles: Readonly<Record<string, string>> = {
  'point-and-read': 'Inspect',
  'colour-by': 'Colour by',
  'explode-and-grid': 'Explode',
  'public-buildings': 'Disciplines',
  environment: 'Light and ground',
};

const inTourOrder = (demos: readonly Demo[]): readonly Demo[] => {
  const named = tour.flatMap((id) => demos.filter((demo) => demo.id === id));
  return [...named, ...demos.filter((demo) => !tour.includes(demo.id))];
};

// The page of one demo on one building, as the frame opens it and as "Full page" links to it.
const pageHref = (demoId: string, buildingId: string | undefined, embed: boolean): string => {
  const route = buildingId === undefined ? demoRoute(demoId) : withFixture(demoRoute(demoId), buildingId);
  return `gallery.html${routeHref(embed ? embedded(route) : route)}`;
};

// Whether a demo lists a building among its fixtures.
const offers = (demo: Demo, buildingId: string): boolean => demo.fixtures.some((fixture) => fixture.id === buildingId);

const wordmark = (): HTMLElement => {
  const made = link('wordmark', './', '');
  const holder = el('span', '');
  holder.innerHTML = mark;
  made.append(holder.firstElementChild ?? holder, el('span', 'family', 'BIM Open'), el('span', 'product', 'Viewer'));
  return made;
};

const topbar = (): HTMLElement => {
  const bar = el('header', 'topbar');
  const inner = el('div', 'topbar-inner');
  const nav = el('nav', '');
  nav.setAttribute('aria-label', 'Sections');
  nav.append(
    link('', '#try', 'Try it'),
    link('', '#buildings', 'Buildings'),
    link('', '#use', 'Use it'),
    link('', 'gallery.html', 'All demos'),
    link('', repository, 'GitHub'),
  );
  inner.append(wordmark(), nav);
  bar.append(inner);
  return bar;
};

const hero = (demos: readonly Demo[]): HTMLElement => {
  const made = el('section', 'hero');
  made.append(
    el('h1', '', 'Draw a building model in the browser, then colour it, cut it, pull it apart and read it.'),
    el(
      'p',
      'lede',
      'BIM Open Viewer is a TypeScript library on three.js and WebGL. It reads BOS (BIM Open Schema), ' +
        'BFAST, GLB, GLTF, OBJ and STL files, holds hundreds of thousands of instances, and does ' +
        'everything through commands a page, a script or an AI agent can send. The demos below run ' +
        'entirely in this page on three openly licensed buildings; nothing is uploaded.',
    ),
  );
  const facts = el('p', 'facts');
  facts.append(
    el('span', '', `${String(demos.length)} demos`),
    el('span', '', `${String(publicBuildings.length)} real buildings`),
    el('span', '', 'Six file formats'),
    el('span', '', 'MIT licence'),
  );
  made.append(facts);
  return made;
};

// The frame and the two chip rows that drive it.
const stage = (demos: readonly Demo[]): HTMLElement => {
  const section = el('section', 'try');
  section.id = 'try';
  const head = el('div', 'section-head');
  head.append(el('h2', '', 'Try it'), el('p', 'section-lede', 'Pick a demo and a building. Drag to orbit, scroll to zoom, click an element to read it.'));
  section.append(head);

  const chips = el('div', 'chips demo-chips');
  chips.setAttribute('role', 'tablist');
  chips.setAttribute('aria-label', 'Demos');
  const buildingChips = el('div', 'chips building-chips');
  buildingChips.setAttribute('role', 'tablist');
  buildingChips.setAttribute('aria-label', 'Buildings');

  const frameBox = el('div', 'stage');
  const frame = el('iframe', '');
  frame.title = 'Live demo';
  frame.setAttribute('allow', 'fullscreen');
  const bar = el('div', 'stage-bar');
  const question = el('span', 'stage-question');
  const full = link('full-page', '', 'Open full page');
  bar.append(question, full);
  frameBox.append(frame, bar);

  let demoId = demos.some((demo) => demo.id === openingDemoId) ? openingDemoId : (demos[0]?.id ?? '');
  let buildingId: string | undefined = openingBuildingId;

  const show = (): void => {
    const demo = demos.find((one) => one.id === demoId);
    const building = buildingId !== undefined && demo !== undefined && offers(demo, buildingId) ? buildingId : undefined;
    frame.src = pageHref(demoId, building, true);
    full.href = pageHref(demoId, building, false);
    question.textContent = demo?.question ?? '';
    for (const chip of Array.from(chips.children)) chip.setAttribute('aria-selected', String(chip.getAttribute('data-id') === demoId));
    for (const chip of Array.from(buildingChips.children)) {
      const id = chip.getAttribute('data-id') ?? '';
      chip.setAttribute('aria-selected', String(id === building));
      chip.toggleAttribute('disabled', demo === undefined || !offers(demo, id));
    }
  };

  for (const demo of demos) {
    const chip = button('chip', chipTitles[demo.id] ?? demo.title, () => {
      demoId = demo.id;
      show();
    });
    chip.setAttribute('role', 'tab');
    chip.setAttribute('data-id', demo.id);
    chip.title = demo.question;
    chips.append(chip);
  }
  for (const building of publicBuildings) {
    const chip = button('chip building-chip', building.title.replace(', federated', ''), () => {
      buildingId = building.id;
      show();
    });
    chip.setAttribute('role', 'tab');
    chip.setAttribute('data-id', building.id);
    chip.title = building.summary;
    buildingChips.append(chip);
  }

  const rows = el('div', 'chip-rows');
  rows.append(labelled('Demo', chips), labelled('Building', buildingChips));
  section.append(rows, frameBox);
  show();
  return section;
};

const labelled = (label: string, chips: HTMLElement): HTMLElement => {
  const row = el('div', 'chip-row');
  row.append(el('span', 'chip-label', label), chips);
  return row;
};

// One public building: its picture from the pages smoke, what it is, which models are drawn, and
// the credit its licence asks for.
const buildingCard = (building: PublicBuilding, demos: readonly Demo[]): HTMLElement => {
  const card = el('article', 'building');
  const picture = el('img', 'building-picture');
  picture.src = `thumbnails/static/${publicBuildingsDemo.id}--${building.id}.png`;
  picture.alt = `${building.title} in the viewer`;
  picture.loading = 'lazy';
  picture.width = 1200;
  picture.height = 800;
  picture.addEventListener('error', () => picture.remove());
  const body = el('div', 'building-body');
  const parts = building.models.flatMap((model) => (model.parts ?? [model]).map((part) => part.discipline));
  const credit = el('p', 'credit');
  credit.append(`${building.attribution} Licence: `, link('', building.licence.url, building.licence.name), '.');
  const actions = el('p', 'demo-actions');
  const inspect = demos.find((demo) => demo.id === publicBuildingsDemo.id) ?? demos[0];
  if (inspect !== undefined) actions.append(link('', pageHref(inspect.id, building.id, false), 'Open in the viewer'));
  actions.append(link('', building.upstream, 'Source IFC files'));
  body.append(el('h3', '', building.title), el('p', '', building.summary), el('p', 'parts', parts.join(' · ')), credit, actions);
  card.append(picture, body);
  return card;
};

const buildings = (demos: readonly Demo[]): HTMLElement => {
  const section = el('section', 'buildings');
  section.id = 'buildings';
  const head = el('div', 'section-head');
  head.append(el('h2', '', 'Three real buildings'));
  const lede = el('p', 'section-lede');
  lede.append(
    'Each is an IFC file that ',
    link('', 'https://github.com/ara3d/bim-open-data/tree/main/samples/public', 'ara3d/bim-open-data'),
    ' converted to BIM Open Schema tables, read here as one file of geometry, properties and relations. ' +
      'Their licences, sources and what the conversion changed are in ',
    link('', `${publicSamplesPath}${publicSamplesNotice}`, publicSamplesNotice),
    '.',
  );
  head.append(lede);
  const grid = el('div', 'building-grid');
  for (const building of publicBuildings) grid.append(buildingCard(building, demos));
  section.append(head, grid);
  return section;
};

const sample = `import { createViewer } from '@bim-open-viewer/viewer';
import { styleRule } from '@bim-open-viewer/model';

const viewer = createViewer(canvas);
await viewer.open('/models/building.bos');
viewer.run('view.fit', {});

// Everything else is a command too: colour, section, explode, pick.
viewer.apply(styleRule('wide', 'Doors under 850 mm', narrowDoorKeys, { color: [1, 0, 0] }));
viewer.run('clipping.sectionAt', { elevation: 4.2, keep: 'below' });`;

const useIt = (): HTMLElement => {
  const section = el('section', 'use');
  section.id = 'use';
  const head = el('div', 'section-head');
  head.append(
    el('h2', '', 'Use it in your page'),
    el(
      'p',
      'section-lede',
      'Three lines put a model on a canvas with navigation, picking and a frame loop that draws only when ' +
        'something changed. Every feature after that is a command with a declared schema, so what a page does ' +
        'by hand an agent can do over MCP.',
    ),
  );
  const code = el('pre', 'code');
  code.append(el('code', '', sample));
  const points = el('ul', 'points');
  const items: readonly (readonly [string, string])[] = [
    ['Seventeen small packages', 'model, render, interact, formats, features, viewer, ui-react, ui-gratify and more; take the ones you need.'],
    ['three.js is a peer dependency', 'your application picks the version and only one copy ever loads.'],
    ['Formats are adapters', 'the renderer and the features know nothing about any file format.'],
    ['State is a document', 'colours, sections, layouts and views live in a slice you can save, replay and diff.'],
  ];
  for (const [lead, text] of items) {
    const item = el('li', '');
    item.append(el('strong', '', lead), ` ${text}`);
    points.append(item);
  }
  const actions = el('p', 'demo-actions');
  actions.append(
    link('', `${repository}#readme`, 'Read the README'),
    link('', `${repository}/tree/main/packages/viewer`, 'The viewer package'),
    link('', repository, 'Repository'),
  );
  const columns = el('div', 'use-columns');
  columns.append(code, points);
  section.append(head, columns, actions);
  return section;
};

const footer = (): HTMLElement => {
  const made = el('footer', 'site-footer');
  const text = el('p', '');
  text.append(
    'BIM Open Viewer is the 3D viewer of the ',
    link('', family, 'BIM Open family'),
    ': ',
    link('', 'https://ara3d.github.io/bim-open-schema/', 'Schema'),
    ' stores a model as plain tables, ',
    link('', 'https://github.com/ara3d/bim-open-data', 'Data'),
    ' reads IFC and Revit into them, ',
    link('', 'https://github.com/ara3d/bim-open-flow', 'Flow'),
    ' turns questions about them into graphs, and ',
    link('', 'https://ara3d.github.io/bim-open-notebook/', 'Notebook'),
    ' keeps the record. Made by ',
    link('', 'https://ara3d.com', 'Ara 3D'),
    '. MIT licence.',
  );
  const note = el('p', 'footnote');
  note.append(
    'In a clone of the repository, ',
    el('code', '', 'npm run gallery'),
    ' also opens Snowdon Towers, a real model of 471,462 instances, when the private file is on the machine.',
  );
  made.append(text, note);
  return made;
};

const render = (root: HTMLElement, found: readonly Demo[]): void => {
  const demos = inTourOrder(found);
  const page = el('main', 'landing');
  page.append(hero(demos), stage(demos), buildings(demos), useIt());
  root.append(topbar(), page, footer());
};

const icon = el('link', '');
icon.rel = 'icon';
icon.href = markUrl;
document.head.append(icon);

const root = document.getElementById('landing');
if (!(root instanceof HTMLElement)) throw new Error('index.html has no element with id "landing"');
render(root, discoveredDemos().demos);
