import { describe, expect, test } from 'bun:test';
import { createEmptyNotebook } from '@pkgs/harness-console-client/notebook-doc';
import { createNotebookStore } from '@pkgs/harness-console-client/notebook-store';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';

describe('notebook-store', () => {
  test('load save clear', async () => {
    const store = createNotebookStore(new ObjectStoreImplInMemory());
    expect(await store.load('alice')).toBeNull();
    const doc = createEmptyNotebook({
      nodeId: 'alice',
      cellId: 'c1',
      starterSql: 'SELECT 1',
    });
    await store.save(doc);
    expect(await store.load('alice')).toEqual(doc);
    await store.clear('alice');
    expect(await store.load('alice')).toBeNull();
  });
});
