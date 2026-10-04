// Times each layer of BOS loading for every .bos variant in a directory.
// Usage (from the viewer repo root): node packages/loaders/bench/bench-bos-load.mjs <variants dir> [runs]
// Reports the best of `runs` for each file and writes <dir>/results.json.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';
import JSZip from 'jszip';
import { unzipSync } from 'fflate';
import { parquetMetadataAsync, parquetRead } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const dir = process.argv[2];
const runs = Number(process.argv[3] ?? 3);
const GEOMETRY = ['Instances', 'VertexBuffer', 'IndexBuffer', 'Meshes', 'Materials', 'Transforms', 'Entities'];
const ms = (t) => Math.round(t);
const pad = (v, n) => String(v).padStart(n);

// --- ZIP layer: three ways to get entry bytes ------------------------------------------------
async function unzipJSZip(buf) {
  const zip = await JSZip.loadAsync(buf);
  const out = {};
  for (const n of Object.keys(zip.files)) if (!zip.files[n].dir) out[n] = await zip.files[n].async('uint8array');
  return out;
}
function unzipFflate(buf) {
  return unzipSync(new Uint8Array(buf));
}
// Central-directory walk plus native inflate: a stand-in for the browser's DecompressionStream('deflate-raw').
function unzipNative(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = buf.byteLength - 22;
  while (dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    const data = u8.subarray(start, start + csize);
    out[name] = method === 0 ? data : new Uint8Array(zlib.inflateRawSync(data));
    p += 46 + nlen + elen + clen;
  }
  return out;
}

// --- Parquet layer ----------------------------------------------------------------------------
const asFile = (bytes) => ({
  byteLength: bytes.byteLength,
  slice: (s, e = bytes.byteLength) => bytes.buffer.slice(bytes.byteOffset + s, bytes.byteOffset + e),
});
async function readTable(bytes, columns) {
  const file = asFile(bytes);
  const metadata = await parquetMetadataAsync(file);
  const cols = {};
  await parquetRead({
    file, compressors, metadata, ...(columns ? { columns } : {}),
    onChunk(c) { cols[c.columnName] = c.columnData; },
  });
  return cols;
}

async function benchOne(file) {
  const buf = fs.readFileSync(file).buffer.slice(0);
  const r = { file: path.basename(file, '.bos'), size: buf.byteLength };
  for (const [k, fn] of [['zipJSZip', unzipJSZip], ['zipFflate', unzipFflate], ['zipNative', unzipNative]]) {
    const t = performance.now();
    await fn(buf);
    r[k] = performance.now() - t;
  }
  // Parquet layer over already-extracted bytes, geometry tables only (what the viewer reads).
  const entries = unzipNative(buf);
  let total = 0;
  r.parquet = {};
  for (const tname of GEOMETRY) {
    const bytes = entries[`${tname}.parquet`];
    if (!bytes) continue;
    const t = performance.now();
    await readTable(bytes, tname === 'Entities' ? ['LocalId'] : undefined);
    r.parquet[tname] = performance.now() - t;
    total += r.parquet[tname];
  }
  r.parquetGeometry = total;
  r.today = r.zipJSZip + total; // the loader's path: JSZip, then hyparquet
  r.bestCase = r.zipNative + total;
  return r;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.bos')).map((f) => path.join(dir, f));
const results = [];
console.log('variant               size MB | zip: jszip fflate native | parquet geometry (vertex index inst ent) | today  best');
for (const f of files) {
  let best;
  for (let i = 0; i < runs; i++) {
    const r = await benchOne(f);
    if (!best || r.today < best.today) best = r;
  }
  results.push(best);
  const p = best.parquet;
  console.log(
    `${best.file.padEnd(20)} ${pad((best.size / 1e6).toFixed(2), 7)} |` +
    ` ${pad(ms(best.zipJSZip), 9)} ${pad(ms(best.zipFflate), 6)} ${pad(ms(best.zipNative), 6)} |` +
    ` ${pad(ms(best.parquetGeometry), 6)} (${ms(p.VertexBuffer)} ${ms(p.IndexBuffer)} ${ms(p.Instances)} ${ms(p.Entities ?? 0)})`.padEnd(42) +
    ` | ${pad(ms(best.today), 5)} ${pad(ms(best.bestCase), 5)}`,
  );
}
fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(results, null, 2));
