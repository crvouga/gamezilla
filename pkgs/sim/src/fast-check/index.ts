import type { Arbitrary } from 'fast-check';
import fc from 'fast-check';
import { createRng, type Rng } from '../internals/rng';
import type { Gen } from '../system/gen';

export {
  type AssertPropertyParams,
  assertProperty,
} from './assert-property';
export {
  arbFiniteNumber,
  arbJsonKey,
  arbJsonObject,
  arbJsonValue,
} from './json';

/**
 * pure-rand-compatible RandomGenerator over our Rng, so every fast-check
 * value is a function of recorded draws.
 */
type RandomGenOver = {
  clone(): RandomGenOver;
  next(): [number, RandomGenOver];
  unsafeNext(): number;
  getState(): unknown;
  unsafeJump(): void;
  jump(): RandomGenOver;
};

export function randomGeneratorOver(rng: Rng): RandomGenOver {
  const self: RandomGenOver = {
    clone() {
      return self;
    },
    next(): [number, RandomGenOver] {
      return [self.unsafeNext(), self];
    },
    unsafeNext(): number {
      return (rng.next() * 0x100000000) | 0;
    },
    getState() {
      return null;
    },
    unsafeJump() {},
    jump() {
      return self;
    },
  };
  return self;
}

/** Adapt a fast-check Arbitrary into our Gen. */
export function gen<T>(arbitrary: Arbitrary<T>): Gen<T> {
  return (rng) => {
    const random = new fc.Random(randomGeneratorOver(rng) as never);
    return arbitrary.generate(random, undefined).value;
  };
}

/** Adapt a Gen into a fast-check Arbitrary (no shrink — shrinking is ours). */
export function arbitrary<T>(g: Gen<T>): Arbitrary<T> {
  return fc.noShrink(fc.maxSafeInteger().map((seed) => g(createRng(seed))));
}
