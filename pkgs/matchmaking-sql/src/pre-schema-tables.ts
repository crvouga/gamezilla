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
 * so reconcile can create the managed-column layout. No-op on fresh databases
 * and when the tables already have `deleted_at`.
 */
export async function dropPreSchemaMatchmakingTables(
  sqlClient: SqlClient,
  log?: (message: string) => void
): Promise<void> {
  if (!(await needsDrop(sqlClient))) {
    log?.('matchmaking pre-schema: already defineTable shape or fresh');
    return;
  }
  for (const table of MATCHMAKING_TABLES) {
    await sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${table}`));
  }
  log?.('matchmaking pre-schema: dropped pre-defineTable tables');
}

async function needsDrop(sqlClient: SqlClient): Promise<boolean> {
  const anyPresent = await anyTableReadable(sqlClient);
  if (!anyPresent) return false;
  for (const table of MATCHMAKING_TABLES) {
    try {
      await sqlClient.run(unsafe(`SELECT deleted_at FROM ${table} WHERE 0`));
    } catch {
      return true;
    }
  }
  try {
    await sqlClient.run(
      unsafe(`SELECT id FROM ${MATCHMAKING_ACTIVE_PARTITIONS_TABLE} WHERE 0`)
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
