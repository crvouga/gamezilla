import { describe, expect, test } from 'bun:test';
import {
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNextNoWait,
} from '@libs/chess/sim/chess-actions';
import {
  isPuzzleLimitVisible,
  readActivePuzzleId,
} from '@libs/chess/sim/chess-puzzle-ui';
import { actorLocalSql, signInWithGoogle, uiOp } from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { Handles } from '@libs/test-ids';
import { sql } from '@pkgs/sql';
import type { OpenSim } from './support/open-chess-sim';
import { openSim } from './support/open-chess-sim';

/** The shipped policy's anonymous rated allowance (pre-existing product config). */
const ANONYMOUS_LIMIT = 20;

type LedgerRow = {
  readonly id: string;
  readonly owner_id: string;
  readonly idempotency_key: string;
  readonly consumed_at: string;
};

async function localLedger(s: OpenSim, actor: string): Promise<LedgerRow[]> {
  return s.read(async (surf) => {
    const client = actorLocalSql(surf, actor);
    if (client === null) throw new Error(`missing ${actor} client SQL`);
    return client.query<LedgerRow>(sql<LedgerRow>`
      SELECT id, owner_id, idempotency_key, consumed_at
      FROM permissions_quota_ledger
      WHERE deleted_at IS NULL
      ORDER BY consumed_at ASC, id ASC
    `);
  });
}

async function serverLedger(s: OpenSim, owner: string): Promise<LedgerRow[]> {
  return s.read((surf) =>
    surf.sim.serverSql.sqlClient.query<LedgerRow>(sql<LedgerRow>`
      SELECT id, owner_id, idempotency_key, consumed_at
      FROM permissions_quota_ledger
      WHERE owner_id = ${owner} AND deleted_at IS NULL
      ORDER BY consumed_at ASC, id ASC
    `)
  );
}

/**
 * Invariant asserted after every step: the authoritative ledger never holds
 * two rows for one idempotency key (no double charge) and never more units
 * in one UTC day than the allowance.
 */
async function expectLedgerInvariant(
  s: OpenSim,
  owner: string,
  maxPerDay: number | null = ANONYMOUS_LIMIT
): Promise<void> {
  const rows = await serverLedger(s, owner);
  const keys = new Set(rows.map((row) => row.idempotency_key));
  expect(keys.size).toBe(rows.length);
  const perDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.consumed_at.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  if (maxPerDay === null) return;
  for (const count of perDay.values()) {
    expect(count).toBeLessThanOrEqual(maxPerDay);
  }
}

async function waitForServerCount(
  s: OpenSim,
  owner: string,
  count: number
): Promise<void> {
  for (let step = 0; step < 60; step += 1) {
    if ((await serverLedger(s, owner)).length === count) return;
    await s.advanceTime(500);
  }
  expect((await serverLedger(s, owner)).length).toBe(count);
}

/**
 * Fill the rest of today's allowance with earlier starts on the same day (as
 * if played before), on the server and in the synced local copy, without
 * driving 19 boards through the UI.
 */
async function consumeRestOfAllowance(
  s: OpenSim,
  actor: string,
  first: LedgerRow
): Promise<void> {
  const inserts = Array.from({ length: ANONYMOUS_LIMIT - 1 }, (_, i) => ({
    id: `quota-fixture-${i}`,
    key: `puzzle.rated.solve:fixture-${i}`,
  }));
  await s.read(async (surf) => {
    const client = actorLocalSql(surf, actor);
    if (client === null) throw new Error(`missing ${actor} client SQL`);
    for (const row of inserts) {
      for (const db of [client, surf.sim.serverSql.sqlClient]) {
        await db.run(sql`
          INSERT INTO permissions_quota_ledger (
            id, owner_id, quota, idempotency_key, amount, consumed_at,
            policy_version, created_at, updated_at, deleted_at
          ) VALUES (
            ${row.id}, ${first.owner_id}, 'puzzle.rated.solve', ${row.key}, 1,
            ${first.consumed_at}, 'fixture', ${first.consumed_at},
            ${first.consumed_at}, NULL
          )
        `);
      }
    }
  });
}

async function openAtLimit(name: string): Promise<{
  readonly s: OpenSim;
  readonly owner: string;
  readonly first: LedgerRow;
}> {
  const s = await openSim(name);
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  // Starting the first rated puzzle consumed exactly one unit.
  const started = await localLedger(s, 'alice');
  expect(started).toHaveLength(1);
  const first = started[0];
  if (first === undefined) throw new Error('expected one ledger row');
  await waitForServerCount(s, first.owner_id, 1);
  await expectLedgerInvariant(s, first.owner_id);
  await consumeRestOfAllowance(s, 'alice', first);
  await expectLedgerInvariant(s, first.owner_id);
  return { s, owner: first.owner_id, first };
}

async function limitVisible(s: OpenSim): Promise<boolean> {
  return s.read(isPuzzleLimitVisible, 'alice');
}

describe('rated puzzle quota (anonymous, permissive baseline)', () => {
  test('the board completes at the limit; the next start is denied and never charged', async () => {
    const { s, owner } = await openAtLimit('chess-puzzle-quota-rollover');
    await using _ = s;
    const puzzleId = await s.read(readActivePuzzleId, 'alice');
    expect(puzzleId).not.toBeNull();

    // The limit was reached mid-puzzle: the puzzle on the board completes.
    await s.apply(playUntilSolved, 'alice');
    expect(await s.read(readActivePuzzleId, 'alice')).toBe(puzzleId);
    expect(await limitVisible(s)).toBe(false);
    await expectLedgerInvariant(s, owner);

    // Starting the 21st is denied: the denial surface replaces the board.
    await s.apply(pressPuzzleNextNoWait, 'alice');
    await s.until(() => limitVisible(s), { maxMs: 15_000, stepMs: 250 });
    expect(await s.read(readActivePuzzleId, 'alice')).toBeNull();
    expect(await localLedger(s, 'alice')).toHaveLength(ANONYMOUS_LIMIT);
    await expectLedgerInvariant(s, owner);

    // The denied start never reached the server ledger.
    await s.advanceTime(2_000);
    expect(await serverLedger(s, owner)).toHaveLength(ANONYMOUS_LIMIT);
    await expectLedgerInvariant(s, owner);
  });

  test('signing in lifts the limit with no code branching on who the user is', async () => {
    const { s, owner } = await openAtLimit('chess-puzzle-quota-sign-in');
    await using _ = s;
    await s.apply(playUntilSolved, 'alice');
    await s.apply(pressPuzzleNextNoWait, 'alice');
    await s.until(() => limitVisible(s), { maxMs: 15_000, stepMs: 250 });
    await expectLedgerInvariant(s, owner);

    // Signing in changes the facts; the policy's predicates pick a role with
    // an unlimited allowance and the screen starts the next puzzle itself.
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(uiOp, {
      actorId: 'alice',
      op: 'tap',
      path: [Handles.navBack],
      extra: { timeoutMs: 15_000 },
    });
    await s.until(
      async (surf) => (await readActivePuzzleId(surf, 'alice')) !== null,
      { maxMs: 30_000, stepMs: 250 }
    );
    expect(await limitVisible(s)).toBe(false);
    // Same owner id (guest progress carries over), now without a daily cap:
    // still one row per idempotency key.
    await expectLedgerInvariant(s, owner, null);
  });
});
