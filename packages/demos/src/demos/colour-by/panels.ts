// The two panels of the demo: a bar along the bottom with one chip per column to colour by, and a
// legend in the top-right corner whose rows switch one swatch's objects on and off.
//
// Neither keeps state of its own beyond what it is about to ask for. `sync` reads the column and the
// rows back from the appearance slice, so a colouring applied by any route shows here too, and a
// swatch the session no longer holds is gone from the legend rather than shown with a made-up count.
//
// The chip is a local part because ui-gratify's `Segmented` has not been published yet; it goes
// when that lands. The legend row is local because it paints a colour swatch from model data.

import { hudPanel, type AnyHudPanel, type HudPanel } from '@bim-open-viewer/ui-gratify';
import { Label, part, Press, rect, rgb, Row, Stack, surface, v, type AppSpec, type Element } from 'gratify';
import { applyColumn } from './apply.js';
import { chosenColumn, classRows, type ClassRow } from './classes.js';
import { colourColumns, type ColourColumnId } from './colouring.js';
import { heldIndex, offeredColumns } from './held.js';

// What the bar shows: the column in force and the columns on offer.
export type ColourBarDoc = { readonly column: ColourColumnId; readonly offered: readonly ColourColumnId[] };

export type ColourBarIntent = { readonly kind: 'column'; readonly column: ColourColumnId };

const titleOf = (column: ColourColumnId): string => colourColumns.find((one) => one.id === column)?.title ?? column;

type ChipProps = { readonly column: ColourColumnId; readonly selected: boolean };

const ColumnChip = part<ChipProps>()('colour-by-chip', {
  size: (props, measure) => v(measure.text(titleOf(props.column), 12).x + 22, 26),
  style: (tokens, channels, props) => ({
    ...surface(tokens, channels, props.selected ? { tint: tokens.accent } : {}),
    corner: 6,
  }),
  render: (node, painter, style) => {
    painter.box(node.rect, style.corner, style.fill, style.edge, 1);
    painter.label(titleOf(node.props.column), node.rect.center, style.text, { size: 12 });
  },
  on: [Press((node): ColourBarIntent => ({ kind: 'column', column: node.props.column }))],
  semantics: (node) => ({
    role: 'button',
    label: titleOf(node.props.column),
    value: node.props.selected ? 'on' : 'off',
  }),
});

export const colourBarApp: AppSpec<ColourBarDoc, ColourBarIntent> = {
  init: { column: 'category', offered: ['category', 'storey'] },
  update: (doc, intent) => ({ ...doc, column: intent.column }),
  view: (doc): Element =>
    Stack('colour-by-bar', { gap: 8, pad: 8 }, [
      Row('colour-by-columns', { gap: 6 }, [
        Label('colour-by-label', { text: 'Colour by', size: 12, dim: true }),
        ...doc.offered.map((column) => ColumnChip(column, { column, selected: doc.column === column })),
      ]),
    ]),
};

const sameColumns = (left: readonly ColourColumnId[], right: readonly ColourColumnId[]): boolean =>
  left.length === right.length && left.every((column, at) => column === right[at]);

// The bar with its types open, so a test can drive `sync` and `onCommit` directly.
export const colourBarSpec: HudPanel<ColourBarDoc, ColourBarIntent> = {
  id: 'colour-by-bar',
  place: { kind: 'edge', edge: 'bottom' },
  spec: colourBarApp,
  sync: (session, doc) => {
    const column = chosenColumn(session) ?? doc.column;
    const offered = offeredColumns(heldIndex());
    return column === doc.column && sameColumns(offered, doc.offered) ? doc : { column, offered };
  },
  onCommit: (doc, previous, session) => {
    const index = heldIndex();
    if (doc.column !== previous.column && index !== undefined) applyColumn(session, index, doc.column);
  },
};

export const colourBarPanel: AnyHudPanel = hudPanel(colourBarSpec);

// What the legend shows: one row per swatch, and the switch the last press asked for. `seq` counts
// presses, so two presses of one row are two requests.
export type LegendDoc = {
  readonly rows: readonly ClassRow[];
  readonly toggle: { readonly ruleId: string; readonly enabled: boolean; readonly seq: number };
};

export type LegendIntent = { readonly kind: 'toggle'; readonly ruleId: string; readonly enabled: boolean };

type RowProps = { readonly row: ClassRow };

const rowText = (row: ClassRow): string => (row.enabled ? row.label : `${row.label} (hidden)`);

const LegendRow = part<RowProps>()('colour-by-legend-row', {
  size: (props, measure) => v(Math.max(190, measure.text(rowText(props.row), 12).x + 70), 22),
  style: (tokens, channels, props) => ({
    ...surface(tokens, channels, {}),
    corner: 4,
    swatchAlpha: props.row.enabled ? 1 : 0.3,
  }),
  render: (node, painter, style) => {
    const box = node.rect;
    const [red, green, blue] = node.props.row.colour;
    painter.box(box, style.corner, style.fill);
    painter.box(
      rect(box.x + 4, box.center.y - 6, 12, 12),
      3,
      rgb(red * 255, green * 255, blue * 255, style.swatchAlpha),
    );
    painter.label(rowText(node.props.row), v(box.x + 22, box.center.y), style.text, { size: 12, align: 'left' });
    painter.label(String(node.props.row.count), v(box.x + box.w - 6, box.center.y), style.text, {
      size: 12,
      align: 'right',
    });
  },
  on: [
    Press(
      (node): LegendIntent => ({ kind: 'toggle', ruleId: node.props.row.ruleId, enabled: !node.props.row.enabled }),
    ),
  ],
  semantics: (node) => ({
    role: 'button',
    label: node.props.row.label,
    value: node.props.row.enabled ? 'on' : 'off',
  }),
});

export const legendApp: AppSpec<LegendDoc, LegendIntent> = {
  init: { rows: [], toggle: { ruleId: '', enabled: true, seq: 0 } },
  update: (doc, intent) => ({
    ...doc,
    toggle: { ruleId: intent.ruleId, enabled: intent.enabled, seq: doc.toggle.seq + 1 },
  }),
  view: (doc): Element =>
    Stack(
      'colour-by-legend',
      { gap: 2, pad: 8 },
      doc.rows.map((row) => LegendRow(row.ruleId, { row })),
    ),
};

const sameRows = (left: readonly ClassRow[], right: readonly ClassRow[]): boolean =>
  left.length === right.length &&
  left.every((row, at) => {
    const other = right[at];
    return (
      other !== undefined &&
      row.ruleId === other.ruleId &&
      row.label === other.label &&
      row.count === other.count &&
      row.enabled === other.enabled
    );
  });

export const legendSpec: HudPanel<LegendDoc, LegendIntent> = {
  id: 'colour-by-legend',
  place: { kind: 'corner', corner: 'top-right' },
  spec: legendApp,
  sync: (session, doc) => {
    const rows = classRows(session);
    return sameRows(rows, doc.rows) ? doc : { ...doc, rows };
  },
  onCommit: (doc, previous, session) => {
    if (doc.toggle.seq !== previous.toggle.seq)
      session.dispatch('appearance.setRuleEnabled', { id: doc.toggle.ruleId, enabled: doc.toggle.enabled });
  },
};

export const legendPanel: AnyHudPanel = hudPanel(legendSpec);

// Every panel this demo draws.
export const colourByPanels: readonly AnyHudPanel[] = [colourBarPanel, legendPanel];
