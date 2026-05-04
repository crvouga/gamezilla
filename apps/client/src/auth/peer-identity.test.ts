import { describe, expect, test } from 'bun:test';

import { removeLegacyPeerSeedIfPresent } from './peer-identity';

describe('peer-identity', () => {
  test('removeLegacyPeerSeedIfPresent deletes legacy key', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        store.set(k, v);
      },
      deleteItem: async (k: string) => {
        store.delete(k);
      },
    };
    await storage.setItem('peer.seed.v1', 'x');
    await removeLegacyPeerSeedIfPresent(storage);
    expect(await storage.getItem('peer.seed.v1')).toBeNull();
  });
});
