// goal:chess-puzzles:7
/**
 * §7 post-solve review: the move list, the scrub controls, arrow keys,
 * Home / End, swipe, and the animate-on-step / snap-on-jump rule — driven
 * through the real UI against the seeded `01Xbe` mate-in-2 (a four-ply line,
 * so start / step / tap / end are four distinct positions).
 */

import { describe, expect, test } from 'bun:test';
import { fenAtSolveIdx } from '@libs/chess/public/chess-puzzle-step';
import {
  closePuzzleFeedSettings,
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openPuzzleFeedSettings,
  openPuzzleFromSpace,
  openPuzzleReview,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleReviewArrow,
  pressPuzzleReviewNav,
  setPuzzleFeedTheme,
  showPuzzleSolutionLine,
  skipPuzzle,
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
  readActivePuzzleId,
  readPuzzleDebug,
} from '@libs/chess/sim/chess-puzzle-ui';
import { SIM_CHESS_PUZZLE_MATE_IN_2 } from '@libs/chess/sim/sim-chess-puzzles';
import {
  partition,
  restoreNetwork,
  returnToTabs,
  signInWithGoogle,
} from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import type { OpenSim } from './support/open-chess-sim';
import { openSim } from './support/open-chess-sim';

const WAIT_MS = 20_000;
/** The seeded four-ply line: `g3h4 g6g5 h4g3 a2g2`. */
const PUZZLE_ID = SIM_CHESS_PUZZLE_MATE_IN_2.id;
const LINE_LENGTH = SIM_CHESS_PUZZLE_MATE_IN_2.moves.split(' ').length;

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

/** Sign in, open the board and pin the feed to the one mate-in-2 puzzle. */
async function enterReviewPuzzle(s: OpenSim): Promise<void> {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  await s.apply(openPuzzleFeedSettings, 'alice');
  await s.apply(setPuzzleFeedTheme, 'alice', 'mateIn2');
  await s.apply(closePuzzleFeedSettings, 'alice');
  await s.until(
    async (surf) => (await readActivePuzzleId(surf, 'alice')) === PUZZLE_ID,
    { maxMs: WAIT_MS }
  );
}

async function openReview(s: OpenSim): Promise<LocalPuzzleRow> {
  const row = required(
    await s.read(readLocalPuzzleRow, 'alice', PUZZLE_ID),
    'local puzzle row'
  );
  await s.apply(leavePuzzleToChessMenu, 'alice');
  await s.apply(openChessStatsScreen, 'alice');
  await s.apply(openPuzzleReview, 'alice', PUZZLE_ID);
  await s.read(waitPuzzleReviewReady, 'alice');
  return row;
}

/** The position the line reaches after `solveIdx` plies. */
function expectedFen(row: LocalPuzzleRow, solveIdx: number): string {
  return required(
    fenAtSolveIdx({ fen: row.fen, moves: row.moves, solveIdx }),
    `fen at ${String(solveIdx)}`
  );
}

async function expectAt(
  s: OpenSim,
  row: LocalPuzzleRow,
  args: { solveIdx: number; animated: boolean }
): Promise<void> {
  const probe = required(
    await s.read(readPuzzleReviewProbe, 'alice'),
    'review probe'
  );
  expect(probe.solveIdx).toBe(args.solveIdx);
  expect(probe.lastSolveIdx).toBe(LINE_LENGTH);
  // §7: one ply animates, a jump snaps.
  expect(probe.animated).toBe(args.animated);
  expect(await s.read(readPuzzleReviewFen, 'alice')).toBe(
    expectedFen(row, args.solveIdx)
  );
  // §7: the current move is the highlighted one, always.
  expect(await s.read(readSelectedMoveLabel, 'alice')).toStartWith(
    `${String(args.solveIdx - 1)}|`
  );
}

