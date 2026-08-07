import { createReadStream, createWriteStream } from 'node:fs';
import {
  access,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { assert } from '@pkgs/assert';
import type { Logger } from '@pkgs/logger';
import { parse } from 'csv-parse';
import { Decompress as ZstdDecompress } from 'fzstd';

const ZST_NAME = 'lichess_db_puzzle.csv.zst';
const MANIFEST_NAME = 'manifest.json';

export type ResolvedSource = {
  /** Path to `.csv` or `.csv.zst` on disk (downloaded or user-provided). */
  localPath: string;
  /** ETag / fingerprint used for resume + cache skip. */
  etag: string;
  isZst: boolean;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isHttpUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

async function readCachedManifestEtag(
  manifestPath: string
): Promise<string | undefined> {
  try {
    const raw = await readFile(manifestPath, 'utf8');
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
  destPath: string;
  totalBytes: number | null;
  onProgress?: (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }) => void;
}): Promise<void> {
  const ws = createWriteStream(args.destPath);
  let received = 0;
  let lastEmit = 0;
  const throttleMs = 550;

  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb): void {
      received += chunk.length;
      if (args.onProgress !== undefined) {
        const now = performance.now();
        if (now - lastEmit >= throttleMs) {
          args.onProgress({
            receivedBytes: received,
            totalBytes: args.totalBytes,
          });
          lastEmit = now;
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

  await pipeline(Readable.fromWeb(args.body), counter, ws);
}

async function downloadAndPersistHttpArchive(args: {
  source: string;
  dataPath: string;
  manifestPath: string;
  log: Logger;
  headEtag: string;
  onDownloadProgress?: (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }) => void;
}): Promise<ResolvedSource> {
  const res = await fetch(args.source);
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
  const tmpPath = `${args.dataPath}.partial`;
  await streamWebBodyToFile({
    body: res.body as unknown as NodeReadableStream,
    destPath: tmpPath,
    totalBytes,
    ...(args.onDownloadProgress !== undefined
      ? { onProgress: args.onDownloadProgress }
      : {}),
  });
  await rename(tmpPath, args.dataPath);
  const etagFinal = etagAfterDownload(args.headEtag, res);
  await writeFile(
    args.manifestPath,
    JSON.stringify(
      {
        etag: etagFinal,
        url: args.source,
        downloadedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );
  args.log.info('seed:puzzles: download complete', { path: args.dataPath });
  return { localPath: args.dataPath, etag: etagFinal, isZst: true };
}

async function resolveHttpArchiveSource(args: {
  source: string;
  cacheDir: string;
  log: Logger;
  onDownloadProgress?: (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }) => void;
}): Promise<ResolvedSource> {
  const manifestPath = join(args.cacheDir, MANIFEST_NAME);
  const dataPath = join(args.cacheDir, ZST_NAME);
  args.log.info('seed:puzzles: HTTP HEAD', { source: args.source });
  const head = await fetch(args.source, { method: 'HEAD' });
  const headEtag = (head.headers.get('etag') ?? '').trim();
  const manifestEtag = await readCachedManifestEtag(manifestPath);
  if (
    headEtag.length > 0 &&
    manifestEtag === headEtag &&
    (await fileExists(dataPath))
  ) {
    args.log.info('seed:puzzles: using cached puzzle archive', {
      path: dataPath,
      etag: headEtag,
    });
    return { localPath: dataPath, etag: headEtag, isZst: true };
  }
  return downloadAndPersistHttpArchive({
    source: args.source,
    dataPath,
    manifestPath,
    log: args.log,
    headEtag,
    ...(args.onDownloadProgress !== undefined
      ? { onDownloadProgress: args.onDownloadProgress }
      : {}),
  });
}

async function resolveLocalFileArchive(
  source: string,
  log: Logger
): Promise<ResolvedSource> {
  const localPath = isAbsolute(source)
    ? source
    : resolve(process.cwd(), source);
  if (!(await fileExists(localPath))) {
    assert.fail('seed:puzzles: source file not found', { localPath });
  }
  const st = await stat(localPath);
  log.info('seed:puzzles: local source', {
    localPath,
    sizeBytes: st.size,
  });
  const etag = `file:${localPath}:${st.mtimeMs}:${st.size}`;
  return { localPath, etag, isZst: localPath.endsWith('.zst') };
}

export async function ensureCachedArchive(args: {
  source: string;
  cacheDir: string;
  log: Logger;
  onDownloadProgress?: (p: {
    receivedBytes: number;
    totalBytes: number | null;
  }) => void;
}): Promise<ResolvedSource> {
  await mkdir(args.cacheDir, { recursive: true });
  if (isHttpUrl(args.source)) {
    return resolveHttpArchiveSource(args);
  }
  return resolveLocalFileArchive(args.source, args.log);
}

class ZstdDecodeTransform extends Transform {
  private readonly dec: ZstdDecompress;

  constructor() {
    super();
    this.dec = new ZstdDecompress((chunk: Uint8Array) => {
      this.push(Buffer.from(chunk));
    });
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    try {
      this.dec.push(new Uint8Array(chunk));
      callback();
    } catch (e) {
      callback(e instanceof Error ? e : new Error(String(e)));
    }
  }

  override _flush(callback: (error?: Error | null) => void): void {
    try {
      this.dec.push(new Uint8Array(0), true);
      callback();
    } catch (e) {
      callback(e instanceof Error ? e : new Error(String(e)));
    }
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
  const fileStream = createReadStream(resolved.localPath);
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
