import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { timingMicroseconds } from '../storybook/timing-measurement';

// regression: pong-frame-budget-floating-point-noise
test('a frame at the budget does not fail because of timestamp subtraction noise', () => {
  expect(timingMicroseconds(33.40000000000009)).toBe(timingMicroseconds(33.4));
  expect(timingMicroseconds(33.401)).toBeGreaterThan(timingMicroseconds(33.4));
});

test('microsecond overruns remain failures at every frame budget', () => {
  assertProperty(
    'integer microsecond comparisons preserve measurable overruns',
    fc.property(
      fc.integer({ min: 0, max: 1_000_000 }),
      fc.integer({ min: 1, max: 1_000_000 }),
      (budget, overrun) => {
        expect(timingMicroseconds(budget / 1000)).toBe(budget);
        expect(timingMicroseconds((budget + overrun) / 1000)).toBeGreaterThan(
          timingMicroseconds(budget / 1000)
        );
      }
    )
  );
});

test('missing or invalid samples cannot become a passing duration', () => {
  expect(timingMicroseconds(Infinity)).toBe(Infinity);
  expect(timingMicroseconds(NaN)).toBeNaN();
});
