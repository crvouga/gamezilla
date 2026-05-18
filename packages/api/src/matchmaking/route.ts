/**
 * Mounts the `@gamezilla/matchmaking` Hono sub-app behind the API's session
 * auth.
 *
 * {@link Matchmaking} is constructed once at app boot but delegates every
 * SQL call to a per-request `pg.Client` via
 * {@link apiRequestAsyncLocalStorage} — this keeps a single matchmaking
 * instance while still honouring the API's one-connection-per-Hyperdrive-
 * request invariant.
 *
 * `Matchmaking` runs its own `migrate()` exactly once via a cached boot
 * promise. The boot bakes the {@link MATCHMAKING_TUNING} values into a
 * PL/pgSQL `matchmaking_tick()` function and, when `pg_cron` is enabled
 * on the database, schedules it to run every 5 seconds. The request
 * layer never advances the queue itself; every route is a single SQL
 * statement.
 *
 * Schema drift between migrate and runtime is impossible by construction —
 * both come from the [./schema.ts](./schema.ts) constants imported by
 * this file.
 *
 * The API has no opinion on attributes, formulas, or partitioning — each
 * caller declares its own attribute schema in `data` and its own
 * acceptance criteria in `formulas` at join time. Completed matches are
 * surfaced via `GET /status/:participantId`, which returns a `matchId`
 * callers can use as a downstream handle (e.g. a Durable Object name).
 *
 * Request-layer side effects: NONE. Every route is a single SQL
 * statement; pass + sweep operations run server-side in `pg_cron`.
 */

import { UnauthorizedError } from '@gamezilla/auth/server/unauthorized-error';
import { appAuth } from '@gamezilla/auth/shared/auth-context';
import { assert } from '@gamezilla/lib/assert';
import { Matchmaking } from '@gamezilla/matchmaking';
import type {
  SqlClient as MmSqlClient,
  QueryResult,
} from '@gamezilla/matchmaking/storage';
import type { Hono, MiddlewareHandler } from 'hono';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { MATCHMAKING_SCHEMA, MATCHMAKING_TUNING } from './schema';

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

/**
 * Builds the request-layer {@link Matchmaking} instance. `tuning` is
 * forwarded so {@link MATCHMAKING_TUNING} gets baked into the PL/pgSQL
 * `matchmaking_tick()` function during `migrate()`. The request path
 * itself issues one SQL statement per route and never invokes pass or
 * sweep operations — those run server-side under `pg_cron`.
 */
export function createMatchmakingSubApp(): Hono {
  const matchmaking = new Matchmaking({
    storage: { sqlClient: lazyRequestSqlClient() },
    schema: MATCHMAKING_SCHEMA,
    tuning: MATCHMAKING_TUNING,
  });
  return matchmaking.app({ requireAuth });
}
