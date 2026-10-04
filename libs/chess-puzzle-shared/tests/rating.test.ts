import { describe, expect, test } from 'bun:test';
import { applyPuzzleAttemptRating, DEFAULT_PUZZLE_RATING_STATE, formatPuzzleRating, isProvisionalPuzzleRating, PUZZLE_PROVISIONAL_RD, PUZZLE_RATING_DEFAULT, PUZZLE_RATING_DEFAULT_RD, PUZZLE_RATING_MAX, PUZZLE_RATING_MIN, PUZZLE_RATING_RD_MAX, PUZZLE_RATING_RD_MIN, PUZZLE_SCORE_PERMILLE, puzzleOpponentRd, puzzleScorePermille, readPuzzleRatingState } from '@libs/chess-puzzle-shared/chess-puzzle-rating';
import { chessPuzzleRatingEventId } from '@libs/chess-puzzle-shared/chess-puzzle-rating-event';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const PUZZLE = { rating: 1500, ratingDeviation: 80 };

describe('§8 puzzle rating state', () => {
  test('a new player starts at 1500 with the maximum deviation, provisional', () => {
    expect(DEFAULT_PUZZLE_RATING_STATE.rating).toBe(PUZZLE_RATING_DEFAULT);
    expect(DEFAULT_PUZZLE_RATING_STATE.ratingDeviation).toBe(
      PUZZLE_RATING_DEFAULT_RD
    );
    expect(isProvisionalPuzzleRating(PUZZLE_RATING_DEFAULT_RD)).toBe(true);
    expect(
      formatPuzzleRating({
        rating: 1500,
        provisional: isProvisionalPuzzleRating(PUZZLE_RATING_DEFAULT_RD),
      })
    ).toBe('1500?');
  });

  test('the "?" marker clears once RD drops below the threshold', () => {
    expect(isProvisionalPuzzleRating(PUZZLE_PROVISIONAL_RD)).toBe(true);
    expect(isProvisionalPuzzleRating(PUZZLE_PROVISIONAL_RD - 1)).toBe(false);
    expect(
      formatPuzzleRating({
        rating: 1612,
        provisional: isProvisionalPuzzleRating(PUZZLE_PROVISIONAL_RD - 1),
      })
    ).toBe('1612');
  });

  test('a solve raises the rating and lowers RD; a fail lowers the rating', () => {
    const solved = applyPuzzleAttemptRating({
      player: DEFAULT_PUZZLE_RATING_STATE,
      puzzleRating: PUZZLE.rating,
      puzzleRatingDeviation: PUZZLE.ratingDeviation,
      scorePermille: PUZZLE_SCORE_PERMILLE.win,
    });
    expect(solved.rating).toBeGreaterThan(PUZZLE_RATING_DEFAULT);
    expect(solved.ratingDeviation).toBeLessThan(PUZZLE_RATING_DEFAULT_RD);

    const failed = applyPuzzleAttemptRating({
      player: DEFAULT_PUZZLE_RATING_STATE,
      puzzleRating: PUZZLE.rating,
      puzzleRatingDeviation: PUZZLE.ratingDeviation,
      scorePermille: PUZZLE_SCORE_PERMILLE.loss,
    });
    expect(failed.rating).toBeLessThan(PUZZLE_RATING_DEFAULT);
    expect(failed.ratingDeviation).toBeLessThan(PUZZLE_RATING_DEFAULT_RD);
  });

  test('RD crosses the provisional threshold after a run of attempts', () => {
    let state = DEFAULT_PUZZLE_RATING_STATE;
    let attempts = 0;
    while (isProvisionalPuzzleRating(state.ratingDeviation) && attempts < 100) {
      state = applyPuzzleAttemptRating({
        player: state,
        puzzleRating: state.rating,
        puzzleRatingDeviation: PUZZLE.ratingDeviation,
        scorePermille:
          attempts % 2 === 0
            ? PUZZLE_SCORE_PERMILLE.win
            : PUZZLE_SCORE_PERMILLE.loss,
      });
      attempts += 1;
    }
    expect(attempts).toBeLessThan(100);
    expect(isProvisionalPuzzleRating(state.ratingDeviation)).toBe(false);
  });

  test('score maps to permille', () => {
    expect(puzzleScorePermille(1)).toBe(PUZZLE_SCORE_PERMILLE.win);
    expect(puzzleScorePermille(0.5)).toBe(PUZZLE_SCORE_PERMILLE.half);
    expect(puzzleScorePermille(0)).toBe(PUZZLE_SCORE_PERMILLE.loss);
  });

  test('a missing puzzle deviation falls back to the catalog default', () => {
    expect(puzzleOpponentRd(0)).toBe(80);
    expect(puzzleOpponentRd(null)).toBe(80);
    expect(puzzleOpponentRd(120)).toBe(120);
  });

  test('a missing profile row reads as the default state', () => {
    expect(readPuzzleRatingState({})).toEqual(DEFAULT_PUZZLE_RATING_STATE);
    expect(
      readPuzzleRatingState({
        rating: 1720,
        ratingDeviation: 64,
        volatilityMicros: 58_000,
      })
    ).toEqual({
      rating: 1720,
      ratingDeviation: 64,
      volatilityMicros: 58_000,
    });
  });

  test('the ledger id is deterministic per (owner, puzzle)', () => {
    expect(chessPuzzleRatingEventId('u1', 'p1')).toBe('u1|p1');
    expect(chessPuzzleRatingEventId('u1', 'p1')).toBe(
      chessPuzzleRatingEventId('u1', 'p1')
    );
    expect(chessPuzzleRatingEventId('u1', 'p2')).not.toBe(
      chessPuzzleRatingEventId('u1', 'p1')
    );
  });
});

