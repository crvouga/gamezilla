/**
 * Reviewing a played puzzle's line from the game log, and stepping through
 * the line in place once the solution is shown. "Move N" is the position
 * after the Nth move of the line, with move N highlighted.
 */

import { expect } from 'bun:test';
import { playUntilSolved } from '@libs/chess-puzzle-harness/chess-actions';
import type { LocalPuzzleRow } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { readLocalPuzzleRow } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { readRenderedPuzzleReviewBoard } from '@libs/chess-puzzle-harness/chess-puzzle-review-ui';
import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { canonicalReviewPosition } from '@libs/chess-puzzle-harness/puzzle-review-oracle';
import {
  chooseReviewMove,
  openPuzzleReviewFromLog,
  readPuzzleReview,
  readPuzzleReviewHighlight,
  readPuzzleReviewMoves,
  readPuzzleReviewPosition,
  retireCataloguePuzzle,
  useReviewControl,
} from '@libs/game-session-harness/puzzle-records';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { remember } from '@libs/harness/spec-world';
import { markPuzzleSoundBoundary } from './puzzle-sound-evidence';
import {
  currentPuzzle,
  ensureStatsOpen,
  enterNamedPuzzle,
  lastPlayer,
  recalled,
  required,
  SETTLE_MS,
} from './puzzle-world';

const reviewedKey = (actor: Actor) => `reviewedLine:${actor}`;

type Direction = 'back' | 'forward';

/** Open the current puzzle's review from the game log. */
async function openReview(w: HarnessWorld, actor: Actor): Promise<void> {
  const puzzle = currentPuzzle(w, actor);
  const row = required(
    await w.s.read(readLocalPuzzleRow, actor, puzzle),
    `${actor}'s copy of puzzle ${puzzle}`
  );
  remember(w, reviewedKey(actor), row);
  await ensureStatsOpen(w, actor);
  await w.s.apply(openPuzzleReviewFromLog, actor, puzzle);
}

/** The position the reviewed line reaches after `move` moves. */
async function expectReviewAt(
  w: HarnessWorld,
  actor: Actor,
  at: { move: number; of: number; animated: boolean }
): Promise<void> {
  const row = recalled<LocalPuzzleRow>(w, reviewedKey(actor));
  expect(row.moves.split(' ')).toHaveLength(at.of);
  // One move animates; a jump snaps.
  expect(await w.s.read(readPuzzleReview, actor)).toEqual(at);
  expect(await w.s.read(readPuzzleReviewPosition, actor)).toBe(
    canonicalReviewPosition(row, at.move)
  );
  expect((await w.s.read(readRenderedPuzzleReviewBoard, actor)).fen).toBe(
    canonicalReviewPosition(row, at.move)
  );
  // The current move is the highlighted one.
  expect(await w.s.read(readPuzzleReviewHighlight, actor)).toBe(at.move);
}

When(
  "{actor} opens the puzzle's review from their game log",
  async (w, actor: Actor) => {
    await openReview(w, actor);
  }
);

Given(
  '{actor} is reviewing the solved puzzle at move {int}',
  async (w, actor: Actor, move: number) => {
    if (!w.memo.has('puzzle:' + actor))
      await enterNamedPuzzle(w, actor, NAMED_PUZZLES.fourMoveMateInTwo);
    await w.s.apply(playUntilSolved, actor);
    await openReview(w, actor);
    // The review opens on the last move; any other is chosen from the list.
    const last = recalled<LocalPuzzleRow>(w, reviewedKey(actor)).moves.split(
      ' '
    ).length;
    if (move !== last) await w.s.apply(chooseReviewMove, actor, move);
    await w.s.read(readRenderedPuzzleReviewBoard, actor);
  }
);

Then(
  "{actor}'s review is at move {int} of {int}, reached with animation",
  async (w, actor: Actor, move: number, of: number) => {
    await expectReviewAt(w, actor, { move, of, animated: true });
  }
);

Then(
  "{actor}'s review lists the moves {string}",
  async (w, actor: Actor, moves: string) => {
    expect(await w.s.read(readPuzzleReviewMoves, actor)).toEqual(
      moves.split(',').map((move) => move.trim())
    );
  }
);

When(
  '{actor} steps {direction} one move in the review',
  async (w, actor: Actor, way: Direction) => {
    await markPuzzleSoundBoundary(w, actor);
    await w.s.apply(useReviewControl, actor, way);
  }
);

Given('the puzzle has since been retired', async (w) => {
  const actor = lastPlayer(w);
  const puzzle = currentPuzzle(w, actor);
  await w.s.apply(retireCataloguePuzzle, puzzle);
  // Precondition guard: the retirement has reached the player's device.
  await w.s.until((surf) => readLocalPuzzleRow(surf, actor, puzzle), {
    maxMs: SETTLE_MS,
    pred: (row) => row?.deleted === true,
  });
});
