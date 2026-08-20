/**
 * Mounts the `@pkgs/matchmaking` Hono sub-app behind the API's session
 * auth.
 *
 * {@link MatchmakingImplSql} is constructed once at app boot but delegates every
 * SQL call to a per-request Neon HTTP client via
 * {@link apiRequestAsyncLocalStorage} — this keeps a single matchmaking
 * instance while still honouring the API's one-connection-per-request
 * invariant.
 *
 * `MatchmakingImplSql` runs `installPostgresSqliteCompat` + `migrate()` once
 * via a cached boot promise. Matching is app-layer + transactional row
 * claims (horizontally scalable). The host advances the queue by calling
 * `POST /matchmaking/tick` (or `Matchmaking.tick()`); there is no pg_cron
 * / PL/pgSQL tick.
 *
 * Schema drift between migrate and runtime is impossible by construction —
 * both come from the [./schema.ts](./schema.ts) constants imported by
 * this file.
 */

import { appAuth } from '@libs/auth/public/auth-context';
import { UnauthorizedError } from '@libs/auth/public/unauthorized-error';
import { assert } from '@pkgs/assert';
import { MatchmakingImplSql } from '@pkgs/matchmaking/impl-sql';
import type { Matchmaking } from '@pkgs/matchmaking/interface';
import type { Sql } from '@pkgs/sql';
import type {
  PreparedStatement,
  RunResult,
  SqlClient,
} from '@pkgs/sql-client/interface';
import type { Hono, MiddlewareHandler } from 'hono';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { MATCHMAKING_SCHEMA, MATCHMAKING_TUNING } from './schema';

/**
 * A {@link SqlClient} facade that resolves the per-request Postgres client
 * from {@link apiRequestAsyncLocalStorage} on every call. The single
 * long-lived matchmaking instance delegates through this so each
 * request reuses its own connection without threading a separate client.
 * `connect` / `disconnect` are intentionally no-ops — the request DB
 * middleware owns that lifecycle.
 */
function lazyRequestSqlClient(): SqlClient {
  const requestSqlClient = (): SqlClient => {
    const s = apiRequestAsyncLocalStorage.getStore();
    assert.defined(s, 'matchmaking: request store missing');
    return s.sqlClient;
  };
  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
      return requestSqlClient().query(query);
    },
    run(query: Sql<unknown>): Promise<RunResult> {
      return requestSqlClient().run(query);
    },
    transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return requestSqlClient().transaction(fn);
    },
    prepare<T extends Record<string, unknown>>(
      query: Sql<T>
    ): PreparedStatement<T> {
      return requestSqlClient().prepare(query);
    },
  };
}

const requireAuth: MiddlewareHandler = async (c, next) => {
  const s = apiRequestAsyncLocalStorage.getStore();
  assert.defined(s, 'matchmaking auth: request store missing');
  try {
    const ctx = await s.sessionAuth.requireAuthContext(s.sqlClient, c.req.raw);
    const auth = appAuth(ctx);
    if (auth === null || auth.accountId === null || auth.isAnon) {
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
 * Builds the request-layer {@link MatchmakingImplSql} instance.
 * Hosts advance the queue via `POST /matchmaking/tick`.
 */
export function createMatchmakingSubApp(): Hono {
  const matchmaking: Matchmaking = new MatchmakingImplSql({
    sqlClient: lazyRequestSqlClient(),
    schema: MATCHMAKING_SCHEMA,
    tuning: {
      ...MATCHMAKING_TUNING,
      // Per-request clock/ids from the request store.
      now: () => {
        const store = apiRequestAsyncLocalStorage.getStore();
        assert.defined(store, 'matchmaking: request store missing');
        return store.clock.now();
      },
      createId: () => {
        const store = apiRequestAsyncLocalStorage.getStore();
        assert.defined(store, 'matchmaking: request store missing');
        return store.createId();
      },
    },
  });
  return matchmaking.app({ requireAuth });
}
