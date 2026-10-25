import { expect, test } from 'bun:test';
import { driveSimulation } from '@libs/game-session-shared-ts/simulation-driver';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { raceSimulation } from './reference-simulation';

// regression: simulation-paused-scheduler-catch-up
test('resuming after 60000 paused milliseconds resets elapsed time even when the timer never woke', () => {
  const time = createHarnessClock();
  const simulation = raceSimulation({ maxCatchUpTicks: 8 });
  let now = 0;
  const errors: unknown[] = [];
  const driver = driveSimulation(simulation, {
    clock: { now: () => now },
    timers: time.timers,
    snapshotRate: 20,
    publish: () => {},
    measure: () => {},
    onError: (error) => errors.push(error),
  });
  simulation.setPaused(true);
  now = 60_000;
  simulation.setPaused(false);
  driver.resetElapsed();
  time.clock.advance(1000 / 60);
  expect(simulation.snapshot().tick).toBe(0);
  now += 1000 / 60;
  time.clock.advance(1000 / 60);
  expect(simulation.snapshot().tick).toBe(1);
  expect(errors).toEqual([]);
  driver.stop();
});

test('simulation and publication have independent frequencies and teardown owns the timer', () => {
  const time = createHarnessClock();
  const simulation = raceSimulation();
  const published: number[] = [];
  const errors: unknown[] = [];
  const driver = driveSimulation(simulation, {
    ...time,
    snapshotRate: 20,
    publish: (snapshot) => published.push(snapshot.tick),
    measure: () => {},
    onError: (error) => errors.push(error),
  });
  for (let tick = 0; tick < 60; tick++) time.clock.advance(1000 / 60);
  expect(simulation.snapshot().tick).toBe(60);
  expect(published).toHaveLength(20);
  expect(published[0]).toBe(3);
  expect(published.at(-1)).toBe(60);
  expect(errors).toEqual([]);
  expect(time.clock.pendingOneShotCount()).toBe(1);
  driver.stop();
  driver.stop();
  expect(time.clock.pendingOneShotCount()).toBe(0);
  time.clock.advance(1000);
  expect(simulation.snapshot().tick).toBe(60);
});

test('publication failure reports once and releases the simulation timer', () => {
  const time = createHarnessClock();
  const errors: unknown[] = [];
  driveSimulation(raceSimulation(), {
    ...time,
    snapshotRate: 20,
    publish: () => {
      throw new Error('publication failed');
    },
    measure: () => {},
    onError: (error) => errors.push(error),
  });
  time.clock.advance(60);
  expect(errors).toHaveLength(1);
  expect(time.clock.pendingOneShotCount()).toBe(0);
  time.clock.advance(1000);
  expect(errors).toHaveLength(1);
});

// regression: simulation-clock-backward-double-count
test('clock readings of 16.666666666666668, 8.333333333333334 and 25 never count the same elapsed time twice', () => {
  const time = createHarnessClock();
  const simulation = raceSimulation();
  let now = 0;
  const errors: unknown[] = [];
  const driver = driveSimulation(simulation, {
    timers: time.timers,
    clock: { now: () => now },
    snapshotRate: 20,
    publish: () => {},
    measure: () => {},
    onError: (error) => errors.push(error),
  });
  for (const reading of [16.666666666666668, 8.333333333333334, 25]) {
    now = reading;
    const due = time.clock.nextDueAt();
    if (due === null) throw new Error('driver lost its timer');
    time.clock.set(due);
  }
  expect(simulation.snapshot().tick).toBe(1);
  expect(errors).toEqual([]);
  driver.stop();
  expect(time.clock.pendingOneShotCount()).toBe(0);
});
