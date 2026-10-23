import type { SessionAuth } from '@libs/auth-shared-ts/session-middleware';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { AsyncLocalStorage } from '@pkgs/async-local-shared-ts/async-local-storage';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { Kv } from '@pkgs/kv-root-shared-ts/interface';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';

/**
 * Request-scoped resources populated by createServer middleware.
 */
export type ApiRequestAsyncStore = {
  readonly sqlClient: SqlClient;
  readonly objectStore: ObjectStore;
  readonly sessionAuth: SessionAuth;
  readonly kv: Kv;
  readonly secretStore: SecretStore;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly http: HttpClient;
  readonly createId: CreateId;
};

export const apiRequestAsyncLocalStorage =
  new AsyncLocalStorage<ApiRequestAsyncStore>();

export function requireRequestStore(): ApiRequestAsyncStore {
  const store = apiRequestAsyncLocalStorage.getStore();
  assert.defined(store, 'request store missing');
  return store;
}
