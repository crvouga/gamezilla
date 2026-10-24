import { expect, test } from 'bun:test';
import { SimulationInputTiming } from '@libs/game-session-shared-ts/simulation-input-timing';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

test('cumulative acknowledgments measure each sent input once and keep other seats independent', () => {
  const timing = new SimulationInputTiming(2);
  expect(timing.record('white', 1, 37)).toBe(true);
  expect(timing.record('white', 2, 50)).toBe(true);
  expect(timing.record('black', 1, 80)).toBe(true);
  expect(timing.record('white', 1, 99)).toBe(false);
  expect(timing.record('white', 3, 99)).toBe(false);
  expect(timing.acknowledge('white', 3, 100)).toEqual([]);
  expect(timing.acknowledge('white', 2, 100)).toEqual([63, 50]);
  expect(timing.acknowledge('white', 2, 101)).toEqual([]);
  expect(timing.acknowledge('black', 1, 101)).toEqual([21]);
  expect(timing.record('white', 1, 102)).toBe(false);
  expect(timing.record('white', 3, 102)).toBe(true);
  timing.clear();
  expect(timing.acknowledge('white', 3, 103)).toEqual([]);
  expect(timing.record('white', 1, 104)).toBe(true);
});

test('backward or invalid clock readings never fabricate latency', () => {
  const timing = new SimulationInputTiming(2);
  expect(timing.record('white', 1, Number.NaN)).toBe(false);
  timing.record('white', 1, 100);
  expect(timing.acknowledge('white', 1, Number.NaN)).toEqual([]);
  expect(timing.acknowledge('white', 1, 90)).toEqual([]);
  expect(timing.acknowledge('white', 1, 110)).toEqual([]);
});

test('client clock offsets cannot change acknowledgment durations or retention bounds', () => {
  assertProperty(
    'simulation acknowledgment clock translation',
    fc.property(
      fc.integer({ min: 0, max: 1_000_000 }),
      fc.integer({ min: 0, max: 1000 }),
      fc.integer({ min: 1, max: 64 }),
      (offset, elapsed, capacity) => {
        const timing = new SimulationInputTiming(capacity);
        for (let sequence = 1; sequence <= capacity; sequence++)
          expect(timing.record('white', sequence, offset)).toBe(true);
        expect(timing.record('white', capacity + 1, offset)).toBe(false);
        expect(timing.acknowledge('white', capacity, offset + elapsed)).toEqual(
          Array.from({ length: capacity }, () => elapsed)
        );
        expect(
          timing.acknowledge('white', capacity, offset + elapsed + 1)
        ).toEqual([]);
        expect(timing.record('white', capacity + 1, offset + elapsed)).toBe(
          true
        );
      }
    )
  );
});
