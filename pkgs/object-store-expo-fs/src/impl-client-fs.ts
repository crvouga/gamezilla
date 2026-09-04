/**
 * Hierarchical local-first {@link ObjectStore} for browser / Expo clients.
 *
 * Keys may include `/` (nested directories). On web, bytes live in OPFS under
 * `baseDir/` (Cache API fallback when OPFS is unavailable). On native, bytes
 * live under `document/<baseDir>/…` with `.meta` content-type sidecars.
 *
 * Distinct from {@link ./impl-expo-file-system.ts ObjectStoreImplExpoFileSystem},
 * which only allows flat TTS-style keys.
 */

import { ObjectStoreWithPrefix } from '@pkgs/object-store/impl-with-prefix';
import type { ObjectStore, StoredObject } from '@pkgs/object-store/interface';
import { assertLogicalObjectKey } from '@pkgs/object-store/namespace-guard';
import type { ExpoFs, ExpoFsDirectory, ExpoFsOpfsDirHandle } from './expo-fs';
import {
  bytesStream,
  parseMetaText,
  readAllBytes,
  removeOpfsIfExists,
  tryGetOpfsFile,
  walkOpfsKeys,
  writeOpfs,
} from './impl-client-fs-helpers';

const META_SUFFIX = '.meta';
const BIN_SUFFIX = '.bin';
const CACHE_ORIGIN = 'https://object-store.local';

export type ObjectStoreImplClientFsOptions = {
  /** Sub-directory under document (native) or OPFS / Cache root (web). */
  readonly baseDir: string;
  /** Injected Expo / OPFS surface — composition roots pass {@link ./wall-expo-fs.ts wallExpoFs()}. */
  readonly expoFs: ExpoFs;
};

type KeyParts = {
  readonly parentSegments: readonly string[];
  readonly fileBase: string;
};

function splitKey(key: string): KeyParts {
  assertLogicalObjectKey(key);
  const segments = key.split('/');
  const fileBase = segments[segments.length - 1];
  if (fileBase === undefined || fileBase.length === 0) {
    throw new Error(`ObjectStoreImplClientFs: invalid key: ${key}`);
  }
  for (const seg of segments) {
    if (seg.length === 0) {
      throw new Error(`ObjectStoreImplClientFs: empty path segment in: ${key}`);
    }
  }
  return {
    parentSegments: segments.slice(0, -1),
    fileBase,
  };
}

export class ObjectStoreImplClientFs implements ObjectStore {
  private readonly baseDir: string;
  private readonly expoFs: ExpoFs;
  private opfsBasePromise: Promise<ExpoFsOpfsDirHandle> | null = null;
  private useCacheApi: boolean | null = null;
  private cachePromise: Promise<Cache> | null = null;

  constructor(options: ObjectStoreImplClientFsOptions) {
    if (options.baseDir.length === 0) {
      throw new Error('ObjectStoreImplClientFs: baseDir must be non-empty');
    }
    if (options.baseDir.includes('/') || options.baseDir.includes('..')) {
      throw new Error(
        'ObjectStoreImplClientFs: baseDir must be a single path segment'
      );
    }
    this.baseDir = options.baseDir;
    this.expoFs = options.expoFs;
  }

  private isWeb(): boolean {
    return this.expoFs.platformOs === 'web';
  }

  private nativeDir(...segments: string[]): ExpoFsDirectory {
    return this.expoFs.createDirectory(
      this.expoFs.paths.document,
      this.baseDir,
      ...segments
    );
  }

  private ensureNativeDir(...segments: string[]): ExpoFsDirectory {
    const dir = this.nativeDir(...segments);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    return dir;
  }

  private async preferCacheApi(): Promise<boolean> {
    if (this.useCacheApi !== null) return this.useCacheApi;
    try {
      await this.expoFs.getOpfsRoot();
      this.useCacheApi = false;
    } catch {
      const cachesApi = (
        globalThis as unknown as {
          caches?: { open(name: string): Promise<Cache> };
        }
      ).caches;
      if (cachesApi === undefined || typeof cachesApi.open !== 'function') {
        throw new Error(
          'ObjectStoreImplClientFs: neither OPFS nor Cache API available'
        );
      }
      this.useCacheApi = true;
    }
    return this.useCacheApi;
  }

  private async openCache(): Promise<Cache> {
    if (this.cachePromise === null) {
      const cachesApi = (
        globalThis as unknown as {
          caches: { open(name: string): Promise<Cache> };
        }
      ).caches;
      this.cachePromise = cachesApi.open(`object-store:${this.baseDir}`);
    }
    return this.cachePromise;
  }

