import { describe, expect, test } from 'bun:test';
import { createOpfsObjectStore } from '@pkgs/object-store-opfs-shared/impl-opfs';
import { createMemoryOpfsRoot } from '@pkgs/object-store-opfs-shared/memory-opfs';
import { readBytes } from '@pkgs/object-store-shared/helpers';
import { runObjectStoreContractTests } from '@pkgs/object-store-shared/object-store-contract';

describe('ObjectStore — ObjectStoreImplOpfs (port suite)', () => {
  runObjectStoreContractTests(() =>
    createOpfsObjectStore({
      baseDir: 'opfs-test',
      getRoot: () => Promise.resolve(createMemoryOpfsRoot()),
    })
  );
});

describe('ObjectStoreImplOpfs', () => {
  test('nested keys live in nested directories under baseDir', async () => {
    const root = createMemoryOpfsRoot();
    const store = createOpfsObjectStore({
      baseDir: 'snapshots',
      getRoot: () => Promise.resolve(root),
    });
    await store.put(
      'a/b/c.json',
      new TextEncoder().encode('{}'),
      'application/json'
    );

    const base = await root.getDirectoryHandle('snapshots');
    const a = await base.getDirectoryHandle('a');
    const b = await a.getDirectoryHandle('b');
    const names: string[] = [];
    for await (const name of b.keys()) names.push(name);
    expect(names.sort()).toEqual(['c.json.bin', 'c.json.meta']);

    const stored = await store.get('a/b/c.json');
    expect(stored?.contentType).toBe('application/json');
    expect(new TextDecoder().decode(await readBytes(stored!.body))).toBe('{}');
    expect([...(await store.listKeys('a/'))]).toEqual(['a/b/c.json']);
  });

  test('two stores with different baseDir do not see each other', async () => {
    const root = createMemoryOpfsRoot();
    const getRoot = () => Promise.resolve(root);
    const one = createOpfsObjectStore({ baseDir: 'one', getRoot });
    const two = createOpfsObjectStore({ baseDir: 'two', getRoot });
    await one.put('k', new Uint8Array([1]), 'text/plain');
    expect(await two.head('k')).toBe(false);
    expect([...(await two.listKeys())]).toEqual([]);
  });

  test('rejects multi-segment baseDir', () => {
    expect(() =>
      createOpfsObjectStore({
        baseDir: 'a/b',
        getRoot: () => Promise.resolve(createMemoryOpfsRoot()),
      })
    ).toThrow('single path segment');
  });

  test('missing .meta sidecar falls back to octet-stream', async () => {
    const root = createMemoryOpfsRoot();
    const store = createOpfsObjectStore({
      baseDir: 'x',
      getRoot: () => Promise.resolve(root),
    });
    await store.put('k', new Uint8Array([7]), 'text/plain');
    const base = await root.getDirectoryHandle('x');
    await base.removeEntry('k.meta');
    const stored = await store.get('k');
    expect(stored?.contentType).toBe('application/octet-stream');
    expect(stored?.size).toBe(1);
  });
});
