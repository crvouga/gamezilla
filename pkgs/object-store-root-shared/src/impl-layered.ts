import { ObjectStoreWithPrefix } from './impl-with-prefix';
import type { ObjectStore, StoredObject } from './interface';

export type LayeredObjectStoreOptions = {
  /** Authoritative backend. Mutations complete here before touching caches. */
  readonly primary: ObjectStore;
  /** Ordered from fastest to slowest; each is an opportunistic read-through cache. */
  readonly caches: readonly ObjectStore[];
  /** Injected wall clock in milliseconds. */
  readonly now: () => number;
  /** Maximum age for cached objects and listings. */
  readonly cacheTtlMs: number;
  /** Maximum object size copied into caches. Larger objects stream from primary. */
  readonly maxCacheBytes?: number;
  /** Serve a known cached value when the authoritative backend is unavailable. */
  readonly staleOnError?: boolean;
};

type CachedObject = { readonly expiresAt: number };
type CachedListing = {
  readonly expiresAt: number;
  readonly keys: readonly string[];
};

function stored(bytes: Uint8Array, contentType: string): StoredObject {
  const copy = new Uint8Array(bytes);
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(copy);
        controller.close();
      },
    }),
    contentType,
    size: copy.byteLength,
  };
}

async function bytesOf(value: StoredObject): Promise<Uint8Array> {
  return new Uint8Array(await new Response(value.body).arrayBuffer());
}

/**
 * Compose an authoritative store with ordered read-through caches. Writes go
 * to the primary first, cache failures never turn a durable write into an
 * apparent failure, and external primary changes become visible after the
 * configured TTL. Listings come from primary and are briefly cached in memory.
 */
export class ObjectStoreImplLayered implements ObjectStore {
  private readonly objectExpiry = new Map<string, CachedObject>();
  private readonly listings = new Map<string, CachedListing>();
  private readonly maxCacheBytes: number;
  private readonly staleOnError: boolean;

  constructor(private readonly options: LayeredObjectStoreOptions) {
    if (options.cacheTtlMs <= 0) throw new Error('cacheTtlMs must be positive');
    this.maxCacheBytes = options.maxCacheBytes ?? 8 * 1024 * 1024;
    this.staleOnError = options.staleOnError ?? false;
  }

  async get(key: string): Promise<StoredObject | null> {
    const known = this.objectExpiry.get(key);
    const fresh = known !== undefined && known.expiresAt > this.options.now();
    let stale: StoredObject | null = null;
    for (const cache of this.options.caches) {
      try {
        const value = await cache.get(key);
        if (value === null) continue;
        if (fresh) return value;
        if (this.staleOnError && known !== undefined && stale === null)
          stale = value;
      } catch {
        // A failed cache lookup is a miss; primary still owns the answer.
      }
    }

    let authoritative: StoredObject | null;
    try {
      authoritative = await this.options.primary.get(key);
    } catch (error) {
      if (this.staleOnError && stale !== null) return stale;
      throw error;
    }
    if (authoritative === null) {
      await this.evict(key);
      return null;
    }
    if (authoritative.size > this.maxCacheBytes) return authoritative;

    const bytes = await bytesOf(authoritative);
    await this.fillCaches(key, bytes, authoritative.contentType);
    return stored(bytes, authoritative.contentType);
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    await this.options.primary.put(key, bytes, contentType);
    this.clearListings();
    await this.fillCaches(key, bytes, contentType);
  }

  async head(key: string): Promise<boolean> {
    const known = this.objectExpiry.get(key);
    if (known !== undefined && known.expiresAt > this.options.now()) {
      for (const cache of this.options.caches) {
        try {
          if (await cache.head(key)) return true;
        } catch {
          // Fall through to the authoritative backend.
        }
      }
    }
    try {
      const exists = await this.options.primary.head(key);
      if (!exists) await this.evict(key);
      return exists;
    } catch (error) {
      if (this.staleOnError && known !== undefined) return true;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.options.primary.delete(key);
    this.objectExpiry.delete(key);
    this.clearListings();
    await Promise.all(
      this.options.caches.map((cache) =>
        cache.delete(key).catch(() => undefined)
      )
    );
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    await this.options.primary.deleteMany(keys);
    for (const key of keys) this.objectExpiry.delete(key);
    this.clearListings();
    await Promise.all(
      this.options.caches.map((cache) =>
        cache.deleteMany(keys).catch(() => undefined)
      )
    );
  }

  async getUri(key: string): Promise<string | null> {
    const known = this.objectExpiry.get(key);
    if (known !== undefined && known.expiresAt > this.options.now()) {
      for (const cache of this.options.caches) {
        try {
          const uri = await cache.getUri(key);
          if (uri !== null) return uri;
        } catch {
          // Fall through to the authoritative backend.
        }
      }
    }
    return this.options.primary.getUri(key);
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    const known = this.listings.get(prefix);
    if (known !== undefined && known.expiresAt > this.options.now())
      return known.keys;
    try {
      const keys = await this.options.primary.listKeys(prefix);
      this.listings.set(prefix, {
        keys,
        expiresAt: this.options.now() + this.options.cacheTtlMs,
      });
      return keys;
    } catch (error) {
      if (this.staleOnError && known !== undefined) return known.keys;
      throw error;
    }
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }

  private async fillCaches(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    if (bytes.byteLength > this.maxCacheBytes) {
      this.objectExpiry.delete(key);
      return;
    }
    await Promise.all(
      this.options.caches.map((cache) =>
        cache.put(key, bytes, contentType).catch(() => undefined)
      )
    );
    this.objectExpiry.set(key, {
      expiresAt: this.options.now() + this.options.cacheTtlMs,
    });
  }

  private async evict(key: string): Promise<void> {
    this.objectExpiry.delete(key);
    await Promise.all(
      this.options.caches.map((cache) =>
        cache.delete(key).catch(() => undefined)
      )
    );
  }

  private clearListings(): void {
    this.listings.clear();
  }
}

export function createLayeredObjectStore(
  options: LayeredObjectStoreOptions
): ObjectStore {
  return new ObjectStoreImplLayered(options);
}
