"""Rewrites a .bos archive in several container layouts so bench-bos-load.mjs can time them.

Usage: python make-variants.py <input.bos> <out dir>

Each variant keeps every table and every row; only the Parquet codec/encoding and the ZIP
entry method change. Requires pyarrow (pip install pyarrow).
"""
import io, os, sys, zipfile
import pyarrow.parquet as pq

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
z = zipfile.ZipFile(src)
tables = {n: z.read(n) for n in z.namelist() if n.lower().endswith('.parquet')}


def rewrite(data, codec, encoding=None, dictionary=False):
    t = pq.read_table(io.BytesIO(data))
    buf = io.BytesIO()
    kw = dict(compression=codec, use_dictionary=dictionary, row_group_size=1 << 31,
              data_page_size=1 << 30, write_statistics=False)
    if encoding:
        kw['column_encoding'] = encoding
    pq.write_table(t, buf, **kw)
    return buf.getvalue()


VARIANTS = {
    # name: (zip method, parquet codec, integer encoding, dictionary)
    'orig': None,
    'store+brotli': (zipfile.ZIP_STORED, 'brotli', None, False),
    'store+snappy': (zipfile.ZIP_STORED, 'snappy', None, False),
    'store+zstd': (zipfile.ZIP_STORED, 'zstd', None, False),
    'store+gzip': (zipfile.ZIP_STORED, 'gzip', None, False),
    'store+none': (zipfile.ZIP_STORED, 'none', None, False),
    'deflate+none': (zipfile.ZIP_DEFLATED, 'none', None, False),
    'deflate+snappy': (zipfile.ZIP_DEFLATED, 'snappy', None, False),
    'store+zstd+delta': (zipfile.ZIP_STORED, 'zstd', 'DELTA_BINARY_PACKED', False),
    'store+none+delta': (zipfile.ZIP_STORED, 'none', 'DELTA_BINARY_PACKED', False),
    'store+snappy+dict': (zipfile.ZIP_STORED, 'snappy', None, True),
}

for name, spec in VARIANTS.items():
    path = os.path.join(out, name + '.bos')
    if spec is None:
        with open(path, 'wb') as f:
            f.write(open(src, 'rb').read())
    else:
        method, codec, enc, dic = spec
        with zipfile.ZipFile(path, 'w', method, compresslevel=6) as zo:
            for n, data in tables.items():
                try:
                    body = rewrite(data, codec, enc, dic)
                except Exception:  # delta applies only to integer columns; fall back per table
                    body = rewrite(data, codec, None, dic)
                zo.writestr(n, body)
    print(f'{name:22} {os.path.getsize(path):>12,} bytes')
