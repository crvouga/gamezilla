/**
 * Puzzle bookkeeping reads and fixtures for scenarios: who owns a device's
 * puzzle progress, the rated-start allowance ledger (`puzzle.rated.solve`
 * starts, on the device and on the server), and the interaction log's
 * starts, completions and wrong moves. Fixtures write earlier history
 * directly so a scenario need not drive twenty boards through the UI.
 */

import { scenarioAction } from '@libs/sim-harness/system/actor-ui';
import { accountIdOf, actorLocalSql } from '@libs/sim-harness/system/identity';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

/** The quota a rated puzzle start consumes. */
const PUZZLE_START_QUOTA = 'puzzle.rated.solve';

export type PuzzleStartLedgerRow = {
  readonly id: string;
  readonly owner_id: string;
  readonly idempotency_key: string;
  readonly consumed_at: string;
};

function localSql(s: ProductSim, actorId: string): SqlTx {
  const db = actorLocalSql(s, actorId);
  if (db === null) throw new Error(`${actorId} has no device database`);
  return db;
}

/**
 * Whose puzzle progress the actor's device records: the signed-in account,
 * or the guest owner its interaction log carries.
 */
export async function readPuzzlePlayerId(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const account = await accountIdOf(s, actorId);
  if (account !== null) return account;
  const db = actorLocalSql(s, actorId);
  if (db === null) return null;
  const rows = await db.query(sql<{ readonly owner_id: string }>`
    SELECT owner_id FROM chess_puzzle_interactions
    WHERE deleted_at IS NULL
    ORDER BY at ASC
    LIMIT 1
  `);
  return rows[0]?.owner_id ?? null;
}

/** Rated puzzle starts the actor's device has charged, oldest first. */
export function readLocalPuzzleStartLedger(
  s: ProductSim,
  actorId: string
): Promise<PuzzleStartLedgerRow[]> {
  return localSql(s, actorId).query(sql<PuzzleStartLedgerRow>`
    SELECT id, owner_id, idempotency_key, consumed_at
    FROM permissions_quota_ledger
    WHERE quota = ${PUZZLE_START_QUOTA} AND deleted_at IS NULL
    ORDER BY consumed_at ASC, id ASC
  `);
}

/** Rated puzzle starts the server has recorded for `ownerId`, oldest first. */
export function readServerPuzzleStartLedger(
  s: ProductSim,
  ownerId: string
): Promise<PuzzleStartLedgerRow[]> {
  return s.sim.serverSql.sqlClient.query(sql<PuzzleStartLedgerRow>`
    SELECT id, owner_id, idempotency_key, consumed_at
    FROM permissions_quota_ledger
    WHERE owner_id = ${ownerId}
      AND quota = ${PUZZLE_START_QUOTA}
      AND deleted_at IS NULL
    ORDER BY consumed_at ASC, id ASC
  `);
}

/**
 * Earlier starts on the same day as the device's first one, on the server
 * and in the device's synced copy, until `allowance` starts are used.
 */
export const useUpPuzzleStartsToday = scenarioAction({
  name: 'useUpPuzzleStartsToday',
  act: async (s, actorId: string, allowance: number) => {
    const device = localSql(s, actorId);
    const first = (await readLocalPuzzleStartLedger(s, actorId))[0];
    if (first === undefined) {
      throw new Error(`${actorId} has not started a rated puzzle today`);
    }
    for (let i = 0; i < allowance - 1; i += 1) {
      for (const db of [device, s.sim.serverSql.sqlClient]) {
        await db.run(sql`
          INSERT INTO permissions_quota_ledger (
            id, owner_id, quota, idempotency_key, amount, consumed_at,
            policy_version, created_at, updated_at, deleted_at
          ) VALUES (
            ${`quota-fixture-${String(i)}`}, ${first.owner_id},
            ${PUZZLE_START_QUOTA}, ${`${PUZZLE_START_QUOTA}:fixture-${String(i)}`},
            1, ${first.consumed_at}, 'fixture', ${first.consumed_at},
            ${first.consumed_at}, NULL
          )
        `);
      }
    }
  },
});

