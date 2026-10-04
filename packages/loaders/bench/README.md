# BOS load performance: where the time goes, and what a different layout buys

Investigation, 2026-10-04. Question: when the viewer loads a `.bos` file, is the ZIP layer or the
Parquet layer slow, and would a different container layout (ZIP method, Parquet codec, encoding)
load faster without a large size cost?

**Answer.** The Parquet layer is slow, and inside it one thing: Brotli decoding in pure JavaScript.
Every column in every BOS table written by `Ara3D.BimOpenSchema.IO` (Parquet.Net 5.2) is
Brotli-compressed, and `hyparquet-compressors` decodes Brotli with a JavaScript port that runs 4 to
10 times slower than a native or WebAssembly decoder. The ZIP's own Deflate is a second, nearly
useless compression layer over already-Brotli'd bytes (it saves 2.7 % of the file) and costs
JSZip 100 to 450 ms more. Two changes fix most of it, and they are independent:

1. **Swap the Brotli decoder** for a WebAssembly one (`brotli-dec-wasm`, 266 KB) in the
   `compressors` object handed to hyparquet. No file-format change; existing files get faster.
   Geometry decode of the committed Snowdon file: 773 ms to 515 ms (Node, same process).
2. **Change the writer**: store ZIP entries instead of deflating them, and either keep Brotli at a
   writer that pages the columns (pyarrow's Brotli decoded in 223 ms with the WASM decoder, at the
   same size), or switch the Parquet codec to gzip (+15 % bytes, 260 ms with the current
   JavaScript gzip) or Snappy (+3× bytes, 120 ms, WASM already shipped).

Confidence: high on the diagnosis (reproduced on two models, three decoders, within one process);
medium on the exact savings in a browser, which were not measured (see "Not checked").

## Files here

- `make-variants.py <in.bos> <out dir>`: rewrites a `.bos` in eleven layouts with pyarrow. Only the
  ZIP entry method, Parquet codec, integer encoding, and dictionary flag change; rows are identical.
- `bench-bos-load.mjs <dir> [runs]`: times three unzip implementations (JSZip as the loader uses,
  fflate, and a central-directory walk with native inflate standing in for the browser's
  `DecompressionStream('deflate-raw')`), then hyparquet over the seven tables the viewer reads
  (`Instances`, `VertexBuffer`, `IndexBuffer`, `Meshes`, `Materials`, `Transforms`, and
  `Entities.LocalId`). Best of `runs`; writes `results.json` next to the inputs.

Run from the viewer repository root, after `pip install pyarrow`:

```sh
python packages/loaders/bench/make-variants.py "../bim-open-schema/examples/Snowdon Towers Sample Architectural.bos" artifacts/bos-bench/snowdon
node packages/loaders/bench/bench-bos-load.mjs artifacts/bos-bench/snowdon 3
```

## Measurements

Node 22.13, Windows 11, one process per table below so rows within a table compare; absolute
numbers moved up to 2× between processes (the JavaScript Brotli pass on the vertex column took
1072 ms in one process and 289 ms in another), so compare rows, not tables.

### What the file is

`deps/bim-open-schema/examples/Snowdon Towers Sample Architectural.bos`, 11.88 MB, 18 Parquet
tables, each ZIP entry Deflate (method 8). Every column: codec BROTLI, encodings RLE/BIT_PACKED/
PLAIN, one row group, one data page per column, written by Parquet.Net 5.2.0. The ZIP's Deflate
reduces the Brotli'd Parquet bytes from 12.2 MB to 11.9 MB. Uncompressed, the same tables are
172 MB (StringParameters 40 MB, VertexBuffer 27 MB, IndexBuffer 26 MB, Entities 18 MB; the
entity and parameter tables use INT64 for every column).

### Snowdon, eleven layouts, same process (`bench-bos-load.mjs`, best of 3)

"today" = JSZip extraction of every entry + hyparquet over the geometry tables, the loader's path.
"best" = native inflate + the same hyparquet pass. Parquet column = geometry tables only.

| layout | MB | unzip JSZip | unzip fflate | unzip native | Parquet geometry | today | best |
|---|---:|---:|---:|---:|---:|---:|---:|
| orig (deflate ZIP, Brotli) | 11.88 | 449 | 310 | 95 | 1515 | 1964 | 1611 |
| store + Brotli (pyarrow) | 11.56 | 44 | 9 | 0 | 1202 | 1246 | 1202 |
| store + gzip | 13.65 | 31 | 3 | 0 | 260 | 292 | 260 |
| store + zstd | 18.70 | 52 | 5 | 0 | 644 | 696 | 644 |
| store + Snappy | 37.42 | 91 | 9 | 0 | 120 | 211 | 120 |
| store + Snappy + dictionary | 33.72 | 101 | 13 | 0 | 573 | 674 | 573 |
| store + none | 172.37 | 415 | 56 | 0 | 62 | 477 | 62 |
| deflate + none | 13.55 | 625 | 479 | 278 | 63 | 688 | 340 |
| deflate + Snappy | 13.69 | 331 | 279 | 112 | 100 | 431 | 212 |
| store + zstd + DELTA_BINARY_PACKED | 20.22 | 45 | 5 | 0 | 2316 | 2362 | 2316 |
| store + none + DELTA_BINARY_PACKED | 54.26 | 150 | 14 | 0 | 1812 | 1962 | 1812 |

