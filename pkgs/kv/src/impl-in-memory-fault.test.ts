import { describe, expect, test } from 'bun:test';
import { asKeyword, asKeywordRecord } from '@pkgs/keyword/keyword';

import { KvImplInMemory } from './impl-in-memory';

const KEY = asKeyword('kv.fault/item');
const VALUE = asKeywordRecord({ 'kv.fault/value': 1 }, 'kv fault');

describe('KvImplInMemory faults', () => {
  test('armFault fails the next op then recovers', async () => {
    const kv = new KvImplInMemory();
    await kv.put(KEY, VALUE);
    kv.armFault(new Error('quota'));
    await expect(kv.get(KEY)).rejects.toThrow('quota');
    expect(await kv.get(KEY)).toEqual(VALUE);
  });
});
