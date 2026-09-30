// @io-wall-ok — IndexedDB persister for the spec reports query cache
/**
 * The reports screen's persistent cache. Frame HTML and the TanStack query
 * document live here so a revisit paints without waiting on the network.
 */

import type { ReportCache } from '@pkgs/harness-report/client';

const DB_NAME = 'gz-spec-reports';
const STORE = 'cache';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('idb open'));
  });
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = op(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('idb'));
  });
}

/** One IndexedDB database for this origin's spec reports. */
export function wallReportCache(): ReportCache {
  const db = openDb();
  return {
    async get(key) {
      const value = await run<unknown>(await db, 'readonly', (store) =>
        store.get(key)
      );
      return typeof value === 'string' ? value : null;
    },
    async set(key, value) {
      await run(await db, 'readwrite', (store) => store.put(value, key));
    },
    async remove(key) {
      await run(await db, 'readwrite', (store) => store.delete(key));
    },
  };
}
