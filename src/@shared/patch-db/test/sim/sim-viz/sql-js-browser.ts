/// <reference types="vite/client" />

import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';

/** `openMemory` init: bundle WASM via Vite instead of fetching from a CDN. */
export const browserSqlJsInit: Parameters<typeof initSqlJs>[0] = {
  locateFile: (file: string) => (file.endsWith('.wasm') ? sqlWasmUrl : file),
};
