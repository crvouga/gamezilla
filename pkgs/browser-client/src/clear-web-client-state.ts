/**
 * Best-effort reset of web client persistence: service workers, Cache Storage,
 * and IndexedDB. Use from "clear local data" / recovery flows.
 */
export async function clearWebClientPersistentState(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }

  if (typeof indexedDB === 'undefined') {
    return;
  }

  if (typeof indexedDB.databases === 'function') {
    const dbs = await indexedDB.databases();
    await Promise.all(
      (dbs ?? []).map(
        (d) =>
          new Promise<void>((resolve, reject) => {
            if (d.name === undefined || d.name === null || d.name === '') {
              resolve();
              return;
            }
            const req = indexedDB.deleteDatabase(d.name);
            req.onsuccess = () => {
              resolve();
            };
            req.onerror = () => {
              reject(req.error ?? new Error('IndexedDB deleteDatabase failed'));
            };
            req.onblocked = () => {
              resolve();
            };
          })
      )
    );
  }
}
