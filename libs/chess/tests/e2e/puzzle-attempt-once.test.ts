/**
 * Each attempt is recorded once: one start, and one outcome (its first),
 * whatever happens after it — a retry, a solve, showing the solution, leaving
 * and coming back, the app closing, or a doubled Next. An illegal move
 * records nothing. The Gherkin keeps what a person sees (the board, the game
 * log); this pins what the device records.
 */

import { describe, expect, test } from 'bun:test';
import {
  castlePuzzleKing,
  leavePuzzleToChessMenu,
  openPuzzleByTheme,
  openPuzzleFromSpace,
  playPuzzleMove,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNextTwice,
  retryPuzzle,
  returnToPuzzleScreen,
  showPuzzleSolutionLine,
} from '@libs/chess/sim/chess-actions';
import { ingestChessPuzzleCsv } from '@libs/chess/sim/chess-puzzle-data';
import {
  countAllPuzzleStarts,
  readLocalPuzzleStartLedger,
} from '@libs/chess/sim/chess-puzzle-ledger-data';
import {
  countPuzzleStarts,
  readPuzzleInteractions,
  readPuzzleOutcomes,
} from '@libs/chess/sim/chess-puzzle-solve-ui';
import {
  isPuzzleSolved,
  readActivePuzzleId,
  readPuzzleStatus,
} from '@libs/chess/sim/chess-puzzle-ui';
import { restartApp, returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import {
  createSpace,
  reenterActiveSpace,
} from '@libs/spaces/sim/space-actions';
import { NAMED_PUZZLES, type NamedPuzzle } from '../steps/puzzle-fixtures';
import { type OpenSim, openSim } from './support/open-chess-sim';

/** Alice signed in, on a puzzle in her space (`named`, when given). */
async function onPuzzle(s: OpenSim, named?: NamedPuzzle): Promise<string> {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
  if (named !== undefined) {
    if (named.csv !== null) await s.apply(ingestChessPuzzleCsv, named.csv);
    await s.apply(openPuzzleByTheme, 'alice', named.theme, named.id);
  }
  const puzzle = await s.read(readActivePuzzleId, 'alice');
  if (puzzle === null) throw new Error('no puzzle on the board');
  return puzzle;
}

function outcomes(s: OpenSim, puzzle: string) {
  return s.read(readPuzzleOutcomes, 'alice', puzzle);
}

describe('each attempt is recorded once', () => {
  test('finishing the line records one solved outcome', async () => {
    await using s = await openSim('attempt-once-finish-line');
    const puzzle = await onPuzzle(s, NAMED_PUZZLES.twoRookClearance);
    await s.apply(playPuzzleMove, 'alice', 'a1a5');
    await s.apply(playUntilSolved, 'alice');
    expect(await outcomes(s, puzzle)).toEqual(['solved']);
  });

  test('a wrong move records one failed outcome', async () => {
    await using s = await openSim('attempt-once-wrong-move');
    const puzzle = await onPuzzle(s, NAMED_PUZZLES.castling);
    await s.apply(playWrongPuzzleMove, 'alice');
    expect(await outcomes(s, puzzle)).toEqual(['failed']);
  });

  test('showing the solution after a wrong move rates nothing again', async () => {
    await using s = await openSim('attempt-once-wrong-then-solution');
    const puzzle = await onPuzzle(s, NAMED_PUZZLES.castling);
    await s.apply(playWrongPuzzleMove, 'alice');
    await s.apply(showPuzzleSolutionLine, 'alice');
    expect(await outcomes(s, puzzle)).toEqual(['failed']);
  });

  test('showing the solution records one failed outcome, and only one', async () => {
    await using s = await openSim('attempt-once-solution');
    const puzzle = await onPuzzle(s, NAMED_PUZZLES.hookMate);
    await s.apply(showPuzzleSolutionLine, 'alice');
    await s.until(async (surf) => readPuzzleStatus(surf, 'alice'), {
      maxMs: 20_000,
      pred: (status) => status === 'revealed',
    });
    await s.advanceTime(2_000);
    expect(await outcomes(s, puzzle)).toEqual(['failed']);
  });

  for (const entry of ['twoSquares', 'ontoRook'] as const) {
    test(`a solve on a retry, castling ${entry}, rates nothing again`, async () => {
      await using s = await openSim(`attempt-once-castle-${entry}`);
      const puzzle = await onPuzzle(s, NAMED_PUZZLES.castling);
      await s.apply(playWrongPuzzleMove, 'alice');
      await s.apply(retryPuzzle, 'alice');
      await s.apply(castlePuzzleKing, 'alice', entry);
      await s.until((surf) => isPuzzleSolved(surf, 'alice'), {
        maxMs: 20_000,
      });
      expect(await outcomes(s, puzzle)).toEqual(['failed']);
    });
  }

  test('an illegal move records only the start', async () => {
    await using s = await openSim('attempt-once-illegal-move');
    const puzzle = await onPuzzle(s, NAMED_PUZZLES.twoRookClearance);
    await s.apply(playPuzzleMove, 'alice', 'a1a8');
    expect(await s.read(readPuzzleInteractions, 'alice', puzzle)).toEqual([
      { kind: 'started', uci: null, correct: null },
    ]);
  });

  test('leaving mid-attempt and coming back starts, fails and charges once', async () => {
    await using s = await openSim('attempt-once-leave-return');
    const puzzle = await onPuzzle(s);
    await s.apply(playWrongPuzzleMove, 'alice');
    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(returnToPuzzleScreen, 'alice');
    expect(await s.read(readActivePuzzleId, 'alice')).toBe(puzzle);
    expect(await s.read(countPuzzleStarts, 'alice', puzzle)).toBe(1);
    expect(await outcomes(s, puzzle)).toEqual(['failed']);
    expect(await s.read(readLocalPuzzleStartLedger, 'alice')).toHaveLength(1);
  });

  test('closing the app mid-puzzle restores the attempt without a second start', async () => {
    await using s = await openSim('attempt-once-restart');
    const puzzle = await onPuzzle(s);
    expect(await s.read(countPuzzleStarts, 'alice', puzzle)).toBe(1);
    await s.apply(restartApp, 'alice');
    await s.apply(reenterActiveSpace, 'alice', 'alice');
    await s.until(async (surf) => readPuzzleStatus(surf, 'alice'), {
      maxMs: 20_000,
      pred: (status) => status === 'solving',
    });
    expect(await s.read(readActivePuzzleId, 'alice')).toBe(puzzle);
    expect(await outcomes(s, puzzle)).toEqual([]);
    expect(await s.read(countPuzzleStarts, 'alice', puzzle)).toBe(1);
    expect(await s.read(readLocalPuzzleStartLedger, 'alice')).toHaveLength(1);
    await s.apply(playUntilSolved, 'alice');
    expect(await outcomes(s, puzzle)).toEqual(['solved']);
  });

  test('asking for the next puzzle twice at once starts and charges one more', async () => {
    await using s = await openSim('attempt-once-next-twice');
    await onPuzzle(s);
    await s.apply(playUntilSolved, 'alice');
    await s.apply(pressPuzzleNextTwice, 'alice');
    expect(await s.read(countAllPuzzleStarts, 'alice')).toBe(2);
    expect(await s.read(readLocalPuzzleStartLedger, 'alice')).toHaveLength(2);
  });
});
