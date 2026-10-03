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
import { demoRoute, routeHref } from '../gallery/routes.js';

const repository = 'https://github.com/ara3d/bim-open-viewer';
const family = 'https://github.com/ara3d/bim-open-toolkit';

// The demo the frame opens first: a generated building, exploded by category.
const openingDemoId = 'explode-and-grid';

const demoHref = (demo: Demo): string => `gallery.html${routeHref(demoRoute(demo.id))}`;

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
      'reviewers who then read it there. The demos below run entirely in this page on generated ' +
      'buildings; nothing is uploaded and no server is involved.',
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

  const cards = el('ul', 'demos');
  const cardOf = new Map<string, HTMLElement>();
  const show = (demo: Demo): void => {
    frame.src = demoHref(demo);
    title.textContent = demo.title;
    question.textContent = demo.question;
    full.href = demoHref(demo);
    for (const [id, card] of cardOf) card.setAttribute('aria-current', String(id === demo.id));
  };
  for (const demo of demos) {
    const actions = el('div', 'demo-actions');
    actions.append(
      button('', 'Show above', () => {
        show(demo);
        stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
      link('', demoHref(demo), 'Full page'),
    );
    const first = demo.fixtures[0];
    const card = el('li', 'demo');
    card.append(
      el('h3', '', demo.title),
      el('p', '', demo.question),
      el('span', 'basis', first === undefined ? '' : `${first.title} · ${basisLabel(first.basis)}`),
      actions,
    );
    cardOf.set(demo.id, card);
    cards.append(card);
  }

  const page = el('main', 'landing');
  page.append(lockup(), intro(), links(), el('h2', '', 'Try it'), stage, cards, footnote());
  root.append(page);
  const opening = demos.find((demo) => demo.id === openingDemoId) ?? demos[0];
  if (opening !== undefined) show(opening);
};

const icon = el('link', '');
icon.rel = 'icon';
icon.href = markUrl;
document.head.append(icon);

const root = document.getElementById('landing');
if (!(root instanceof HTMLElement)) throw new Error('index.html has no element with id "landing"');
render(root, discoveredDemos().demos);
