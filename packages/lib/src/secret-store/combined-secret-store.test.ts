import { describe, expect, it } from 'bun:test';
import { CombinedSecretStore } from './combined-secret-store';
import type { SecretStore } from './interface';

type WritableMockStore = SecretStore & {
  readonly writes: ReadonlyArray<{
    readonly name: string;
    readonly value: string;
  }>;
};

function makeStore(
  values: Record<string, string | null>,
  options?: { readonly setShouldThrow?: boolean }
): WritableMockStore {
  const writes: { name: string; value: string }[] = [];
  return {
    writes,
    async getRequired(name: string) {
      const value = values[name] ?? null;
      if (value === null) {
        throw new Error(`missing: ${name}`);
      }
      return value;
    },
    async getOptional(name: string) {
      return values[name] ?? null;
    },
    async getRequiredMany(names: readonly string[]) {
      const out: Record<string, string> = {};
      for (const name of names) {
        const value = values[name] ?? null;
        if (value === null) {
          throw new Error(`missing: ${name}`);
        }
        out[name] = value;
      }
      return out;
    },
    async setSecret(name: string, value: string) {
      if (options?.setShouldThrow === true) {
        throw new Error(`setSecret not supported on this store: ${name}`);
      }
      values[name] = value;
      writes.push({ name, value });
    },
  };
}

describe('CombinedSecretStore', () => {
  it('prefers primary over fallback', async () => {
    const store = new CombinedSecretStore(
      makeStore({ A: 'primary-a' }),
      makeStore({ A: 'fallback-a' })
    );
    await expect(store.getRequired('A')).resolves.toBe('primary-a');
  });

  it('uses fallback when primary has no value', async () => {
    const store = new CombinedSecretStore(
      makeStore({ A: null }),
      makeStore({ A: 'fallback-a' })
    );
    await expect(store.getRequired('A')).resolves.toBe('fallback-a');
  });

  it('throws when missing in both stores', async () => {
    const store = new CombinedSecretStore(
      makeStore({ A: null }),
      makeStore({ A: null })
    );
    await expect(store.getRequired('A')).rejects.toThrow(
      'Secret "A" is missing'
    );
  });

  it('combines requiredMany with same precedence', async () => {
    const store = new CombinedSecretStore(
      makeStore({ A: 'a1', B: null }),
      makeStore({ A: 'a2', B: 'b2' })
    );
    await expect(store.getRequiredMany(['A', 'B'])).resolves.toEqual({
      A: 'a1',
      B: 'b2',
    });
  });

  it('setSecret writes only to primary', async () => {
    const primary = makeStore({});
    const fallback = makeStore({});
    const store = new CombinedSecretStore(primary, fallback);

    await store.setSecret('A', 'v');

    expect(primary.writes).toEqual([{ name: 'A', value: 'v' }]);
    expect(fallback.writes).toEqual([]);
  });

  it('setSecret propagates errors from primary (does not fall back)', async () => {
    const primary = makeStore({}, { setShouldThrow: true });
    const fallback = makeStore({});
    const store = new CombinedSecretStore(primary, fallback);

    await expect(store.setSecret('A', 'v')).rejects.toThrow();
    expect(fallback.writes).toEqual([]);
  });
});