describe('§7 post-solve review', () => {
  test('buttons, the move list and the ends scrub the solved line', async () => {
    await using s = await openSim('chess-puzzle-review-buttons');
    await enterReviewPuzzle(s);
    await s.apply(playUntilSolved, 'alice');
    const row = await openReview(s);

    // Review opens on the final position of the line.
    await expectAt(s, row, { solveIdx: LINE_LENGTH, animated: false });
    // SAN, not figurine, until the preference says otherwise.
    expect(await s.read(readPuzzleReviewMoveLabels, 'alice')).toEqual([
      'Kh4',
      'g5+',
      'Kg3',
      'Rg2#',
    ]);

    await s.apply(pressPuzzleReviewNav, 'alice', 'back');
    await expectAt(s, row, { solveIdx: LINE_LENGTH - 1, animated: true });

    await s.apply(pressPuzzleReviewNav, 'alice', 'forward');
    await expectAt(s, row, { solveIdx: LINE_LENGTH, animated: true });

    await s.apply(pressPuzzleReviewNav, 'alice', 'start');
    await expectAt(s, row, { solveIdx: 1, animated: false });

    await s.apply(pressPuzzleReviewNav, 'alice', 'end');
    await expectAt(s, row, { solveIdx: LINE_LENGTH, animated: false });

    // Tapping a ply jumps straight to the position after it.
    await s.apply(tapPuzzleReviewMove, 'alice', 1);
    await expectAt(s, row, { solveIdx: 2, animated: false });

    // One ply back from a tap is a step again.
    await s.apply(pressPuzzleReviewNav, 'alice', 'back');
    await expectAt(s, row, { solveIdx: 1, animated: true });
  });

  test('arrow keys step and Home / End jump', async () => {
    await using s = await openSim('chess-puzzle-review-keys');
    await enterReviewPuzzle(s);
    await s.apply(playUntilSolved, 'alice');
    const row = await openReview(s);

    await s.apply(pressPuzzleReviewArrow, 'alice', 'arrowLeft');
    await expectAt(s, row, { solveIdx: LINE_LENGTH - 1, animated: true });

    await s.apply(pressPuzzleReviewArrow, 'alice', 'arrowRight');
    await expectAt(s, row, { solveIdx: LINE_LENGTH, animated: true });

    await s.apply(pressPuzzleReviewArrow, 'alice', 'home');
    await expectAt(s, row, { solveIdx: 1, animated: false });

    await s.apply(pressPuzzleReviewArrow, 'alice', 'end');
    await expectAt(s, row, { solveIdx: LINE_LENGTH, animated: false });
  });

  test('a horizontal swipe scrubs one ply at a time', async () => {
    await using s = await openSim('chess-puzzle-review-swipe');
    await enterReviewPuzzle(s);
    await s.apply(playUntilSolved, 'alice');
    const row = await openReview(s);

    await s.apply(swipePuzzleReview, 'alice', 'back');
    await expectAt(s, row, { solveIdx: LINE_LENGTH - 1, animated: true });

    await s.apply(swipePuzzleReview, 'alice', 'forward');
    await expectAt(s, row, { solveIdx: LINE_LENGTH, animated: true });
  });

  test('review after a failed attempt still scrubs the whole line', async () => {
    await using s = await openSim('chess-puzzle-review-failed');
    await enterReviewPuzzle(s);
    await s.apply(playWrongPuzzleMove, 'alice');
    await s.apply(skipPuzzle, 'alice');
    const row = await openReview(s);

    // The player never reached the end, but review shows the whole solution.
    await expectAt(s, row, { solveIdx: LINE_LENGTH, animated: false });
    await s.apply(pressPuzzleReviewNav, 'alice', 'start');
    await expectAt(s, row, { solveIdx: 1, animated: false });
  });

  test('the revealed state scrubs the full line in place', async () => {
    await using s = await openSim('chess-puzzle-review-revealed');
    await enterReviewPuzzle(s);
    await s.apply(showPuzzleSolutionLine, 'alice');
    await s.until(
      async (surf) =>
        (await readPuzzleDebug(surf, 'alice'))?.status === 'revealed',
      { maxMs: WAIT_MS }
    );

    // The play screen's own move bar carries the §7 jump controls.
    await s.apply(pressPuzzleReviewNav, 'alice', 'start');
    await s.until(
      async (surf) => (await readPuzzleDebug(surf, 'alice'))?.solveIdx === 1,
      { maxMs: WAIT_MS }
    );

    await s.apply(pressPuzzleReviewNav, 'alice', 'end');
    await s.until(
      async (surf) =>
        (await readPuzzleDebug(surf, 'alice'))?.solveIdx === LINE_LENGTH,
      { maxMs: WAIT_MS }
    );
  });

  // §34: "puzzle retired / edited after being prefetched".
  test('a retired puzzle still opens in review from the game log', async () => {
    await using s = await openSim('chess-puzzle-review-retired');
    await enterReviewPuzzle(s);
    await s.apply(playUntilSolved, 'alice');
    const row = required(
      await s.read(readLocalPuzzleRow, 'alice', PUZZLE_ID),
      'local puzzle row'
    );

    // Retire it on the server, then let the client re-hydrate its pool: the
    // tombstone rides the ordinary snapshot, no test-only write path.
    await s.apply(partition, 'alice');
    await s.apply(retireChessPuzzle, PUZZLE_ID);
    await s.apply(restoreNetwork);
    await s.until(
      async (surf) =>
        (await readLocalPuzzleRow(surf, 'alice', PUZZLE_ID))?.deleted === true,
      { maxMs: WAIT_MS }
    );

    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    await s.apply(openPuzzleReview, 'alice', PUZZLE_ID);
    await s.read(waitPuzzleReviewReady, 'alice');

    // The recorded line is intact and still scrubs.
    await expectAt(s, row, { solveIdx: LINE_LENGTH, animated: false });
    await s.apply(pressPuzzleReviewNav, 'alice', 'start');
    await expectAt(s, row, { solveIdx: 1, animated: false });
  });
});
