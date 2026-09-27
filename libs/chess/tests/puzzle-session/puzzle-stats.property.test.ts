import { describe, expect, test } from 'bun:test';
import type { ChessPuzzleRatingEvent } from '@libs/chess/public/chess-puzzle-rating-event';
import { deriveChessPuzzleStats } from '@libs/chess/public/chess-puzzle-stats';
import { assertProperty, fc } from '@pkgs/property';

/**
 * §15 stats figures (played, solved, accuracy) fold the rated attempts only:
 * relations that must hold for any history, never a restatement of the fold.
 */

const arbOutcome = fc.constantFrom<ChessPuzzleRatingEvent['outcome']>(
  'solved',
  'failed',
  'abandoned'
);

const arbEvents = fc
  .array(arbOutcome, { maxLength: 40 })
  .map((outcomes): ChessPuzzleRatingEvent[] =>
    outcomes.map((outcome, index) => ({
      puzzleId: `p${String(index)}`,
      puzzleRating: 1500,
      outcome,
      scorePermille: outcome === 'solved' ? 1000 : 0,
      ratingBefore: 1500,
      ratingAfter: 1500,
      ratingDeviationBefore: 350,
      ratingDeviationAfter: 340,
      at: `2026-09-19T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
    }))
  );

function stats(events: readonly ChessPuzzleRatingEvent[]) {
  return deriveChessPuzzleStats({
    profileRating: 1500,
    profileRatingDeviation: 350,
    ratingEvents: events,
    interactions: [],
  });
}

function event(
  outcome: ChessPuzzleRatingEvent['outcome'],
  id: string
): ChessPuzzleRatingEvent {
  return {
    puzzleId: id,
    puzzleRating: 1500,
    outcome,
    scorePermille: 0,
    ratingBefore: 1500,
    ratingAfter: 1500,
    ratingDeviationBefore: 350,
    ratingDeviationAfter: 340,
    at: '2026-09-20T00:00:00.000Z',
  };
}

describe('§15 stats figures over rated attempts', () => {
  test('every rated attempt is played; solved never exceeds played; accuracy is a percentage', () => {
    assertProperty(
      'stats figures bounds',
      fc.property(arbEvents, (events) => {
        const s = stats(events);
        expect(s.totalPlayed).toBe(events.length);
        expect(s.totalSolved).toBeGreaterThanOrEqual(0);
        expect(s.totalSolved).toBeLessThanOrEqual(s.totalPlayed);
        expect(Number.isInteger(s.accuracy)).toBe(true);
        expect(s.accuracy).toBeGreaterThanOrEqual(0);
        expect(s.accuracy).toBeLessThanOrEqual(100);
      })
    );
  });

  test('accuracy is 100 exactly when every attempt was solved, 0 when none was', () => {
    assertProperty(
      'stats accuracy extremes',
      fc.property(arbEvents, (events) => {
        const s = stats(events);
        const all = events.length > 0 && s.totalSolved === events.length;
        expect(s.accuracy === 100).toBe(all);
        if (s.totalSolved === 0) expect(s.accuracy).toBe(0);
      })
    );
  });

  test('the order attempts arrive in never changes the figures', () => {
    assertProperty(
      'stats order independence',
      fc.property(
        arbEvents.chain((events) =>
          fc.tuple(
            fc.constant(events),
            fc.shuffledSubarray(events, {
              minLength: events.length,
              maxLength: events.length,
            })
          )
        ),
        ([events, shuffled]) => {
          const a = stats(events);
          const b = stats(shuffled);
          expect([b.totalPlayed, b.totalSolved, b.accuracy]).toEqual([
            a.totalPlayed,
            a.totalSolved,
            a.accuracy,
          ]);
        }
      )
    );
  });

  test('a solve never lowers accuracy; a fail or a skip never raises it', () => {
    assertProperty(
      'stats accuracy monotone',
      fc.property(arbEvents, arbOutcome, (events, outcome) => {
        const before = stats(events);
        const after = stats([...events, event(outcome, 'next')]);
        expect(after.totalPlayed).toBe(before.totalPlayed + 1);
        if (outcome === 'solved') {
          expect(after.totalSolved).toBe(before.totalSolved + 1);
          expect(after.accuracy).toBeGreaterThanOrEqual(before.accuracy);
        } else {
          expect(after.totalSolved).toBe(before.totalSolved);
          expect(after.accuracy).toBeLessThanOrEqual(before.accuracy);
        }
      })
    );
  });
});
