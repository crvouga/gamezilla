import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { MotionSample } from '../src/ports';
import { createShakeDetector } from '../src/shake';

const STILL: MotionSample = { x: 0, y: 0, z: 9.8 };
const SAMPLE_MS = 50;

/** Feeds motion at a phone's pace; counts how many shakes were noticed. */
function feel(samples: readonly MotionSample[]): number {
  const { clock } = createHarnessClock();
  const shaken = createShakeDetector(clock);
  let shakes = 0;
  for (const sample of samples) {
    if (shaken(sample)) shakes++;
    clock.advance(SAMPLE_MS);
  }
  return shakes;
}

const shaking = (count: number): MotionSample[] =>
  Array.from({ length: count }, (_, index) => ({
    x: index % 2 === 0 ? 30 : -30,
    y: 0,
    z: 9.8,
  }));
const still = (count: number): MotionSample[] =>
  Array.from({ length: count }, () => STILL);

describe('telling a shake from a phone being carried', () => {
  test('a phone lying still is not being shaken', () => {
    expect(feel(still(200))).toBe(0);
  });

  test('half a second of hard motion is a shake', () => {
    expect(feel(shaking(10))).toBe(1);
  });

  test('one knock is not a shake', () => {
    expect(feel([...still(20), ...shaking(2), ...still(20)])).toBe(0);
  });

  test('a phone set down hard now and then is not being shaken', () => {
    const bumps = Array.from({ length: 20 }, () => [
      ...shaking(1),
      ...still(4),
    ]).flat();
    expect(feel(bumps)).toBe(0);
  });

  test('one long shake opens one bug report', () => {
    expect(feel(shaking(30))).toBe(1);
  });

  test('shaking again later is noticed again', () => {
    expect(feel([...shaking(10), ...still(60), ...shaking(10)])).toBe(2);
  });
});
