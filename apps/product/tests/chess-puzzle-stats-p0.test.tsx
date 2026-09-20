// goal:chess-puzzles:15
/**
 * §15 P0 — current rating, total solved, overall accuracy.
 *
 * The three figures are folds of the §8 rating ledger, not of the move log:
 * an attempt contributes exactly one row per puzzle, ever, so a retry inside
 * one play and an unrated exhausted-pool repeat both leave them alone. Each
 * scenario recomputes the expected values from the server's own ledger rows
 * rather than restating them.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isProvisionalPuzzleRating,
  PUZZLE_RATING_DEFAULT,
} from '@libs/chess/public/chess-puzzle-rating';
import {
  accountIdOf,
  createSpace,
  ingestChessPuzzleCsv,
  isPuzzleAttemptRated,
  leaveChessStatsScreen,
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openPuzzleFromSpace,
  type PuzzleRatingEventRow,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNext,
  readActivePuzzleId,
  readPuzzlePickSource,
  readServerPuzzleProfile,
  readServerRatingEvents,
  readStatsAccuracy,
  readStatsElo,
  readStatsPlayed,
  readStatsRatingLabel,
  readStatsSolved,
  reopenPuzzleFromChessMenu,
  returnToTabs,
  signInWithGoogle,
  skipPuzzle,
} from '../src/sim';
import { SIM_CHESS_PUZZLES } from '../src/test/fixtures/chess-puzzles';
import type { OpenSim } from '../src/test/setup/open-sim';
import { openSim } from '../src/test/setup/open-sim';

const RATING_CSV = readFileSync(
  join(import.meta.dir, '../fixtures/chess-puzzles-rating.sim.csv'),
  'utf8'
);

const WAIT_MS = 30_000;

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

async function enterPuzzles(s: OpenSim): Promise<void> {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
}

type P0Figures = {
  readonly played: number;
  readonly solved: number;
  readonly accuracy: number;
};

/** What §15 P0 must show, recomputed from the authoritative ledger. */
function figuresFromLedger(events: readonly PuzzleRatingEventRow[]): P0Figures {
  const played = events.length;
  const solved = events.filter((e) => e.outcome === 'solved').length;
  return {
    played,
    solved,
    accuracy: played > 0 ? Math.round((solved / played) * 100) : 0,
  };
}

async function readShownFigures(s: OpenSim): Promise<P0Figures> {
  return {
    played: required(await s.read(readStatsPlayed, 'alice'), 'played tile'),
    solved: required(await s.read(readStatsSolved, 'alice'), 'solved tile'),
    accuracy: required(
      await s.read(readStatsAccuracy, 'alice'),
      'accuracy tile'
    ),
  };
}

/** Settle on the server holding exactly `events` ledger rows, then read them. */
async function settledLedger(
  s: OpenSim,
  ownerId: string,
  events: number
): Promise<readonly PuzzleRatingEventRow[]> {
  await s.until(
    async (surf) =>
      (await readServerRatingEvents(surf, ownerId)).length === events,
    { maxMs: WAIT_MS, stepMs: 100 }
  );
  return s.read(readServerRatingEvents, ownerId);
}

