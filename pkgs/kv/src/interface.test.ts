import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { assert } from '@pkgs/assert';
import { asKeyword } from '@pkgs/keyword/keyword';
import { parseKvRecordFromUnknown } from './assert-kv-record';
import { KvImplInMemory } from './impl-in-memory';
import { KvImplWeb } from './impl-kv-web';
import { runKvContractTests } from './kv-contract';

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

/** Fake-tier port suite (in-memory + web polyfill). Real Postgres: *.contract.test.ts */
describe('KvImplInMemory (port suite)', () => {
  runKvContractTests(() => new KvImplInMemory());
});

describe('KvImplWeb (port suite)', () => {
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
