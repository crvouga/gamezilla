/**
 * HTTP headers required for expo-sqlite on web (SharedArrayBuffer).
 * @see https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
 */
'use strict';

const EXPO_SQLITE_WEB_COOP = 'same-origin';
const EXPO_SQLITE_WEB_COEP = 'require-corp';

/** @param {{ setHeader: (name: string, value: string) => void }} res */
function applyExpoSqliteWebIsolationHeaders(res) {
  res.setHeader('Cross-Origin-Embedder-Policy', EXPO_SQLITE_WEB_COEP);
  res.setHeader('Cross-Origin-Opener-Policy', EXPO_SQLITE_WEB_COOP);
}

/** @param {Headers} headers */
function applyExpoSqliteWebIsolationHeadersToFetch(headers) {
  headers.set('Cross-Origin-Embedder-Policy', EXPO_SQLITE_WEB_COEP);
  headers.set('Cross-Origin-Opener-Policy', EXPO_SQLITE_WEB_COOP);
}

module.exports = {
  EXPO_SQLITE_WEB_COOP,
  EXPO_SQLITE_WEB_COEP,
  applyExpoSqliteWebIsolationHeaders,
  applyExpoSqliteWebIsolationHeadersToFetch,
};