  private cacheRequest(key: string): Request {
    return new Request(`${CACHE_ORIGIN}/${this.baseDir}/${key}`);
  }

  private async ensureOpfsBase(): Promise<ExpoFsOpfsDirHandle> {
    if (this.opfsBasePromise === null) {
      this.opfsBasePromise = (async () => {
        const root = await this.expoFs.getOpfsRoot();
        return root.getDirectoryHandle(this.baseDir, { create: true });
      })();
    }
    return this.opfsBasePromise;
  }

  private async resolveOpfsDir(
    parentSegments: readonly string[],
    create: boolean
  ): Promise<ExpoFsOpfsDirHandle | null> {
    let dir = await this.ensureOpfsBase();
    for (const seg of parentSegments) {
      try {
        dir = await dir.getDirectoryHandle(seg, { create });
      } catch (err) {
        if (!create && err instanceof Error && err.name === 'NotFoundError') {
          return null;
        }
        throw err;
      }
    }
    return dir;
  }

  async get(key: string): Promise<StoredObject | null> {
    const parts = splitKey(key);
    if (this.isWeb()) {
      if (await this.preferCacheApi()) return this.getCache(key);
      return this.getOpfs(parts);
    }
    return this.getNative(parts);
  }

  private getNative(parts: KeyParts): StoredObject | null {
    const dir = this.nativeDir(...parts.parentSegments);
    if (!dir.exists) return null;
    const metaFile = this.expoFs.createFile(
      dir,
      `${parts.fileBase}${META_SUFFIX}`
    );
    if (!metaFile.exists) return null;
    const meta = parseMetaText(metaFile.textSync());
    const bodyFile = this.expoFs.createFile(
      dir,
      `${parts.fileBase}${BIN_SUFFIX}`
    );
    if (!bodyFile.exists) return null;
    const bytes = bodyFile.bytesSync();
    return {
      body: bytesStream(bytes),
      contentType: meta.contentType,
      size: bytes.byteLength,
    };
  }

  private async getOpfs(parts: KeyParts): Promise<StoredObject | null> {
    const dir = await this.resolveOpfsDir(parts.parentSegments, false);
    if (dir === null) return null;
    const handle = await tryGetOpfsFile(dir, `${parts.fileBase}${BIN_SUFFIX}`);
    if (handle === null) return null;
    const file = await handle.getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const metaHandle = await tryGetOpfsFile(
      dir,
      `${parts.fileBase}${META_SUFFIX}`
    );
    let contentType = 'application/octet-stream';
    if (metaHandle !== null) {
      const metaFile = await metaHandle.getFile();
      contentType = parseMetaText(
        new TextDecoder().decode(new Uint8Array(await metaFile.arrayBuffer()))
      ).contentType;
    }
    return { body: bytesStream(bytes), contentType, size: bytes.byteLength };
  }

  private async getCache(key: string): Promise<StoredObject | null> {
    const cache = await this.openCache();
    const res = await cache.match(this.cacheRequest(key));
    if (res === undefined) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType =
      res.headers.get('content-type') ?? 'application/octet-stream';
    return {
      body: bytesStream(bytes),
      contentType,
      size: bytes.byteLength,
    };
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const parts = splitKey(key);
    if (this.isWeb()) {
      if (await this.preferCacheApi()) {
        await this.putCache(key, bytes, contentType);
        return;
      }
      await this.putOpfs(parts, bytes, contentType);
      return;
    }
    this.putNative(parts, bytes, contentType);
  }

  private putNative(
    parts: KeyParts,
    bytes: Uint8Array,
    contentType: string
  ): void {
    const dir = this.ensureNativeDir(...parts.parentSegments);
    const bodyFile = this.expoFs.createFile(
      dir,
      `${parts.fileBase}${BIN_SUFFIX}`
    );
    if (bodyFile.exists) bodyFile.delete();
    bodyFile.create();
    bodyFile.write(bytes);
    const metaFile = this.expoFs.createFile(
      dir,
      `${parts.fileBase}${META_SUFFIX}`
    );
    if (metaFile.exists) metaFile.delete();
    metaFile.create();
    metaFile.write(JSON.stringify({ contentType }));
  }

  private async putOpfs(
    parts: KeyParts,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const dir = await this.resolveOpfsDir(parts.parentSegments, true);
    if (dir === null) {
      throw new Error('ObjectStoreImplClientFs: failed to create OPFS path');
    }
    await writeOpfs(dir, `${parts.fileBase}${BIN_SUFFIX}`, bytes);
    const metaBytes = new TextEncoder().encode(JSON.stringify({ contentType }));
    await writeOpfs(dir, `${parts.fileBase}${META_SUFFIX}`, metaBytes);
  }

