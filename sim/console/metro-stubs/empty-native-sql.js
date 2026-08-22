/**
 * Metro web stub for Node-only SQL engines (better-sqlite3, bun:sqlite,
 * PGlite worker host, package `@sqlite.org/sqlite-wasm`).
 * Browser playground loads WASM via `/generated/...` native ESM instead.
 */
'use strict';

throw new Error(
  'Native / package SQL engine is not available in the Expo web bundle. ' +
    'Use /generated/pglite and /generated/sqlite-wasm assets instead.'
);
