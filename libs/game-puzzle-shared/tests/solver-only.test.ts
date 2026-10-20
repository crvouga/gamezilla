import { expect, test } from 'bun:test';
import { planOpponentStage } from '@libs/game-puzzle-shared/opponent-stage';
import { positionAt, setupPuzzle } from '@libs/game-puzzle-shared/puzzle-setup';
import { SOLO_PILE_GAME as GAME } from './solver-only-game';

const START = 'pile:4:white';
const LINE = ['take2', 'take2'];

// regression: solo-puzzle-opening-applies-solver-move
test('solver-only setup preserves the supplied position before either solver move', () => {
  expect(setupPuzzle(GAME, START, LINE)).toEqual({
    kind: 'ready',
    displayPosition: START,
    solverSide: 'white',
    solveIdx: 0,
    status: 'solving',
  });
  expect(positionAt(GAME, START, LINE, 0)).toBe(START);
});

test('a solver-only first move is never animated as an automatic setup move', () => {
  expect(
    planOpponentStage({
      game: GAME,
      startPosition: START,
      moves: LINE.join(' '),
      displayPosition: 'pile:2:white',
      solveIdx: 1,
      furthestSolveIdx: 1,
      prevSolveIdx: 0,
      prevFurthestSolveIdx: 0,
      revealed: false,
    })
  ).toEqual({ kind: 'snap', boardPosition: 'pile:2:white' });
});

test('showing a solver-only solution includes every move from the supplied position', () => {
  expect(
    planOpponentStage({
      game: GAME,
      startPosition: START,
      moves: LINE.join(' '),
      displayPosition: 'pile:0:white',
      solveIdx: 2,
      furthestSolveIdx: 2,
      prevSolveIdx: 0,
      prevFurthestSolveIdx: 0,
      revealed: true,
    })
  ).toEqual({
    kind: 'animate',
    fromPosition: START,
    frames: [
      { position: 'pile:2:white', atMs: 600 },
      { position: 'pile:0:white', atMs: 1200 },
    ],
  });
});
