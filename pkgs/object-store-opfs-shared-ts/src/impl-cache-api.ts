/**
 * {@link ObjectStore} over the browser Cache API — fallback for browsers
 * without OPFS (or contexts where `navigator.storage.getDirectory` throws).
 * Objects are stored as synthetic `Response`s under a private origin so they
 * never collide with real network cache entries.
 */

import { readBytes } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreWithPrefix } from '@pkgs/object-store-root-shared-ts/impl-with-prefix';
import type {
  ObjectStore,
  StoredObject,
} from '@pkgs/object-store-root-shared-ts/interface';
import { assertBaseDir, sortKeys, splitKey } from './key-parts';
import { bytesStream, toArrayBuffer } from './opfs-helpers';

const LABEL = 'ObjectStoreImplCacheApi';
const CACHE_ORIGIN = 'https://object-store.local';

/** Structural subset of the DOM `Cache` used here (testable without a browser). */
export type CacheLike = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
  keys(): Promise<readonly Request[]>;
};

export type CacheStorageLike = {
  open(name: string): Promise<CacheLike>;
};

export type ObjectStoreImplCacheApiOptions = {
  readonly baseDir: string;
  /** Injected — composition roots pass `globalThis.caches`. */
  readonly caches: CacheStorageLike;
};

export class ObjectStoreImplCacheApi implements ObjectStore {
  private readonly baseDir: string;
  private readonly caches: CacheStorageLike;
  private cachePromise: Promise<CacheLike> | null = null;

  constructor(options: ObjectStoreImplCacheApiOptions) {
    assertBaseDir(options.baseDir, LABEL);
    this.baseDir = options.baseDir;
    this.caches = options.caches;
  }

  private openCache(): Promise<CacheLike> {
    if (this.cachePromise === null) {
      this.cachePromise = this.caches.open(`object-store:${this.baseDir}`);
    }
    return this.cachePromise;
  }

  private request(key: string): Request {
    splitKey(key, LABEL);
    return new Request(`${CACHE_ORIGIN}/${this.baseDir}/${key}`);
  }

  async get(key: string): Promise<StoredObject | null> {
    const cache = await this.openCache();
    const res = await cache.match(this.request(key));
    if (res === undefined) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType =
      res.headers.get('content-type') ?? 'application/octet-stream';
    return { body: bytesStream(bytes), contentType, size: bytes.byteLength };
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const cache = await this.openCache();
    await cache.put(
      this.request(key),
      new Response(toArrayBuffer(bytes), {
        headers: { 'content-type': contentType },
      })
    );
  }

  async head(key: string): Promise<boolean> {
    const cache = await this.openCache();
    return (await cache.match(this.request(key))) !== undefined;
  }

  async delete(key: string): Promise<void> {
    const cache = await this.openCache();
    await cache.delete(this.request(key));
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
    const cache = await this.openCache();
    const urlPrefix = `${CACHE_ORIGIN}/${this.baseDir}/`;
    const keys: string[] = [];
    for (const req of await cache.keys()) {
      if (!req.url.startsWith(urlPrefix)) continue;
      keys.push(decodeURIComponent(req.url.slice(urlPrefix.length)));
    }
    return sortKeys(keys, prefix);
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

export function createCacheApiObjectStore(
  options: ObjectStoreImplCacheApiOptions
): ObjectStore {
  return new ObjectStoreImplCacheApi(options);
}
