/**
 * Reviewing a played puzzle of the run's game from the game log, and
 * stepping through the line in place once its solution is shown. "Move N"
 * is the position after the Nth move of the line, with move N highlighted;
 * every position expected is the known puzzle's, asked of the game's rules.
 */

import { expect } from 'bun:test';
import { solveKnownPuzzle } from '@libs/game-session-harness/puzzle-moves';
import type { ReviewControl } from '@libs/game-session-harness/puzzle-records';
import {
  chooseReviewMove,
  flickReview,
  isPuzzleRetiredOnDevice,
  openPuzzleReviewFromLog,
  pressReviewKey,
  readPuzzleReview,
  readPuzzleReviewHighlight,
  readPuzzleReviewMoves,
  readPuzzleReviewPosition,
  retireCataloguePuzzle,
  useReviewControl,
} from '@libs/game-session-harness/puzzle-records';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  currentPuzzle,
  focusStats,
  lastPuzzlePlayer,
  lineOf,
  puzzleGameId,
  puzzleOn,
  SETTLE_MS,
  writtenAs,
} from './puzzle-world';

type Direction = 'back' | 'forward';
type End = 'start' | 'end';

/** Open the review of `actor`'s current puzzle from the game log. */
async function openReview(w: HarnessWorld, actor: Actor): Promise<void> {
  await focusStats(w, actor);
  await w.s.apply(openPuzzleReviewFromLog, actor, currentPuzzle(w, actor));
}

/** The review shows move `move` of `of`, reached as said, and highlights it. */
async function expectReviewAt(
  w: HarnessWorld,
  actor: Actor,
  at: { move: number; of: number; animated: boolean }
): Promise<void> {
  const line = lineOf(w, puzzleOn(w, actor));
  expect(line).toHaveLength(at.of + 1);
  expect(await w.s.read(readPuzzleReview, actor)).toEqual({
    move: at.move,
    of: at.of,
    animated: at.animated,
  });
  expect(await w.s.read(readPuzzleReviewPosition, actor)).toBe(
    line[at.move] ?? null
  );
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
    await w.s.apply(focusActor, actor);
    await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
    await openReview(w, actor);
    // The review opens on the last move; any other is chosen from the list.
    if (move !== puzzleOn(w, actor).record.line.length)
      await w.s.apply(chooseReviewMove, actor, move);
  }
);

Then(
  "{actor}'s review is at move {int} of {int}, reached with animation",
  async (w, actor: Actor, move: number, of: number) => {
    await expectReviewAt(w, actor, { move, of, animated: true });
  }
);

Then(
  "{actor}'s review is at move {int} of {int}, reached without animation",
  async (w, actor: Actor, move: number, of: number) => {
    await expectReviewAt(w, actor, { move, of, animated: false });
  }
);

Then(
  "{actor}'s review lists the line's moves as the game writes them",
  async (w, actor: Actor) => {
    expect(await w.s.read(readPuzzleReviewMoves, actor)).toEqual(
      puzzleOn(w, actor).labels.map((label) => writtenAs(w, label))
    );
  }
);

When(
  '{actor} steps {direction} one move in the review',
  async (w, actor: Actor, way: Direction) => {
    await w.s.apply(useReviewControl, actor, way);
  }
);

When(
  '{actor} steps {direction} one move in the review with the keyboard',
  async (w, actor: Actor, way: Direction) => {
    await w.s.apply(
      pressReviewKey,
      actor,
      way === 'back' ? 'arrowLeft' : 'arrowRight'
    );
  }
);

When(
  '{actor} jumps to the {end} of the review',
  async (w, actor: Actor, end: End) => {
    await w.s.apply(useReviewControl, actor, end satisfies ReviewControl);
  }
);

When(
  '{actor} jumps to the {end} of the review with the keyboard',
  async (w, actor: Actor, end: End) => {
    await w.s.apply(pressReviewKey, actor, end === 'start' ? 'home' : 'end');
  }
);

When(
  '{actor} jumps to the {end} of the revealed line',
  async (w, actor: Actor, end: End) => {
    await w.s.apply(focusActor, actor);
    await w.s.apply(useReviewControl, actor, end);
  }
);

When(
  "{actor} chooses move {int} from the review's move list",
  async (w, actor: Actor, move: number) => {
    await w.s.apply(chooseReviewMove, actor, move);
  }
);

When(
  '{actor} flicks the review {direction} one move',
  async (w, actor: Actor, way: Direction) => {
    await w.s.apply(flickReview, actor, way);
  }
);

Given('the puzzle has since been retired', async (w) => {
  const actor = lastPuzzlePlayer(w);
  const puzzle = currentPuzzle(w, actor);
  await w.s.apply(retireCataloguePuzzle, puzzle);
  // Precondition guard: the retirement has reached the solver's device.
  await w.s.until((surf) => isPuzzleRetiredOnDevice(surf, actor, puzzle), {
    maxMs: SETTLE_MS,
  });
});
