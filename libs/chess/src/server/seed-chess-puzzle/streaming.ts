import { isAbsolute, join, resolve } from 'node:path';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { Logger } from '@pkgs/logger';
import { readUtf8, writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { parse } from 'csv-parse';
import { ZstdDecodeTransform } from './zstd-decode-transform';

const ZST_NAME = 'lichess_db_puzzle.csv.zst';
const MANIFEST_NAME = 'manifest.json';

export type ResolvedSource = {
  /** Store containing the `.csv` or `.csv.zst` source. */
  store: ObjectStore;
  /** Object key for `.csv` or `.csv.zst` source. */
  key: string;
  /** Human-readable path/key for logs. */
  displayPath: string;
  /** ETag / fingerprint used for resume + cache skip. */
  etag: string;
  isZst: boolean;
};

function isHttpUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

async function readCachedManifestEtag(
  store: ObjectStore,
  manifestKey: string
): Promise<string | undefined> {
  try {
    const raw = await readUtf8(store, manifestKey);
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw) as { etag?: string };
    return typeof parsed.etag === 'string' ? parsed.etag : undefined;
  } catch {
    return undefined;
  }
}

function etagAfterDownload(headEtag: string, res: Response): string {
  if (headEtag.length > 0) return headEtag;
  const fromRes = (res.headers.get('etag') ?? '').trim();
  if (fromRes.length > 0) return fromRes;
  return `n:${res.headers.get('content-length') ?? '0'}`;
}

function parseContentLengthHeader(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function streamWebBodyToFile(args: {
  body: NodeReadableStream;
  store: ObjectStore;
  key: string;
  totalBytes: number | null;
  now: Clock['now'];
  onProgress?: (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }) => void;
}): Promise<void> {
  let received = 0;
  let lastEmit = 0;
  const throttleMs = 550;

  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb): void {
      received += chunk.length;
      if (args.onProgress !== undefined) {
        const t = args.now();
        if (t - lastEmit >= throttleMs) {
          args.onProgress({
            receivedBytes: received,
            totalBytes: args.totalBytes,
          });
          lastEmit = t;
        }
      }
      cb(null, chunk);
    },
    flush(cb): void {
      args.onProgress?.({
        receivedBytes: received,
        totalBytes: args.totalBytes,
      });
      cb();
    },
  });

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of Readable.fromWeb(args.body).pipe(counter)) {
    const bytes =
      chunk instanceof Uint8Array
        ? new Uint8Array(chunk)
        : new TextEncoder().encode(String(chunk));
    chunks.push(bytes);
    total += bytes.byteLength;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  await args.store.put(args.key, bytes, 'application/zstd');
}

async function downloadAndPersistHttpArchive(args: {
  source: string;
  cacheStore: ObjectStore;
  dataKey: string;
  manifestKey: string;
  displayPath: string;
  log: Logger;
  headEtag: string;
  http: HttpClient;
  now: Clock['now'];
  onDownloadProgress?: (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }) => void;
}): Promise<ResolvedSource> {
  const res = await args.http.fetch(args.source);
  if (!res.ok || res.body === null) {
    assert.fail('seed:puzzles: download failed', {
      status: res.status,
      source: args.source,
    });
  }
  const totalBytes = parseContentLengthHeader(
    res.headers.get('content-length')
  );
  args.log.info('seed:puzzles: download started', {
    source: args.source,
    totalBytes,
  });
  await streamWebBodyToFile({
    body: res.body as unknown as NodeReadableStream,
    store: args.cacheStore,
    key: args.dataKey,
    totalBytes,
    now: args.now,
    ...(args.onDownloadProgress !== undefined
      ? { onProgress: args.onDownloadProgress }
      : {}),
  });
  const etagFinal = etagAfterDownload(args.headEtag, res);
  await writeUtf8(
    args.cacheStore,
    args.manifestKey,
    JSON.stringify(
      {
        etag: etagFinal,
        url: args.source,
        downloadedAt: new Date(args.now()).toISOString(),
      },
      null,
      2
    ),
    'application/json'
  );
  args.log.info('seed:puzzles: download complete', { path: args.displayPath });
  return {
    store: args.cacheStore,
    key: args.dataKey,
    displayPath: args.displayPath,
    etag: etagFinal,
    isZst: true,
  };
}

async function resolveHttpArchiveSource(args: {
  source: string;
  cacheDir: string;
  cacheStore: ObjectStore;
  log: Logger;
  http: HttpClient;
  now: Clock['now'];
  onDownloadProgress?: (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }) => void;
}): Promise<ResolvedSource> {
  const manifestKey = MANIFEST_NAME;
  const dataKey = ZST_NAME;
  const displayPath = join(args.cacheDir, ZST_NAME);
  args.log.info('seed:puzzles: HTTP HEAD', { source: args.source });
  const head = await args.http.fetch(args.source, { method: 'HEAD' });
  const headEtag = (head.headers.get('etag') ?? '').trim();
  const manifestEtag = await readCachedManifestEtag(
    args.cacheStore,
    manifestKey
  );
  if (
    headEtag.length > 0 &&
    manifestEtag === headEtag &&
    (await args.cacheStore.head(dataKey))
  ) {
    args.log.info('seed:puzzles: using cached puzzle archive', {
      path: displayPath,
      etag: headEtag,
    });
    return {
      store: args.cacheStore,
      key: dataKey,
      displayPath,
      etag: headEtag,
      isZst: true,
    };
  }
  return downloadAndPersistHttpArchive({
    source: args.source,
    cacheStore: args.cacheStore,
    dataKey,
    manifestKey,
    displayPath,
    log: args.log,
    headEtag,
    http: args.http,
    now: args.now,
    ...(args.onDownloadProgress !== undefined
      ? { onDownloadProgress: args.onDownloadProgress }
      : {}),
  });
}

