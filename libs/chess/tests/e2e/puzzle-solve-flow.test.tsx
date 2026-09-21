// goal:chess-puzzles:5
/**
 * §5 core solve flow, §6 show solution, and the §3 input rules the solve
 * flow owns, driven through the real UI against seeded motif puzzles
 * (`fixtures/chess-puzzles-motifs.sim.csv`, one unique theme each so the feed
 * filter serves exactly the puzzle a scenario is about).
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChessPuzzleTheme } from '@libs/chess/public/chess-puzzle-themes';
import {
  choosePuzzlePromotion,
  closePuzzleFeedSettings,
  openPuzzleFeedSettings,
  openPuzzleFromSpace,
  playPuzzleMove,
  playWrongPuzzleMove,
  retryPuzzle,
  setPuzzleFeedTheme,
  showPuzzleSolutionLine,
} from '@libs/chess/sim/chess-actions';
import { ingestChessPuzzleCsv } from '@libs/chess/sim/chess-puzzle-data';
import {
  readPuzzleBoardProbe,
  readPuzzleHaptics,
  readPuzzleInteractions,
  readPuzzleOutcomes,
  readPuzzlePromotionPending,
  readPuzzlePrompt,
} from '@libs/chess/sim/chess-puzzle-solve-ui';
import {
  isPuzzleSolved,
  readActivePuzzleId,
  readPuzzleDebug,
  readPuzzleStatus,
} from '@libs/chess/sim/chess-puzzle-ui';
import { SIM_CHESS_FIXTURES_DIR } from '@libs/chess/sim/sim-chess-puzzles';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import type { OpenSim } from './support/open-chess-sim';
import { openSim } from './support/open-chess-sim';

const MOTIF_CSV = readFileSync(
  join(SIM_CHESS_FIXTURES_DIR, 'chess-puzzles-motifs.sim.csv'),
  'utf8'
);

const WAIT_MS = 20_000;

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

/**
 * Seed the motif puzzles, sign in, open the board and narrow the feed to one
 * theme so `puzzleId` is the puzzle on the board.
 */
async function enterMotifPuzzle(
  s: OpenSim,
  theme: ChessPuzzleTheme,
  puzzleId: string
): Promise<void> {
  await s.apply(ingestChessPuzzleCsv, MOTIF_CSV);
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  await s.apply(openPuzzleFeedSettings, 'alice');
  await s.apply(setPuzzleFeedTheme, 'alice', theme);
  await s.apply(closePuzzleFeedSettings, 'alice');
  await s.until(
    async (surf) => (await readActivePuzzleId(surf, 'alice')) === puzzleId,
    { maxMs: WAIT_MS }
  );
}

/** The solver may move: the room is solving and the board is unlocked. */
async function waitSolverToMove(s: OpenSim): Promise<void> {
  await s.until(
    async (surf) =>
      (await readPuzzleBoardProbe(surf, 'alice'))?.interactive === true,
    { maxMs: WAIT_MS }
  );
}

async function expectSolvedOnce(s: OpenSim, puzzleId: string): Promise<void> {
  await s.until((surf) => isPuzzleSolved(surf, 'alice'), { maxMs: WAIT_MS });
  expect(await s.read(readPuzzleOutcomes, 'alice', puzzleId)).toEqual([
    'solved',
  ]);
}

