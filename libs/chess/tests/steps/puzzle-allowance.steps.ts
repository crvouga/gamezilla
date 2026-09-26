/**
 * The daily rated-puzzle allowance: puzzle starts used on the device and
 * recorded on the server, never charged twice, never past the day's limit,
 * and the limit itself as an invitation rather than an error.
 */

import { expect } from 'bun:test';

import { openPuzzleFromSpace } from '@libs/chess/sim/chess-actions';
import {
  addEarlierCompletedPuzzles,
  countAllPuzzleStarts,
  countCompletedPuzzles,
  type PuzzleStartLedgerRow,
  readLocalPuzzleStartLedger,
  readServerPuzzleStartLedger,
  useUpPuzzleStartsToday,
} from '@libs/chess/sim/chess-puzzle-ledger-data';
import { isPuzzleLimitVisible } from '@libs/chess/sim/chess-puzzle-ui';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { puzzleOwner, SECOND_MS, SETTLE_MS, trackPuzzle } from './puzzle-world';

/** The shipped policy's rated puzzle starts a guest gets per day. */
const GUEST_DAILY_PUZZLE_STARTS = 20;
/** Earlier completed puzzles a guest's history starts with. */
const EARLIER_COMPLETED = 20;

async function serverLedger(
  w: SimWorld,
  actor: Actor
): Promise<PuzzleStartLedgerRow[]> {
  return w.s.read(readServerPuzzleStartLedger, await puzzleOwner(w, actor));
}

function dayOf(row: PuzzleStartLedgerRow): string {
  return new Date(row.consumed_at).toISOString().slice(0, 10);
}

async function today(w: SimWorld): Promise<string> {
  const now = await w.s.read((surf) => Promise.resolve(surf.sim.clock.now()));
  return new Date(now).toISOString().slice(0, 10);
}

async function untilServerStarts(
  w: SimWorld,
  actor: Actor,
  count: number,
  maxMs: number
): Promise<void> {
  const owner = await puzzleOwner(w, actor);
  await w.s.until((surf) => readServerPuzzleStartLedger(surf, owner), {
    maxMs,
    pred: (rows) => rows.length === count,
  });
}

async function expectNoDoubleCharge(w: SimWorld, actor: Actor): Promise<void> {
  const rows = await serverLedger(w, actor);
  expect(new Set(rows.map((row) => row.idempotency_key)).size).toBe(
    rows.length
  );
}

async function expectAtMostPerDay(
  w: SimWorld,
  actor: Actor,
  limit: number
): Promise<void> {
  const perDay = new Map<string, number>();
  for (const row of await serverLedger(w, actor)) {
    perDay.set(dayOf(row), (perDay.get(dayOf(row)) ?? 0) + 1);
  }
  for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(limit);
}

Given(
  "{actor} is a guest who reached today's puzzle limit while solving a puzzle",
  async (w, actor: Actor) => {
    await w.s.apply(createSpace, actor);
    await w.s.apply(openPuzzleFromSpace, actor);
    await trackPuzzle(w, actor);
    // Starting this puzzle used exactly one unit, and the server has it.
    expect(await w.s.read(readLocalPuzzleStartLedger, actor)).toHaveLength(1);
    await untilServerStarts(w, actor, 1, 30 * SECOND_MS);
    await expectNoDoubleCharge(w, actor);
    await w.s.apply(useUpPuzzleStartsToday, actor, GUEST_DAILY_PUZZLE_STARTS);
    await expectNoDoubleCharge(w, actor);
    await expectAtMostPerDay(w, actor, GUEST_DAILY_PUZZLE_STARTS);
  }
);

Then(
  "{actor}'s device has used {int} puzzle start(s) today",
  async (w, actor: Actor, count: number) => {
    const rows = await w.s.read(readLocalPuzzleStartLedger, actor);
    expect(rows).toHaveLength(count);
    const day = await today(w);
    for (const row of rows) expect(dayOf(row)).toBe(day);
  }
);

Then(
  "{actor}'s device has used {int} puzzle start(s)",
  async (w, actor: Actor, count: number) => {
    expect(await w.s.read(readLocalPuzzleStartLedger, actor)).toHaveLength(
      count
    );
  }
);

Then(
  'the server records {int} puzzle start(s) for {actor}',
  async (w, count: number, actor: Actor) => {
    await untilServerStarts(w, actor, count, SETTLE_MS);
    expect(await serverLedger(w, actor)).toHaveLength(count);
  }
);

Then(
  'no puzzle start is charged twice for {actor}',
  async (w, actor: Actor) => {
    await expectNoDoubleCharge(w, actor);
  }
);

Then(
  'the server records no more than {int} puzzle starts for {actor} in a day',
  async (w, limit: number, actor: Actor) => {
    await expectAtMostPerDay(w, actor, limit);
  }
);

Then(
  '{actor} has started {int} puzzles in all',
  async (w, actor: Actor, count: number) => {
    expect(await w.s.read(countAllPuzzleStarts, actor)).toBe(count);
  }
);

Then('{actor} is not shown the puzzle limit', async (w, actor: Actor) => {
  expect(await w.s.read(isPuzzleLimitVisible, actor)).toBe(false);
});

Then(
  '{actor} is shown the puzzle limit within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((surf) => isPuzzleLimitVisible(surf, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

When(
  "twenty earlier completed puzzles are added to {actor}'s history",
  async (w, actor: Actor) => {
    await w.s.apply(addEarlierCompletedPuzzles, actor, EARLIER_COMPLETED);
  }
);

Then(
  "{actor}'s history shows {int} completed puzzles",
  async (w, actor: Actor, count: number) => {
    expect(await w.s.read(countCompletedPuzzles, actor)).toBe(count);
  }
);
