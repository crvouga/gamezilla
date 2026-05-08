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
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { finished } from 'node:stream/promises';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse';
import { Decompress as ZstdDecompress } from 'fzstd';
import { assert } from '@gamezilla/lib/assert';
import type { Logger } from '@gamezilla/lib/logger';

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

async function downloadAndPersistHttpArchive(args: {
  source: string;
  dataPath: string;
  manifestPath: string;
  log: Logger;
  headEtag: string;
}): Promise<ResolvedSource> {
  args.log.info('seed:puzzles: downloading puzzle archive', {
    source: args.source,
  });
  const res = await fetch(args.source);
  if (!res.ok || res.body === null) {
    assert.fail('seed:puzzles: download failed', {
      status: res.status,
      source: args.source,
    });
  }
  const tmpPath = `${args.dataPath}.partial`;
  const ws = createWriteStream(tmpPath);
  await finished(
    Readable.fromWeb(res.body as unknown as NodeReadableStream).pipe(ws)
  );
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
}): Promise<ResolvedSource> {
  const manifestPath = join(args.cacheDir, MANIFEST_NAME);
  const dataPath = join(args.cacheDir, ZST_NAME);
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
  });
}

async function resolveLocalFileArchive(
  source: string
): Promise<ResolvedSource> {
  const localPath = isAbsolute(source)
    ? source
    : resolve(process.cwd(), source);
  if (!(await fileExists(localPath))) {
    assert.fail('seed:puzzles: source file not found', { localPath });
  }
  const st = await stat(localPath);
  const etag = `file:${localPath}:${st.mtimeMs}:${st.size}`;
  return { localPath, etag, isZst: localPath.endsWith('.zst') };
}

export async function ensureCachedArchive(args: {
  source: string;
  cacheDir: string;
  log: Logger;
}): Promise<ResolvedSource> {
  await mkdir(args.cacheDir, { recursive: true });
  if (isHttpUrl(args.source)) {
    return resolveHttpArchiveSource(args);
  }
  return resolveLocalFileArchive(args.source);
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

export async function iteratePuzzleRows(
  resolved: ResolvedSource,
  onRow: (row: Record<string, unknown>) => Promise<boolean>
): Promise<void> {
  const fileStream = createReadStream(resolved.localPath);
  const decode = resolved.isZst ? new ZstdDecodeTransform() : new PassThrough();
  const parser = parse({
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  const pipePromise = pipeline(fileStream, decode, parser);
  try {
    for await (const record of parser as AsyncIterable<
      Record<string, unknown>
    >) {
      const cont = await onRow(record);
      if (!cont) break;
    }
  } finally {
    await pipePromise;
  }
}
