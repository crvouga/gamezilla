import { describe, expect, test } from 'bun:test';

import { updatePuzzleRating } from './chess-puzzle-rating';

describe('updatePuzzleRating', () => {
  test('clean win vs equal puzzle raises rating', () => {
    const out = updatePuzzleRating({
      playerRating: 1200,
      playerRd: 350,
      puzzleRating: 1200,
      score: 1,
    });
    expect(out.rating).toBeGreaterThan(1200);
    expect(out.rating).toBeLessThanOrEqual(3000);
    expect(out.ratingDeviation).toBeGreaterThanOrEqual(30);
    expect(out.ratingDeviation).toBeLessThanOrEqual(350);
  });

  test('loss vs higher puzzle drops rating less than vs equal', () => {
    const vsEqual = updatePuzzleRating({
      playerRating: 1200,
      playerRd: 350,
      puzzleRating: 1200,
      score: 0,
    });
    const vsHigher = updatePuzzleRating({
      playerRating: 1200,
      playerRd: 350,
      puzzleRating: 1600,
      score: 0,
    });
    expect(vsEqual.rating).toBeLessThan(1200);
    expect(vsHigher.rating).toBeGreaterThanOrEqual(vsEqual.rating);
  });

  test('partial score moves rating less than full win', () => {
    const win = updatePuzzleRating({
      playerRating: 1200,
      playerRd: 350,
      puzzleRating: 1200,
      score: 1,
    });
    const partial = updatePuzzleRating({
      playerRating: 1200,
      playerRd: 350,
      puzzleRating: 1200,
      score: 0.5,
    });
    expect(partial.rating).toBeLessThanOrEqual(win.rating);
    expect(partial.rating).toBeGreaterThanOrEqual(1200);
  });

  test('clamps rating and RD to bounds', () => {
    const low = updatePuzzleRating({
      playerRating: 400,
      playerRd: 30,
      puzzleRating: 3000,
      score: 0,
    });
    expect(low.rating).toBeGreaterThanOrEqual(400);
    expect(low.ratingDeviation).toBeGreaterThanOrEqual(30);

    const high = updatePuzzleRating({
      playerRating: 3000,
      playerRd: 350,
      puzzleRating: 400,
      score: 1,
    });
    expect(high.rating).toBeLessThanOrEqual(3000);
    expect(high.ratingDeviation).toBeLessThanOrEqual(350);
  });
});