async function resolveLocalFileArchive(
  source: string,
  sourceStore: ObjectStore,
  log: Logger
): Promise<ResolvedSource> {
  const localPath = isAbsolute(source)
    ? source
    : resolve(process.cwd(), source);
  const key = localPath.replace(/^\/+/, '');
  const obj = await sourceStore.get(key);
  if (obj === null) {
    assert.fail('seed:puzzles: source file not found', { localPath });
  }
  log.info('seed:puzzles: local source', {
    localPath,
    sizeBytes: obj.size,
  });
  const etag = `file:${localPath}:${obj.size}`;
  return {
    store: sourceStore,
    key,
    displayPath: localPath,
    etag,
    isZst: localPath.endsWith('.zst'),
  };
}

export class PuzzleArchiveCache {
  constructor(
    private readonly log: Logger,
    private readonly http: HttpClient,
    private readonly now: Clock['now'],
    private readonly cacheStore: ObjectStore,
    private readonly sourceStore: ObjectStore
  ) {}

  async ensureCachedArchive(args: {
    source: string;
    cacheDir: string;
    onDownloadProgress?: (p: {
      receivedBytes: number;
      totalBytes: number | null;
    }) => void;
  }): Promise<ResolvedSource> {
    if (isHttpUrl(args.source)) {
      return resolveHttpArchiveSource({
        source: args.source,
        cacheDir: args.cacheDir,
        cacheStore: this.cacheStore,
        log: this.log,
        http: this.http,
        now: this.now,
        ...(args.onDownloadProgress !== undefined
          ? { onDownloadProgress: args.onDownloadProgress }
          : {}),
      });
    }
    return resolveLocalFileArchive(args.source, this.sourceStore, this.log);
  }
}

export type IteratePuzzleRowsOptions = {
  onParsedRowCount?: (args: { parsedRows: number }) => void;
  /** Emit parse progress every N CSV rows (default 25_000). */
  progressEveryDataRows?: number;
};

function isAbortError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const e = error as { code?: unknown; name?: unknown };
  return e.code === 'ABORT_ERR' || e.name === 'AbortError';
}

export async function iteratePuzzleRows(
  resolved: ResolvedSource,
  onRow: (row: Record<string, unknown>) => Promise<boolean>,
  options?: IteratePuzzleRowsOptions
): Promise<void> {
  const obj = await resolved.store.get(resolved.key);
  assert.defined(obj, 'seed:puzzles: resolved source disappeared', {
    key: resolved.key,
    displayPath: resolved.displayPath,
  });
  const fileStream = Readable.fromWeb(
    obj.body as unknown as NodeReadableStream
  );
  const decode = resolved.isZst ? new ZstdDecodeTransform() : new PassThrough();
  const parser = parse({
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  const every = options?.progressEveryDataRows ?? 25_000;
  let parsedRows = 0;
  // `stopRequested` is set when the row callback returns `false` (e.g.
  // `--limit` reached). Returning early from the consumer destroys the
  // parser before its writable side ends, which makes `pipeline()` reject
  // with `ABORT_ERR` on Node and Bun. We swallow exactly that case below
  // so a user-requested early stop is not surfaced as a stream abort and,
  // crucially, so it does not mask a real downstream error from `onRow`.
  let stopRequested = false;
  let rowCallbackError: unknown = null;
  try {
    await pipeline(
      fileStream,
      decode,
      parser,
      async (records: AsyncIterable<Record<string, unknown>>) => {
        for await (const record of records) {
          parsedRows += 1;
          if (
            options?.onParsedRowCount !== undefined &&
            parsedRows % every === 0
          ) {
            options.onParsedRowCount({ parsedRows });
          }
          let cont: boolean;
          try {
            cont = await onRow(record);
          } catch (err) {
            // Capture the real error so we can rethrow it after pipeline
            // unwinds — otherwise `pipeline()` may surface a bare
            // `ABORT_ERR` from cleanup that hides the original cause.
            rowCallbackError = err;
            stopRequested = true;
            return;
          }
          if (!cont) {
            stopRequested = true;
            return;
          }
        }
      }
    );
  } catch (err) {
    if (rowCallbackError !== null) throw rowCallbackError;
    if (stopRequested && isAbortError(err)) return;
    throw err;
  }
  if (rowCallbackError !== null) throw rowCallbackError;
}