describe('chess puzzle solve flow (§5)', () => {
  test('a clean multi-move solve: setup move, reply, one recorded outcome', async () => {
    await using s = await openSim('chess-puzzle-solve-clean');
    await enterMotifPuzzle(s, 'clearance', 'solveTR1');
    await waitSolverToMove(s);

    // §5 load: the opponent's setup move has played and the board faces the
    // solver, who is prompted to move.
    const opening = required(
      await s.read(readPuzzleBoardProbe, 'alice'),
      'board probe'
    );
    expect(opening.orientation).toBe('white');
    expect(opening.lastMove).toEqual({ from: 'a7', to: 'a6' });
    expect(opening.turn).toBe('w');
    expect(await s.read(readPuzzlePrompt, 'alice')).toBe(
      'Your turn — find the best move for White'
    );

    // §5 correct move: the opponent's reply auto-plays and input re-opens.
    await s.apply(playPuzzleMove, 'alice', 'a1a5');
    await waitSolverToMove(s);
    const afterReply = required(
      await s.read(readPuzzleBoardProbe, 'alice'),
      'board probe'
    );
    // The canned reply h7h6 played by itself and the solver is on move again.
    expect(afterReply.fen.split(' ')[0]).toBe('6k1/8/p6p/R7/8/8/8/4K2R');
    expect(afterReply.turn).toBe('w');
    expect(await s.read(readPuzzleDebug, 'alice')).toMatchObject({
      status: 'solving',
      solveIdx: 3,
    });

    await s.apply(playPuzzleMove, 'alice', 'h1h5');
    await expectSolvedOnce(s, 'solveTR1');
    expect(await s.read(readPuzzleHaptics, 'alice')).toContain('success');
  });

  test('the first wrong move is the outcome; retry, solve and show solution never re-rate', async () => {
    await using s = await openSim('chess-puzzle-solve-first-outcome');
    await enterMotifPuzzle(s, 'castling', 'solveCAS1');
    await waitSolverToMove(s);

    await s.apply(playWrongPuzzleMove, 'alice');
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('wrong');
    expect(await s.read(readPuzzleOutcomes, 'alice', 'solveCAS1')).toEqual([
      'failed',
    ]);
    expect(await s.read(readPuzzleHaptics, 'alice')).toContain('error');

    // §6: showing the solution of an already-resolved attempt re-rates nothing.
    await s.apply(showPuzzleSolutionLine, 'alice');
    expect(await s.read(readPuzzleOutcomes, 'alice', 'solveCAS1')).toEqual([
      'failed',
    ]);

    // §3: castling entered as king-onto-own-rook.
    await s.apply(retryPuzzle, 'alice');
    await waitSolverToMove(s);
    await s.apply(playPuzzleMove, 'alice', 'e1h1');
    await s.until((surf) => isPuzzleSolved(surf, 'alice'), { maxMs: WAIT_MS });
    expect(await s.read(readPuzzleOutcomes, 'alice', 'solveCAS1')).toEqual([
      'failed',
    ]);

    // §3: the same castle entered as king-two-squares.
    await s.apply(retryPuzzle, 'alice');
    await waitSolverToMove(s);
    await s.apply(playPuzzleMove, 'alice', 'e1g1');
    await s.until((surf) => isPuzzleSolved(surf, 'alice'), { maxMs: WAIT_MS });
    expect(await s.read(readPuzzleOutcomes, 'alice', 'solveCAS1')).toEqual([
      'failed',
    ]);
  });
});

describe('chess puzzle input rules (§3 / §34 interaction)', () => {
  test('only the side to move moves; an illegal drop snaps back unpunished', async () => {
    await using s = await openSim('chess-puzzle-input-rules');
    await enterMotifPuzzle(s, 'clearance', 'solveTR1');
    await waitSolverToMove(s);
    const before = required(
      await s.read(readPuzzleBoardProbe, 'alice'),
      'board probe'
    );

    // §3: the opponent's pieces are not interactive.
    await s.apply(playPuzzleMove, 'alice', 'g8f8');
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('solving');
    expect((await s.read(readPuzzleBoardProbe, 'alice'))?.fen).toBe(before.fen);

    // §3: dropping on an illegal square is no move at all — no wrong move.
    await s.apply(playPuzzleMove, 'alice', 'a1a8');
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('solving');
    expect((await s.read(readPuzzleBoardProbe, 'alice'))?.fen).toBe(before.fen);
    expect(await s.read(readPuzzleOutcomes, 'alice', 'solveTR1')).toEqual([]);
    expect(await s.read(readPuzzleInteractions, 'alice', 'solveTR1')).toEqual([
      { kind: 'started', uci: null, correct: null },
    ]);
  });

  test('input is locked after a wrong move and after the puzzle ends', async () => {
    await using s = await openSim('chess-puzzle-input-locked');
    await enterMotifPuzzle(s, 'clearance', 'solveTR1');
    await waitSolverToMove(s);

    // §3: locked while the attempt sits in `wrong` (Retry / Solution only).
    await s.apply(playWrongPuzzleMove, 'alice');
    expect((await s.read(readPuzzleBoardProbe, 'alice'))?.interactive).toBe(
      false
    );

    await s.apply(retryPuzzle, 'alice');
    await waitSolverToMove(s);
    await s.apply(playPuzzleMove, 'alice', 'a1a5');
    await waitSolverToMove(s);
    await s.apply(playPuzzleMove, 'alice', 'h1h5');
    await s.until((surf) => isPuzzleSolved(surf, 'alice'), { maxMs: WAIT_MS });

    // §3: locked once the puzzle is over.
    expect((await s.read(readPuzzleBoardProbe, 'alice'))?.interactive).toBe(
      false
    );
  });
});

describe('chess puzzle show solution (§6)', () => {
  test('the remaining line plays out, review opens and it counts as a fail', async () => {
    await using s = await openSim('chess-puzzle-show-solution');
    await enterMotifPuzzle(s, 'hookMate', 'solveFM1');
    await waitSolverToMove(s);

    await s.apply(showPuzzleSolutionLine, 'alice');
    await s.until(
      async (surf) =>
        (await readPuzzleDebug(surf, 'alice'))?.solveIdx === 4 &&
        (await readPuzzleBoardProbe(surf, 'alice'))?.status === 'checkmate',
      { maxMs: WAIT_MS }
    );
    expect(await s.read(readPuzzleOutcomes, 'alice', 'solveFM1')).toEqual([
      'failed',
    ]);
    // Review: the board is not interactive any more.
    expect((await s.read(readPuzzleBoardProbe, 'alice'))?.interactive).toBe(
      false
    );

    // Already resolved: showing it again changes nothing.
    expect(await s.read(readPuzzleOutcomes, 'alice', 'solveFM1')).toEqual([
      'failed',
    ]);
  });
});

