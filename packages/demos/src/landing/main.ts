// The static site's front page: the lockup, what the viewer is for, one demo running in a frame,
// and every demo the host can run, each loadable into that frame or opened on its own page.
//
// The list comes from the gallery's own discovery, so a demo added under `src/demos` appears here
// with no edit, and a demo that needs the private model is absent here exactly when it is absent
// from the gallery.

import './landing.css';
import mark from '../../../../docs/brand/viewer-mark.svg?raw';
import markUrl from '../../../../docs/brand/viewer-mark.svg?url';
import type { Demo } from '../gallery/contracts.js';
import { discoveredDemos } from '../gallery/discovery.js';
import { button, el, link } from '../gallery/elements.js';
import { basisLabel } from '../gallery/fixtures.js';
import { demoRoute, routeHref, withFixture } from '../gallery/routes.js';
import { demo as publicBuildingsDemo } from '../demos/public-buildings/index.js';
import {
  publicBuildings,
  publicSamplesNotice,
  publicSamplesPath,
  type PublicBuilding,
} from '../demos/public-buildings/buildings.js';

const repository = 'https://github.com/ara3d/bim-open-viewer';
const family = 'https://github.com/ara3d/bim-open-toolkit';

// What the frame opens first: Schependomlaan, a real building anyone may redistribute.
const openingBuildingId = 'schependomlaan';

const demoHref = (demo: Demo): string => `gallery.html${routeHref(demoRoute(demo.id))}`;
const buildingHref = (building: PublicBuilding): string =>
  `gallery.html${routeHref(withFixture(demoRoute(publicBuildingsDemo.id), building.id))}`;

// What the frame can show: a demo on its first fixture, or one public building.
type Shown = { readonly key: string; readonly title: string; readonly question: string; readonly href: string };
const shownDemo = (demo: Demo): Shown => ({ key: demo.id, title: demo.title, question: demo.question, href: demoHref(demo) });
const shownBuilding = (building: PublicBuilding): Shown => ({
  key: `building:${building.id}`,
  title: building.title,
  question: building.summary,
  href: buildingHref(building),
});

const lockup = (): HTMLElement => {
  const made = el('header', 'lockup');
  const holder = el('span', '');
  holder.innerHTML = mark;
  const wordmark = el('h1', 'wordmark');
  wordmark.append(el('span', 'family', 'BIM Open'), el('span', 'product', 'Viewer'));
  made.append(holder.firstElementChild ?? holder, wordmark);
  return made;
};

const links = (): HTMLElement => {
  const list = el('ul', 'links');
  const targets: readonly (readonly [string, string])[] = [
    [repository, 'Repository'],
    [`${repository}#readme`, 'README'],
    ['gallery.html', 'Demo gallery'],
    [family, 'The BIM Open family'],
    ['https://ara3d.github.io/bim-open-schema/', 'BIM Open Schema, the tables a model is stored as'],
  ];
  for (const [href, text] of targets) {
    const item = el('li', '');
    item.append(link('', href, text));
    list.append(item);
  }
  return list;
};

const intro = (): HTMLElement =>
  el(
    'p',
    'intro',
    'BIM Open Viewer draws building models in a web browser with three.js and WebGL. It reads BOS ' +
      '(BIM Open Schema), BFAST, GLB, GLTF, OBJ and STL files, holds hundreds of thousands of ' +
      'instances, and lets a page colour, section, explode and inspect a model through commands. ' +
      'It is for developers who put a building model in a web page, and for the analysts and ' +
      'reviewers who then read it there. The demos below run entirely in this page, on three openly ' +
      'licensed buildings and on generated ones; nothing is uploaded and no server is involved.',
  );

const footnote = (): HTMLElement => {
  const made = el('p', 'footnote');
  made.append(
    'In a clone of the repository, ',
    el('code', '', 'npm run gallery'),
    ' also offers Snowdon Towers, a real model of 471,462 instances, when the private file is on the machine. ' +
      'This site leaves it out.',
  );
  return made;
};

// The two links every card carries: show it in the frame above, or open it on its own page.
const cardActions = (shown: Shown, show: (shown: Shown) => void, stage: HTMLElement): HTMLElement => {
  const actions = el('div', 'demo-actions');
  actions.append(
    button('', 'Show above', () => {
      show(shown);
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }),
    link('', shown.href, 'Full page'),
  );
  return actions;
};

