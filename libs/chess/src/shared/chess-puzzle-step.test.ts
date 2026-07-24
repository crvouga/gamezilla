import { describe, expect, test } from 'bun:test';

import {
  fenAtSolveIdx,
  nextForwardSolveIdx,
  prevSolveIdx,
  resolveSeekSolveIdx,
  statusAtSolveIdx,
} from './chess-puzzle-step';
import { CHESS_PUZZLE_PLAY_STATUS } from './chess-puzzle-play-attr';
import { setupPuzzleStart } from './chess-puzzle-fsm';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';

describe('chess-puzzle-step', () => {
  test('prevSolveIdx rewinds one ply at a time', () => {
    expect(prevSolveIdx(1)).toBeNull();
    expect(prevSolveIdx(2)).toBe(1);
    expect(prevSolveIdx(3)).toBe(2);
    expect(prevSolveIdx(4)).toBe(3);
    expect(prevSolveIdx(5)).toBe(4);
  });

  test('nextForwardSolveIdx never past furthest', () => {
    expect(
      nextForwardSolveIdx({
        solveIdx: 1,
        furthestSolveIdx: 5,
        tokensLength: 4,
      })
    ).toBe(2);
    expect(
      nextForwardSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        tokensLength: 4,
      })
    ).toBe(4);
    expect(
      nextForwardSolveIdx({
        solveIdx: 4,
        furthestSolveIdx: 4,
        tokensLength: 4,
      })
    ).toBeNull();
  });

  test('resolveSeekSolveIdx clamps to furthest and skips current', () => {
    expect(
      resolveSeekSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        targetSolveIdx: 1,
      })
    ).toBe(1);
    expect(
      resolveSeekSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        targetSolveIdx: 3,
      })
    ).toBeNull();
    expect(
      resolveSeekSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        targetSolveIdx: 0,
      })
    ).toBeNull();
    expect(
      resolveSeekSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        targetSolveIdx: 5,
      })
    ).toBeNull();
  });

  test('fenAtSolveIdx matches setup opening fen at idx 1', () => {
    const setup = setupPuzzleStart(VALID_FEN, VALID_MOVES);
    expect(setup.kind).toBe('ready');
    if (setup.kind !== 'ready') return;
    expect(
      fenAtSolveIdx({ fen: VALID_FEN, moves: VALID_MOVES, solveIdx: 1 })
    ).toBe(setup.displayFen);
  });

  test('statusAtSolveIdx', () => {
    expect(statusAtSolveIdx(3, 4)).toBe(CHESS_PUZZLE_PLAY_STATUS.solving);
    expect(statusAtSolveIdx(4, 4)).toBe(CHESS_PUZZLE_PLAY_STATUS.solved);
  });
});
