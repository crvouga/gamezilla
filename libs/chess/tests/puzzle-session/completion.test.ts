import { describe, expect, test } from 'bun:test';
import type { ChessPuzzleInteractionRow } from '@libs/chess/public/chess-puzzle-interaction-entities';
import {
  PUZZLE_ELO_DEFAULT,
  PUZZLE_ELO_MAX,
  PUZZLE_ELO_MIN,
  PUZZLE_ELO_PROVISIONAL_GAMES,
  projectPuzzleEloFromInteractions,
  puzzleEloK,
  updatePuzzleRating,
} from '@libs/chess/public/chess-puzzle-rating';
import { derivePuzzleCompletion } from '@libs/chess/public/puzzle-session';
import { assertProperty, fc } from '@pkgs/sim/fast-check';

function row(
  partial: Partial<ChessPuzzleInteractionRow> &
    Pick<ChessPuzzleInteractionRow, 'kind' | 'puzzleId'>
): ChessPuzzleInteractionRow {
  return {
    solveIdx: 0,
    uci: null,
    correct: null,
    puzzleRating: 1500,
    at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('derivePuzzleCompletion', () => {
  test('null while the current play has no terminal row', () => {
    const interactions = [
      row({ kind: 'started', puzzleId: 'p1' }),
      row({ kind: 'moved', puzzleId: 'p1', uci: 'e2e4', correct: true }),
    ];
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
      })
    ).toBeNull();
  });

  test('solved play yields projected delta and streak', () => {
    const interactions = [
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
    ];
    const expected = updatePuzzleRating({
      playerRating: 1200,
      puzzleRating: 1200,
      score: 1,
      ratedGames: 0,
    });
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
      })
    ).toEqual({
      outcome: 'solved',
      ratingBefore: 1200,
      ratingAfter: expected.rating,
      delta: expected.rating - 1200,
      streak: 1,
      puzzleRating: 1200,
    });
  });

  test('abandoned play reports negative projected delta', () => {
    const interactions = [
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.000Z',
      }),
      row({
        kind: 'abandoned',
        puzzleId: 'p1',
        puzzleRating: 1200,
        at: '2026-01-01T00:00:01.000Z',
      }),
    ];
    const completion = derivePuzzleCompletion({
      interactions,
      puzzleId: 'p1',
      allInteractions: interactions,
    });
    expect(completion?.outcome).toBe('abandoned');
    expect(completion?.delta).toBeLessThan(0);
  });

  test('ignores terminal rows from an earlier play of the same puzzle', () => {
    const interactions = [
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:00.000Z',
      }),
      row({
        kind: 'solved',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:01.000Z',
      }),
      row({
        kind: 'started',
        puzzleId: 'p1',
        at: '2026-01-01T00:00:02.000Z',
      }),
    ];
    expect(
      derivePuzzleCompletion({
        interactions,
        puzzleId: 'p1',
        allInteractions: interactions,
      })
    ).toBeNull();
  });
});

describe('puzzle rating properties', () => {
  test('ratings stay inside the supported clamp for arbitrary score sequences', () => {
    assertProperty(
      'rating clamp',
      fc.property(
        fc.array(fc.constantFrom<0 | 0.5 | 1>(0, 0.5, 1), {
          maxLength: 64,
        }),
        (scores) => {
          let rating = PUZZLE_ELO_DEFAULT;
          for (const [ratedGames, score] of scores.entries()) {
            rating = updatePuzzleRating({
              playerRating: rating,
              puzzleRating: 400 + (ratedGames % 27) * 100,
              score,
              ratedGames,
            }).rating;
            expect(rating).toBeGreaterThanOrEqual(PUZZLE_ELO_MIN);
            expect(rating).toBeLessThanOrEqual(PUZZLE_ELO_MAX);
          }
        }
      )
    );
  });

  test('a higher score never lowers the next rating', () => {
    assertProperty(
      'rating score order',
      fc.property(
        fc.integer({ min: PUZZLE_ELO_MIN, max: PUZZLE_ELO_MAX }),
        fc.integer({ min: PUZZLE_ELO_MIN, max: PUZZLE_ELO_MAX }),
        fc.integer({ min: 0, max: 100 }),
        (playerRating, puzzleRating, ratedGames) => {
          const low = updatePuzzleRating({
            playerRating,
            puzzleRating,
            score: 0,
            ratedGames,
          }).rating;
          const high = updatePuzzleRating({
            playerRating,
            puzzleRating,
            score: 1,
            ratedGames,
          }).rating;
          expect(high).toBeGreaterThanOrEqual(low);
        }
      )
    );
  });

  test('projection equals folding updatePuzzleRating over ordered scores', () => {
    assertProperty(
      'rating projection fold',
      fc.property(
        fc.array(fc.constantFrom<0 | 0.5 | 1>(0, 0.5, 1), {
          minLength: 1,
          maxLength: 24,
        }),
        (scores) => {
          const interactions: ChessPuzzleInteractionRow[] = [];
          for (const [index, score] of scores.entries()) {
            const puzzleId = `p-${index}`;
            const at = `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`;
            interactions.push(row({ kind: 'started', puzzleId, at }));
            if (score === 0.5) {
              interactions.push(
                row({
                  kind: 'moved',
                  puzzleId,
                  correct: false,
                  uci: 'a1a2',
                  at: `${at.slice(0, 17)}01.000Z`,
                })
              );
            }
            interactions.push(
              row({
                kind: score === 0 ? 'abandoned' : 'solved',
                puzzleId,
                at: `${at.slice(0, 17)}02.000Z`,
              })
            );
          }

          let folded = PUZZLE_ELO_DEFAULT;
          for (const [ratedGames, score] of scores.entries()) {
            folded = updatePuzzleRating({
              playerRating: folded,
              puzzleRating: 1500,
              score,
              ratedGames,
            }).rating;
          }
          expect(projectPuzzleEloFromInteractions(interactions).rating).toBe(
            folded
          );
        }
      )
    );
  });

  test('K switches from provisional to stable at the threshold', () => {
    expect(puzzleEloK(PUZZLE_ELO_PROVISIONAL_GAMES - 1)).toBe(40);
    expect(puzzleEloK(PUZZLE_ELO_PROVISIONAL_GAMES)).toBe(20);
    expect(puzzleEloK(PUZZLE_ELO_PROVISIONAL_GAMES + 1)).toBe(20);
  });
});
