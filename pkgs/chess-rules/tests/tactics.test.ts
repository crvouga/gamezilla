import { expect, test } from 'bun:test';
import { hangingPieces, knightForks } from '@pkgs/chess-rules/tactics';

// regression: puzzle-assistant-defended-knight-hanging
test('a bishop able to recapture prevents a hanging-knight claim', () => {
  expect(
    hangingPieces('4k3/8/8/8/3r4/8/3N4/2B4K b - - 1 2').some(
      (piece) => piece.square === 'd2'
    )
  ).toBe(false);
  expect(hangingPieces('4k3/8/8/8/3r4/8/3N4/7K b - - 1 2')).toContainEqual({
    piece: 'n',
    square: 'd2',
    capture: 'd4d2',
  });
});

// regression: puzzle-assistant-missed-knight-fork
test('a real fork of king and queen is found, while a pinned knight cannot fork', () => {
  expect(knightForks('4k3/8/8/5n2/8/7P/8/3Q1K2 b - - 0 2')).toContainEqual({
    move: 'f5e3',
    square: 'e3',
    targets: [
      { piece: 'q', square: 'd1' },
      { piece: 'k', square: 'f1' },
    ],
  });
  expect(knightForks('4k3/4n3/8/8/8/8/3Q4/4R1K1 b - - 0 1').length).toBe(0);
});

// regression: chess-tactics-opponent-already-checked
test('an impossible position cannot produce tactics or capture a king', () => {
  const fen = '4k3/8/8/8/8/4n3/7P/3Q1K2 b - - 0 2';
  expect(knightForks(fen)).toEqual([]);
  expect(hangingPieces(fen)).toEqual([]);
});
