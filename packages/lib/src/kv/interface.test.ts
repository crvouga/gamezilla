import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { assert } from '../assert';
import { asKeyword, asKeywordRecord } from '../keyword/keyword';
import { parseKvRecordFromUnknown } from './assert-kv-record';
import { KvImplInMemory } from './impl-in-memory';
import { KvImplWeb } from './impl-kv-web';
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

describe('KvImplInMemory (contract)', () => {
  runKvContractTests(() => new KvImplInMemory());
});

describe('parseKvRecordFromUnknown', () => {
  test('parses JSON string with keyword keys into KvRecord', () => {
    const r = parseKvRecordFromUnknown(
      assert,
      '{"kv.contract/value":"1"}',
      'parseKvRecordFromUnknown test'
    );
    expect(r[asKeyword('kv.contract/value')]).toBe('1');
  });
});

function createLocalStoragePolyfill(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  } as unknown as Storage;
}

describe('KvImplWeb (contract)', () => {
  let removedPolyfill = false;

  beforeAll(() => {
    if (typeof globalThis.localStorage === 'undefined') {
      Object.defineProperty(globalThis, 'localStorage', {
        value: createLocalStoragePolyfill(),
        configurable: true,
        writable: true,
      });
      removedPolyfill = true;
    }
  });

  afterAll(() => {
    if (removedPolyfill) {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  runKvContractTests(() => new KvImplWeb());
});
