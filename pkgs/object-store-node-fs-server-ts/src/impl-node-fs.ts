import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { NodeFs } from '@pkgs/object-store-node-fs-shared-ts/node-fs';
import { ObjectStoreWithPrefix } from '@pkgs/object-store-root-shared-ts/impl-with-prefix';
import type {
  ObjectStore,
  StoredObject,
} from '@pkgs/object-store-root-shared-ts/interface';
import { assertLogicalObjectKey } from '@pkgs/object-store-root-shared-ts/namespace-guard';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

const META_SUFFIX = '.meta.json';
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/**
 * Same-directory tmp names so `rename` is atomic on POSIX. The pid keeps them
 * unique across processes: `bun test --parallel` workers write the same key
 * (a migrated harness seed) at once, and a per-process counter alone collides —
 * one worker's `rename` moves the other's tmp away and it fails `ENOENT`.
 */
let tmpSeq = 0;

/** A vanished parent between `mkdir` and `open` (parallel report writers). */
function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'ENOENT'
  );
}

/**
 * Windows refuses to replace a file while another process replaces or holds
 * it (`EPERM` / `EACCES` / `EBUSY`); the holder lets go within moments, so the
 * rename is tried again rather than failing a put that raced another writer.
 */
const BUSY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RENAME_ATTEMPTS = 200;

function isBusy(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    BUSY_CODES.has(String((error as { readonly code?: unknown }).code))
  );
}

function nextTmpPath(dest: string): string {
  tmpSeq += 1;
  return `${dest}.${String(process.pid)}.${String(tmpSeq)}.tmp`;
}

export type ObjectStoreFsLayout = 'sidecar' | 'tree';

export type NodeFsObjectStoreOptions = {
  /** Absolute or relative directory root for all keys. */
  readonly rootDir: string;
  /** Injected filesystem — composition roots pass {@link ./wall-node-fs.ts wallNodeFs()}. */
  readonly fs: NodeFs;
  /**
   * `sidecar` (default): blob cache with `.meta.json` content-type sidecars.
   * `tree`: keys map 1:1 to relative paths; no sidecars (git trees / CI scans).
   */
  readonly layout?: ObjectStoreFsLayout;
  /** Directory basenames to skip when walking for `listKeys` (tree layout). */
  readonly skipDirNames?: ReadonlySet<string>;
};

type Meta = {
  readonly contentType: string;
};

function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const copy = new Uint8Array(bytes);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(copy);
      controller.close();
    },
  });
}

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'text/typescript';
  if (lower.endsWith('.js') || lower.endsWith('.cjs') || lower.endsWith('.mjs'))
    return 'text/javascript';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.sql')) return 'application/sql';
  if (lower.endsWith('.txt') || lower.endsWith('.ndjson'))
    return 'text/plain; charset=utf-8';
  return DEFAULT_CONTENT_TYPE;
}

/**
 * Node/Bun {@link ObjectStore} backed by the local filesystem.
 * Keys may include `/` (mapped to directories). Rejects `..` and absolute keys.
 * Wall `node:fs` is injected via {@link NodeFsObjectStoreOptions.fs}.
 */
export class ObjectStoreImplNodeFs implements ObjectStore {
  private readonly rootDir: string;
  private readonly fs: NodeFs;
  private readonly layout: ObjectStoreFsLayout;
  private readonly skipDirNames: ReadonlySet<string>;

  constructor(options: NodeFsObjectStoreOptions) {
    if (options.rootDir.trim().length === 0) {
      throw new Error('ObjectStoreImplNodeFs: rootDir must be non-empty');
    }
    this.rootDir = resolve(options.rootDir);
    this.fs = options.fs;
    this.layout = options.layout ?? 'sidecar';
    this.skipDirNames = options.skipDirNames ?? new Set();
  }

  private resolveDataPath(key: string): string {
    assertLogicalObjectKey(key);
    const dataPath = resolve(this.rootDir, ...key.split('/'));
    const rel = slashPath(relative(this.rootDir, dataPath));
    if (rel.startsWith('..') || rel.includes('../')) {
      throw new Error(`ObjectStoreImplNodeFs: key escapes rootDir: ${key}`);
    }
    return dataPath;
  }

