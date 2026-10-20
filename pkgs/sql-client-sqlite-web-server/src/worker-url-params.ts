import { SQLITE_WORKER_FLAGS } from '@pkgs/sql-client-sqlite-web-shared/sqlite-worker-url';

/**
 * The switches the SQLite worker is spawned with. A service worker drops them
 * before matching its precache, or the precached script would be fetched from
 * the network while offline.
 */
export const SQLITE_WORKER_URL_PARAMS = new RegExp(
  `^(${SQLITE_WORKER_FLAGS.join('|')})$`
);
