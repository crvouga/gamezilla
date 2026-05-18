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
 * The API has no opinion on attributes, formulas, or game type — each
 * client declares its own attribute schema in `data` and its own
 * acceptance criteria in `formulas` at join time. Completed matches are
 * surfaced via `GET /status/:playerId`, which returns a `matchId` callers
 * can use as a downstream identifier (e.g. a Durable Object name).
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
  const matchmaker = new Matchmaker({ sqlClient: lazyRequestSqlClient() });
  return createMatchmakingApp({ matchmaker, requireAuth });
}
