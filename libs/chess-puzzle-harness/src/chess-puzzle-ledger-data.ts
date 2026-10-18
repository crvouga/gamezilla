/**
 * Chess puzzle bookkeeping a scenario reads: whether a device's history
 * records an attempt at a puzzle. The daily allowance's ledger is every
 * game's (`@libs/game-session-harness/puzzle-allowance`).
 */

import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql } from '@libs/harness/identity';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';

function localSql(s: ProductHarness, actorId: string): SqlTx {
  const db = actorLocalSql(s, actorId);
  if (db === null) throw new Error(`${actorId} has no device database`);
  return db;
}

/** Whether the device's history records any attempt at `puzzleId`. */
export async function hasPlayedPuzzle(
  s: ProductHarness,
  actorId: string,
  puzzleId: string
): Promise<boolean> {
  const rows = await localSql(s, actorId).query(sql<{
    readonly n: number;
  }>`
    SELECT COUNT(*) AS n FROM chess_puzzle_interactions
    WHERE puzzle_id = ${puzzleId} AND deleted_at IS NULL
  `);
  return Number(rows[0]?.n ?? 0) > 0;
}
