/**
 * HTTP headers required for SQLite WASM OPFS (SharedArrayBuffer isolation).
 */

'use strict';

const SQLITE_WEB_COOP = 'same-origin';
const SQLITE_WEB_COEP = 'require-corp';

/** @param {{ setHeader: (name: string, value: string) => void }} res */
function applySqliteWebIsolationHeaders(res) {
  res.setHeader('Cross-Origin-Embedder-Policy', SQLITE_WEB_COEP);
  res.setHeader('Cross-Origin-Opener-Policy', SQLITE_WEB_COOP);
}

/** @param {Headers} headers */
function applySqliteWebIsolationHeadersToFetch(headers) {
  headers.set('Cross-Origin-Embedder-Policy', SQLITE_WEB_COEP);
  headers.set('Cross-Origin-Opener-Policy', SQLITE_WEB_COOP);
}

module.exports = {
  SQLITE_WEB_COOP,
  SQLITE_WEB_COEP,
  applySqliteWebIsolationHeaders,
  applySqliteWebIsolationHeadersToFetch,
};
