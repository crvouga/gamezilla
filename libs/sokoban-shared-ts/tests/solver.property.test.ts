import { expect, test } from 'bun:test';
import {
  applySokobanMove,
  decodeSokobanAction,
  encodeSokobanAction,
  sokobanComplete,
} from '@libs/sokoban-shared-ts/sokoban-position';
import { solveSokoban } from '@libs/sokoban-shared-ts/sokoban-solver';
import { sokobanStarterPack } from '@libs/sokoban-shared-ts/sokoban-starter-pack';
import type { SokobanBoard } from '@libs/sokoban-shared-ts/sokoban-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  boardOf,
  definitionBoard,
  enumeratePositions,
  pulledBoardArb,
  puzzleBoardArb,
  startOf,
} from './sokoban-fixtures';

function completes(board: SokobanBoard, actions: readonly string[]): boolean {
  let position = startOf(board);
  for (const action of actions) {
    const direction = decodeSokobanAction(action);
    if (!direction.valid) return false;
    const next = applySokobanMove(board, position, direction.value);
    if (!next.valid) return false;
    position = next.value;
  }
  return sokobanComplete(board, position);
}

const tinyBoards = puzzleBoardArb({ maxWidth: 4, maxHeight: 3, maxCrates: 2 });

test('with room to finish, the solver agrees with exhaustive enumeration', () => {
  assertProperty(
    'exhaustive agreement',
    fc.property(tinyBoards, (board) => {
      const truth = enumeratePositions(board);
      const result = solveSokoban(board, { maxStates: truth.reachable });
      if (truth.fewestMoves === null) {
        expect(result).toEqual({ status: 'unsolvable' });
        return;
      }
      expect(result.status).toBe('solved');
      if (result.status !== 'solved') return;
      expect(result.actions).toHaveLength(truth.fewestMoves);
      expect(completes(board, result.actions)).toBe(true);
    }),
    { numRuns: 200 }
  );
});

test('a budget too small to finish yields inconclusive, never unsolvable', () => {
  assertProperty(
    'bounded search',
    fc.property(
      tinyBoards,
      fc.integer({ min: 0, max: 12 }),
      (board, maxStates) => {
        const truth = enumeratePositions(board);
        const result = solveSokoban(board, { maxStates });
        expect(solveSokoban(board, { maxStates })).toEqual(result);
        if (result.status === 'solved')
          expect(completes(board, result.actions)).toBe(true);
        if (result.status === 'unsolvable') {
          expect(truth.fewestMoves).toBeNull();
          expect(truth.reachable).toBeLessThanOrEqual(maxStates);
        }
        if (truth.reachable > maxStates && truth.fewestMoves === null)
          expect(result.status).toBe('inconclusive');
      }
    ),
    { numRuns: 200 }
  );
});

test('literal outcomes: solved at once, unsolvable, inconclusive and invalid', () => {
  expect(solveSokoban(boardOf('@**'), { maxStates: 1 })).toEqual({
    status: 'solved',
    actions: [],
  });
  expect(
    solveSokoban(boardOf('#####', '#.@$#', '#####'), { maxStates: 100 })
  ).toEqual({ status: 'unsolvable' });
  expect(
    solveSokoban(boardOf('#####', '#.@$#', '#####'), { maxStates: 0 })
  ).toEqual({ status: 'inconclusive' });
  const plan = sokobanStarterPack.puzzles[3]!;
  const planBoard = definitionBoard(plan.definition);
  expect(solveSokoban(planBoard, { maxStates: 10 })).toEqual({
    status: 'inconclusive',
  });
  expect(solveSokoban(boardOf(' $.'), { maxStates: 100 })).toMatchObject({
    status: 'invalid',
    issues: [{ code: 'needs_worker' }],
  });
});

test('every starter witness is as short as the shortest solution', () => {
  for (const puzzle of sokobanStarterPack.puzzles) {
    const board = definitionBoard(puzzle.definition);
    const result = solveSokoban(board, { maxStates: 100_000 });
    expect(result.status).toBe('solved');
    if (result.status === 'solved')
      expect(result.actions).toHaveLength(puzzle.witness.length);
  }
});

test('a board pulled back from completion is solved in no more moves than the pulls', () => {
  assertProperty(
    'known solutions',
    fc.property(pulledBoardArb(), ({ board, solution }) => {
      expect(completes(board, solution.map(encodeSokobanAction))).toBe(true);
      const result = solveSokoban(board, { maxStates: 100_000 });
      expect(result.status).toBe('solved');
      if (result.status !== 'solved') return;
      expect(result.actions.length).toBeLessThanOrEqual(solution.length);
      expect(completes(board, result.actions)).toBe(true);
    })
  );
});
