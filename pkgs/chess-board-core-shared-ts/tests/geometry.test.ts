import { describe, expect, test } from 'bun:test';
import {
  indexFromSquare,
  isKnightJump,
  isSquare,
  squareCenter,
  squareFromIndex,
  squareToXY,
  xyToSquare,
} from '@pkgs/chess-board-core-shared-ts/geometry';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';

describe('geometry', () => {
  test('index <-> square round-trips for all 64 squares', () => {
    for (let i = 0; i < 64; i++) {
      expect(indexFromSquare(squareFromIndex(i))).toBe(i);
    }
    expect(squareFromIndex(0)).toBe('a1');
    expect(squareFromIndex(63)).toBe('h8');
    expect(squareFromIndex(-5)).toBe('a1');
    expect(squareFromIndex(99)).toBe('h8');
  });

  test('isSquare validates algebraic notation', () => {
    expect(isSquare('e4')).toBe(true);
    expect(isSquare('i4')).toBe(false);
    expect(isSquare('e9')).toBe(false);
    expect(isSquare('e')).toBe(false);
  });

  test('white orientation: a1 bottom-left, h8 top-right', () => {
    expect(squareToXY('a1', 800, 'white')).toEqual({ x: 0, y: 700, cell: 100 });
    expect(squareToXY('h8', 800, 'white')).toEqual({ x: 700, y: 0, cell: 100 });
    expect(xyToSquare(50, 750, 800, 'white')).toBe('a1');
    expect(xyToSquare(750, 50, 800, 'white')).toBe('h8');
  });

  test('black orientation flips both axes', () => {
    expect(squareToXY('a1', 800, 'black')).toEqual({ x: 700, y: 0, cell: 100 });
    expect(xyToSquare(750, 50, 800, 'black')).toBe('a1');
  });

  test('xyToSquare returns null outside the board', () => {
    expect(xyToSquare(-1, 10, 800, 'white')).toBeNull();
    expect(xyToSquare(800, 10, 800, 'white')).toBeNull();
    expect(xyToSquare(10, 10, 0, 'white')).toBeNull();
  });

  test('squareToXY / xyToSquare round-trip for every square in both orientations', () => {
    for (const orientation of ['white', 'black'] as const) {
      for (let i = 0; i < 64; i++) {
        const sq = squareFromIndex(i);
        const c = squareCenter(sq, 400, orientation);
        expect(xyToSquare(c.x, c.y, 400, orientation)).toBe(sq);
      }
    }
  });

  test('isKnightJump', () => {
    const pairs: [Square, Square, boolean][] = [
      ['g1', 'f3', true],
      ['b1', 'c3', true],
      ['e4', 'e5', false],
      ['e4', 'g6', false],
    ];
    for (const [from, to, expected] of pairs) {
      expect(isKnightJump(from, to)).toBe(expected);
    }
  });
});
