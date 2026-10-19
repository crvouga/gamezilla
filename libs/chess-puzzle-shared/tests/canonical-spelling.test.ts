/**
 * Chess's spelling of a puzzle move (`chessPuzzles.judge.canonical`), the
 * one spelling the platform's judge compares with the line's move: castling
 * entered as king-onto-rook is castling, and a promotion keeps its piece, so
 * a queen is never the line's knight. (The judge itself, over every game's
 * known puzzles, is `conformance/puzzles/puzzle-judge` in
 * @libs/games-harness.)
 */

import { expect, test } from 'bun:test';
import { chessPuzzles } from '@libs/chess-puzzle-shared/chess-puzzles';

const canonical = chessPuzzles.judge?.canonical;
if (canonical === undefined) throw new Error('chess spells its moves');

test('castling is one move, whether the king goes two squares or onto its rook', () => {
  const fen = '4k3/8/p7/8/8/8/8/4K2R w K - 0 2';
  expect(canonical(fen, 'e1g1')).toBe('e1g1');
  expect(canonical(fen, 'e1h1')).toBe('e1g1');
});

test('a promotion keeps its piece: a queen and a knight are different moves', () => {
  const fen = '8/2q1P1k1/8/8/8/8/8/6K1 w - - 0 2';
  expect(canonical(fen, 'e7e8n')).toBe('e7e8n');
  expect(canonical(fen, 'e7e8q')).toBe('e7e8q');
  expect(canonical(fen, 'E7E8N')).toBe('e7e8n');
});