const COMPLETED_KINDS = ['solved', 'failed', 'abandoned'] as const;

/** `count` completed puzzles from an earlier day, in the device's history. */
export const addEarlierCompletedPuzzles = scenarioAction({
  name: 'addEarlierCompletedPuzzles',
  act: async (s, actorId: string, count: number) => {
    const owner = await readPuzzlePlayerId(s, actorId);
    if (owner === null) throw new Error(`${actorId} has no puzzle history`);
    const device = localSql(s, actorId);
    for (let index = 0; index < count; index += 1) {
      await device.run(sql`
        INSERT INTO chess_puzzle_interactions (
          id, owner_id, puzzle_id, puzzle_rating, kind, solve_idx, uci, correct, at
        ) VALUES (
          ${`earlier-completed-${String(index)}`}, ${owner},
          ${`earlier-puzzle-${String(index)}`}, 1200, 'solved', 0, NULL, NULL,
          '2024-06-01T00:00:00.000Z'
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }
  },
});

/** Distinct puzzles the device's history records as completed. */
export async function countCompletedPuzzles(
  s: ProductSim,
  actorId: string
): Promise<number> {
  const rows = await localSql(s, actorId).query(sql<{
    readonly count: number;
  }>`
    SELECT COUNT(DISTINCT puzzle_id) AS count
    FROM chess_puzzle_interactions
    WHERE kind IN (${COMPLETED_KINDS[0]}, ${COMPLETED_KINDS[1]}, ${COMPLETED_KINDS[2]})
      AND deleted_at IS NULL
  `);
  return Number(rows[0]?.count ?? 0);
}

/** Every puzzle start the device logged, across puzzles. */
export async function countAllPuzzleStarts(
  s: ProductSim,
  actorId: string
): Promise<number> {
  const rows = await localSql(s, actorId).query(sql<{
    readonly count: number;
  }>`
    SELECT COUNT(*) AS count FROM chess_puzzle_interactions
    WHERE kind = 'started' AND deleted_at IS NULL
  `);
  return Number(rows[0]?.count ?? 0);
}

function countWrongMoves(
  db: Pick<SqlTx, 'query'>,
  puzzleId: string,
  ownerId: string | null
): Promise<{ readonly count: number }[]> {
  return ownerId === null
    ? db.query(sql<{ readonly count: number }>`
        SELECT COUNT(*) AS count FROM chess_puzzle_interactions
        WHERE puzzle_id = ${puzzleId} AND kind = 'moved' AND correct IS FALSE
      `)
    : db.query(sql<{ readonly count: number }>`
        SELECT COUNT(*) AS count FROM chess_puzzle_interactions
        WHERE puzzle_id = ${puzzleId} AND owner_id = ${ownerId}
          AND kind = 'moved' AND correct IS FALSE
      `);
}

/** Wrong moves the device logged on one puzzle. */
export async function countLocalWrongMoves(
  s: ProductSim,
  actorId: string,
  puzzleId: string
): Promise<number> {
  const rows = await countWrongMoves(localSql(s, actorId), puzzleId, null);
  return Number(rows[0]?.count ?? 0);
}

/** Wrong moves the server holds for `ownerId` on one puzzle. */
export async function countServerWrongMoves(
  s: ProductSim,
  ownerId: string,
  puzzleId: string
): Promise<number> {
  const rows = await countWrongMoves(
    s.sim.serverSql.sqlClient,
    puzzleId,
    ownerId
  );
  return Number(rows[0]?.count ?? 0);
}

const DAY_MS = 86_400_000;

/**
 * Virtual time left until the next UTC midnight, when the day's puzzle
 * allowance resets (the policy's `utcMidnight` boundary).
 */
export function readMsUntilNextUtcDay(s: ProductSim): number {
  const now = s.sim.clock.now();
  return DAY_MS - (now % DAY_MS);
}
