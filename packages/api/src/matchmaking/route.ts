/**
 * Mounts the `@gamezilla/matchmaking` Hono sub-app behind the API's session
 * auth.
 *
 * The {@link Matchmaker} is constructed once at app boot but delegates every
 * SQL call to a per-request `pg.Client` via
 * {@link apiRequestAsyncLocalStorage} — this keeps a single matchmaker
 * instance while still honouring the API's one-connection-per-Hyperdrive-
 * request invariant.
 *
 * The API has no opinion on attributes, formulas, or partitioning — each
 * caller declares its own attribute schema in `data` and its own
 * acceptance criteria in `formulas` at join time. Completed matches are
 * surfaced via `GET /status/:participantId`, which returns a `matchId`
 * callers can use as a downstream handle (e.g. a Durable Object name).
 */

import { UnauthorizedError } from '@gamezilla/auth/server/unauthorized-error';
import { appAuth } from '@gamezilla/auth/shared/auth-context';
import { assert } from '@gamezilla/lib/assert';
import { createMatchmakingApp } from '@gamezilla/matchmaking/app';
import { Matchmaker } from '@gamezilla/matchmaking/matchmaker';
import type {
  SqlClient as MmSqlClient,
  QueryResult,
} from '@gamezilla/matchmaking/sql-client';
import type { Hono, MiddlewareHandler } from 'hono';
import { apiRequestAsyncLocalStorage } from '../request-scope';

function lazyRequestSqlClient(): MmSqlClient {
  return {
    query<T = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>> {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'matchmaking: request store missing');
      return s.matchmakingSqlClient.query<T>(sql, params);
    },
    tx<T>(fn: (tx: MmSqlClient) => Promise<T>): Promise<T> {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'matchmaking: request store missing');
      return s.matchmakingSqlClient.tx(fn);
    },
  };
}

const requireAuth: MiddlewareHandler = async (c, next) => {
  const s = apiRequestAsyncLocalStorage.getStore();
  assert.defined(s, 'matchmaking auth: request store missing');
  try {
    const ctx = await s.sessionAuth.requireAuthContext(s.patchDb, c.req.raw);
    const auth = appAuth(ctx);
    if (auth === null || auth.accountId === null) {
      throw new UnauthorizedError('Matchmaking requires a signed-in account');
    }
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return c.json({ error: err.message }, 401);
    }
    throw err;
  }
  await next();
  return;
};

export function createMatchmakingSubApp(): Hono {
  // Constants MUST mirror the `migrate({ schema })` call in
  // `migrations/run-postgres-migrations.ts`. `partitionKeys` /
  // `primaryNumericKey` mismatches surface on first SQL call via the
  // schema-fingerprint assert (a silent zero-match bug is the
  // alternative). `bucketWidth` mismatches degrade the bucket pre-filter
  // but stay correct; everything else here is a runtime tuning knob.
  // `minPassIntervalMs` of 100 caps per-partition pass cost regardless
  // of poller volume; `sweepIntervalMs` coalesces both abandonment
  // cleanup and matched-row cleanup. `matchedRetentionSeconds: 3600`
  // keeps the matched-row tail bounded — long-lived state for active
  // matches lives downstream of `matchId` (e.g. a Durable Object).
  const matchmaker = new Matchmaker({
    sqlClient: lazyRequestSqlClient(),
    partitionKeys: [],
    bucketWidth: 50,
    maxPairsPerPass: 100,
    minPassIntervalMs: 100,
    maxWaitSeconds: 300,
    sweepIntervalMs: 60_000,
    matchedRetentionSeconds: 3600,
  });
  return createMatchmakingApp({ matchmaker, requireAuth });
}
