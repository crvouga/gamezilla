import type { SessionAuth } from '@libs/auth/server/session-middleware';
import type { Kv } from '@pkgs/kv/interface';
import type { SqlClient as MmSqlClient } from '@pkgs/matchmaking/storage';
import type { PatchDb } from '@pkgs/patch-db/interface';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped {@link PatchDb} for the patch-db sync host resolver
 * (`PatchDbResolvable` function). Populated by {@link ./app/create-app.ts} middleware.
 */
export type ApiRequestAsyncStore = {
  readonly patchDb: PatchDb;
  readonly sessionAuth: SessionAuth;
  /** Postgres-backed {@link Kv} for LLM response caching (per request). */
  readonly kv: Kv;
  /**
   * Matchmaking-flavored SqlClient backed by the same per-request Postgres
   * client that the patch-db host uses. Built once in
   * `createRequestDbMiddleware` so the long-lived `Matchmaker` instance can
   * delegate to a fresh request connection on every call.
   */
  readonly matchmakingSqlClient: MmSqlClient;
};

export const apiRequestAsyncLocalStorage =
  new AsyncLocalStorage<ApiRequestAsyncStore>();
