/**
 * Typed Hono RPC client for step transitions.
 *
 * `IdpAppType` is a **type-only** import of the server app: the browser app
 * shares the route contract with the server, and nothing from the server is
 * bundled. The client is built lazily because this module is also loaded where
 * there is no `location` (the server renders the same route components).
 */

import { hc } from 'hono/client';

import type { IdpAppType } from '../../src/server/app';

export function createIdpRpc() {
  return hc<IdpAppType>(`${window.location.origin}/`);
}

export type IdpRpcClient = ReturnType<typeof createIdpRpc>;
