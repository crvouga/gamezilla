import { describe, expect, test } from 'bun:test';

import { ObjectStoreImplInMemory } from './impl-in-memory';

describe('ObjectStoreImplInMemory faults', () => {
  test('armFault fails the next op then recovers', async () => {
    const store = new ObjectStoreImplInMemory();
    await store.put('k', new Uint8Array([1]), 'application/octet-stream');
    store.armFault(new Error('s3-down'));
    await expect(store.get('k')).rejects.toThrow('s3-down');
    const hit = await store.get('k');
    expect(hit).not.toBeNull();
  });
});
