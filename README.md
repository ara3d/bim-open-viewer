# BIM Open Viewer

A WebGL viewer for large AEC and BIM models, built on [three.js](https://threejs.org/).
Successor to `@ara3d/ara3d-webgl`. The renderer, navigation and features know nothing
about any file format; `@bim-open-viewer/formats` and `@bim-open-viewer/loaders` adapt
BOS (BIM Open Schema), BFAST, GLB, GLTF, OBJ and STL files to one model.

The viewer was developed inside [BIM Open Toolkit](https://github.com/ara3d/bim-open-toolkit),
which consumes this repository as a submodule at `submodules/bim-open-viewer`; this
repository keeps that history.

This is an npm workspace with seventeen packages, split so they can be developed
independently.

## Foundation

| Package | Role |
|---|---|
| [`@bim-open-viewer/model`](packages/model/) | Pure data contracts and operations: identity, coordinates, sets, style rules, edits, view state, document slices, schema combinators, `Result`, facts, `Table`, mesh POD, and the `Feature` / `Command` / `StateSlice` / `Event` contracts. No runtime dependencies at all — no three.js, no renderer, no browser API, no other package here — so it runs unchanged in a test, in Node, in a browser, and in an MCP server. |

## Renderer

| Package | Role |
|---|---|
| [`@bim-open-viewer/core`](packages/core/) | Renderer: scene management, instanced drawing, materials, per-instance color, frame loop |
| `@bim-open-viewer/loaders` | Ingestion: GLB and BOS loading into viewer-core scene structures, with incremental progress reporting |
| `@bim-open-viewer/controls` | Interaction: orbit camera navigation, picking and selection with typed events, section planes. Owns no scene content. |

## Composition

| Package | Role |
|---|---|
| `@bim-open-viewer/render` | The instance table bound to viewer-core groups, representation registry, picking, clipping, environment, overlay primitives, capture and frame timing |
| `@bim-open-viewer/interact` | Camera state math, orbit / first-person / overhead navigation, configurable bindings, touch, and interruptible camera animation |
| `@bim-open-viewer/formats` | BOS, BFAST, GLB, GLTF, OBJ and STL adapters producing one normalized `LoadedModel` with a columnar representation table — reporting their failures instead of raising them |
| `@bim-open-viewer/features` | One Feature module per capability — appearance, clipping, annotations, animation, comparison, edits, environment, HUD, layouts, capture — each owning its commands, state slice, schema and optional render hook |
| `@bim-open-viewer/workflows` | Pure result adapters and recipes for the review workflows: input tables in; typed results, rules, sets, overlays and views out |
| [`@bim-open-viewer/viewer`](packages/viewer/) | The default composition: `createViewer`, the command bus, feature host, slice persistence and multi-view |

## User interface

| Package | Role |
|---|---|
| `@bim-open-viewer/ui-react` | React bindings — `useViewer`, `useSelection`, `useSlice` — and the review application |
| `@bim-open-viewer/ui-gratify` | The Gratify layer: in-canvas panels, the sidebar property inspector, widget kit, theme bridge and semantics mirror |
| [`@bim-open-viewer/visualization`](packages/visualization/) | Composable model identity, review state, appearance/edit layers, persistence and renderer bindings |

## Fixtures, testing and hosts

| Package | Role |
|---|---|
| `@bim-open-viewer/synthetic` | Seeded generators for buildings, networks, schedules, revisions, facts with gaps, stress scenes and mesh primitives |
| `@bim-open-viewer/testing` | Fixture builders, fake clocks, headless scene helpers, the browser runner and the benchmark protocol |
| `@bim-open-viewer/demos` | Gallery host, feature demos, workflow demos, fixture server and browser specs |
| `@bim-open-viewer/mcp` | Node bridge exposing viewer commands as MCP tools over a WebSocket to a browser session |

## Using it

The facade is three lines:

```ts
import { createViewer } from '@bim-open-viewer/viewer';

const viewer = createViewer(canvas);
await viewer.open('/models/building.bfast');
viewer.run('view.fit', {});
```

That is a renderer on the canvas, a model loaded and drawn, navigation on the pointer,
click to select, a frame loop that draws only when something changed, a resize observer,
and one `dispose()` that leaves nothing behind. Changing appearance goes through the same
door — a command — rather than a second API:

```ts
import { styleRule } from '@bim-open-viewer/model';

viewer.apply(styleRule('unrated', 'Unrated doors', unratedDoorKeys, { color: [1, 0, 0] }));
```

Design requirements carried over from the previous viewer's lessons:

- `three` is a **peer dependency** of every package — the host application picks
  the version, and only one copy of three ever loads.
- All numeric parameters are floats (plain `number`); no integer-quantized APIs.
- Per-instance color is a first-class API, changeable after creation.
- Scene structures support incremental population, so loaders can stream
  geometry in and report progress.

This workspace is a candidate to move to its own repository once stable.

The visualization alpha includes 23 independent feature demos, primarily using the local
Snowdon fixture. After installing and running `npm run build`, use `npm run demo`.
`npm run demo:snowdon`, `npm run demo:normalized` and `npm run demo:browser` check the
served fixture, normalized geometry and browser behavior. See the
[package README](packages/visualization/README.md) for setup, evidence and remaining scope.

## Developing

Gratify, the canvas UI library behind `@bim-open-viewer/ui-gratify`, is a submodule, so
clone with `--recurse-submodules` (or run `git submodule update --init` afterwards).

```
git clone --recurse-submodules https://github.com/ara3d/bim-open-viewer
cd bim-open-viewer
npm install
npm run -w @bim-open-viewer/core build
npm test -w @bim-open-viewer/core
```

Unit tests run under Node with vitest and never require a WebGL context: the
three.js object-graph logic is kept separate from the `WebGLRenderer` so it is
testable headless.