describe('chess puzzle move rules (§34 chess logic)', () => {
  test('underpromotion is the solution and the queen is never picked for you', async () => {
    await using s = await openSim('chess-puzzle-underpromotion');
    await enterMotifPuzzle(s, 'underPromotion', 'solveUP1');
    await waitSolverToMove(s);

    // §3: the picker opens instead of auto-queening.
    await s.apply(playPuzzleMove, 'alice', 'e7e8');
    expect(await s.read(readPuzzlePromotionPending, 'alice')).toMatchObject({
      from: 'e7',
      to: 'e8',
      color: 'w',
    });
    await s.apply(choosePuzzlePromotion, 'alice', 'q');
    await s.until(
      async (surf) => (await readPuzzleStatus(surf, 'alice')) === 'wrong',
      { maxMs: WAIT_MS }
    );

    await s.apply(retryPuzzle, 'alice');
    await waitSolverToMove(s);
    await s.apply(playPuzzleMove, 'alice', 'e7e8');
    await s.apply(choosePuzzlePromotion, 'alice', 'n');
    await s.until((surf) => isPuzzleSolved(surf, 'alice'), { maxMs: WAIT_MS });
  });

  test('a capture-promotion that mates with another piece is accepted', async () => {
    await using s = await openSim('chess-puzzle-any-mate-promotion');
    await enterMotifPuzzle(s, 'promotion', 'solveCAP1');
    await waitSolverToMove(s);

    await s.apply(playPuzzleMove, 'alice', 'g7h8');
    await s.apply(choosePuzzlePromotion, 'alice', 'r');
    await expectSolvedOnce(s, 'solveCAP1');
  });

  test('en passant as the solution', async () => {
    await using s = await openSim('chess-puzzle-en-passant');
    await enterMotifPuzzle(s, 'enPassant', 'solveEP1');
    await waitSolverToMove(s);

    await s.apply(playPuzzleMove, 'alice', 'e5d6');
    await expectSolvedOnce(s, 'solveEP1');
  });

  test('another mate on the final move is accepted', async () => {
    await using s = await openSim('chess-puzzle-multiple-mates');
    await enterMotifPuzzle(s, 'killBoxMate', 'solveMM1');
    await waitSolverToMove(s);

    await s.apply(playPuzzleMove, 'alice', 'a7a8');
    await expectSolvedOnce(s, 'solveMM1');
  });

  test('a faster mate on a non-final move ends the puzzle as solved', async () => {
    await using s = await openSim('chess-puzzle-faster-mate');
    await enterMotifPuzzle(s, 'hookMate', 'solveFM1');
    await waitSolverToMove(s);

    await s.apply(playPuzzleMove, 'alice', 'b7b8');
    await expectSolvedOnce(s, 'solveFM1');
  });

  test('a transposing move is accepted and the line continues reordered', async () => {
    await using s = await openSim('chess-puzzle-transposition');
    await enterMotifPuzzle(s, 'clearance', 'solveTR1');
    await waitSolverToMove(s);

    // The stored line is a1a5 … h1h5; playing h1h5 first transposes.
    await s.apply(playPuzzleMove, 'alice', 'h1h5');
    await waitSolverToMove(s);
    expect(await s.read(readPuzzleDebug, 'alice')).toMatchObject({
      status: 'solving',
      solveIdx: 3,
    });
    await s.apply(playPuzzleMove, 'alice', 'a1a5');
    await expectSolvedOnce(s, 'solveTR1');
  });

  test('solver is Black: orientation, prompt and promotion picker follow', async () => {
    await using s = await openSim('chess-puzzle-black-solver');
    await enterMotifPuzzle(s, 'advancedPawn', 'solveBP1');
    await waitSolverToMove(s);

    const probe = required(
      await s.read(readPuzzleBoardProbe, 'alice'),
      'board probe'
    );
    expect(probe.orientation).toBe('black');
    expect(probe.turn).toBe('b');
    expect(await s.read(readPuzzlePrompt, 'alice')).toBe(
      'Your turn — find the best move for Black'
    );

    await s.apply(playPuzzleMove, 'alice', 'e2e1');
    expect(await s.read(readPuzzlePromotionPending, 'alice')).toMatchObject({
      color: 'b',
    });
    await s.apply(choosePuzzlePromotion, 'alice', 'n');
    await expectSolvedOnce(s, 'solveBP1');
  });

  test('the solver is in check at the start of the attempt', async () => {
    await using s = await openSim('chess-puzzle-check-at-start');
    await enterMotifPuzzle(s, 'defensiveMove', 'solveCK1');
    await waitSolverToMove(s);

    expect(await s.read(readPuzzleBoardProbe, 'alice')).toMatchObject({
      inCheck: true,
      turn: 'w',
    });
    await s.apply(playPuzzleMove, 'alice', 'h1h4');
    await expectSolvedOnce(s, 'solveCK1');
  });
});
