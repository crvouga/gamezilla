/**
 * Hierarchical local-first {@link ObjectStore} over the browser Origin
 * Private File System.
 *
 * Keys may include `/` (nested directories). Bytes live in
 * `<root>/<baseDir>/<key>.bin` with a `<key>.meta` JSON sidecar carrying the
 * content type. The OPFS root is injected ({@link OpfsRootProvider}) so the
 * store is testable against {@link ./memory-opfs.ts createMemoryOpfsRoot()}.
 */

import { readBytes } from '@pkgs/object-store-shared/helpers';
import { ObjectStoreWithPrefix } from '@pkgs/object-store-shared/impl-with-prefix';
import type { ObjectStore, StoredObject } from '@pkgs/object-store-shared/interface';
import { assertBaseDir, sortKeys, splitKey } from './key-parts';
import type { KeyParts } from './key-parts';
import { isNotFoundError } from './opfs';
import type { OpfsDirHandle, OpfsRootProvider } from './opfs';
import {
  bytesStream,
  parseMetaText,
  readOpfsBytes,
  removeOpfsIfExists,
  toArrayBuffer,
  tryGetOpfsFile,
  walkOpfsKeys,
  writeOpfs,
} from './opfs-helpers';

const LABEL = 'ObjectStoreImplOpfs';
const SUFFIXES = { meta: '.meta', bin: '.bin' } as const;

export type ObjectStoreImplOpfsOptions = {
  /** Single path segment under the OPFS root. */
  readonly baseDir: string;
  /** Injected root — composition roots pass `navigator.storage.getDirectory`. */
  readonly getRoot: OpfsRootProvider;
};

export class ObjectStoreImplOpfs implements ObjectStore {
  private readonly baseDir: string;
  private readonly getRoot: OpfsRootProvider;
  private basePromise: Promise<OpfsDirHandle> | null = null;

  constructor(options: ObjectStoreImplOpfsOptions) {
    assertBaseDir(options.baseDir, LABEL);
    this.baseDir = options.baseDir;
    this.getRoot = options.getRoot;
  }

  private ensureBase(): Promise<OpfsDirHandle> {
    if (this.basePromise === null) {
      this.basePromise = (async () => {
        const root = await this.getRoot();
        return root.getDirectoryHandle(this.baseDir, { create: true });
      })();
    }
    return this.basePromise;
  }

  private async resolveDir(
    parentSegments: readonly string[],
    create: boolean
  ): Promise<OpfsDirHandle | null> {
    let dir = await this.ensureBase();
    for (const seg of parentSegments) {
      try {
        dir = await dir.getDirectoryHandle(seg, { create });
      } catch (err) {
        if (!create && isNotFoundError(err)) return null;
        throw err;
      }
    }
    return dir;
  }

  private async resolveExistingDir(
    key: string
  ): Promise<{ dir: OpfsDirHandle; parts: KeyParts } | null> {
    const parts = splitKey(key, LABEL);
    const dir = await this.resolveDir(parts.parentSegments, false);
    return dir === null ? null : { dir, parts };
  }

  async get(key: string): Promise<StoredObject | null> {
    const located = await this.resolveExistingDir(key);
    if (located === null) return null;
    const { dir, parts } = located;
    const bytes = await readOpfsBytes(dir, `${parts.fileBase}${SUFFIXES.bin}`);
    if (bytes === null) return null;
    const metaBytes = await readOpfsBytes(
      dir,
      `${parts.fileBase}${SUFFIXES.meta}`
    );
    const contentType =
      metaBytes === null
        ? 'application/octet-stream'
        : parseMetaText(new TextDecoder().decode(metaBytes)).contentType;
    return { body: bytesStream(bytes), contentType, size: bytes.byteLength };
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const parts = splitKey(key, LABEL);
    const dir = await this.resolveDir(parts.parentSegments, true);
    if (dir === null) throw new Error(`${LABEL}: failed to create OPFS path`);
    await writeOpfs(dir, `${parts.fileBase}${SUFFIXES.bin}`, bytes);
    const metaBytes = new TextEncoder().encode(JSON.stringify({ contentType }));
    await writeOpfs(dir, `${parts.fileBase}${SUFFIXES.meta}`, metaBytes);
  }

  async head(key: string): Promise<boolean> {
    const located = await this.resolveExistingDir(key);
    if (located === null) return false;
    const { dir, parts } = located;
    return (
      (await tryGetOpfsFile(dir, `${parts.fileBase}${SUFFIXES.bin}`)) !== null
    );
  }

  async delete(key: string): Promise<void> {
    const located = await this.resolveExistingDir(key);
    if (located === null) return;
    const { dir, parts } = located;
    await removeOpfsIfExists(dir, `${parts.fileBase}${SUFFIXES.bin}`);
    await removeOpfsIfExists(dir, `${parts.fileBase}${SUFFIXES.meta}`);
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    for (const key of keys) await this.delete(key);
  }

  async getUri(key: string): Promise<string | null> {
    const stored = await this.get(key);
    if (stored === null) return null;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function')
      return null;
    const bytes = await readBytes(stored.body);
    return URL.createObjectURL(
      new Blob([toArrayBuffer(bytes)], { type: stored.contentType })
    );
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    const root = await this.ensureBase();
    return sortKeys(await walkOpfsKeys(root, '', SUFFIXES), prefix);
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

export function createOpfsObjectStore(
  options: ObjectStoreImplOpfsOptions
): ObjectStore {
  return new ObjectStoreImplOpfs(options);
}
