/**
 * Reviewing a played puzzle's line from the game log, and stepping through
 * the line in place once the solution is shown. "Move N" is the position
 * after the Nth move of the line, with move N highlighted.
 */

import { expect } from 'bun:test';
import {
  openPuzzleReview,
  playUntilSolved,
  pressPuzzleReviewArrow,
  pressPuzzleReviewNav,
  swipePuzzleReview,
  tapPuzzleReviewMove,
} from '@libs/chess/harness/chess-actions';
import {
  type LocalPuzzleRow,
  readLocalPuzzleRow,
  retireChessPuzzle,
} from '@libs/chess/harness/chess-puzzle-data';
import {
  readPuzzleReviewFen,
  readPuzzleReviewMoveLabels,
  readPuzzleReviewProbe,
  readRenderedPuzzleReviewBoard,
  readSelectedMoveLabel,
  waitPuzzleReviewReady,
} from '@libs/chess/harness/chess-puzzle-review-ui';
import { NAMED_PUZZLES } from '@libs/chess/harness/puzzle-fixtures';
import { canonicalReviewPosition } from '@libs/chess/harness/puzzle-review-oracle';
import {
  type Actor,
  Given,
  type HarnessWorld,
  Then,
  When,
} from '@libs/harness/spec/define';
import { remember } from '@libs/harness/spec/world';
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
type End = 'start' | 'end';

/** Open the current puzzle's review from the game log. */
async function openReview(w: HarnessWorld, actor: Actor): Promise<void> {
  const puzzle = currentPuzzle(w, actor);
  const row = required(
    await w.s.read(readLocalPuzzleRow, actor, puzzle),
    `${actor}'s copy of puzzle ${puzzle}`
  );
  remember(w, reviewedKey(actor), row);
  await ensureStatsOpen(w, actor);
  await w.s.apply(openPuzzleReview, actor, puzzle);
  await w.s.read(waitPuzzleReviewReady, actor);
}

/** The position the reviewed line reaches after `move` moves. */
async function expectReviewAt(
  w: HarnessWorld,
  actor: Actor,
  at: { move: number; of: number; animated: boolean }
): Promise<void> {
  const row = recalled<LocalPuzzleRow>(w, reviewedKey(actor));
  expect(row.moves.split(' ')).toHaveLength(at.of);
  const probe = required(
    await w.s.read(readPuzzleReviewProbe, actor),
    'review probe'
  );
  expect(probe.solveIdx).toBe(at.move);
  expect(probe.lastSolveIdx).toBe(at.of);
  // One move animates; a jump snaps.
  expect(probe.animated).toBe(at.animated);
  expect(await w.s.read(readPuzzleReviewFen, actor)).toBe(
    canonicalReviewPosition(row, at.move)
  );
  expect((await w.s.read(readRenderedPuzzleReviewBoard, actor)).fen).toBe(
    canonicalReviewPosition(row, at.move)
  );
  // The current move is the highlighted one.
  expect(await w.s.read(readSelectedMoveLabel, actor)).toStartWith(
    `${String(at.move - 1)}|`
  );
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
    if (move !== last) await w.s.apply(tapPuzzleReviewMove, actor, move - 1);
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
  "{actor}'s review is at move {int} of {int}, reached without animation",
  async (w, actor: Actor, move: number, of: number) => {
    await expectReviewAt(w, actor, { move, of, animated: false });
  }
);

Then(
  "{actor}'s review lists the moves {string}",
  async (w, actor: Actor, moves: string) => {
    expect(await w.s.read(readPuzzleReviewMoveLabels, actor)).toEqual(
      moves.split(',').map((move) => move.trim())
    );
  }
);

When(
  '{actor} steps {direction} one move in the review',
  async (w, actor: Actor, way: Direction) => {
    await markPuzzleSoundBoundary(w, actor);
    await w.s.apply(pressPuzzleReviewNav, actor, way);
  }
);

When(
  '{actor} steps {direction} one move in the review with the keyboard',
  async (w, actor: Actor, way: Direction) => {
    const key = way === 'back' ? 'arrowLeft' : 'arrowRight';
    await w.s.apply(pressPuzzleReviewArrow, actor, key);
  }
);

When(
  '{actor} jumps to the {end} of the review',
  async (w, actor: Actor, which: End) => {
    await w.s.apply(pressPuzzleReviewNav, actor, which);
  }
);

When(
  '{actor} jumps to the {end} of the review with the keyboard',
  async (w, actor: Actor, which: End) => {
    const key = which === 'start' ? 'home' : 'end';
    await w.s.apply(pressPuzzleReviewArrow, actor, key);
  }
);

When(
  '{actor} jumps to the {end} of the revealed line',
  async (w, actor: Actor, which: End) => {
    await w.s.apply(pressPuzzleReviewNav, actor, which);
  }
);

When(
  "{actor} chooses move {int} from the review's move list",
  async (w, actor: Actor, move: number) => {
    await w.s.apply(tapPuzzleReviewMove, actor, move - 1);
  }
);

When(
  '{actor} flicks the review {direction} one move',
  async (w, actor: Actor, way: Direction) => {
    await w.s.apply(swipePuzzleReview, actor, way);
  }
);

Given('the puzzle has since been retired', async (w) => {
  const actor = lastPlayer(w);
  const puzzle = currentPuzzle(w, actor);
  await w.s.apply(retireChessPuzzle, puzzle);
  // Precondition guard: the retirement has reached the player's device.
  await w.s.until((surf) => readLocalPuzzleRow(surf, actor, puzzle), {
    maxMs: SETTLE_MS,
    pred: (row) => row?.deleted === true,
  });
});
