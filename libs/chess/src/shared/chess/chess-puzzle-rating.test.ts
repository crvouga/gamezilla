import { describe, expect, test } from 'bun:test';
import type { ChessPuzzleInteractionRow } from '@libs/chess/public/chess-puzzle-interaction-entities';
import {
  PUZZLE_ELO_DEFAULT,
  PUZZLE_ELO_K_PROVISIONAL,
  PUZZLE_ELO_MAX,
  PUZZLE_ELO_MIN,
  projectPuzzleEloFromInteractions,
  updatePuzzleRating,
} from '@libs/chess/public/chess-puzzle-rating';

describe('updatePuzzleRating', () => {
  test('clean win vs equal puzzle raises rating by at most K', () => {
    const out = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1200,
      score: 1,
      ratedGames: 0,
    });
    expect(out.rating).toBeGreaterThan(1200);
    expect(out.rating - 1200).toBeLessThanOrEqual(PUZZLE_ELO_K_PROVISIONAL);
  });

  test('loss vs higher puzzle drops rating less than vs equal', () => {
    const vsEqual = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1200,
      score: 0,
      ratedGames: 0,
    });
    const vsHigher = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1600,
      score: 0,
      ratedGames: 0,
    });
    expect(vsEqual.rating).toBeLessThan(1200);
    expect(vsHigher.rating).toBeGreaterThanOrEqual(vsEqual.rating);
  });

  test('partial score moves rating less than full win', () => {
    const win = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1200,
      score: 1,
      ratedGames: 0,
    });
    const partial = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1200,
      score: 0.5,
      ratedGames: 0,
    });
    expect(partial.rating).toBeLessThanOrEqual(win.rating);
    expect(partial.rating).toBe(1200);
  });

  test('clamps rating to bounds', () => {
    const low = updatePuzzleRating({
      playerRating: 400,
      puzzleRating: 3000,
      score: 0,
      ratedGames: 0,
    });
    expect(low.rating).toBeGreaterThanOrEqual(PUZZLE_ELO_MIN);

    const high = updatePuzzleRating({
      playerRating: 3000,
      puzzleRating: 400,
      score: 1,
      ratedGames: 0,
    });
    expect(high.rating).toBeLessThanOrEqual(PUZZLE_ELO_MAX);
  });

  test('harder puzzle win raises more than equal puzzle win', () => {
    const vsEqual = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1200,
      score: 1,
      ratedGames: 0,
    });
    const vsHigher = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1600,
      score: 1,
      ratedGames: 0,
    });
    expect(vsHigher.rating).toBeGreaterThan(vsEqual.rating);
  });
});

function row(
  partial: Partial<ChessPuzzleInteractionRow> &
    Pick<ChessPuzzleInteractionRow, 'kind' | 'puzzleId' | 'at'>
): ChessPuzzleInteractionRow {
  return {
    solveIdx: 0,
    uci: null,
    correct: null,
    puzzleRating: 1200,
    ...partial,
  };
}

describe('projectPuzzleEloFromInteractions', () => {
  test('empty history stays at default', () => {
    const out = projectPuzzleEloFromInteractions([]);
    expect(out.rating).toBe(PUZZLE_ELO_DEFAULT);
    expect(out.ratedGames).toBe(0);
    expect(out.entries).toEqual([]);
    expect(out.eloSeries).toEqual([PUZZLE_ELO_DEFAULT]);
  });

  test('clean solve raises rating and records delta', () => {
    const interactions = [
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.000Z',
      }),
      row({
        kind: 'moved',
        puzzleId: 'p1',
        uci: 'e2e4',
        correct: true,
        at: '2026-01-01T00:00:01.000Z',
      }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        puzzleRating: 1200,
        at: '2026-01-01T00:00:02.000Z',
      }),
    ];
    const out = projectPuzzleEloFromInteractions(interactions);
    expect(out.ratedGames).toBe(1);
    expect(out.rating).toBeGreaterThan(PUZZLE_ELO_DEFAULT);
    expect(out.entries).toHaveLength(1);
    const entry = out.entries[0];
    expect(entry?.delta).toBe(entry!.ratingAfter - entry!.ratingBefore);
    expect(entry?.outcome).toBe('solved');
  });

  test('medium solve streak does not slam into max elo', () => {
    const interactions: ChessPuzzleInteractionRow[] = [];
    for (let i = 0; i < 10; i += 1) {
      const puzzleId = `p${i}`;
      const base = `2026-01-01T00:${String(i).padStart(2, '0')}`;
      interactions.push(
        row({
          kind: 'started',
          puzzleId,
          at: `${base}:00.000Z`,
        }),
        row({
          kind: 'solved',
          puzzleId,
          puzzleRating: 600,
          at: `${base}:01.000Z`,
        })
      );
    }
    const out = projectPuzzleEloFromInteractions(interactions);
    expect(out.rating).toBeLessThan(PUZZLE_ELO_MAX);
    expect(
      out.entries.every((e) => Math.abs(e.delta) <= PUZZLE_ELO_K_PROVISIONAL)
    ).toBe(true);
  });

  test('hinted solve scores partial and moves less than clean solve', () => {
    const clean = projectPuzzleEloFromInteractions([
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.000Z',
      }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        puzzleRating: 1200,
        at: '2026-01-01T00:00:01.000Z',
      }),
    ]);
    const hinted = projectPuzzleEloFromInteractions([
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.000Z',
      }),
      row({
        kind: 'used-hint',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.500Z',
      }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        puzzleRating: 1200,
        at: '2026-01-01T00:00:01.000Z',
      }),
    ]);
    expect(hinted.rating).toBeLessThan(clean.rating);
    expect(hinted.entries[0]?.delta).toBe(0);
  });
});
