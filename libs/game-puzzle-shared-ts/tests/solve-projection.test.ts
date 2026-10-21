import { describe, expect, test } from 'bun:test';
import { hintStageFromRoom } from '@libs/game-puzzle-shared-ts/hint-stage';
import { puzzleNavFromState } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import {
  nextSolutionAction,
  projectBoardPosition,
  projectSolveStatus,
} from '@libs/game-puzzle-shared-ts/solve-projection';
import { PILE_GAME } from './pile-game';

describe('projectSolveStatus', () => {
  test('idle room reads as loading', () => {
    expect(
      projectSolveStatus({
        roomStatus: 'idle',
        roomPuzzleId: 'p1',
        puzzleId: 'p1',
      })
    ).toBe('loading');
  });

  test('room for another puzzle reads as loading', () => {
    expect(
      projectSolveStatus({
        roomStatus: 'solving',
        roomPuzzleId: 'p-other',
        puzzleId: 'p1',
      })
    ).toBe('loading');
  });

  test('matching puzzle passes room status through', () => {
    expect(
      projectSolveStatus({
        roomStatus: 'wrong',
        roomPuzzleId: 'p1',
        puzzleId: 'p1',
      })
    ).toBe('wrong');
  });
});

describe('projectBoardPosition', () => {
  const reached = 'pile:5:white';

  test('a wrong move stays played, as the game plays it, until the retry', () => {
    expect(
      projectBoardPosition(PILE_GAME, {
        status: 'wrong',
        position: reached,
        wrongAction: 'take2',
      })
    ).toBe('pile:3:black');
    expect(
      projectBoardPosition(PILE_GAME, {
        status: 'wrong',
        position: reached,
        wrongAction: 'TAKE1',
      })
    ).toBe('pile:4:black');
  });

  test('the reached position shows once the wrong move is retried', () => {
    expect(
      projectBoardPosition(PILE_GAME, {
        status: 'solving',
        position: reached,
        wrongAction: 'take2',
      })
    ).toBe(reached);
  });

  test('a board with nothing to paint stays empty', () => {
    expect(
      projectBoardPosition(PILE_GAME, {
        status: 'wrong',
        position: null,
        wrongAction: 'take1',
      })
    ).toBeNull();
  });

  test('a wrong move the game refuses leaves the position as reached', () => {
    expect(
      projectBoardPosition(PILE_GAME, {
        status: 'wrong',
        position: 'pile:1:white',
        wrongAction: 'take2',
      })
    ).toBe('pile:1:white');
  });
});

describe('nextSolutionAction', () => {
  const moves = 'take1 take2 take1';

  test('returns the line move at solveIdx while solving', () => {
    expect(nextSolutionAction({ status: 'solving', moves, solveIdx: 1 })).toBe(
      'take2'
    );
  });

  test('null when not solving or past the line', () => {
    expect(nextSolutionAction({ status: 'solved', moves, solveIdx: 1 })).toBe(
      null
    );
    expect(nextSolutionAction({ status: 'loading', moves, solveIdx: 1 })).toBe(
      null
    );
    expect(nextSolutionAction({ status: 'solving', moves, solveIdx: 3 })).toBe(
      null
    );
  });
});

describe('hintStageFromRoom', () => {
  test('escalates none -> highlight -> solution', () => {
    expect(
      hintStageFromRoom({
        status: 'solving',
        expectedFromSquare: null,
        solutionRevealed: false,
      })
    ).toBe('none');
    expect(
      hintStageFromRoom({
        status: 'solving',
        expectedFromSquare: 'e2',
        solutionRevealed: false,
      })
    ).toBe('highlight');
    expect(
      hintStageFromRoom({
        status: 'solving',
        expectedFromSquare: 'e2',
        solutionRevealed: true,
      })
    ).toBe('solution');
  });

  test('a shown solution (revealed review) reads as solution', () => {
    expect(
      hintStageFromRoom({
        status: 'revealed',
        expectedFromSquare: null,
        solutionRevealed: false,
      })
    ).toBe('solution');
  });

  test('solution flag without a square still reads as none', () => {
    expect(
      hintStageFromRoom({
        status: 'solving',
        expectedFromSquare: null,
        solutionRevealed: true,
      })
    ).toBe('none');
  });
});

describe('puzzleNavFromState', () => {
  const moves = 'e2e4 e7e5 g1f3 b8c6';

  test('loading / wrong: pinned to frontier with no nav', () => {
    for (const status of ['loading', 'wrong', 'invalid'] as const) {
      expect(
        puzzleNavFromState({
          firstSolveIdx: 1,
          status,
          solveIdx: 2,
          furthestSolveIdx: 3,
          moves,
        })
      ).toEqual({ atFrontier: true, canGoBack: false, canGoForward: false });
    }
  });

  test('solving at the post-opening start cannot go back', () => {
    expect(
      puzzleNavFromState({
        firstSolveIdx: 1,
        status: 'solving',
        solveIdx: 1,
        furthestSolveIdx: 1,
        moves,
      })
    ).toEqual({ atFrontier: true, canGoBack: false, canGoForward: false });
  });

  test('scrubbed back: can step both ways, not at frontier', () => {
    expect(
      puzzleNavFromState({
        firstSolveIdx: 1,
        status: 'solving',
        solveIdx: 2,
        furthestSolveIdx: 3,
        moves,
      })
    ).toEqual({ atFrontier: false, canGoBack: true, canGoForward: true });
  });

  test('solved at the end: back only', () => {
    expect(
      puzzleNavFromState({
        firstSolveIdx: 1,
        status: 'solved',
        solveIdx: 4,
        furthestSolveIdx: 4,
        moves,
      })
    ).toEqual({ atFrontier: true, canGoBack: true, canGoForward: false });
  });
});
