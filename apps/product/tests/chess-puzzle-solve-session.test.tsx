// goal:chess-puzzles:5
/**
 * §5 session handling and load: a pending attempt survives leaving the screen
 * and killing the app, Next advances exactly once from an already-prefetched
 * puzzle (no network), and the auto-advance setting moves on by itself.
 */
import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import {
  actorLocalSql,
  countPuzzleStarts,
  createSpace,
  isPuzzleSolved,
  leavePuzzleToChessMenu,
  openPuzzleFromSpace,
  partition,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNextTwice,
  readActivePuzzleId,
  readNextPuzzleId,
  readPuzzleOutcomes,
  readPuzzleStatus,
  reenterActiveSpace,
  reopenPuzzleFromChessMenu,
  restartApp,
  returnToTabs,
  setPuzzleAutoAdvance,
  signInWithGoogle,
} from '../src/sim';
import { aliceUsername } from '../src/test/fixtures/fixtures';
import type { OpenSim } from '../src/test/setup/open-sim';
import { openSim } from '../src/test/setup/open-sim';

const WAIT_MS = 20_000;

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

async function enterPuzzle(s: OpenSim): Promise<string> {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  return required(await s.read(readActivePuzzleId, 'alice'), 'active puzzle');
}

/** Rated-start quota rows this actor's device holds (one per started puzzle). */
async function ledgerCount(s: OpenSim): Promise<number> {
  const rows = await s.read(async (surf) => {
    const db = actorLocalSql(surf, 'alice');
    if (db === null) throw new Error('missing client SQL');
    return db.query<{ readonly id: string }>(sql<{ readonly id: string }>`
      SELECT id FROM permissions_quota_ledger WHERE deleted_at IS NULL
    `);
  });
  return rows.length;
}

/** Every `started` row this actor logged, across puzzles. */
async function startedRows(s: OpenSim): Promise<number> {
  const rows = await s.read(async (surf) => {
    const db = actorLocalSql(surf, 'alice');
    if (db === null) throw new Error('missing client SQL');
    return db.query<{ readonly id: string }>(sql<{ readonly id: string }>`
      SELECT id FROM chess_puzzle_interactions
      WHERE kind = 'started' AND deleted_at IS NULL
    `);
  });
  return rows.length;
}

describe('chess puzzle session handling (§5)', () => {
  test('leaving mid-attempt keeps the puzzle pending and restores it', async () => {
    await using s = await openSim('chess-puzzle-session-leave');
    const puzzleId = await enterPuzzle(s);
    await s.apply(playWrongPuzzleMove, 'alice');
    expect(await s.read(readPuzzleOutcomes, 'alice', puzzleId)).toEqual([
      'failed',
    ]);

    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(reopenPuzzleFromChessMenu, 'alice');

    // Same puzzle, same attempt: no free skip, no second start, no new charge.
    expect(await s.read(readActivePuzzleId, 'alice')).toBe(puzzleId);
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('wrong');
    expect(await s.read(countPuzzleStarts, 'alice', puzzleId)).toBe(1);
    expect(await s.read(readPuzzleOutcomes, 'alice', puzzleId)).toEqual([
      'failed',
    ]);
    expect(await ledgerCount(s)).toBe(1);
  });

  test('the app killed mid-puzzle restores the same pending attempt', async () => {
    await using s = await openSim('chess-puzzle-session-restart');
    const puzzleId = await enterPuzzle(s);
    expect(await s.read(countPuzzleStarts, 'alice', puzzleId)).toBe(1);

    await s.apply(restartApp, 'alice');
    await s.apply(reenterActiveSpace, 'alice', aliceUsername);
    await s.until(
      async (surf) => (await readPuzzleStatus(surf, 'alice')) === 'solving',
      { maxMs: WAIT_MS }
    );

    expect(await s.read(readActivePuzzleId, 'alice')).toBe(puzzleId);
    expect(await s.read(readPuzzleOutcomes, 'alice', puzzleId)).toEqual([]);
    expect(await s.read(countPuzzleStarts, 'alice', puzzleId)).toBe(1);
    expect(await ledgerCount(s)).toBe(1);

    // The restored attempt still solves, and is rated exactly once.
    await s.apply(playUntilSolved, 'alice');
    expect(await s.read(readPuzzleOutcomes, 'alice', puzzleId)).toEqual([
      'solved',
    ]);
  });

  test('tapping Next twice advances exactly one puzzle', async () => {
    await using s = await openSim('chess-puzzle-session-next-twice');
    const first = await enterPuzzle(s);
    await s.apply(playUntilSolved, 'alice');
    await s.apply(pressPuzzleNextTwice, 'alice');

    const second = required(
      await s.read(readActivePuzzleId, 'alice'),
      'next puzzle'
    );
    expect(second).not.toBe(first);
    expect(await startedRows(s)).toBe(2);
    expect(await ledgerCount(s)).toBe(2);
  });

  test('the next puzzle is prefetched and Next needs no network', async () => {
    await using s = await openSim('chess-puzzle-session-prefetch');
    const first = await enterPuzzle(s);
    // §5 load: the next puzzle is already picked while this one is unsolved.
    const prefetched = required(
      await s.read(readNextPuzzleId, 'alice'),
      'prefetched puzzle'
    );
    expect(prefetched).not.toBe(first);

    await s.apply(playUntilSolved, 'alice');
    await s.apply(partition, 'alice');
    await s.apply(pressPuzzleNextTwice, 'alice');
    expect(await s.read(readActivePuzzleId, 'alice')).not.toBe(first);
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('solving');
  });

  test('auto-advance moves on by itself after a solve', async () => {
    await using s = await openSim('chess-puzzle-session-auto-advance');
    const first = await enterPuzzle(s);
    await s.apply(setPuzzleAutoAdvance, 'alice', 'after1s');

    await s.apply(playUntilSolved, 'alice');
    await s.until(
      async (surf) => {
        const active = await readActivePuzzleId(surf, 'alice');
        return active !== null && active !== first;
      },
      { maxMs: WAIT_MS }
    );
    expect(await s.read(isPuzzleSolved, 'alice')).toBe(false);
  });
});
