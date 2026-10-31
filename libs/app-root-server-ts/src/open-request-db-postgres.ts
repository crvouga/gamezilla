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

import type { RequestDb } from '@libs/app-root-shared-ts/open-request-db';
import { observeSync } from '@pkgs/observability-root-shared-ts/span';
import {
  adaptPgClientAsPool,
  openPgClient,
} from '@pkgs/sql-client-postgres-server-ts/connect';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';

export async function openRequestDb(
  connectionString: string,
  dbScope: PostgresDbScope
): Promise<RequestDb> {
  const { client, sqlClient } = await observeSync('database', () =>
    openPgClient({
      connectionString,
      dbScope,
      clientOptions: { connectionTimeoutMillis: 2_000 },
      observeOpen: (stage, run) => observeSync(stage, run),
    })
  );
  const pool = adaptPgClientAsPool(client, dbScope, connectionString);
  return { kind: 'postgres', sqlClient, pool };
}
