import { describe, expect, it } from 'bun:test';
import { CachingSecretStore } from './caching-secret-store';
import type { SecretStore } from './interface';

function createCountingStore(): SecretStore & { counts: { g: number; o: number; m: number } } {
  const counts = { g: 0, o: 0, m: 0 };
  return {
    counts,
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
});
