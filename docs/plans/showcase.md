# The public site as a showcase

Written 2026-10-04 from the owner's review of <https://ara3d.github.io/bim-open-viewer/>: the demos
are faked (generated boxes), the branding is inconsistent, the demos do not impress, the clipping
is poor, the black background is doubtful, and the page should make people want to use the viewer
in their own pages. This plan is the design and the ordered chunks; each chunk is one commit.

## Diagnosis

1. **Two looks on one page.** The landing page carries the family look (`docs/BRANDING.md` in the
   toolkit: Instrument Sans, Public Sans, Fira Code, the viewer's teal, light neutrals). The gallery
   inside its frame carries an older look: a serif display face, warm paper, an orange accent, cobalt
   links, system fonts. The frame on the landing page shows the two side by side.
2. **Generated boxes.** Six demos are published; five open the "Synthetic building", a stack of grey
   slabs, because their first fixture is the private Snowdon model. Only `public-buildings` opens a
   real building, and it installs no panel and no feature beyond picking.
3. **Features exist that nobody sees.** Clipping (planes, a box, a storey cut), colour by column
   (`demos/colour-by`, with no `index.ts`), levels, saved views and ambient occlusion are in the
   packages and absent from the site. The cut has no caps, so a sectioned wall reads as a hollow
   shell.
4. **The picture is dull.** A near-black stage, a flat grey Archicad model, systems drawn as dots
   inside an architecture ghosted to 10 %, 2 frames a second on DigitalHub under software WebGL.
5. **The page sells nothing.** No headline, no picture before the fold, no "three lines to embed
   it", no path from the demo to the package.

## Design

**One look.** The gallery takes the family tokens: fonts from Google Fonts with the family fallback
stacks, text `#171a1f`, dim `#5a606c`, surface white, background `#f4f5f7`, border `#e3e6ea`, the
viewer's teal `#0f8a80` as the only accent. The dark theme uses the family site's dark values. The
serif, the orange and the cobalt go. Landing page and gallery read one `tokens.css`.

**A light stage.** The viewport follows the theme: light `#e8ebef` with a quiet grid in the light
theme, `#15171b` in the dark theme. Ambient occlusion stays an experiment page; it is not switched
on here.

**Real buildings only, on the site.** Every demo offers the three openly licensed buildings
(Schependomlaan, DigitalHub, Duplex) as fixtures. The static site drops the generated building
wherever a source-backed fixture remains; the dev gallery keeps Snowdon first and the generated
building last, as now.

**More to see.** The published demos, each on a real building:

| Demo | What it shows | Status |
|---|---|---|
| Inspect | hover and click an element, read its properties | existing, re-fixtured |
| Colour by | category, storey, discipline, with a legend | new, from `colour-by` |
| Section | a storey cut on a slider, a section box, capped cut faces | new |
| Explode | storeys pulled apart | existing, re-fixtured |
| Disciplines | the federated models drawn together, architecture ghosted | existing `public-buildings`, re-presented |
| Light and ground | the environment presets | existing, re-fixtured |
| Capture | a picture for a report | existing, re-fixtured |

Portfolio stays off the static site (its only public fixture is generated); a ticket records the
three-building estate as the way back.

**The landing page.** Top bar with the mark and the two-weight wordmark and four links. A headline
and one paragraph. The live frame, full width, with a row of chips (Inspect, Colour, Section,
Explode, Disciplines, Light, Capture) that swap what it shows, and a fixture row for the three
buildings. The building cards with fresh captures and their credit lines. "Use it in your page":
the three-line facade, the package names, the licence. A footer naming the family.

## Chunks

| # | Chunk | Files | Depends on |
|---|---|---|---|
| C1 | Family tokens and chrome for the gallery | `packages/demos/src/gallery/styles/*`, `packages/demos/gallery.html`, `ui-gratify` theme bridge values | none |
| C2 | Public fixtures shared by every demo; static site drops generated fixtures | `packages/demos/src/demos/_shared/fixtures.ts` (new), `_shared/snowdon.ts`, each demo's `fixtures`, `gallery/hosting.ts` | none |
| C3 | Theme-following stage colour | `gallery/viewer.ts`, `gallery/theme.ts`, `demo-page.ts` | C1 |
| C4 | Capped clipping in the renderer, and the section demo | `packages/render/src/clipping.ts` (caps data), `gallery/adapters.ts` (stencil caps), `demos/section/*` (new) | C2 |
| C5 | Colour-by demo | `demos/colour-by/index.ts`, `panels.ts`, `inspector.ts` | C2 |
| C6 | Disciplines demo re-presented | `demos/public-buildings/*` | C2 |
| C7 | Landing page | `packages/demos/index.html`, `src/landing/*` | C1, C2 |
| C8 | Captures, smoke, README, toolkit site tile, dependency pin | `scripts/pages-smoke.mjs`, `README.md`, toolkit `site/`, `deps.json` | all |

## Acceptance

- `npm run pages && npm run pages:smoke` passes with every published demo green on Schependomlaan.
- The landing page and the gallery share one stylesheet of tokens; no serif face, no orange.
- A section through Schependomlaan shows capped walls, and the storey slider moves the cut.
- No demo on the static site opens a generated model.