describe('§15 stats P0', () => {
  test('rating, solved and accuracy are folds of the rating ledger', async () => {
    await using s = await openSim('chess-puzzle-stats-p0-figures');
    await enterPuzzles(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    // Nothing played yet: the seed rating, provisional, and empty figures.
    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    expect(await s.read(readStatsRatingLabel, 'alice')).toBe(
      `${String(PUZZLE_RATING_DEFAULT)}?`
    );
    expect(await readShownFigures(s)).toEqual({
      played: 0,
      solved: 0,
      accuracy: 0,
    });

    await s.apply(leaveChessStatsScreen, 'alice');
    await s.apply(reopenPuzzleFromChessMenu, 'alice');

    // Two solves and one failure across the three seeded puzzles.
    const played: string[] = [];
    for (let i = 0; i < SIM_CHESS_PUZZLES.length; i += 1) {
      played.push(
        required(await s.read(readActivePuzzleId, 'alice'), 'active puzzle')
      );
      if (i === SIM_CHESS_PUZZLES.length - 1) {
        await s.apply(playWrongPuzzleMove, 'alice');
        await s.apply(skipPuzzle, 'alice');
      } else {
        await s.apply(playUntilSolved, 'alice');
      }
      // Invariant at every step: one ledger row per attempted puzzle.
      const rows = await s.read(readServerRatingEvents, ownerId);
      expect(new Set(rows.map((e) => e.puzzle_id)).size).toBe(rows.length);
      await s.apply(pressPuzzleNext, 'alice');
    }

    const ledger = await settledLedger(s, ownerId, SIM_CHESS_PUZZLES.length);
    const expected = figuresFromLedger(ledger);
    expect(expected).toEqual({ played: 3, solved: 2, accuracy: 67 });

    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    expect(await readShownFigures(s)).toEqual(expected);

    const profile = required(
      await s.read(readServerPuzzleProfile, ownerId),
      'server profile'
    );
    expect(await s.read(readStatsElo, 'alice')).toBe(profile.rating);
    // A fresh profile is still provisional after three attempts.
    expect(isProvisionalPuzzleRating(profile.rating_deviation)).toBe(true);
    expect(await s.read(readStatsRatingLabel, 'alice')).toBe(
      `${String(profile.rating)}?`
    );
  });

  test('an unrated repeat attempt moves none of the three figures', async () => {
    await using s = await openSim('chess-puzzle-stats-p0-repeat');
    await enterPuzzles(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    for (const _puzzle of SIM_CHESS_PUZZLES) {
      await s.apply(playUntilSolved, 'alice');
      await s.apply(pressPuzzleNext, 'alice');
    }
    const before = figuresFromLedger(
      await settledLedger(s, ownerId, SIM_CHESS_PUZZLES.length)
    );
    expect(before).toEqual({ played: 3, solved: 3, accuracy: 100 });

    // §9: the pool is exhausted, so the oldest attempt comes round unrated.
    await s.until(
      async (surf) =>
        (await readPuzzlePickSource(surf, 'alice')) === 'exhausted',
      { maxMs: WAIT_MS, stepMs: 100 }
    );
    expect(await s.read(isPuzzleAttemptRated, 'alice')).toBe(false);
    await s.apply(playUntilSolved, 'alice');

    // The ledger is unchanged, so the P0 figures are too — a replay cannot
    // inflate "solved" or accuracy.
    const after = figuresFromLedger(
      await settledLedger(s, ownerId, SIM_CHESS_PUZZLES.length)
    );
    expect(after).toEqual(before);

    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    expect(await readShownFigures(s)).toEqual(before);
  });

  test('the provisional marker clears once RD settles, figures still hold', async () => {
    await using s = await openSim('chess-puzzle-stats-p0-provisional');
    await s.apply(ingestChessPuzzleCsv, RATING_CSV);
    await enterPuzzles(s);
    const ownerId = required(await s.read(accountIdOf, 'alice'), 'account');

    // Alternate solve / fail (slice 5's convergence recipe) so RD actually
    // falls instead of the rating running away from the pool.
    let attempts = 0;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const settled = await s.read(readServerPuzzleProfile, ownerId);
      if (
        settled !== null &&
        !isProvisionalPuzzleRating(settled.rating_deviation)
      ) {
        break;
      }
      if (attempt % 2 === 0) {
        await s.apply(playUntilSolved, 'alice');
      } else {
        await s.apply(playWrongPuzzleMove, 'alice');
        await s.apply(skipPuzzle, 'alice');
      }
      await s.apply(pressPuzzleNext, 'alice');
      attempts += 1;
    }

    const ledger = await settledLedger(s, ownerId, attempts);
    const profile = required(
      await s.read(readServerPuzzleProfile, ownerId),
      'server profile'
    );
    expect(isProvisionalPuzzleRating(profile.rating_deviation)).toBe(false);

    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    // Marker gone: the label is the bare rating.
    expect(await s.read(readStatsRatingLabel, 'alice')).toBe(
      String(profile.rating)
    );
    expect(await readShownFigures(s)).toEqual(figuresFromLedger(ledger));
  });
});
