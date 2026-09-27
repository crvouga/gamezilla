/**
 * Reviewing a played puzzle's line from the game log, and stepping through
 * the line in place once the solution is shown. "Move N" is the position
 * after the Nth move of the line, with move N highlighted.
 */

import { expect } from 'bun:test';

import { fenAtSolveIdx } from '@libs/chess/public/chess-puzzle-step';
import {
  openPuzzleReview,
  playUntilSolved,
  pressPuzzleReviewArrow,
  pressPuzzleReviewNav,
  swipePuzzleReview,
  tapPuzzleReviewMove,
} from '@libs/chess/sim/chess-actions';
import {
  type LocalPuzzleRow,
  readLocalPuzzleRow,
  retireChessPuzzle,
} from '@libs/chess/sim/chess-puzzle-data';
import {
  readPuzzleReviewFen,
  readPuzzleReviewMoveLabels,
  readPuzzleReviewProbe,
  readSelectedMoveLabel,
  waitPuzzleReviewReady,
} from '@libs/chess/sim/chess-puzzle-review-ui';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { remember } from '@libs/sim-harness/spec/world';
import {
  currentPuzzle,
  ensureStatsOpen,
  lastPuzzle,
  recalled,
  required,
  SECOND_MS,
} from './puzzle-world';

const reviewedKey = (actor: Actor) => `reviewedLine:${actor}`;

type Direction = 'back' | 'forward';
type End = 'start' | 'end';

function direction(word: string): Direction {
  if (word === 'back' || word === 'forward') return word;
  throw new Error(`not a direction: ${word} (back or forward)`);
}

function end(word: string): End {
  if (word === 'start' || word === 'end') return word;
  throw new Error(`not an end: ${word} (start or end)`);
}

/** Open the current puzzle's review from the game log. */
async function openReview(w: SimWorld, actor: Actor): Promise<void> {
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
function positionAt(row: LocalPuzzleRow, move: number): string {
  return required(
    fenAtSolveIdx({ fen: row.fen, moves: row.moves, solveIdx: move }),
    `the position after move ${String(move)}`
  );
}

async function expectReviewAt(
  w: SimWorld,
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
    positionAt(row, at.move)
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
  '{actor} has solved the puzzle and is reviewing it',
  async (w, actor: Actor) => {
    await w.s.apply(playUntilSolved, actor);
    await openReview(w, actor);
  }
);

Then('{actor} is reviewing that puzzle', async (w, actor: Actor) => {
  const row = recalled<LocalPuzzleRow>(w, reviewedKey(actor));
  const lineLength = row.moves.split(' ').length;
  expect(await w.s.read(readPuzzleReviewFen, actor)).toBe(
    positionAt(row, lineLength)
  );
});

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
  '{actor} steps {word} one move in the review',
  async (w, actor: Actor, way: string) => {
    await w.s.apply(pressPuzzleReviewNav, actor, direction(way));
  }
);

When(
  '{actor} steps {word} one move in the review with the keyboard',
  async (w, actor: Actor, way: string) => {
    const key = direction(way) === 'back' ? 'arrowLeft' : 'arrowRight';
    await w.s.apply(pressPuzzleReviewArrow, actor, key);
  }
);

When(
  '{actor} jumps to the {word} of the review',
  async (w, actor: Actor, which: string) => {
    await w.s.apply(pressPuzzleReviewNav, actor, end(which));
  }
);

When(
  '{actor} jumps to the {word} of the review with the keyboard',
  async (w, actor: Actor, which: string) => {
    const key = end(which) === 'start' ? 'home' : 'end';
    await w.s.apply(pressPuzzleReviewArrow, actor, key);
  }
);

When(
  '{actor} jumps to the {word} of the revealed line',
  async (w, actor: Actor, which: string) => {
    await w.s.apply(pressPuzzleReviewNav, actor, end(which));
  }
);

When(
  "{actor} chooses move {int} from the review's move list",
  async (w, actor: Actor, move: number) => {
    await w.s.apply(tapPuzzleReviewMove, actor, move - 1);
  }
);

When(
  '{actor} flicks the review {word} one move',
  async (w, actor: Actor, way: string) => {
    await w.s.apply(swipePuzzleReview, actor, direction(way));
  }
);

When('the puzzle is retired from the pool', async (w) => {
  await w.s.apply(retireChessPuzzle, lastPuzzle(w));
});

Then(
  "{actor}'s device knows the puzzle is retired within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const puzzle = currentPuzzle(w, actor);
    await w.s.until((surf) => readLocalPuzzleRow(surf, actor, puzzle), {
      maxMs: seconds * SECOND_MS,
      pred: (row) => row?.deleted === true,
    });
  }
);
