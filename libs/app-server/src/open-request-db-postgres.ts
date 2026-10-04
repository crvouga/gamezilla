// @api-wall-ok — injected Postgres OpenRequestDb adapter (Worker composition).
/**
 * One pinned Postgres session per Worker request, shared by sync upload routes
 * and auth provisioning via {@link adaptPgClientAsPool} (one TCP session, no pool
 * deadlocks).
 *
 * Do not share sockets or wait-queues across requests. A module-scoped open
 * semaphore that `resolve()`s another request's Promise is illegal in Workers
 * (cross-request I/O → `SpanParent` / "Promise will never complete" under
 * wrangler boot fan-out). Cap concurrent DB work by awaiting disconnect on the
 * request path instead (`request-db-middleware`).
 */

import type { PostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import {
  adaptPgClientAsPool,
  openPgClient,
} from '@pkgs/sql-client-postgres-server/connect';

import type { RequestDb } from '@libs/app-shared/open-request-db';

export async function openRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  const { client, sqlClient } = await openPgClient({
    connectionString,
    dbScope,
  });
  const pool = adaptPgClientAsPool(client, dbScope, connectionString);
  return { kind: 'postgres', sqlClient, pool };
}
