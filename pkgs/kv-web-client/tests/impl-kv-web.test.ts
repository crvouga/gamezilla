import { afterAll, beforeAll, beforeEach, describe } from 'bun:test';
import { runKvContractTests } from '@pkgs/kv-root-shared/kv-contract';
import { KvImplWeb } from '@pkgs/kv-web-client/impl-kv-web';

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
