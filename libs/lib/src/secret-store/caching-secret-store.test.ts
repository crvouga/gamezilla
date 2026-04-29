import { describe, expect, it } from 'bun:test';
import { CachingSecretStore } from './caching-secret-store';
import type { SecretStore } from './interface';

type CountingStore = SecretStore & {
  readonly counts: { g: number; o: number; m: number; s: number };
  readonly writes: ReadonlyArray<{ readonly name: string; readonly value: string }>;
};

function createCountingStore(): CountingStore {
  const counts = { g: 0, o: 0, m: 0, s: 0 };
  const writes: { name: string; value: string }[] = [];
  return {
    counts,
    writes,
    async getRequired(name: string) {
      counts.g += 1;
      return `${name}-v`;
    },
    async getOptional(name: string) {
      counts.o += 1;
      if (name === 'nil') return null;
      return `${name}-o`;
    },
    async getRequiredMany(names: readonly string[]) {
      counts.m += 1;
      return Object.fromEntries(names.map((n) => [n, `${n}-m`]));
    },
    async setSecret(name: string, value: string) {
      counts.s += 1;
      writes.push({ name, value });
    },
  };
}

describe('CachingSecretStore', () => {
  it('caches getRequired until TTL', async () => {
    let t = 0;
    const inner = createCountingStore();
    const cache = new CachingSecretStore(inner, { ttlMs: 1000, now: () => t });

    await expect(cache.getRequired('A')).resolves.toBe('A-v');
    await expect(cache.getRequired('A')).resolves.toBe('A-v');
    expect(inner.counts.g).toBe(1);

    t += 1001;
    await expect(cache.getRequired('A')).resolves.toBe('A-v');
    expect(inner.counts.g).toBe(2);
  });

  it('caches getOptional including null', async () => {
    let t = 0;
    const inner = createCountingStore();
    const cache = new CachingSecretStore(inner, { ttlMs: 1000, now: () => t });

    await expect(cache.getOptional('nil')).resolves.toBeNull();
    await expect(cache.getOptional('nil')).resolves.toBeNull();
    expect(inner.counts.o).toBe(1);
  });

  it('getRequiredMany uses cache for hits', async () => {
    let t = 0;
    const inner = createCountingStore();
    const cache = new CachingSecretStore(inner, { ttlMs: 1000, now: () => t });

    await cache.getRequired('A');
    await cache.getRequiredMany(['A', 'B']);
    expect(inner.counts.m).toBe(1);
    expect(inner.counts.g).toBe(1);
  });

  it('setSecret forwards to inner and invalidates the read cache', async () => {
    let t = 0;
    const inner = createCountingStore();
    const cache = new CachingSecretStore(inner, { ttlMs: 1000, now: () => t });

    await cache.getRequired('A');
    expect(inner.counts.g).toBe(1);

    await cache.setSecret('A', 'new-value');
    expect(inner.counts.s).toBe(1);
    expect(inner.writes).toEqual([{ name: 'A', value: 'new-value' }]);

    await cache.getRequired('A');
    expect(inner.counts.g).toBe(2);
  });
});
