/**
 * Reviewing a played puzzle of the run's game from the game log, and
 * stepping through the line in place once its solution is shown. "Move N"
 * is the position after the Nth move of the line, with move N highlighted;
 * every position expected is the known puzzle's, asked of the game's rules.
 */

import { expect } from 'bun:test';
import { knownPuzzleLinePoint } from '@libs/game-session-harness/puzzle-line-layout';
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
import type { Actor, PuzzleLinePoint } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { gameOf } from './game-world';
import {
  currentPuzzle,
  enterKnownPuzzle,
  focusStats,
  lastPuzzlePlayer,
  lineOf,
  noteSoundsSoFar,
  playsPuzzles,
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

/** The review shows the authored point and highlights its move, when one exists. */
async function expectReviewAt(
  w: HarnessWorld,
  actor: Actor,
  point: PuzzleLinePoint,
  animated: boolean
): Promise<void> {
  const at = knownPuzzleLinePoint(gameOf(w), puzzleOn(w, actor), point);
  const line = lineOf(w, puzzleOn(w, actor));
  expect(line).toHaveLength(at.of + 1);
  expect(await w.s.read(readPuzzleReview, actor)).toEqual({
    move: at.move,
    of: at.of,
    animated,
  });
  expect(await w.s.read(readPuzzleReviewPosition, actor)).toBe(
    line[at.move] ?? null
  );
  expect(await w.s.read(readPuzzleReviewHighlight, actor)).toBe(
    at.move === 0 ? null : at.move
  );
}

When(
  "{actor} opens the puzzle's review from their game log",
  async (w, actor: Actor) => {
    await openReview(w, actor);
  }
);

Given(
  '{actor} is reviewing the solved puzzle at {puzzlePosition}',
  async (w, actor: Actor, point: PuzzleLinePoint) => {
    // Onto the game's known puzzle first, unless already on a puzzle.
    if (!playsPuzzles(w, actor)) await enterKnownPuzzle(w, actor);
    await w.s.apply(focusActor, actor);
    await w.s.apply(solveKnownPuzzle, actor, puzzleGameId(w));
    await openReview(w, actor);
    const at = knownPuzzleLinePoint(gameOf(w), puzzleOn(w, actor), point);
    if (point === 'start') await w.s.apply(useReviewControl, actor, 'start');
    else if (point !== 'end') await w.s.apply(chooseReviewMove, actor, at.move);
  }
);

Then(
  "{actor}'s review is at {puzzlePosition}, reached {puzzleAnimation}",
  async (w, actor: Actor, point: PuzzleLinePoint, animated: boolean) => {
    await expectReviewAt(w, actor, point, animated);
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
    await noteSoundsSoFar(w, actor);
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
  "{actor} chooses the first move from the review's move list",
  async (w, actor: Actor) => {
    await w.s.apply(chooseReviewMove, actor, 1);
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
