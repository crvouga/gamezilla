import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword/keyword';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';

import { HistoryStore } from './history-store';

describe('HistoryStore', () => {
  test('round-trips ids through in-memory Kv', async () => {
    const kv = new KvImplInMemory();
    const key = asKeyword('ui.prefs/command-history');
    const store = new HistoryStore({ kv, storageKey: key, limit: 3 });
    await store.hydrate();
    store.touch('a');
    store.touch('b');
    store.touch('c');
    store.touch('a');
    expect(store.getIds()).toEqual(['a', 'c', 'b']);

    const again = new HistoryStore({ kv, storageKey: key, limit: 3 });
    await again.hydrate();
    expect(again.getIds()).toEqual(['a', 'c', 'b']);
  });

  test('works without kv', async () => {
    const store = new HistoryStore({ limit: 2 });
    await store.hydrate();
    store.touch('x');
    store.touch('y');
    store.touch('z');
    expect(store.getIds()).toEqual(['z', 'y']);
  });
});