// One public building: its picture from the pages smoke, what it is, which models are drawn, and
// the credit its licence asks for.
const buildingCard = (building: PublicBuilding, actions: HTMLElement): HTMLElement => {
  const card = el('li', 'demo building');
  const picture = el('img', 'building-picture');
  picture.src = `thumbnails/static/${publicBuildingsDemo.id}--${building.id}.png`;
  picture.alt = `${building.title} in the viewer`;
  picture.loading = 'lazy';
  picture.addEventListener('error', () => picture.remove());
  const credit = el('p', 'credit');
  credit.append(`${building.attribution} Licence: `, link('', building.licence.url, building.licence.name), '.');
  card.append(
    picture,
    el('h3', '', building.title),
    el('p', '', building.summary),
    el('span', 'basis', building.models.map((model) => model.discipline).join(' · ')),
    credit,
    actions,
  );
  return card;
};

// Where the buildings come from, and the notice their files ship with.
const buildingsNotice = (): HTMLElement => {
  const made = el('p', 'footnote');
  made.append(
    'The buildings are BIM Open Schema files that ',
    link('', 'https://github.com/ara3d/bim-open-data/tree/main/samples/public', 'ara3d/bim-open-data'),
    ' converted from the source IFC files. Their licences, sources, and what the conversion changed are in ',
    link('', `${publicSamplesPath}${publicSamplesNotice}`, publicSamplesNotice),
    '.',
  );
  return made;
};

const render = (root: HTMLElement, demos: readonly Demo[]): void => {
  const stage = el('section', 'stage');
  const bar = el('div', 'stage-bar');
  const title = el('span', 'stage-title');
  const question = el('span', 'stage-question');
  const full = link('', 'gallery.html', 'Open full page');
  const caption = el('span', '');
  caption.append(title, question);
  bar.append(caption, full);
  const frame = el('iframe', '');
  frame.title = 'Live demo';
  stage.append(bar, frame);

  const cardOf = new Map<string, HTMLElement>();
  const show = (shown: Shown): void => {
    frame.src = shown.href;
    title.textContent = shown.title;
    question.textContent = shown.question;
    full.href = shown.href;
    for (const [key, card] of cardOf) card.setAttribute('aria-current', String(key === shown.key));
  };

  // The public buildings, when this host can open them.
  const hostsBuildings = demos.some((demo) => demo.id === publicBuildingsDemo.id);
  const buildings = el('ul', 'demos buildings');
  for (const building of hostsBuildings ? publicBuildings : []) {
    const shown = shownBuilding(building);
    const card = buildingCard(building, cardActions(shown, show, stage));
    cardOf.set(shown.key, card);
    buildings.append(card);
  }

  const cards = el('ul', 'demos');
  for (const demo of demos) {
    const shown = shownDemo(demo);
    const first = demo.fixtures[0];
    const card = el('li', 'demo');
    card.append(
      el('h3', '', demo.title),
      el('p', '', demo.question),
      el('span', 'basis', first === undefined ? '' : `${first.title} · ${basisLabel(first.basis)}`),
      cardActions(shown, show, stage),
    );
    cardOf.set(shown.key, card);
    cards.append(card);
  }

  const page = el('main', 'landing');
  page.append(lockup(), intro(), links(), el('h2', '', 'Try it'), stage);
  if (hostsBuildings) page.append(el('h2', 'section', 'Public buildings'), buildings, buildingsNotice());
  page.append(el('h2', 'section', 'Demos'), cards, footnote());
  root.append(page);
  const opening = hostsBuildings ? publicBuildings.find((one) => one.id === openingBuildingId) : undefined;
  const firstDemo = demos[0];
  if (opening !== undefined) show(shownBuilding(opening));
  else if (firstDemo !== undefined) show(shownDemo(firstDemo));
};

const icon = el('link', '');
icon.rel = 'icon';
icon.href = markUrl;
document.head.append(icon);

const root = document.getElementById('landing');
if (!(root instanceof HTMLElement)) throw new Error('index.html has no element with id "landing"');
render(root, discoveredDemos().demos);
