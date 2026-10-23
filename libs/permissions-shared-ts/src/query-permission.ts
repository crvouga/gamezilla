import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import type { QueryCtx } from '@pkgs/sync-engine-shared-ts/queries-types';

import { decideForActor } from './decide-for-actor';
import type { AppGrantKey } from './permission-catalog';
import type { AccessReader } from './read-access';

function readerOf(ctx: QueryCtx): AccessReader {
  return {
    query: <T>(query: Sql<T>) => ctx.db.query(query) as Promise<T[]>,
  };
}

/**
 * The caller's decision for `key` inside a sync query's `authorize`: the same
 * synced rows and policy the server replay reads, judged at the server's now.
 */
export function decideInQuery(
  ctx: QueryCtx,
  key: AppGrantKey
): Promise<Decision> {
  const nowMs = ctx.env.now().getTime();
  return decideForActor(readerOf(ctx), {
    identity: ctx.env,
    key,
    nowMs,
    clientAtMs: nowMs,
  });
}

/**
 * A `defineQuery` `authorize` hook for `key`: the query answers only callers
 * the permission system allows (a denied query hydrates nothing).
 */
export function queryRequires(
  key: AppGrantKey
): (ctx: QueryCtx) => Promise<boolean> {
  return async (ctx) => (await decideInQuery(ctx, key)).allowed;
}
