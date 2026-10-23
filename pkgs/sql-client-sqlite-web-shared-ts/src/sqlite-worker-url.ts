/**
 * Databases live on the SAH pool, never on sqlite-wasm's `opfs` / `opfs-wl`
 * VFSes. Left on, its start-up installs both: each loads an async proxy script
 * this app does not ship (the host answers with `index.html`), and logs a
 * console error for it. The library reads these switches off the worker URL.
 */
export const SQLITE_WORKER_FLAGS = ['opfs-disable', 'opfs-wl-disable'] as const;

export const SQLITE_WORKER_URL = `/sql-workers/sqlite-worker.js?${SQLITE_WORKER_FLAGS.join('&')}`;
