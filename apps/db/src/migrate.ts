/**
 * Run Postgres-backed lib migrations against an in-process PGlite instance.
 * Uses {@link SqlClientImplPglite} and {@link runPostgresMigrations}.
 *
 * The dev DB server boots ephemeral PGlite (in memory), so migrations must run
 * on every startup before requests are served. We don't reuse
 * {@link SqlClientImplPgliteHttp} here because there is no HTTP server yet —
 * the Hono app is mounted only after migrations succeed.
 */

import type { PGlite } from '@electric-sql/pglite';
import type { Logger } from '@gamezilla/lib/logger';
import { SqlClientImplPglite } from '@gamezilla/lib/sql-client/impl-pglite';
import { runPostgresMigrations } from './postgres-migrations';

export async function migrateInProcessPglite(
  db: PGlite,
  logger: Logger
): Promise<void> {
  const sqlClient = new SqlClientImplPglite(db);
  await runPostgresMigrations({ sqlClient, logger });
}
