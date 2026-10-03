// Turns a fixture summary into stable JSON, and back.
//
// The snapshots exist so that a change to a generator shows up in review as a diff rather than as
// a number nobody looked at. That needs three things: a text form whose lines correspond to
// something a reader recognises (one line per column), a representation for values JSON has none
// for (NaN, which is most of what these fixtures are about), and a digest for the few columns too
// long to read, so a change is still visible even where the values are not.

import type { Column, Table } from '@bim-open-viewer/model';
import type { FixtureSummary } from '../src/fixtures.js';

// The most rows a snapshot writes out in full. Beyond this a column is reduced to a digest, so the
// file stays readable while a change to it is still visible.
export const inlineRowLimit = 400;

// One cell as JSON holds it. A number JSON cannot hold is written as the text of its name.
export type SnapshotCell = number | string | boolean;

// One column of a snapshot: its type, and either every value or a digest of them.
export type SnapshotColumn = {
  readonly type: string;
  readonly values?: readonly SnapshotCell[];
  readonly digest?: string;
};

// One table of a snapshot.
export type SnapshotTable = {
  readonly rowCount: number;
  readonly columns: Readonly<Record<string, SnapshotColumn>>;
};

// One fixture as a snapshot holds it.
export type Snapshot = {
  readonly name: string;
  readonly objectCount: number;
  readonly factCount: number;
  readonly meshes: readonly { readonly name: string; readonly instanceCount: number; readonly triangleCount: number }[];
  readonly extras: Readonly<Record<string, number | string>>;
  readonly tables: Readonly<Record<string, SnapshotTable>>;
};

// A number as JSON can hold it. NaN and the infinities have no JSON form, and writing them as null
// or as zero is exactly the mistake these fixtures exist to catch, so they are written as text.
export function snapshotNumber(value: number): SnapshotCell {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Number.POSITIVE_INFINITY) return 'Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  return value;
}

// Every value of a column, in row order.
function columnValues(column: Column): readonly SnapshotCell[] {
  if (column.type === 'string') return [...column.values];
  if (column.type === 'bool') return [...column.values].map((value) => value === 1);
  return [...column.values].map(snapshotNumber);
}

// A 32-bit FNV-1a digest of a column's values, as eight hexadecimal digits. Used only where a
// column is too long to write out; it says that something changed, not what.
export function digestOf(values: readonly SnapshotCell[]): string {
  let hash = 0x811c9dc5;
  for (const value of values) {
    // The separator is written as an escape rather than as a literal, so the source file stays
    // plain ASCII and no invisible byte can hide in it.
    const text = `${String(value)}\u001f`;
    for (let index = 0; index < text.length; index++) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

// One table as a snapshot holds it.
export function snapshotTable(source: Table): SnapshotTable {
  const columns: Record<string, SnapshotColumn> = {};
  for (const [name, column] of source.columns) {
    const values = columnValues(column);
    columns[name] =
      source.rowCount <= inlineRowLimit
        ? { type: column.type, values }
        : { type: column.type, digest: digestOf(values) };
  }
  return { rowCount: source.rowCount, columns };
}

// One fixture summary as a snapshot holds it.
export function snapshotOf(summary: FixtureSummary): Snapshot {
  const tables: Record<string, SnapshotTable> = {};
  for (const [name, source] of summary.tables) tables[name] = snapshotTable(source);
  return {
    name: summary.name,
    objectCount: summary.objectCount,
    factCount: summary.factCount,
    meshes: summary.meshes.map((mesh) => ({ ...mesh })),
    extras: { ...summary.extras },
    tables,
  };
}

// One value written as JSON, on one line.
const inline = (value: unknown): string => JSON.stringify(value) ?? 'null';

// A snapshot as text: one line per column, so a change to a generator reads as a diff of the
// columns it changed rather than of a single very long line or of thousands of short ones.
export function snapshotText(snapshot: Snapshot): string {
  const lines: string[] = ['{'];
  lines.push(`  "name": ${inline(snapshot.name)},`);
  lines.push(`  "objectCount": ${String(snapshot.objectCount)},`);
  lines.push(`  "factCount": ${String(snapshot.factCount)},`);
  lines.push(`  "meshes": [`);
  snapshot.meshes.forEach((mesh, index) => {
    lines.push(`    ${inline(mesh)}${index === snapshot.meshes.length - 1 ? '' : ','}`);
  });
  lines.push(`  ],`);
  lines.push(`  "extras": ${inline(snapshot.extras)},`);
  lines.push(`  "tables": {`);
  const tableNames = Object.keys(snapshot.tables);
  tableNames.forEach((tableName, tableIndex) => {
    const table = snapshot.tables[tableName];
    if (table === undefined) return;
    lines.push(`    ${inline(tableName)}: {`);
    lines.push(`      "rowCount": ${String(table.rowCount)},`);
    lines.push(`      "columns": {`);
    const columnNames = Object.keys(table.columns);
    columnNames.forEach((columnName, columnIndex) => {
      const column = table.columns[columnName];
      if (column === undefined) return;
      lines.push(`        ${inline(columnName)}: ${inline(column)}${columnIndex === columnNames.length - 1 ? '' : ','}`);
    });
    lines.push(`      }`);
    lines.push(`    }${tableIndex === tableNames.length - 1 ? '' : ','}`);
  });
  lines.push(`  }`);
  lines.push('}');
  return `${lines.join('\n')}\n`;
}