  /**
   * Recreate the parent on each attempt. A parallel run can remove a report
   * directory after `mkdir` returns and before `open` of the temp file; one
   * ENOENT then used to fail a trace that had already written hundreds of frames.
   */
  private async writeFileAtomic(
    dest: string,
    contents: Uint8Array | string
  ): Promise<void> {
    const dir = dirname(dest);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.fs.mkdir(dir, { recursive: true });
        await this.writeNewFile(dest, contents);
        return;
      } catch (error) {
        if (!isEnoent(error) || attempt === 2) throw error;
      }
    }
  }

  private async writeNewFile(
    dest: string,
    contents: Uint8Array | string
  ): Promise<void> {
    const tmp = nextTmpPath(dest);
    try {
      await this.fs.writeFile(tmp, contents);
      await this.replace(tmp, dest);
    } finally {
      await this.fs.rm(tmp, { force: true });
    }
  }

  private async replace(tmp: string, dest: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.fs.rename(tmp, dest);
        return;
      } catch (error) {
        if (isBusy(error) && attempt < RENAME_ATTEMPTS) continue;
        if (attempt > 1) throw error;
        await this.fs.rm(dest, { force: true });
      }
    }
  }

  async get(key: string): Promise<StoredObject | null> {
    const dataPath = this.resolveDataPath(key);
    if (this.layout === 'tree') {
      try {
        const bytes = new Uint8Array(await this.fs.readFile(dataPath));
        return {
          body: bytesStream(bytes),
          contentType: guessContentType(key),
          size: bytes.byteLength,
        };
      } catch {
        return null;
      }
    }
    const metaPath = `${dataPath}${META_SUFFIX}`;
    try {
      const [raw, metaRaw] = await Promise.all([
        this.fs.readFile(dataPath),
        this.fs.readFile(metaPath, 'utf8'),
      ]);
      const meta = JSON.parse(metaRaw) as Meta;
      const bytes = new Uint8Array(raw);
      return {
        body: bytesStream(bytes),
        contentType: meta.contentType,
        size: bytes.byteLength,
      };
    } catch {
      return null;
    }
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const dataPath = this.resolveDataPath(key);
    await this.writeFileAtomic(dataPath, bytes);
    if (this.layout === 'sidecar') {
      const meta: Meta = { contentType };
      await this.writeFileAtomic(
        `${dataPath}${META_SUFFIX}`,
        JSON.stringify(meta)
      );
    }
  }

  async head(key: string): Promise<boolean> {
    const dataPath = this.resolveDataPath(key);
    try {
      await this.fs.stat(dataPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const dataPath = this.resolveDataPath(key);
    await this.fs.rm(dataPath, { force: true });
    if (this.layout === 'sidecar') {
      await this.fs.rm(`${dataPath}${META_SUFFIX}`, { force: true });
    }
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    for (const key of keys) await this.delete(key);
  }

  async getUri(key: string): Promise<string | null> {
    if (!(await this.head(key))) return null;
    return pathToFileURL(this.resolveDataPath(key)).href;
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    const keys: string[] = [];
    await this.walk('', keys);
    const filtered =
      prefix.length === 0 ? keys : keys.filter((k) => k.startsWith(prefix));
    return filtered.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  private async walk(relDir: string, out: string[]): Promise<void> {
    const abs =
      relDir.length === 0 ? this.rootDir : resolve(this.rootDir, relDir);
    let entries;
    try {
      entries = await this.fs.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (this.skipDirNames.has(name)) continue;
      const childRel = relDir.length === 0 ? name : `${relDir}/${name}`;
      if (entry.isDirectory()) {
        await this.walk(childRel, out);
        continue;
      }
      if (!entry.isFile()) continue;
      if (this.layout === 'sidecar' && name.endsWith(META_SUFFIX)) continue;
      out.push(childRel);
    }
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

export function createNodeFsObjectStore(
  options: NodeFsObjectStoreOptions
): ObjectStore {
  return new ObjectStoreImplNodeFs(options);
}
