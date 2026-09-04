/**
 * Metro stub for Node-only SQL engines (better-sqlite3, bun:sqlite,
 * PGlite worker host, package `@sqlite.org/sqlite-wasm`).
 * Native playground uses the mem fabric; do not throw at module load
 * (Hermes `import()` probes would crash `[runtime not ready]`).
 */
'use strict';

module.exports = {};
