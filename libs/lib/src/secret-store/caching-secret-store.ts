import type { SecretStore, SecretStoreGetInit } from './interface';

export type CachingSecretStoreOptions = {
  /** Time-to-live for successfully resolved values, in ms. */
  ttlMs: number;
  /** @default Date.now */
  now?: () => number;
};

type CacheEntry = { value: string | null; expiresAt: number };

/**
 * Wraps a {@link SecretStore}: caches successful `getRequired` / `getOptional`
 * results per key until TTL. Thrown errors are never cached.
 */
export class CachingSecretStore implements SecretStore {
  private readonly inner: SecretStore;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(inner: SecretStore, options: CachingSecretStoreOptions) {
    this.inner = inner;
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? Date.now;
  }

  /** Testing: drop all cached entries. */
  clearCacheForTests(): void {
    this.cache.clear();
  }

  private peek(name: string): string | null | undefined {
    const e = this.cache.get(name);
    if (e === undefined) {
      return undefined;
    }
    if (e.expiresAt <= this.now()) {
      this.cache.delete(name);
      return undefined;
    }
    return e.value;
  }

  private put(name: string, value: string | null): void {
    this.cache.set(name, { value, expiresAt: this.now() + this.ttlMs });
  }

  async getRequired(name: string, init?: SecretStoreGetInit): Promise<string> {
    const p = this.peek(name);
    if (p !== undefined && p !== null) {
      return p;
    }
    if (p === null) {
      this.cache.delete(name);
    }
    const value = await this.inner.getRequired(name, init);
    this.put(name, value);
    return value;
  }

  async getOptional(
    name: string,
    init?: SecretStoreGetInit
  ): Promise<string | null> {
    const p = this.peek(name);
    if (p !== undefined) {
      return p;
    }
    const value = await this.inner.getOptional(name, init);
    this.put(name, value);
    return value;
  }

  async getRequiredMany(
    names: readonly string[],
    init?: SecretStoreGetInit
  ): Promise<Record<string, string>> {
    if (names.length === 0) {
      return {};
    }
    const out: Record<string, string> = {};
    const missing: string[] = [];
    for (const name of names) {
      const p = this.peek(name);
      if (p !== undefined && p !== null) {
        out[name] = p;
      } else {
        if (p === null) {
          this.cache.delete(name);
        }
        missing.push(name);
      }
    }
    if (missing.length === 0) {
      return out;
    }
    const fetched = await this.inner.getRequiredMany(missing, init);
    const expiresAt = this.now() + this.ttlMs;
    for (const [k, v] of Object.entries(fetched)) {
      this.cache.set(k, { value: v, expiresAt });
      out[k] = v;
    }
    return out;
  }
}

export function createCachingSecretStore(
  inner: SecretStore,
  options: CachingSecretStoreOptions
): SecretStore {
  return new CachingSecretStore(inner, options);
}
