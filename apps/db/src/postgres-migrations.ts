/**
 * Single place that defines Postgres DDL migration order for this app:
 * patch-db → kv → entity-db down (drop legacy `entities` table).
 *
 * Callers supply the {@link SqlClient} (optionally a transaction-scoped client)
 * and a {@link Logger}; see `scripts/migrate-db.ts` and `src/migrate.ts` (`migrateInProcessPglite`).
 */
import { EntityDbImplPostgres } from '@gamezilla/lib/entity-db/impl-postgres';
import { KvImplPostgres } from '@gamezilla/lib/kv/impl-postgres';
import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';

export type RunPostgresMigrationsArgs = {
  sqlClient: SqlClient;
  logger: Logger;
};

/** Runs all bundled Postgres migrations in the canonical order. */
export async function runPostgresMigrations(
  args: RunPostgresMigrationsArgs
): Promise<void> {
  const { sqlClient, logger } = args;
  await sqlClient.transaction(async (tx) => {
    await PatchDbImplPostgres.migrateUp({ sqlClient: tx, logger });
    await KvImplPostgres.migrateUp({ sqlClient: tx, logger });
    await EntityDbImplPostgres.migrateDown({ sqlClient: tx, logger });
  });
}
