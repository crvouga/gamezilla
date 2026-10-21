import { expect, test } from 'bun:test';
import { asKeyword, asKeywordRecord } from '@pkgs/keyword-shared-ts/keyword';

import type { Kv } from './interface';

const K_MISSING = asKeyword('kv.contract/missing-key');
const K_ITEM = asKeyword('kv.contract/item');
const K_GHOST = asKeyword('kv.contract/ghost');
const K_ITEM_X = asKeyword('kv.contract/item-x');
const K_TX = asKeyword('kv.contract/tx-value');

const ATTR_V1 = asKeywordRecord({ 'kv.contract/value': '1' }, 'kv contract v1');
const ATTR_V2 = asKeywordRecord({ 'kv.contract/value': '2' }, 'kv contract v2');
const ATTR_Y = asKeywordRecord({ 'kv.contract/value': 'y' }, 'kv contract y');
const ATTR_TX = asKeywordRecord(
  { 'kv.contract/tx-payload': 'v' },
  'kv contract tx'
);

/** Shared abstract suite — run against every Kv adapter (fake + real). */
export function runKvContractTests(factory: () => Kv | Promise<Kv>): void {
  test('get returns null for missing key', async () => {
    const kv = await Promise.resolve(factory());
    expect(await kv.get(K_MISSING)).toBeNull();
  });

  test('put then get returns value', async () => {
    const kv = await Promise.resolve(factory());
    await kv.put(K_ITEM, ATTR_V1);
    expect(await kv.get(K_ITEM)).toEqual(ATTR_V1);
  });

  test('put overwrites', async () => {
    const kv = await Promise.resolve(factory());
    await kv.put(K_ITEM, ATTR_V1);
    await kv.put(K_ITEM, ATTR_V2);
    expect(await kv.get(K_ITEM)).toEqual(ATTR_V2);
  });

  test('zap is idempotent', async () => {
    const kv = await Promise.resolve(factory());
    await kv.zap(K_GHOST);
    await kv.put(K_ITEM_X, ATTR_Y);
    await kv.zap(K_ITEM_X);
    await kv.zap(K_ITEM_X);
    expect(await kv.get(K_ITEM_X)).toBeNull();
  });

  test('transaction isolates put', async () => {
    const kv = await Promise.resolve(factory());
    await kv.tx(async (tx) => {
      await tx.put(K_TX, ATTR_TX);
    });
    expect(await kv.get(K_TX)).toEqual(ATTR_TX);
  });
}
