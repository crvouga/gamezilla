import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { createSeededRng } from '@pkgs/uuid-shared/seeded-rng';
import type { SeededRng } from '@pkgs/uuid-shared/seeded-rng';
import fc from 'fast-check';

const arbSeed = fc.oneof(
  fc.integer({ min: -(2 ** 40), max: 2 ** 40 }),
  fc.bigInt({ min: 0n, max: 2n ** 64n - 1n }),
  fc.string({ maxLength: 12 })
);
const arbLabel = fc.stringMatching(/^[a-z]{1,8}$/);

function draws(rng: SeededRng, n: number): number[] {
  return Array.from({ length: n }, () => rng.random());
}

describe('createSeededRng', () => {
  test('same seed ⇒ same stream across random / int / bool / pick', () => {
    assertProperty(
      'same seed ⇒ same stream across random / int / bool / pick',
      fc.property(arbSeed, fc.integer({ min: 1, max: 30 }), (seed, steps) => {
        const a = createSeededRng(seed);
        const b = createSeededRng(seed);
        expect(a.seed).toBe(b.seed);
        for (let i = 0; i < steps; i += 1) {
          expect(a.int(1000)).toBe(b.int(1000));
          expect(a.random()).toBe(b.random());
          expect(a.bool(0.37)).toBe(b.bool(0.37));
          expect(a.pick(['x', 'y', 'z'])).toBe(b.pick(['x', 'y', 'z']));
        }
      })
    );
  });

  test('a number seed is its floored magnitude; 0 is 1', () => {
    assertProperty(
      'a number seed is its floored magnitude; 0 is 1',
      fc.property(fc.double({ min: -1e12, max: 1e12, noNaN: true }), (seed) => {
        const canonical = Math.floor(Math.abs(seed)) || 1;
        expect(draws(createSeededRng(seed), 4)).toEqual(
          draws(createSeededRng(canonical), 4)
        );
        expect(createSeededRng(seed).seed).toBe(BigInt(canonical));
      })
    );
  });

  test('draws stay in range', () => {
    assertProperty(
      'draws stay in range',
      fc.property(
        arbSeed,
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.array(fc.integer(), { minLength: 1, maxLength: 5 }),
        (seed, max, items) => {
          const rng = createSeededRng(seed);
          for (let i = 0; i < 20; i += 1) {
            const r = rng.random();
            expect(r >= 0 && r < 1).toBe(true);
            const n = rng.int(max);
            expect(Number.isInteger(n) && n >= 0 && n < max).toBe(true);
            expect(items).toContain(rng.pick(items));
          }
        }
      )
    );
  });

  test('bool is constant outside (0, 1)', () => {
    assertProperty(
      'bool is constant outside (0, 1)',
      fc.property(arbSeed, fc.double({ max: 0, noNaN: true }), (seed, p) => {
        const rng = createSeededRng(seed);
        expect(rng.bool(p)).toBe(false);
        expect(rng.bool(1 - p)).toBe(true);
      })
    );
  });

  test('int refuses a non-positive or non-finite bound; pick refuses []', () => {
    assertProperty(
      'int refuses a non-positive or non-finite bound; pick refuses []',
      fc.property(
        arbSeed,
        fc.oneof(
          fc.double({ max: 0 }),
          fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY)
        ),
        (seed, max) => {
          const rng = createSeededRng(seed);
          expect(() => rng.int(max)).toThrow();
          expect(() => rng.pick([])).toThrow();
        }
      )
    );
  });

  test('fork depends only on the root seed and label, not on draws taken', () => {
    assertProperty(
      'fork depends only on the root seed and label, not on draws taken',
      fc.property(
        arbSeed,
        arbLabel,
        fc.nat({ max: 10 }),
        (seed, label, consumed) => {
          const fresh = createSeededRng(seed);
          const used = createSeededRng(seed);
          draws(used, consumed);
          expect(draws(used.fork(label), 6)).toEqual(
            draws(fresh.fork(label), 6)
          );
        }
      )
    );
  });

  test('distinct fork labels diverge from each other and from the root', () => {
    assertProperty(
      'distinct fork labels diverge from each other and from the root',
      fc.property(arbSeed, arbLabel, arbLabel, (seed, labelA, labelB) => {
        fc.pre(labelA !== labelB);
        const root = createSeededRng(seed);
        const a = draws(root.fork(labelA), 8);
        const b = draws(root.fork(labelB), 8);
        expect(a).not.toEqual(b);
        expect(a).not.toEqual(draws(createSeededRng(seed), 8));
      })
    );
  });
});
