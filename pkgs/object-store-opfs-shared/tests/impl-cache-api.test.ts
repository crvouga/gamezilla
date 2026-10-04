import { describe, expect, test } from 'bun:test';
import type {
  CacheLike,
  CacheStorageLike,
} from '@pkgs/object-store-opfs-shared/impl-cache-api';
import { createCacheApiObjectStore } from '@pkgs/object-store-opfs-shared/impl-cache-api';
import { runObjectStoreContractTests } from '@pkgs/object-store-root-shared/object-store-contract';

/** Minimal in-memory Cache API (keyed by request URL). */
function createMemoryCacheStorage(): CacheStorageLike & {
  readonly opened: string[];
} {
  const opened: string[] = [];
  const caches = new Map<string, Map<string, Response>>();
  function makeCache(entries: Map<string, Response>): CacheLike {
    return {
      match(request) {
        return Promise.resolve(entries.get(request.url)?.clone());
      },
      put(request, response) {
        entries.set(request.url, response);
        return Promise.resolve();
      },
      delete(request) {
        return Promise.resolve(entries.delete(request.url));
      },
      keys() {
        return Promise.resolve([...entries.keys()].map((u) => new Request(u)));
      },
    };
  }
  return {
    opened,
    open(name) {
      opened.push(name);
      let entries = caches.get(name);
      if (entries === undefined) {
        entries = new Map();
        caches.set(name, entries);
      }
      return Promise.resolve(makeCache(entries));
    },
  };
}

describe('ObjectStore — ObjectStoreImplCacheApi (port suite)', () => {
  runObjectStoreContractTests(() =>
    createCacheApiObjectStore({
      baseDir: 'cache-test',
      caches: createMemoryCacheStorage(),
    })
  );
});

describe('ObjectStoreImplCacheApi', () => {
  test('opens one named cache per baseDir, lazily', async () => {
    const caches = createMemoryCacheStorage();
    const store = createCacheApiObjectStore({ baseDir: 'thumbs', caches });
    expect(caches.opened).toEqual([]);
    await store.head('a');
    await store.head('b');
    expect(caches.opened).toEqual(['object-store:thumbs']);
  });

  test('listKeys ignores entries from other baseDirs', async () => {
    const caches = createMemoryCacheStorage();
    const one = createCacheApiObjectStore({ baseDir: 'one', caches });
    const two = createCacheApiObjectStore({ baseDir: 'two', caches });
    await one.put('x/y', new Uint8Array([1]), 'text/plain');
    await two.put('z', new Uint8Array([2]), 'text/plain');
    expect([...(await one.listKeys())]).toEqual(['x/y']);
    expect([...(await two.listKeys())]).toEqual(['z']);
  });
});
