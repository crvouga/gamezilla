import type { SessionAuth } from '@libs/auth/server/session-middleware';
import type { Kv } from '@pkgs/kv/interface';
import type { SqlClient as MmSqlClient } from '@pkgs/matchmaking/storage';
import type { Observability } from '@pkgs/observability/port/observability';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped resources populated by {@link ./app/create-app.ts} middleware.
 */
export type ApiRequestAsyncStore = {
  readonly sqlClient: SqlClient;
  readonly sessionAuth: SessionAuth;
  /** Postgres-backed {@link Kv} for LLM response caching (per request). */
  readonly kv: Kv;
  /**
   * Matchmaking-flavored SqlClient backed by the same per-request Postgres
   * client. Built once in `createRequestDbMiddleware` so the long-lived
   * `Matchmaker` instance can delegate to a fresh request connection on every
   * call.
   */
  readonly matchmakingSqlClient: MmSqlClient;
  readonly observability: Observability;
};

export const apiRequestAsyncLocalStorage =
  new AsyncLocalStorage<ApiRequestAsyncStore>();
