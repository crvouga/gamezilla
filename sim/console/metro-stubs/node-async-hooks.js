/**
 * Metro stub for `node:async_hooks` on Expo native (Hermes).
 * better-auth dynamically imports this; playground uses in-process ALS.
 */
'use strict';

class AsyncLocalStorage {
  run(_store, callback) {
    return callback();
  }
  getStore() {
    return undefined;
  }
  enterWith() {}
  disable() {}
}

async function getAsyncLocalStorage() {
  return AsyncLocalStorage;
}

Object.defineProperty(exports, '__esModule', { value: true });
exports.AsyncLocalStorage = AsyncLocalStorage;
exports.getAsyncLocalStorage = getAsyncLocalStorage;
