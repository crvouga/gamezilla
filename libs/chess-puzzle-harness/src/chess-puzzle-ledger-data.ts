/**
 * Puzzle bookkeeping reads and fixtures for scenarios: who owns a device's
 * puzzle progress, the rated-start allowance ledger (`puzzle.rated.solve`
 * starts on the device), and the interaction log's completions. Fixtures
 * write earlier history directly so a scenario need not drive twenty boards
 * through the UI.
 */

import { deviceMutationEnv } from '@libs/auth-shared/device-mutation-env';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness/identity';
import { PERMISSIONS_TOPIC_MAP } from '@libs/permissions-shared/topic-map';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import {
  topicMapCtxFromEnv,
  topicsFromWriteCapture,
} from '@pkgs/sync-engine-shared/topic-map';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

/** The quota a rated puzzle start consumes. */
const PUZZLE_START_QUOTA = 'puzzle.rated.solve';

export type PuzzleStartLedgerRow = {
  readonly id: string;
  readonly owner_id: string;
  readonly idempotency_key: string;
  readonly consumed_at: string;
};

function localSql(s: ProductHarness, actorId: string): SqlTx {
  const db = actorLocalSql(s, actorId);
  if (db === null) throw new Error(`${actorId} has no device database`);
  return db;
}

/**
 * Whose puzzle progress the actor's device records: the signed-in account,
 * or the guest owner its interaction log carries.
 */
export async function readPuzzlePlayerId(
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string
): Promise<PuzzleStartLedgerRow[]> {
  return localSql(s, actorId).query(sql<PuzzleStartLedgerRow>`
    SELECT id, owner_id, idempotency_key, consumed_at
    FROM permissions_quota_ledger
    WHERE quota = ${PUZZLE_START_QUOTA} AND deleted_at IS NULL
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
    const env = deviceMutationEnv(
      first.owner_id,
      await s.harness.client(actorId)
    );
    const server = s.harness.serverSql.sqlClient;
    const capture = await server.transaction(async (tx) => {
      const wrapped = wrapMutationDb(tx, env);
      await writeEarlierStarts(wrapped.tx, first, allowance);
      return wrapped.getCapture();
    });
    await writeEarlierStarts(device, first, allowance);
    const pubsub = s.harness.server.events;
    if (pubsub === null) throw new Error('Puzzle quota fixture needs pubsub');
    await notifyChannels({
      pubsub,
      sql: s.harness.serverSql.sqlClient,
      topics: await topicsFromWriteCapture({
        topicMap: PERMISSIONS_TOPIC_MAP,
        capture,
        ctx: topicMapCtxFromEnv(env),
      }),
      tables: capture.tables,
      now: s.harness.clock.now,
      label: 'puzzle-quota-fixture',
    });
  },
});

async function writeEarlierStarts(
  db: SqlTx,
  first: PuzzleStartLedgerRow,
  allowance: number
): Promise<void> {
  for (let i = 0; i < allowance - 1; i += 1) {
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
  s: ProductHarness,
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
  s: ProductHarness,
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
  s: ProductHarness,
  actorId: string,
  puzzleId: string
): Promise<number> {
  const rows = await countWrongMoves(localSql(s, actorId), puzzleId, null);
  return Number(rows[0]?.count ?? 0);
}

/** Wrong moves the server holds for `ownerId` on one puzzle. */
export async function countServerWrongMoves(
  s: ProductHarness,
  ownerId: string,
  puzzleId: string
): Promise<number> {
  const rows = await countWrongMoves(
    s.harness.serverSql.sqlClient,
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
export function readMsUntilNextUtcDay(s: ProductHarness): number {
  const now = s.harness.clock.now();
  return DAY_MS - (now % DAY_MS);
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
