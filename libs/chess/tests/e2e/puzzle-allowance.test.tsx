/**
 * The daily rated-puzzle allowance as chess charges it: opening a puzzle
 * uses exactly one start, on the device and on the server; no start is ever
 * charged twice; a start past the limit is denied and never charged; no day
 * holds more starts than the allowance. The ledger rules themselves are in
 * `libs/permissions/tests/consume-quota.test.ts`; this pins chess's wiring.
 */

import { describe, expect, test } from 'bun:test';
import {
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNextNoWait,
} from '@libs/chess/sim/chess-actions';
import {
  type PuzzleStartLedgerRow,
  readLocalPuzzleStartLedger,
  readPuzzlePlayerId,
  readServerPuzzleStartLedger,
  useUpPuzzleStartsToday,
} from '@libs/chess/sim/chess-puzzle-ledger-data';
import { isPuzzleLimitVisible } from '@libs/chess/sim/chess-puzzle-ui';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { type OpenSim, openSim } from './support/open-chess-sim';

/** The shipped policy's rated puzzle starts a guest gets per day (GOAL). */
const GUEST_DAILY_PUZZLE_STARTS = 20;

function expectNoDoubleCharge(rows: readonly PuzzleStartLedgerRow[]): void {
  expect(new Set(rows.map((row) => row.idempotency_key)).size).toBe(
    rows.length
  );
}

function expectAtMostPerDay(
  rows: readonly PuzzleStartLedgerRow[],
  limit: number
): void {
  const perDay = new Map<string, number>();
  for (const row of rows) {
    const day = new Date(row.consumed_at).toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(limit);
}

/** A guest on their first puzzle of the day; their puzzle owner id. */
async function guestOnFirstPuzzle(s: OpenSim): Promise<string> {
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  const owner = await s.read(readPuzzlePlayerId, 'alice');
  if (owner === null) throw new Error('alice has no puzzle owner');
  return owner;
}

describe('the daily puzzle allowance, as chess charges it', () => {
  test('opening a puzzle uses exactly one start, on the device and the server', async () => {
    await using s = await openSim('puzzle-allowance-one-start');
    const owner = await guestOnFirstPuzzle(s);

    const local = await s.read(readLocalPuzzleStartLedger, 'alice');
    expect(local).toHaveLength(1);
    const today = new Date(await s.read((surf) => surf.sim.clock.now()))
      .toISOString()
      .slice(0, 10);
    expect(new Date(local[0]?.consumed_at ?? 0).toISOString()).toStartWith(
      today
    );
    await s.until(
      async (surf) =>
        (await readServerPuzzleStartLedger(surf, owner)).length === 1,
      { maxMs: 30_000 }
    );
    expectNoDoubleCharge(await s.read(readServerPuzzleStartLedger, owner));
  });

  test('a start past the limit is denied and never charged', async () => {
    await using s = await openSim('puzzle-allowance-denied-start');
    const owner = await guestOnFirstPuzzle(s);
    await s.until(
      async (surf) =>
        (await readServerPuzzleStartLedger(surf, owner)).length === 1,
      { maxMs: 30_000 }
    );
    await s.apply(useUpPuzzleStartsToday, 'alice', GUEST_DAILY_PUZZLE_STARTS);

    await s.apply(playUntilSolved, 'alice');
    await s.apply(pressPuzzleNextNoWait, 'alice');
    await s.until((surf) => isPuzzleLimitVisible(surf, 'alice'), {
      maxMs: 15_000,
    });
    await s.advanceTime(2_000);

    const server = await s.read(readServerPuzzleStartLedger, owner);
    expect(server).toHaveLength(GUEST_DAILY_PUZZLE_STARTS);
    expectNoDoubleCharge(server);
    expectAtMostPerDay(server, GUEST_DAILY_PUZZLE_STARTS);
    expect(await s.read(readLocalPuzzleStartLedger, 'alice')).toHaveLength(
      GUEST_DAILY_PUZZLE_STARTS
    );
  });
});