The real loader (`parseBosGeometry` from `dist`, which extracts only the seven entries it needs),
same process, best of 3: orig 1192 ms, store+Brotli 1234, store+gzip 432, store+Snappy 530,
deflate+Snappy 531, deflate+none 686. Vertex count 2,261,978 in every case.

### Golden Nugget (11.28 MB, `deps/bim-open-schema/examples`), same layouts

| layout | MB | unzip JSZip | Parquet geometry | today |
|---|---:|---:|---:|---:|
| orig | 11.28 | 132 | 800 | 932 |
| store + Brotli | 14.39 | 30 | 912 | 942 |
| store + gzip | 18.26 | 39 | 330 | 369 |
| store + zstd | 21.90 | 45 | 481 | 526 |
| store + Snappy | 42.59 | 96 | 112 | 207 |
| deflate + none | 17.90 | 635 | 60 | 695 |

Same ordering as Snowdon. The deflate+Snappy row of this run was an outlier (1411 ms, fflate 2183)
and is omitted; rerun before quoting it.

### The decoder alone, vertex column bytes (27.15 MB raw)

Brotli quality 11 from Node's zlib gives 2.36 MB; gzip level 6 gives 4.06 MB.

| decoder | ms |
|---|---:|
| Brotli, native (`zlib.brotliDecompressSync`) | 71 to 113 |
| Brotli, `brotli-dec-wasm` 2.3.2 (266 KB package) | 73 |
| Brotli, `brotli-wasm` 3.0.1 (1 MB wasm) | 78 |
| Brotli, `hyparquet-compressors` 1.1.1 JavaScript | 289 to 1072 |
| gzip, native | 69 |
| gzip, `hyparquet-compressors` JavaScript | 193 |

### The decoder swapped into hyparquet, geometry tables, same process

| file | JS Brotli | brotli-dec-wasm | brotli-wasm | native |
|---|---:|---:|---:|---:|
| orig (Parquet.Net, 1 page per column) | 773 | 515 | 525 | 432 |
| store+Brotli (pyarrow, 114 pages per column) | 664 | 223 | 268 | 166 |

With a fast decoder the Parquet.Net file is still 2 to 2.5× slower than the pyarrow one at the
same codec and size. The difference is in how the writer laid the column out (one 27 MB page and
.NET's Brotli stream versus 114 pages from pyarrow's Brotli); which of the two matters was not
separated.

## What this means for the format and the writer

- The ZIP layer should **store** entries (method 0). Deflate over Brotli saves 2.7 % and costs
  JSZip roughly 400 ms on 18 entries, 100 ms on the 7 the loader opens. `ParquetUtils.cs` already
  defaults `zipCompressionLevel` to `NoCompression`, yet every file inspected, including
  `Snowdon-v2.bos` from 2026-02, has method 8 with real compression; check what .NET's
  `ZipArchive` emits for that level, or set the entry method explicitly.
- Brotli is the right codec **for size** (the best by 15 % over gzip, 40 % over zstd at pyarrow's
  defaults) and the wrong one for the decoder we ship. Keep Brotli and fix the decoder, or trade
  bytes for the gzip decoder we already have.
- Integer encodings (DELTA_BINARY_PACKED) and dictionary pages make hyparquet slower here; stay
  with PLAIN.
- Smaller pages help the decode even at the same codec. If the C# writer stays, see whether
  Parquet.Net exposes a page size; if not, that is a reason to try another writer for geometry.
- A size-first alternative that avoids codecs entirely does not exist: uncompressed Parquet is
  172 MB for this model.

## Not checked

- Browser timings. Node and Chromium share V8, so the JavaScript codec ratios should hold, but
  WASM instantiation, fetch, and main-thread scheduling were not measured. Chrome 152 (the desktop
  app's browser pane) reports `DecompressionStream` support for gzip, deflate, and deflate-raw
  only, not Brotli or zstd, so a native Brotli path in the browser is not available; WASM is the
  option.
- Whether `brotli-dec-wasm` handles every stream Parquet.Net's `BrotliEncoder` produces (it decoded
  all seven Snowdon geometry tables and the pyarrow rewrite; the other eleven tables were not
  read with it).
- The bosToBfast conversion and render-side costs. `docs/bim-flow-startup.md` in the toolkit
  measured those; this spike stops at decoded typed arrays.
- Why the Parquet.Net single-page layout decodes slower than pyarrow's paged one with the same codec.

## Next

The smallest step with the highest return: add `brotli-dec-wasm` to `@bim-open-viewer/loaders`,
pass `{ ...compressors, BROTLI: wasmDecompress }` to hyparquet, and rerun `bench-bos-load.mjs` plus
`scripts/profile-bim-flow-startup.mjs` in the toolkit to see the browser number. The writer changes
(stored ZIP entries, page size) go to `bim-open-data` as a ticket.

## Should this be a skill?

No. The reusable part of the method (vary one layer at a time, time each layer in one process,
swap the decoder before the format, check native support in the target runtime) is already what
the `investigate` skill's spike reference asks for, and the project-specific part is these two
scripts, which now live in the repository and run with two commands. A skill would restate the
procedure without saving a step. What would be worth keeping, if more format spikes follow, is a
sentence in that spike reference: "when a decode is slow, time the decoder on the same bytes
outside the parser first; it separates the codec from the file layout."
