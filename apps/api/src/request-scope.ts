import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionAuth } from '@libs/auth/server/session-middleware';
import type { BetterAuthInstance } from '@pkgs/auth-better-auth/server';
import type { Io } from '@pkgs/io';
import type { Kv } from '@pkgs/kv/interface';
import type { Observability } from '@pkgs/observability/port/observability';
import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Request-scoped resources populated by {@link ./app/create-app.ts} middleware.
 * Product code constructs use cases from `sqlClient` + `io` at the point of use.
 */
export type ApiRequestAsyncStore = {
  readonly sqlClient: SqlClient;
  readonly sessionAuth: SessionAuth;
  /** Postgres-backed {@link Kv} for LLM response caching (per request). */
  readonly kv: Kv;
  readonly observability: Observability;
  readonly secretStore: SecretStore;
  readonly betterAuth: BetterAuthInstance;
  /** Injectable I/O bag (also available via {@link runWithIo} / getIo). */
  readonly io: Io;
};

export const apiRequestAsyncLocalStorage =
  new AsyncLocalStorage<ApiRequestAsyncStore>();
