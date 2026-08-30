import type { SessionAuth } from '@libs/auth/public/session-middleware';
import { assert } from '@pkgs/assert';
import { AsyncLocalStorage } from '@pkgs/async-local';
import type { Clock, Timers } from '@pkgs/clock';
import type { Kv } from '@pkgs/kv/interface';
import type { Observability } from '@pkgs/observability/port/observability';
import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

/**
 * Request-scoped resources populated by createServer middleware.
 */
export type ApiRequestAsyncStore = {
  readonly sqlClient: SqlClient;
  readonly sessionAuth: SessionAuth;
  readonly kv: Kv;
  readonly observability: Observability;
  readonly secretStore: SecretStore;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
};

export const apiRequestAsyncLocalStorage =
  new AsyncLocalStorage<ApiRequestAsyncStore>();

export function requireRequestStore(): ApiRequestAsyncStore {
  const store = apiRequestAsyncLocalStorage.getStore();
  assert.defined(store, 'request store missing');
  return store;
}
