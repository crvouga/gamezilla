// @api-wall-ok — Worker entry polyfill; must load before any `@pkgs/async-local` use.
/**
 * Cloudflare Workers expose AsyncLocalStorage via `node:async_hooks` under
 * `nodejs_compat`, not on `globalThis`. `@pkgs/async-local` prefers a
 * constructable `globalThis.AsyncLocalStorage` so concurrent request stores
 * stay isolated; without this install it falls back to stack ALS and
 * overlapping `/api/query` + auth requests can query an already-`end()`'d pg
 * Client ("Client was closed and is not queryable").
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const g = globalThis as typeof globalThis & {
  AsyncLocalStorage?: typeof AsyncLocalStorage;
};

if (typeof g.AsyncLocalStorage !== 'function') {
  g.AsyncLocalStorage = AsyncLocalStorage;
}
