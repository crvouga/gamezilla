import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import { createSeededRng } from './seeded-rng';

describe('createSeededRng properties', () => {
  test('same seed yields the same int/random sequence', () => {
    assertProperty(
      'seeded RNG determinism',
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 40 }),
        (seed, steps) => {
          const a = createSeededRng(seed);
          const b = createSeededRng(seed);
          for (let i = 0; i < steps; i += 1) {
            expect(a.int(1000)).toBe(b.int(1000));
            expect(a.random()).toBe(b.random());
            expect(a.bool(0.37)).toBe(b.bool(0.37));
          }
        }
      )
    );
  });

  test('distinct fork labels diverge', () => {
    assertProperty(
      'fork labels diverge',
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.stringMatching(/^[a-z]{2,8}$/),
        fc.stringMatching(/^[a-z]{2,8}$/),
        (seed, labelA, labelB) => {
          fc.pre(labelA !== labelB);
          const root = createSeededRng(seed);
          const a = root.fork(labelA);
          const b = root.fork(labelB);
          const seqA = Array.from({ length: 8 }, () => a.int(1_000_000));
          const seqB = Array.from({ length: 8 }, () => b.int(1_000_000));
          expect(seqA).not.toEqual(seqB);
        }
      )
    );
  });
});
