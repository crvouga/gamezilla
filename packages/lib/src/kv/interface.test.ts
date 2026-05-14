import { describe, expect, test } from 'bun:test';
import { asKeyword } from '../keyword/keyword';
import { KvImplInMemory } from './impl-in-memory';
import type { Kv } from './interface';

const K_MISSING = asKeyword('gamezilla.kv.contract/missing-key');
const K_ITEM = asKeyword('gamezilla.kv.contract/item');
const K_GHOST = asKeyword('gamezilla.kv.contract/ghost');
const K_ITEM_X = asKeyword('gamezilla.kv.contract/item-x');
const K_TX = asKeyword('gamezilla.kv.contract/tx-value');

export function runKvContractTests(factory: () => Kv | Promise<Kv>): void {
  test('get returns null for missing key', async () => {
    const kv = await Promise.resolve(factory());
    expect(await kv.get(K_MISSING)).toBeNull();
  });

  test('put then get returns value', async () => {
    const kv = await Promise.resolve(factory());
    await kv.put(K_ITEM, '1');
    expect(await kv.get(K_ITEM)).toBe('1');
  });

  test('put overwrites', async () => {
    const kv = await Promise.resolve(factory());
    await kv.put(K_ITEM, '1');
    await kv.put(K_ITEM, '2');
    expect(await kv.get(K_ITEM)).toBe('2');
  });

  test('zap is idempotent', async () => {
    const kv = await Promise.resolve(factory());
    await kv.zap(K_GHOST);
    await kv.put(K_ITEM_X, 'y');
    await kv.zap(K_ITEM_X);
    await kv.zap(K_ITEM_X);
    expect(await kv.get(K_ITEM_X)).toBeNull();
  });

  test('transaction isolates put', async () => {
    const kv = await Promise.resolve(factory());
    await kv.transaction(async (tx) => {
      await tx.put(K_TX, 'v');
    });
    expect(await kv.get(K_TX)).toBe('v');
  });
}

describe('KvImplInMemory (contract)', () => {
  runKvContractTests(() => new KvImplInMemory());
});
