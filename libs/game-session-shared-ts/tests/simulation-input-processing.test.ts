import { expect, test } from 'bun:test';
import { SimulationInputProcessing } from '@libs/game-session-shared-ts/simulation-input-processing';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const input = (playerId: string, sequence: number, tick = 1) => ({
  playerId,
  sequence,
  tick,
});

test('receipt times are bounded globally and arbitrary player names stay independent', () => {
  const timing = new SimulationInputProcessing(3);
  const inputs = [input('first:1', 2), input('first', 1), input('first:1', 1)];
  for (const entry of inputs) expect(timing.record(entry, 5)).toBe(true);
  expect(timing.record(inputs[0]!, 9)).toBe(false);
  expect(timing.record(input('fourth', 1), 9)).toBe(false);
  expect(timing.applied(1, [...inputs].reverse(), 17)).toEqual([12, 12, 12]);
  expect(timing.applied(1, inputs, 18)).toEqual([]);
  expect(timing.record(input('fourth', 1, 2), 18)).toBe(true);
  timing.clear();
  expect(timing.applied(2, [input('fourth', 1, 2)], 34)).toEqual([]);
});

test('only exact successful applications are timed; expired superseded records release capacity', () => {
  const timing = new SimulationInputProcessing(2);
  const superseded = input('first', 1, 3);
  const applied = input('first', 2, 1);
  timing.record(superseded, 0);
  timing.record(applied, 7);
  expect(timing.applied(1, [applied], 17)).toEqual([10]);
  timing.applied(3, [], 50);
  expect(timing.record(input('second', 1, 4), 50)).toBe(true);
  expect(timing.record(input('third', 1, 4), 50)).toBe(true);
  expect(timing.applied(4, [superseded], 67)).toEqual([]);
});

test('invalid and backward authority clocks cannot produce delayed fabricated samples', () => {
  const timing = new SimulationInputProcessing(2);
  const first = input('first', 1);
  expect(timing.record(first, Number.NaN)).toBe(false);
  expect(timing.record(first, 100)).toBe(true);
  expect(timing.applied(1, [first], 90)).toEqual([]);
  expect(timing.applied(1, [first], 110)).toEqual([]);
  timing.record(first, 100);
  expect(timing.applied(1, [first], Number.NaN)).toEqual([]);
  expect(timing.applied(1, [first], 110)).toEqual([]);
});

test('authority clock offsets and reordered arrivals cannot change elapsed time or the retention bound', () => {
  assertProperty(
    'simulation input processing clock translation',
    fc.property(
      fc.integer({ min: -1_000_000, max: 1_000_000 }),
      fc.integer({ min: 0, max: 1000 }),
      fc.integer({ min: 1, max: 64 }),
      (offset, elapsed, capacity) => {
        const timing = new SimulationInputProcessing(capacity);
        const inputs = Array.from({ length: capacity }, (_, index) =>
          input('arbitrary-seat', index + 1)
        );
        for (const entry of [...inputs].reverse())
          expect(timing.record(entry, offset)).toBe(true);
        expect(timing.record(input('overflow', 1), offset)).toBe(false);
        expect(timing.applied(1, inputs, offset + elapsed)).toEqual(
          inputs.map(() => elapsed)
        );
        expect(timing.applied(1, inputs, offset + elapsed)).toEqual([]);
      }
    )
  );
});
