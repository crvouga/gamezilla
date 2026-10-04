import { afterEach, describe, expect, test } from 'bun:test';
import {
  createBrowserObjectStore,
  wallCacheStorage,
  wallOpfsRoot,
} from '@pkgs/object-store-opfs-client/wall-browser-fs';
import { createMemoryOpfsRoot } from '@pkgs/object-store-opfs-shared/memory-opfs';

type MutableGlobals = { navigator?: unknown; caches?: unknown };
const g = globalThis as unknown as MutableGlobals;
const originalNavigator = g.navigator;
const originalCaches = g.caches;

afterEach(() => {
  if (originalNavigator === undefined) delete g.navigator;
  else g.navigator = originalNavigator;
  if (originalCaches === undefined) delete g.caches;
  else g.caches = originalCaches;
});

describe('wall-browser-fs', () => {
  test('prefers OPFS when navigator.storage.getDirectory exists', async () => {
    const root = createMemoryOpfsRoot();
    g.navigator = { storage: { getDirectory: () => Promise.resolve(root) } };
    g.caches = undefined;
    expect(wallOpfsRoot()).not.toBeNull();
    const store = createBrowserObjectStore({ baseDir: 'app' });
    await store.put('k', new Uint8Array([1]), 'text/plain');
    const base = await root.getDirectoryHandle('app');
    const names: string[] = [];
    for await (const name of base.keys()) names.push(name);
    expect(names.sort()).toEqual(['k.bin', 'k.meta']);
  });

  test('falls back to Cache API when OPFS is missing', async () => {
    g.navigator = { storage: {} };
    const entries = new Map<string, Response>();
    const opened: string[] = [];
    g.caches = {
      open(name: string) {
        opened.push(name);
        return Promise.resolve({
          match: (r: Request) => Promise.resolve(entries.get(r.url)?.clone()),
          put: (r: Request, res: Response) => {
            entries.set(r.url, res);
            return Promise.resolve();
          },
          delete: (r: Request) => Promise.resolve(entries.delete(r.url)),
          keys: () =>
            Promise.resolve([...entries.keys()].map((u) => new Request(u))),
        });
      },
    };
    expect(wallOpfsRoot()).toBeNull();
    expect(wallCacheStorage()).not.toBeNull();
    const store = createBrowserObjectStore({ baseDir: 'app' });
    await store.put('k', new Uint8Array([1]), 'text/plain');
    expect(opened).toEqual(['object-store:app']);
    expect(await store.head('k')).toBe(true);
  });

  test('throws when neither surface is available', () => {
    g.navigator = undefined;
    g.caches = undefined;
    expect(() => createBrowserObjectStore({ baseDir: 'app' })).toThrow(
      'neither OPFS nor Cache API'
    );
  });
});
