/**
 * Mounts the `@gamezilla/matchmaking` Hono sub-app behind the API's session
 * auth.
 *
 * The {@link Matchmaker} is constructed once at app boot but delegates every
 * SQL call to a per-request `pg.Client` via
 * {@link apiRequestAsyncLocalStorage} — this keeps a single matchmaker
 * instance (and one `onMatch` registration) while still honouring the API's
 * one-connection-per-Hyperdrive-request invariant.
 *
 * `onMatch` is intentionally a no-op stub today; downstream packages can wire
 * up match-record creation, room provisioning, push notifications, etc. by
 * threading a different callback through here.
 */

import { appAuth } from '@gamezilla/auth/shared/auth-context';
import { UnauthorizedError } from '@gamezilla/auth/server/unauthorized-error';
import { assert } from '@gamezilla/lib/assert';
import { createLogger } from '@gamezilla/lib/logger';
import { createMatchmakingApp } from '@gamezilla/matchmaking/app';
import { Matchmaker } from '@gamezilla/matchmaking/matchmaker';
import type {
  QueryResult,
  SqlClient as MmSqlClient,
} from '@gamezilla/matchmaking/sql-client';
import type { MatchedPlayer } from '@gamezilla/matchmaking/types';
import type { Hono, MiddlewareHandler } from 'hono';
import { apiRequestAsyncLocalStorage } from '../request-scope';

const log = createLogger({ name: 'api:matchmaking' });

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
    transaction<T>(fn: (tx: MmSqlClient) => Promise<T>): Promise<T> {
      const s = apiRequestAsyncLocalStorage.getStore();
      assert.defined(s, 'matchmaking: request store missing');
      return s.matchmakingSqlClient.transaction(fn);
    },
  };
}

function logOnMatch(group: readonly MatchedPlayer[]): void {
  log.info('matchmaking: group matched', {
    size: group.length,
    playerIds: group.map((p) => p.playerId),
  });
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
  const matchmaker = new Matchmaker({
    sqlClient: lazyRequestSqlClient(),
    onMatch: logOnMatch,
  });
  return createMatchmakingApp({ matchmaker, requireAuth });
}