describe('§8 puzzle rating properties', () => {
  const arbScore = fc.constantFrom(
    PUZZLE_SCORE_PERMILLE.loss,
    PUZZLE_SCORE_PERMILLE.half,
    PUZZLE_SCORE_PERMILLE.win
  );

  test('state stays inside the persisted clamps for any attempt sequence', () => {
    assertProperty(
      'puzzle rating clamp',
      fc.property(fc.array(arbScore, { maxLength: 64 }), (scores) => {
        let state = DEFAULT_PUZZLE_RATING_STATE;
        for (const [index, scorePermille] of scores.entries()) {
          state = applyPuzzleAttemptRating({
            player: state,
            puzzleRating: 400 + (index % 27) * 100,
            puzzleRatingDeviation: 80,
            scorePermille,
          });
          expect(Number.isInteger(state.rating)).toBe(true);
          expect(Number.isInteger(state.ratingDeviation)).toBe(true);
          expect(Number.isInteger(state.volatilityMicros)).toBe(true);
          expect(state.rating).toBeGreaterThanOrEqual(PUZZLE_RATING_MIN);
          expect(state.rating).toBeLessThanOrEqual(PUZZLE_RATING_MAX);
          expect(state.ratingDeviation).toBeGreaterThanOrEqual(
            PUZZLE_RATING_RD_MIN
          );
          expect(state.ratingDeviation).toBeLessThanOrEqual(
            PUZZLE_RATING_RD_MAX
          );
        }
      })
    );
  });

  test('a solve never ends below a fail on the same attempt', () => {
    assertProperty(
      'puzzle rating score order',
      fc.property(
        fc.integer({ min: PUZZLE_RATING_MIN, max: PUZZLE_RATING_MAX }),
        fc.integer({ min: PUZZLE_RATING_MIN, max: PUZZLE_RATING_MAX }),
        fc.integer({ min: PUZZLE_RATING_RD_MIN, max: PUZZLE_RATING_RD_MAX }),
        (playerRating, puzzleRating, playerRd) => {
          const player = {
            rating: playerRating,
            ratingDeviation: playerRd,
            volatilityMicros: 60_000,
          };
          const lost = applyPuzzleAttemptRating({
            player,
            puzzleRating,
            puzzleRatingDeviation: 80,
            scorePermille: PUZZLE_SCORE_PERMILLE.loss,
          });
          const won = applyPuzzleAttemptRating({
            player,
            puzzleRating,
            puzzleRatingDeviation: 80,
            scorePermille: PUZZLE_SCORE_PERMILLE.win,
          });
          expect(won.rating).toBeGreaterThanOrEqual(lost.rating);
        }
      )
    );
  });

  test('applying an attempt is deterministic (client optimistic = server replay)', () => {
    assertProperty(
      'puzzle rating determinism',
      fc.property(
        fc.integer({ min: PUZZLE_RATING_MIN, max: PUZZLE_RATING_MAX }),
        fc.integer({ min: PUZZLE_RATING_RD_MIN, max: PUZZLE_RATING_RD_MAX }),
        arbScore,
        (puzzleRating, playerRd, scorePermille) => {
          const player = {
            rating: 1500,
            ratingDeviation: playerRd,
            volatilityMicros: 60_000,
          };
          const input = {
            player,
            puzzleRating,
            puzzleRatingDeviation: 80,
            scorePermille,
          };
          expect(applyPuzzleAttemptRating(input)).toEqual(
            applyPuzzleAttemptRating(input)
          );
        }
      )
    );
  });
});
