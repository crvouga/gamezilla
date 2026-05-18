import type { SessionAuth } from '@gamezilla/auth/server/session-middleware';
import type { Kv } from '@gamezilla/lib/kv/interface';
import type { SqlClient as MmSqlClient } from '@gamezilla/matchmaking/storage';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped {@link PatchDb} for the patch-db sync host resolver
 * (`PatchDbResolvable` function). Populated by {@link ./app/create-app.ts} middleware.
 */
export type ApiRequestAsyncStore = {
  readonly patchDb: PatchDb;
  readonly sessionAuth: SessionAuth;
  /** Postgres-backed {@link Kv} for LLM response caching (per Hyperdrive request). */
  readonly kv: Kv;
  /**
   * Matchmaking-flavored SqlClient backed by the same per-request `pg.Client`
   * that the patch-db host uses. Built once in
   * `createRequestDbMiddleware` so the long-lived `Matchmaker` instance can
   * delegate to a fresh request connection on every call.
   */
  readonly matchmakingSqlClient: MmSqlClient;
};

export const apiRequestAsyncLocalStorage =
  new AsyncLocalStorage<ApiRequestAsyncStore>();
