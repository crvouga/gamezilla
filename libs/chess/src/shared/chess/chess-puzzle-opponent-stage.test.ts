import { describe, expect, test } from 'bun:test';

import { setupPuzzleStart } from './chess-puzzle-fsm';
import { planOpponentStage } from './chess-puzzle-opponent-stage';
import { fenAtSolveIdx } from './chess-puzzle-step';

const VALID_FEN = '4k3/8/8/8/8/8/4P3/4K2R b - - 0 1';
const VALID_MOVES = 'e8d7 e1f2 d7e6 f2e3';

describe('planOpponentStage', () => {
  test('animates opening on fresh start', () => {
    const setup = setupPuzzleStart(VALID_FEN, VALID_MOVES);
    expect(setup.kind).toBe('ready');
    if (setup.kind !== 'ready') return;
    const plan = planOpponentStage({
      startFen: VALID_FEN,
      moves: VALID_MOVES,
      displayFen: setup.displayFen,
      solveIdx: 1,
      furthestSolveIdx: 1,
      prevSolveIdx: -1,
      prevFurthestSolveIdx: -1,
    });
    expect(plan).toEqual({
      kind: 'animate',
      fromFen: VALID_FEN,
      toFen: setup.displayFen,
      holdMs: 450,
    });
  });

  test('snaps when seeking back without new progress', () => {
    const mid = fenAtSolveIdx({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      solveIdx: 1,
    });
    expect(mid).not.toBeNull();
    if (mid === null) return;
    const plan = planOpponentStage({
      startFen: VALID_FEN,
      moves: VALID_MOVES,
      displayFen: mid,
      solveIdx: 1,
      furthestSolveIdx: 3,
      prevSolveIdx: 3,
      prevFurthestSolveIdx: 3,
    });
    expect(plan).toEqual({ kind: 'snap', boardFen: mid });
  });

  test('animates canned opponent reply after +2 progress', () => {
    const afterHuman = fenAtSolveIdx({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      solveIdx: 2,
    });
    const afterReply = fenAtSolveIdx({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      solveIdx: 3,
    });
    expect(afterHuman).not.toBeNull();
    expect(afterReply).not.toBeNull();
    if (afterHuman === null || afterReply === null) return;
    const plan = planOpponentStage({
      startFen: VALID_FEN,
      moves: VALID_MOVES,
      displayFen: afterReply,
      solveIdx: 3,
      furthestSolveIdx: 3,
      prevSolveIdx: 1,
      prevFurthestSolveIdx: 1,
    });
    expect(plan).toEqual({
      kind: 'animate',
      fromFen: afterHuman,
      toFen: afterReply,
      holdMs: 280,
    });
  });

  test('snaps on terminal human-only ply (+1)', () => {
    const solved = fenAtSolveIdx({
      fen: VALID_FEN,
      moves: VALID_MOVES,
      solveIdx: 4,
    });
    expect(solved).not.toBeNull();
    if (solved === null) return;
    const plan = planOpponentStage({
      startFen: VALID_FEN,
      moves: VALID_MOVES,
      displayFen: solved,
      solveIdx: 4,
      furthestSolveIdx: 4,
      prevSolveIdx: 3,
      prevFurthestSolveIdx: 3,
    });
    expect(plan).toEqual({ kind: 'snap', boardFen: solved });
  });

  test('re-animates opening on retry reset', () => {
    const setup = setupPuzzleStart(VALID_FEN, VALID_MOVES);
    expect(setup.kind).toBe('ready');
    if (setup.kind !== 'ready') return;
    const plan = planOpponentStage({
      startFen: VALID_FEN,
      moves: VALID_MOVES,
      displayFen: setup.displayFen,
      solveIdx: 1,
      furthestSolveIdx: 1,
      prevSolveIdx: 3,
      prevFurthestSolveIdx: 3,
    });
    expect(plan.kind).toBe('animate');
    if (plan.kind !== 'animate') return;
    expect(plan.fromFen).toBe(VALID_FEN);
    expect(plan.toFen).toBe(setup.displayFen);
  });
});
