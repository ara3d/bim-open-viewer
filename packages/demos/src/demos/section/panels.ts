// The section bar: one chip per level, a height slider over the model's full height, which side of
// the cut is kept, a section box, and clear.
//
// The panel keeps no cut of its own beyond what it is about to ask for: `sync` reads the applied
// cut back out of the clipping slice, so a section set by any other route shows here too and the
// bar never claims an elevation that is not in force. The levels and the height range come from the
// survey `start` held.
//
// `Section box` and `Clear` use ui-gratify's published `Button`. The chips and the slider stay local
// parts because `Segmented` and `Slider` have not been published yet; each is marked below and is
// deleted when its counterpart lands.

import type { SectionSide } from '@bim-open-viewer/features';
import { Button, hudPanel, type AnyHudPanel, type HudPanel } from '@bim-open-viewer/ui-gratify';
import { Drag1D, Label, part, Press, rect, Row, Stack, surface, v, type AppSpec, type Element } from 'gratify';
import { cutIn, heightRange, heldSurvey, middleBox, type SectionSurvey } from './survey.js';

// A level as the bar offers it.
export type LevelChip = { readonly name: string; readonly elevation: number };

// What the bar shows: the cut it will next ask for, the levels and height range to choose from, and
// how many times the box and clear buttons have been pressed.
export type SectionDoc = {
  readonly kind: 'none' | 'planes' | 'box';
  readonly elevation: number;
  readonly keep: SectionSide;
  readonly levels: readonly LevelChip[];
  readonly low: number;
  readonly high: number;
  // How far above a level's floor a chip cuts, in the model's units.
  readonly cutOffset: number;
  readonly boxAsked: number;
  readonly clearAsked: number;
};

export type SectionIntent =
  | { readonly kind: 'elevation'; readonly elevation: number }
  | { readonly kind: 'keep'; readonly keep: SectionSide }
  | { readonly kind: 'box' }
  | { readonly kind: 'clear' };

// Local parts: a chip is a button that can be selected. When `Segmented` is published these go.
type ChipProps = { readonly label: string; readonly selected: boolean };

const chipStyle = (selected: boolean) => (tokens: Parameters<typeof surface>[0], channels: Parameters<typeof surface>[1]) => ({
  ...surface(tokens, channels, selected ? { tint: tokens.accent } : {}),
  corner: 6,
});

const chipSize = (props: ChipProps, measure: { text: (text: string, size: number) => { x: number } }) =>
  v(measure.text(props.label, 12).x + 22, 26);

type LevelProps = ChipProps & { readonly elevation: number; readonly cutOffset: number };

const LevelChipPart = part<LevelProps>()('section-level-chip', {
  size: chipSize,
  style: (tokens, channels, props) => chipStyle(props.selected)(tokens, channels),
  render: (node, painter, style) => {
    painter.box(node.rect, style.corner, style.fill, style.edge, 1);
    painter.label(node.props.label, node.rect.center, style.text, { size: 12 });
  },
  on: [
    Press((node): SectionIntent => ({
      kind: 'elevation',
      elevation: node.props.elevation + node.props.cutOffset,
    })),
  ],
  semantics: (node) => ({ role: 'button', label: node.props.label, value: node.props.selected ? 'on' : 'off' }),
});

type KeepProps = ChipProps & { readonly keep: SectionSide };

const KeepChip = part<KeepProps>()('section-keep-chip', {
  size: chipSize,
  style: (tokens, channels, props) => chipStyle(props.selected)(tokens, channels),
  render: (node, painter, style) => {
    painter.box(node.rect, style.corner, style.fill, style.edge, 1);
    painter.label(node.props.label, node.rect.center, style.text, { size: 12 });
  },
  on: [Press((node): SectionIntent => ({ kind: 'keep', keep: node.props.keep }))],
  semantics: (node) => ({ role: 'button', label: node.props.label, value: node.props.selected ? 'on' : 'off' }),
});

// A slider is a local part because ui-gratify's `Slider` has not been published yet.
type HeightProps = { readonly elevation: number; readonly low: number; readonly high: number };

const fractionOf = (props: HeightProps): number =>
  props.high > props.low ? Math.min(1, Math.max(0, (props.elevation - props.low) / (props.high - props.low))) : 0;

const HeightSlider = part<HeightProps>()('section-height-slider', {
  size: () => v(220, 30),
  style: (tokens, channels) => ({
    track: tokens.muted,
    fill: tokens.accent,
    knob: tokens.mix(tokens.textBright, tokens.accent, (channels.hover ?? 0) * 0.3),
  }),
  render: (node, painter, style) => {
    const bar = node.rect;
    const x = bar.x + 8;
    const width = bar.w - 16;
    const y = bar.center.y;
    const fraction = fractionOf(node.props);
    painter.box(rect(x, y - 2.5, width, 5), 2.5, style.track);
    painter.box(rect(x, y - 2.5, width * fraction, 5), 2.5, style.fill);
    painter.dot(v(x + width * fraction, y), 7, style.knob);
  },
  on: [
    Drag1D({
      axis: 'x',
      to: (node, fraction): SectionIntent => ({
        kind: 'elevation',
        elevation: Math.round((node.props.low + fraction * (node.props.high - node.props.low)) * 100) / 100,
      }),
    }),
  ],
  semantics: (node) => ({ role: 'slider', label: 'Cut height', value: node.props.elevation }),
});

