import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property';
import fc from 'fast-check';

import {
  GLICKO2_DEFAULT,
  GLICKO2_DEFAULT_RD,
  type Glicko2Rating,
  type Glicko2Result,
  glicko2Decay,
  glicko2ExpectedScore,
  glicko2Update,
} from '../src/glicko2';

const SEED = 20240908;

/**
 * Glickman, "Example of the Glicko-2 system" (glicko.pdf): a player rated
 * 1500 / 200 / 0.06 with τ = 0.5 plays three opponents and ends on
 * 1464.06 / 151.52 / 0.05999.
 */
const PAPER_PLAYER: Glicko2Rating = {
  rating: 1500,
  rd: 200,
  volatility: 0.06,
};

const PAPER_RESULTS: readonly Glicko2Result[] = [
  { opponentRating: 1400, opponentRd: 30, score: 1 },
  { opponentRating: 1550, opponentRd: 100, score: 0 },
  { opponentRating: 1700, opponentRd: 300, score: 0 },
];

describe('glicko2 worked example', () => {
  // The paper prints μ′ / φ′ rounded to four decimals, so its 1464.06 /
  // 151.52 differ from full-precision arithmetic in the third decimal.
  test('reproduces the published rating period', () => {
    const next = glicko2Update(PAPER_PLAYER, PAPER_RESULTS, { tau: 0.5 });
    expect(next.rating).toBeCloseTo(1464.06, 1);
    expect(next.rd).toBeCloseTo(151.52, 1);
    expect(next.volatility).toBeCloseTo(0.05999, 4);
  });

  /** Full-precision regression vector for the same period (float drift guard). */
  test('the worked example is stable to five decimals', () => {
    const next = glicko2Update(PAPER_PLAYER, PAPER_RESULTS, { tau: 0.5 });
    expect(next.rating.toFixed(5)).toBe('1464.05067');
    expect(next.rd.toFixed(5)).toBe('151.51652');
    expect(next.volatility.toFixed(7)).toBe('0.0599960');
  });

  test('expected score matches the paper g/E values', () => {
    // E against the 1400/30 opponent in the worked example is 0.639.
    const e = glicko2ExpectedScore(PAPER_PLAYER, {
      rating: 1400,
      rd: 30,
      volatility: 0.06,
    });
    expect(e).toBeCloseTo(0.639, 3);
  });

  test('an empty rating period only inflates RD', () => {
    const next = glicko2Decay(PAPER_PLAYER);
    expect(next.rating).toBe(PAPER_PLAYER.rating);
    expect(next.rd).toBeGreaterThan(PAPER_PLAYER.rd);
    expect(next.volatility).toBe(PAPER_PLAYER.volatility);
  });

  test('RD inflation is clamped at the maximum', () => {
    const next = glicko2Decay({ rating: 1500, rd: 350, volatility: 0.06 });
    expect(next.rd).toBe(GLICKO2_DEFAULT_RD);
  });
});

const arbRating = fc.record({
  rating: fc.integer({ min: 400, max: 2900 }),
  rd: fc.integer({ min: 30, max: 350 }),
  volatility: fc
    .integer({ min: 20_000, max: 200_000 })
    .map((micros) => micros / 1_000_000),
});

const arbOpponent = fc.record({
  opponentRating: fc.integer({ min: 400, max: 2900 }),
  opponentRd: fc.integer({ min: 30, max: 350 }),
});

describe('glicko2 properties', () => {
  test('a win never lowers the rating, a loss never raises it', () => {
    assertProperty(
      'a win never lowers the rating, a loss never raises it',
      fc.property(arbRating, arbOpponent, (player, opponent) => {
        const won = glicko2Update(player, [{ ...opponent, score: 1 }]);
        const lost = glicko2Update(player, [{ ...opponent, score: 0 }]);
        expect(won.rating).toBeGreaterThanOrEqual(player.rating);
        expect(lost.rating).toBeLessThanOrEqual(player.rating);
        expect(won.rating).toBeGreaterThan(lost.rating);
      }),
      { seed: SEED, numRuns: 200 }
    );
  });

  test('RD never grows past the maximum and the result is always finite', () => {
    assertProperty(
      'RD never grows past the maximum and the result is always finite',
      fc.property(
        arbRating,
        arbOpponent,
        fc.constantFrom(0, 0.5, 1),
        (player, opponent, score) => {
          const next = glicko2Update(player, [{ ...opponent, score }]);
          expect(next.rd).toBeLessThanOrEqual(GLICKO2_DEFAULT_RD);
          expect(next.rd).toBeGreaterThan(0);
          expect(Number.isFinite(next.rating)).toBe(true);
          expect(Number.isFinite(next.volatility)).toBe(true);
        }
      ),
      { seed: SEED, numRuns: 200 }
    );
  });

  /**
   * Against a comparably rated opponent a game always leaves the player more
   * certain than the same period sat out. (A huge upset may do the opposite:
   * that is what volatility is for.)
   */
  test('a near-rated game leaves the player more certain than sitting out', () => {
    assertProperty(
      'a near-rated game leaves the player more certain than sitting out',
      fc.property(
        arbRating,
        fc.integer({ min: -300, max: 300 }),
        fc.integer({ min: 30, max: 350 }),
        fc.constantFrom(0, 0.5, 1),
        (player, ratingDelta, opponentRd, score) => {
          const next = glicko2Update(player, [
            {
              opponentRating: player.rating + ratingDelta,
              opponentRd,
              score,
            },
          ]);
          expect(next.rd).toBeLessThan(glicko2Decay(player).rd);
        }
      ),
      { seed: SEED, numRuns: 200 }
    );
  });

  test('the update is a pure function of its inputs', () => {
    assertProperty(
      'the update is a pure function of its inputs',
      fc.property(
        arbRating,
        arbOpponent,
        fc.constantFrom(0, 0.5, 1),
        (player, opponent, score) => {
          const a = glicko2Update(player, [{ ...opponent, score }]);
          const b = glicko2Update(player, [{ ...opponent, score }]);
          expect(a).toEqual(b);
        }
      ),
      { seed: SEED, numRuns: 100 }
    );
  });

  test('a long even run converges on the opponent and settles RD', () => {
    let player = GLICKO2_DEFAULT;
    const rd: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      player = glicko2Update(player, [
        { opponentRating: 1800, opponentRd: 60, score: i % 2 === 0 ? 1 : 0 },
      ]);
      rd.push(player.rd);
    }
    // Scoring 50% against 1800 puts the player at 1800.
    expect(Math.abs(player.rating - 1800)).toBeLessThan(120);
    // RD converges: the last step moves it far less than the first.
    const firstDrop = GLICKO2_DEFAULT_RD - (rd[0] ?? 0);
    const lastDrop = (rd[rd.length - 2] ?? 0) - (rd[rd.length - 1] ?? 0);
    expect(lastDrop).toBeLessThan(firstDrop);
    expect(player.rd).toBeLessThan(100);
  });

  test('a solve and a fail against the same puzzle bracket the start', () => {
    assertProperty(
      'a solve and a fail against the same puzzle bracket the start',
      fc.property(arbRating, arbOpponent, (player, opponent) => {
        const drew = glicko2Update(player, [{ ...opponent, score: 0.5 }]);
        const won = glicko2Update(player, [{ ...opponent, score: 1 }]);
        const lost = glicko2Update(player, [{ ...opponent, score: 0 }]);
        expect(drew.rating).toBeLessThanOrEqual(won.rating);
        expect(drew.rating).toBeGreaterThanOrEqual(lost.rating);
      }),
      { seed: SEED, numRuns: 200 }
    );
  });
});
