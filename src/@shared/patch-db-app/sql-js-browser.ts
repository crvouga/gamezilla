/// <reference types="vite/client" />

import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import type { SqlJsInitConfig } from '../sql-client/impl-sql-js';

/**
 * `openMemory` init: bundle WASM via Vite.
 * The playground runs 3 in-memory DBs (server + clients) on one wasm module; a larger
 * initial heap avoids SQLITE_NOMEM / "out of memory" after HMR or repeated prepare cycles.
 */
export const browserSqlJsInit = {
  locateFile: (file: string) => (file.endsWith('.wasm') ? sqlWasmUrl : file),
  /** 64 MiB, multiple of 64 KiB (Emscripten page size). */
  INITIAL_MEMORY: 64 * 1024 * 1024,
} as SqlJsInitConfig;
