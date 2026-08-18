import { describe, expect, test } from 'bun:test';

import { solvedPuzzleKingSquare } from './chess-puzzle-solved-king-square';
import { shouldPlayEloTick } from './throttle-elo-tick';

describe('solvedPuzzleKingSquare', () => {
  test('finds black king when black is mated', () => {
    const fen = '7k/6R1/5K2/8/8/8/8/8 b - - 0 1';
    expect(solvedPuzzleKingSquare(fen)).toBe('h8');
  });

  test('finds white king away from e1 when white is mated', () => {
    const fen = '6K1/5k2/8/8/8/8/8/8 w - - 0 1';
    expect(solvedPuzzleKingSquare(fen)).toBe('g8');
  });

  test('falls back to e1/e8 when king placement is missing', () => {
    expect(solvedPuzzleKingSquare('8/8/8/8/8/8/8/8 w - - 0 1')).toBe('e1');
    expect(solvedPuzzleKingSquare('8/8/8/8/8/8/8/8 b - - 0 1')).toBe('e8');
  });
});

describe('shouldPlayEloTick', () => {
  test('plays when rating changes and interval elapsed', () => {
    expect(
      shouldPlayEloTick({
        nextRating: 1201,
        prevDisplayedRating: 1200,
        lastTickAtMs: 0,
        nowMs: 100,
      })
    ).toBe(true);
  });

  test('skips duplicate rating', () => {
    expect(
      shouldPlayEloTick({
        nextRating: 1200,
        prevDisplayedRating: 1200,
        lastTickAtMs: 0,
        nowMs: 100,
      })
    ).toBe(false);
  });

  test('throttles rapid ticks', () => {
    expect(
      shouldPlayEloTick({
        nextRating: 1201,
        prevDisplayedRating: 1200,
        lastTickAtMs: 50,
        nowMs: 100,
      })
    ).toBe(false);
  });
});
