import { expect, test } from 'bun:test';
import { puzzleCommentary } from '@libs/chess/public/puzzle-commentary';

// regression: puzzle-assistant-theme-fiction
test('a theme label cannot make a solved non-mating board checkmate', () => {
  const result = puzzleCommentary({
    puzzleId: 'castle',
    fen: '4k3/8/p7/8/8/8/8/5RK1 b - - 1 2',
    status: 'solved',
    solveIdx: 2,
    layoutKey: 0,
    wrongUci: null,
    hint: 'none',
    opponentReplying: false,
    viewingHistory: false,
  });
  expect(result?.kind).toBe('solved');
  expect(result?.text.toLowerCase()).not.toContain('checkmate');
});

// regression: puzzle-assistant-unavailable-is-illegal
test('unplayable data is described as unavailable rather than an illegal solver move', () => {
  const result = puzzleCommentary({
    puzzleId: 'broken',
    fen: null,
    status: 'invalid',
    solveIdx: 0,
    layoutKey: 0,
    wrongUci: null,
    hint: 'none',
    opponentReplying: false,
    viewingHistory: false,
  });
  expect(result?.kind).toBe('unavailable');
  expect(result?.text).not.toContain('not legal');
});

// regression: puzzle-assistant-opponent-king
test('an opponent in check during its reply is not the solver in check', () => {
  const result = puzzleCommentary({
    puzzleId: 'reply',
    fen: '7k/7R/8/8/8/8/8/K7 b - - 1 1',
    status: 'solving',
    solveIdx: 3,
    layoutKey: 0,
    wrongUci: null,
    hint: 'none',
    opponentReplying: true,
    viewingHistory: false,
  });
  expect(result?.kind).toBe('progress');
  expect(result?.text).not.toContain('Your king');
  expect(result?.text).not.toContain('has replied');
});

// regression: puzzle-assistant-history-diagnosis
test('an old wrong move is not diagnosed against a different historical board', () => {
  const result = puzzleCommentary({
    puzzleId: 'history',
    fen: '7k/7R/8/8/8/8/8/K7 b - - 1 1',
    status: 'wrong',
    solveIdx: 1,
    layoutKey: 2,
    wrongUci: 'a1b1',
    hint: 'highlight',
    opponentReplying: false,
    viewingHistory: true,
  });
  expect(result?.kind).toBe('review');
  expect(result?.text).not.toContain('Your king');
  expect(result?.text).not.toContain('highlighted');
});
