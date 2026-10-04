// Parquet page decompressors for the BOS tables. Every BOS column is Brotli-compressed, and
// hyparquet-compressors decodes Brotli in JavaScript at a quarter to a tenth of native speed
// (packages/loaders/bench/README.md). Each runtime gets its fastest decoder: Node its built-in zlib,
// browsers a 200 KB WebAssembly module; the JavaScript port stays as the fallback.
import type { Compressors } from 'hyparquet';
import { compressors as jsCompressors } from 'hyparquet-compressors';

type BrotliDecode = (input: Uint8Array, outputLength: number) => Uint8Array;

const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

async function nodeBrotli(): Promise<BrotliDecode> {
  const name = 'node:zlib'; // a variable keeps browser bundlers from following the import
  const zlib = (await import(/* @vite-ignore */ name)) as typeof import('node:zlib');
  return (input) => new Uint8Array(zlib.brotliDecompressSync(input));
}

async function wasmBrotli(): Promise<BrotliDecode> {
  const brotli = await (await import('brotli-dec-wasm')).default;
  return (input) => brotli.decompress(input);
}

let loading: Promise<Compressors> | undefined;

/**
 * hyparquet `compressors` with the fastest Brotli decoder this runtime offers. Resolved once; a
 * decoder that fails to load leaves the JavaScript one in place and says so once on the console.
 */
export function bosCompressors(): Promise<Compressors> {
  loading ??= (isNode ? nodeBrotli() : wasmBrotli())
    .then((BROTLI): Compressors => ({ ...jsCompressors, BROTLI }))
    .catch((error: unknown): Compressors => {
      console.warn('BOS: fast Brotli decoder unavailable, using the JavaScript one', error);
      return jsCompressors;
    });
  return loading;
}
