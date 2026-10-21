import { expect, test } from 'bun:test';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { createLayeredObjectStore } from '@pkgs/object-store-root-shared-ts/impl-layered';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';

function instrument(inner: ObjectStore) {
  let reads = 0;
  let failReads = false;
  const store: ObjectStore = {
    get: async (key) => {
      reads += 1;
      if (failReads) throw new Error('remote unavailable');
      return inner.get(key);
    },
    put: (key, bytes, type) => inner.put(key, bytes, type),
    head: (key) => inner.head(key),
    delete: (key) => inner.delete(key),
    deleteMany: (keys) => inner.deleteMany(keys),
    getUri: (key) => inner.getUri(key),
    listKeys: (prefix) => inner.listKeys(prefix),
    withPrefix: (prefix) => inner.withPrefix(prefix),
  };
  return {
    store,
    reads: () => reads,
    failReads(value: boolean) {
      failReads = value;
    },
  };
}

test('layered store reads through local cache and refreshes it after its TTL', async () => {
  let now = 0;
  const remote = instrument(new ObjectStoreImplInMemory());
  const cache = new ObjectStoreImplInMemory();
  await writeUtf8(remote.store, 'evidence/report.json', 'first');
  const store = createLayeredObjectStore({
    primary: remote.store,
    caches: [cache],
    now: () => now,
    cacheTtlMs: 20,
  });

  expect(await readUtf8(store, 'evidence/report.json')).toBe('first');
  expect(await readUtf8(store, 'evidence/report.json')).toBe('first');
  expect(remote.reads()).toBe(1);

  await writeUtf8(remote.store, 'evidence/report.json', 'updated');
  expect(await readUtf8(store, 'evidence/report.json')).toBe('first');
  now = 21;
  expect(await readUtf8(store, 'evidence/report.json')).toBe('updated');
  expect(remote.reads()).toBe(2);
});

test('layered store writes to primary first and makes successful writes immediately readable', async () => {
  const now = 5;
  const remote = new ObjectStoreImplInMemory();
  const cache = new ObjectStoreImplInMemory();
  const store = createLayeredObjectStore({
    primary: remote,
    caches: [cache],
    now: () => now,
    cacheTtlMs: 20,
  });

  await writeUtf8(store, 'runs/latest/report.json', 'saved');
  expect(await readUtf8(cache, 'runs/latest/report.json')).toBe('saved');
  expect(await readUtf8(store, 'runs/latest/report.json')).toBe('saved');
  await store.delete('runs/latest/report.json');
  expect(await store.head('runs/latest/report.json')).toBe(false);
  expect(await cache.head('runs/latest/report.json')).toBe(false);
});

test('layered store can serve a known local report during a primary outage when enabled', async () => {
  let now = 0;
  const remote = instrument(new ObjectStoreImplInMemory());
  const store = createLayeredObjectStore({
    primary: remote.store,
    caches: [new ObjectStoreImplInMemory()],
    now: () => now,
    cacheTtlMs: 10,
    staleOnError: true,
  });
  await writeUtf8(remote.store, 'layers/current.json', 'last known report');
  expect(await readUtf8(store, 'layers/current.json')).toBe(
    'last known report'
  );
  now = 11;
  remote.failReads(true);
  expect(await readUtf8(store, 'layers/current.json')).toBe(
    'last known report'
  );
});