  private async putCache(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const cache = await this.openCache();
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    await cache.put(
      this.cacheRequest(key),
      new Response(ab, { headers: { 'content-type': contentType } })
    );
  }

  async head(key: string): Promise<boolean> {
    const parts = splitKey(key);
    if (this.isWeb()) {
      if (await this.preferCacheApi()) {
        const cache = await this.openCache();
        return (await cache.match(this.cacheRequest(key))) !== undefined;
      }
      const dir = await this.resolveOpfsDir(parts.parentSegments, false);
      if (dir === null) return false;
      return (
        (await tryGetOpfsFile(dir, `${parts.fileBase}${BIN_SUFFIX}`)) !== null
      );
    }
    const dir = this.nativeDir(...parts.parentSegments);
    if (!dir.exists) return false;
    return this.expoFs.createFile(dir, `${parts.fileBase}${BIN_SUFFIX}`).exists;
  }

  async delete(key: string): Promise<void> {
    const parts = splitKey(key);
    if (this.isWeb()) {
      if (await this.preferCacheApi()) {
        const cache = await this.openCache();
        await cache.delete(this.cacheRequest(key));
        return;
      }
      const dir = await this.resolveOpfsDir(parts.parentSegments, false);
      if (dir === null) return;
      await removeOpfsIfExists(dir, `${parts.fileBase}${BIN_SUFFIX}`);
      await removeOpfsIfExists(dir, `${parts.fileBase}${META_SUFFIX}`);
      return;
    }
    const dir = this.nativeDir(...parts.parentSegments);
    if (!dir.exists) return;
    const body = this.expoFs.createFile(dir, `${parts.fileBase}${BIN_SUFFIX}`);
    if (body.exists) body.delete();
    const meta = this.expoFs.createFile(dir, `${parts.fileBase}${META_SUFFIX}`);
    if (meta.exists) meta.delete();
  }

  async getUri(key: string): Promise<string | null> {
    const stored = await this.get(key);
    if (stored === null) return null;
    if (!this.isWeb()) {
      const parts = splitKey(key);
      const dir = this.nativeDir(...parts.parentSegments);
      const file = this.expoFs.createFile(
        dir,
        `${parts.fileBase}${BIN_SUFFIX}`
      );
      if (!file.exists) return null;
      return file.uri;
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function')
      return null;
    const bytes = await readAllBytes(stored.body);
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    return URL.createObjectURL(new Blob([ab], { type: stored.contentType }));
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    const keys = this.isWeb()
      ? (await this.preferCacheApi())
        ? await this.listKeysCache()
        : await this.listKeysOpfs()
      : this.listKeysNative();
    const filtered =
      prefix.length === 0 ? keys : keys.filter((k) => k.startsWith(prefix));
    return filtered.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  private listKeysNative(): string[] {
    const root = this.nativeDir();
    if (!root.exists || typeof root.list !== 'function') return [];
    return this.walkNative(root, '');
  }

  private walkNative(dir: ExpoFsDirectory, relDir: string): string[] {
    const keys: string[] = [];
    for (const entry of dir.list?.() ?? []) {
      if (entry.name.length === 0 || entry.name.endsWith(META_SUFFIX)) continue;
      const childRel =
        relDir.length === 0 ? entry.name : `${relDir}/${entry.name}`;
      if (entry.kind === 'directory') {
        keys.push(
          ...this.walkNative(this.nativeDir(...childRel.split('/')), childRel)
        );
        continue;
      }
      if (!entry.name.endsWith(BIN_SUFFIX)) continue;
      const base = entry.name.slice(0, -BIN_SUFFIX.length);
      keys.push(relDir.length === 0 ? base : `${relDir}/${base}`);
    }
    return keys;
  }

  private async listKeysOpfs(): Promise<string[]> {
    const root = await this.ensureOpfsBase();
    return walkOpfsKeys(root, '', META_SUFFIX, BIN_SUFFIX);
  }

  private async listKeysCache(): Promise<string[]> {
    const cache = await this.openCache();
    const prefix = `${CACHE_ORIGIN}/${this.baseDir}/`;
    const keys: string[] = [];
    for (const req of await cache.keys()) {
      const url = typeof req === 'string' ? req : req.url;
      if (!url.startsWith(prefix)) continue;
      keys.push(decodeURIComponent(url.slice(prefix.length)));
    }
    return keys;
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

export function createClientFsObjectStore(
  options: ObjectStoreImplClientFsOptions
): ObjectStore {
  return new ObjectStoreImplClientFs(options);
}