// The elevation as the bar prints it.
export const elevationText = (doc: SectionDoc): string =>
  doc.kind === 'box' ? 'Section box' : doc.kind === 'none' ? 'No section' : `Cut at ${doc.elevation.toFixed(2)}`;

// A chip is lit when the cut in force is the plan cut of its level.
const lit = (doc: SectionDoc, chip: LevelChip): boolean =>
  doc.kind === 'planes' && Math.abs(doc.elevation - (chip.elevation + doc.cutOffset)) < 1e-6;

export const sectionApp: AppSpec<SectionDoc, SectionIntent> = {
  init: {
    kind: 'none',
    elevation: 0,
    keep: 'below',
    levels: [],
    low: 0,
    high: 1,
    cutOffset: 0,
    boxAsked: 0,
    clearAsked: 0,
  },
  update: (doc, intent) => {
    switch (intent.kind) {
      case 'elevation':
        return { ...doc, kind: 'planes', elevation: intent.elevation };
      case 'keep':
        return { ...doc, keep: intent.keep };
      case 'box':
        return { ...doc, boxAsked: doc.boxAsked + 1 };
      case 'clear':
        return { ...doc, clearAsked: doc.clearAsked + 1 };
    }
  },
  view: (doc): Element =>
    Stack('section-bar', { gap: 8, pad: 8 }, [
      Row(
        'section-levels',
        { gap: 6 },
        doc.levels.map((chip, index) =>
          LevelChipPart(`level-${index}`, {
            label: chip.name,
            selected: lit(doc, chip),
            elevation: chip.elevation,
            cutOffset: doc.cutOffset,
          }),
        ),
      ),
      Row('section-height', { gap: 8 }, [
        Label('section-height-label', { text: elevationText(doc), size: 12, dim: true }),
        HeightSlider('height', { elevation: doc.elevation, low: doc.low, high: doc.high }),
      ]),
      Row('section-actions', { gap: 6 }, [
        KeepChip('above', { label: 'Keep above', keep: 'above', selected: doc.keep === 'above' }),
        KeepChip('below', { label: 'Keep below', keep: 'below', selected: doc.keep === 'below' }),
        Button('box', { label: 'Section box', press: { kind: 'box' } }),
        Button('clear', { label: 'Clear', press: { kind: 'clear' } }),
      ]),
    ]),
};

// The bar's document as the clipping slice and the survey hold it now. A cut this bar did not make
// leaves the elevation and kept side the bar last offered.
export const sectionDocFrom = (
  doc: SectionDoc,
  cut: ReturnType<typeof cutIn>,
  survey: SectionSurvey | undefined,
): SectionDoc => {
  const range = survey === undefined ? undefined : heightRange(survey);
  const asked =
    cut.kind === 'planes' && cut.elevation !== undefined && cut.keep !== undefined
      ? { elevation: cut.elevation, keep: cut.keep }
      : {};
  const next: SectionDoc = {
    ...doc,
    ...asked,
    kind: cut.kind,
    levels: survey?.levels.map((level) => ({ name: level.name, elevation: level.elevation })) ?? doc.levels,
    low: range?.low ?? doc.low,
    high: range?.high ?? doc.high,
    cutOffset: survey?.cutOffset ?? doc.cutOffset,
  };
  const same =
    next.kind === doc.kind &&
    next.elevation === doc.elevation &&
    next.keep === doc.keep &&
    next.low === doc.low &&
    next.high === doc.high &&
    next.cutOffset === doc.cutOffset &&
    next.levels.length === doc.levels.length &&
    next.levels.every((level, index) => level.elevation === doc.levels[index]?.elevation && level.name === doc.levels[index]?.name);
  return same ? doc : next;
};

// The section bar with its types open, so a test can drive `sync` and `onCommit` directly.
export const sectionPanelSpec: HudPanel<SectionDoc, SectionIntent> = {
  id: 'section-bar',
  place: { kind: 'edge', edge: 'bottom' },
  spec: sectionApp,
  sync: (session, doc) => {
    const survey = heldSurvey();
    return sectionDocFrom(doc, cutIn(session, survey?.up ?? 'z'), survey);
  },
  onCommit: (doc, previous, session) => {
    const survey = heldSurvey();
    if (doc.elevation !== previous.elevation || doc.keep !== previous.keep) {
      session.dispatch('clipping.sectionAt', {
        elevation: doc.elevation,
        axis: survey?.up ?? 'z',
        keep: doc.keep,
      });
    }
    if (doc.boxAsked !== previous.boxAsked) {
      const box = survey === undefined ? undefined : middleBox(survey);
      if (box !== undefined) session.dispatch('clipping.setBox', box);
    }
    if (doc.clearAsked !== previous.clearAsked) session.dispatch('clipping.clear', {});
  },
};

// The section bar as the gallery hosts it, along the bottom edge of the viewport.
export const sectionPanel: AnyHudPanel = hudPanel(sectionPanelSpec);

// Every panel this demo draws.
export const sectionPanels: readonly AnyHudPanel[] = [sectionPanel];
