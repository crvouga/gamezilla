import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  MATCHMAKING_ACTIVE_PARTITIONS_TABLE,
  MATCHMAKING_MATCHED_TABLE,
  MATCHMAKING_SCHEMA_STATE_TABLE,
  MATCHMAKING_WAITING_TABLE,
} from './schema/tables';

const MATCHMAKING_TABLES = [
  MATCHMAKING_WAITING_TABLE,
  MATCHMAKING_ACTIVE_PARTITIONS_TABLE,
  MATCHMAKING_MATCHED_TABLE,
  MATCHMAKING_SCHEMA_STATE_TABLE,
] as const;

/**
 * Ephemeral matchmaking tick state: drop pre-defineTable shapes when present
 * so reconcile can create the managed-column layout. No-op on fresh DBs or
 * when tables already have `deleted_at`.
 */
export class MatchmakingCutoverMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await cutoverMatchmakingTables(ctx.sqlClient, (msg) => {
      ctx.logger.info(msg);
    });
  }
}

/** Portable cutover used by {@link migrate} (no DatabaseMigrationContext). */
export async function cutoverMatchmakingTables(
  sqlClient: SqlClient,
  log?: (message: string) => void
): Promise<void> {
  if (!(await needsCutover(sqlClient))) {
    log?.('matchmaking cutover: already defineTable shape or fresh');
    return;
  }
  for (const table of MATCHMAKING_TABLES) {
    await sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${table}`));
  }
  log?.('matchmaking cutover: dropped pre-defineTable tables');
}

async function needsCutover(sqlClient: SqlClient): Promise<boolean> {
  const anyPresent = await anyTableReadable(sqlClient);
  if (!anyPresent) return false;
  for (const table of MATCHMAKING_TABLES) {
    try {
      await sqlClient.run(
        unsafe(`SELECT deleted_at FROM ${table} WHERE 0`)
      );
    } catch {
      return true;
    }
  }
  try {
    await sqlClient.run(
      unsafe(
        `SELECT id FROM ${MATCHMAKING_ACTIVE_PARTITIONS_TABLE} WHERE 0`
      )
    );
  } catch {
    return true;
  }
  return false;
}

async function anyTableReadable(sqlClient: SqlClient): Promise<boolean> {
  for (const table of MATCHMAKING_TABLES) {
    try {
      await sqlClient.run(unsafe(`SELECT 1 FROM ${table} WHERE 0`));
      return true;
    } catch {
      // missing
    }
  }
  return false;
}
