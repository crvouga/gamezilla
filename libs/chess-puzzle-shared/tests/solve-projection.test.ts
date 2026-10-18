import { describe, expect, test } from 'bun:test';
import {
  countMoveTokens,
  nextSolutionUci,
  PUZZLE_SOLUTION_ARROW_ID,
  projectBoardFen,
  projectSolveStatus,
  solutionArrows,
} from '@libs/chess-puzzle-shared/solve-projection';
import { hintStageFromRoom } from '@libs/game-puzzle-shared/hint-stage';
import { puzzleNavFromState } from '@libs/game-puzzle-shared/puzzle-nav';

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

describe('projectBoardFen', () => {
  const reached = '6k1/8/8/8/8/8/8/R6K w - - 0 1';

  test('a wrong move stays on the square it was played to', () => {
    expect(
      projectBoardFen({ status: 'wrong', fen: reached, wrongUci: 'a1a5' })
    ).toBe('6k1/8/8/R7/8/8/8/7K b - - 1 1');
  });

  test('a wrong promotion shows the piece that was chosen', () => {
    expect(
      projectBoardFen({
        status: 'wrong',
        fen: '6k1/P7/8/8/8/8/8/7K w - - 0 1',
        wrongUci: 'a7a8n',
      })
    ).toBe('N5k1/8/8/8/8/8/8/7K b - - 0 1');
  });

  test('the reached position shows once the wrong move is retried', () => {
    expect(
      projectBoardFen({ status: 'solving', fen: reached, wrongUci: null })
    ).toBe(reached);
    expect(
      projectBoardFen({ status: 'solving', fen: reached, wrongUci: 'a1a5' })
    ).toBe(reached);
  });

  test('a board with nothing to paint stays empty', () => {
    expect(
      projectBoardFen({ status: 'wrong', fen: null, wrongUci: 'a1a5' })
    ).toBeNull();
  });

  test('a wrong move that does not fit the position leaves it as reached', () => {
    expect(
      projectBoardFen({ status: 'wrong', fen: reached, wrongUci: 'b1b5' })
    ).toBe(reached);
  });
});

describe('countMoveTokens', () => {
  test('counts whitespace-separated UCI tokens', () => {
    expect(countMoveTokens('')).toBe(0);
    expect(countMoveTokens('   ')).toBe(0);
    expect(countMoveTokens('e2e4')).toBe(1);
    expect(countMoveTokens(' e2e4  e7e5\ng1f3 ')).toBe(3);
  });
});

describe('nextSolutionUci', () => {
  const moves = 'e2e4 e7e5 g1f3';

  test('returns the token at solveIdx while solving', () => {
    expect(nextSolutionUci({ status: 'solving', moves, solveIdx: 1 })).toBe(
      'e7e5'
    );
  });

  test('null when not solving or past the line', () => {
    expect(nextSolutionUci({ status: 'solved', moves, solveIdx: 1 })).toBe(
      null
    );
    expect(nextSolutionUci({ status: 'loading', moves, solveIdx: 1 })).toBe(
      null
    );
    expect(nextSolutionUci({ status: 'solving', moves, solveIdx: 3 })).toBe(
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

describe('solutionArrows', () => {
  const base = {
    atFrontier: true,
    hintStage: 'solution' as const,
    expectedFromSquare: 'e2',
    expectedToSquare: 'e4',
  };

  test('one arrow at the frontier once the solution is revealed', () => {
    expect(solutionArrows(base)).toEqual([
      { from: 'e2', to: 'e4', id: PUZZLE_SOLUTION_ARROW_ID },
    ]);
  });

  test('empty while scrubbing history, before solution, or without squares', () => {
    expect(solutionArrows({ ...base, atFrontier: false })).toEqual([]);
    expect(solutionArrows({ ...base, hintStage: 'highlight' })).toEqual([]);
    expect(solutionArrows({ ...base, expectedToSquare: null })).toEqual([]);
  });

  test('empty result is a shared frozen array', () => {
    const a = solutionArrows({ ...base, atFrontier: false });
    const b = solutionArrows({ ...base, hintStage: 'none' });
    expect(a).toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
  });
});

describe('puzzleNavFromState', () => {
  const moves = 'e2e4 e7e5 g1f3 b8c6';

  test('loading / wrong: pinned to frontier with no nav', () => {
    for (const status of ['loading', 'wrong', 'invalid'] as const) {
      expect(
        puzzleNavFromState({ status, solveIdx: 2, furthestSolveIdx: 3, moves })
      ).toEqual({ atFrontier: true, canGoBack: false, canGoForward: false });
    }
  });

  test('solving at the post-opening start cannot go back', () => {
    expect(
      puzzleNavFromState({
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
        status: 'solved',
        solveIdx: 4,
        furthestSolveIdx: 4,
        moves,
      })
    ).toEqual({ atFrontier: true, canGoBack: true, canGoForward: false });
  });
});
