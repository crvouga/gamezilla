import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionAuth } from '@libs/auth/server/session-middleware';
import type { BetterAuthInstance } from '@pkgs/auth-better-auth/server';
import type { Kv } from '@pkgs/kv/interface';
import type { Observability } from '@pkgs/observability/port/observability';
import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Request-scoped resources populated by {@link ./app/create-app.ts} middleware.
 */
export type ApiRequestAsyncStore = {
  readonly sqlClient: SqlClient;
  readonly sessionAuth: SessionAuth;
  /** Postgres-backed {@link Kv} for LLM response caching (per request). */
  readonly kv: Kv;
  readonly observability: Observability;
  readonly secretStore: SecretStore;
  readonly betterAuth: BetterAuthInstance;
};

export const apiRequestAsyncLocalStorage =
  new AsyncLocalStorage<ApiRequestAsyncStore>();
