/**
 * In-memory localStorage for Node/Jest so namespaced sim client KV/auth dump/restore works.
 */

type StorageEntry = {
  readonly map: Map<string, string>;
};

const stores = new Map<string, StorageEntry>();

function storeFor(kind: 'local' | 'session'): StorageEntry {
  const key = kind;
  let entry = stores.get(key);
  if (entry === undefined) {
    entry = { map: new Map() };
    stores.set(key, entry);
  }
  return entry;
}

function makeStorage(kind: 'local' | 'session'): Storage {
  const entry = storeFor(kind);
  return {
    get length() {
      return entry.map.size;
    },
    clear() {
      entry.map.clear();
    },
    getItem(key: string) {
      return entry.map.get(key) ?? null;
    },
    key(index: number) {
      const keys = [...entry.map.keys()];
      return keys[index] ?? null;
    },
    removeItem(key: string) {
      entry.map.delete(key);
    },
    setItem(key: string, value: string) {
      entry.map.set(key, value);
    },
  };
}

let installed = false;

/** Install process-wide localStorage/sessionStorage when missing (Jest / Node sim). */
export function ensureNodeLocalStoragePolyfill(): void {
  if (installed) return;
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      enumerable: true,
      value: makeStorage('local'),
    });
  }
  if (typeof globalThis.sessionStorage === 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      enumerable: true,
      value: makeStorage('session'),
    });
  }
  installed = true;
}

/** Drop all polyfilled storage (test teardown). */
export function clearNodeLocalStoragePolyfill(): void {
  for (const entry of stores.values()) {
    entry.map.clear();
  }
}
