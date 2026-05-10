import { createLogger, type Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type { PatchDbIndexSpec } from '../indexes/index-spec';
import { reconcileSnapshotIndexes } from '../indexes/reconcile';
import { sqliteIndexDialect } from './index-dialect-sqlite';
import { MIGRATIONS } from './sql-constants';

async function runBaseMigrations(sqlClient: SqlClient): Promise<void> {
  const statements = MIGRATIONS.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const [, stmt] of statements.entries()) {
    try {
      await sqlClient.run(stmt);
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Applies base DDL for the patch-db SQLite schema and (optionally) reconciles
 * declarative snapshot indexes. The library only manages indexes whose name
 * starts with `pdb_idx_`.
 */
export async function migratePatchDbSqlite(
  sqlClient: SqlClient,
  options?: {
    logger?: Logger;
    indexes?: readonly PatchDbIndexSpec[];
  }
): Promise<void> {
  await runBaseMigrations(sqlClient);
  if (options?.indexes !== undefined) {
    const logger =
      options.logger ??
      createLogger({ name: 'patch-db-sqlite', level: 'silent' });
    await reconcileSnapshotIndexes({
      sqlClient,
      logger,
      dialect: sqliteIndexDialect,
      indexes: options.indexes,
    });
  }
}
