import { describe, expect, test } from 'bun:test';

import { squareCenter } from './chess-board-squares';

const SIZE = 320;
const CELL = SIZE / 8;

function center(col: number, row: number): { x: number; y: number } {
  return { x: (col + 0.5) * CELL, y: (row + 0.5) * CELL };
}

describe('squareCenter', () => {
  test('white: e2, a1, h8', () => {
    // e=4 rank2 → row 6; a=0 rank1 → row 7; h=7 rank8 → row 0
    expect(squareCenter('e2', SIZE, 'white')).toEqual(center(4, 6));
    expect(squareCenter('a1', SIZE, 'white')).toEqual(center(0, 7));
    expect(squareCenter('h8', SIZE, 'white')).toEqual(center(7, 0));
    expect(squareCenter('e2', SIZE, 'white')).toEqual({ x: 180, y: 260 });
    expect(squareCenter('a1', SIZE, 'white')).toEqual({ x: 20, y: 300 });
    expect(squareCenter('h8', SIZE, 'white')).toEqual({ x: 300, y: 20 });
  });

  test('black: e7, a8, h1 (flipped columns/rows)', () => {
    // e=4 → col 3 rank7 → row 6; a=0 → col 7 rank8 → row 7; h=7 → col 0 rank1 → row 0
    expect(squareCenter('e7', SIZE, 'black')).toEqual(center(3, 6));
    expect(squareCenter('a8', SIZE, 'black')).toEqual(center(7, 7));
    expect(squareCenter('h1', SIZE, 'black')).toEqual(center(0, 0));
  });
});
