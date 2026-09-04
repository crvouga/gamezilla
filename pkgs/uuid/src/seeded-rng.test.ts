import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';

import { createSeededRng } from './seeded-rng';

// `@pkgs/sim` depends on this package, so use fast-check directly (no
// `@pkgs/sim/fast-check` runner) to keep the workspace graph acyclic.
const PARAMS: fc.Parameters<unknown> = { numRuns: 40, seed: 424_242 };

describe('createSeededRng properties', () => {
  test('same seed yields the same int/random sequence', () => {
    fc.assert(
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
      ),
      PARAMS
    );
  });

  test('distinct fork labels diverge', () => {
    fc.assert(
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
      ),
      PARAMS
    );
  });
});
