/**
 * The daily puzzle limit as a scenario sets it up: the rated puzzle starts a
 * device has charged (`puzzle.rated.solve` in its synced quota ledger),
 * earlier starts of the same day written so a scenario need not drive twenty
 * boards through the UI, and the night passing to the next UTC day, when the
 * allowance starts again. The limit is one allowance for every game offering
 * puzzles: a start of any game's puzzle is charged to the same ledger.
 */

import { deviceMutationEnv } from '@libs/auth-shared/device-mutation-env';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorLocalSql } from '@libs/harness/identity';
import { ACTION } from '@libs/permissions-shared/permission-catalog';
import { PERMISSIONS_TOPIC_MAP } from '@libs/permissions-shared/topic-map';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import {
  topicMapCtxFromEnv,
  topicsFromWriteCapture,
} from '@pkgs/sync-engine-shared/topic-map';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

/** The quota a rated puzzle start consumes, whichever game it is of. */
const PUZZLE_START_QUOTA = ACTION.puzzleRatedSolve;

const DAY_MS = 86_400_000;

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

/**
 * Virtual time left until the next UTC midnight, when the day's puzzle
 * allowance resets (the policy's `utcMidnight` boundary).
 */
export function readMsUntilNextUtcDay(s: ProductHarness): number {
  const now = s.harness.clock.now();
  return DAY_MS - (now % DAY_MS);
}

/**
 * The night passes: every device and the server sleep until the next UTC
 * midnight (when the day's puzzle allowance resets), and whatever fell due
 * meanwhile runs once on waking.
 */
export const sleepUntilNextUtcDay = scenarioAction({
  name: 'sleepUntilNextUtcDay',
  act: async (s) => {
    await s.session.advanceTime(0);
    await s.session.scheduler.underlying.sleep(readMsUntilNextUtcDay(s));
    await s.session.advanceTime(0);
  },
});

export const PUZZLE_ALLOWANCE_ACTIONS = [sleepUntilNextUtcDay];
