import { describe, expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

import { createEmptyNotebook } from './notebook-doc';
import { createNotebookStore } from './notebook-store';

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
