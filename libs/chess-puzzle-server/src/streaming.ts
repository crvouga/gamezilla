import { isAbsolute, join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { assert } from '@pkgs/assert-shared/singleton';
import type { Clock } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import type { Logger } from '@pkgs/logger-shared/logger';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';

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

export type PuzzleArchiveCacheOptions = {
  readonly log: Logger;
  readonly http: HttpClient;
  readonly now: Clock['now'];
  readonly cacheStore: ObjectStore;
  readonly sourceStore: ObjectStore;
};

export class PuzzleArchiveCache {
  private readonly log: Logger;
  private readonly http: HttpClient;
  private readonly now: Clock['now'];
  private readonly cacheStore: ObjectStore;
  private readonly sourceStore: ObjectStore;

  constructor(options: PuzzleArchiveCacheOptions) {
    this.log = options.log;
    this.http = options.http;
    this.now = options.now;
    this.cacheStore = options.cacheStore;
    this.sourceStore = options.sourceStore;
  }

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
