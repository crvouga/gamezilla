import { expect, test } from 'bun:test';
import { driveSimulation } from '@libs/game-session-shared-ts/simulation-driver';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { raceSimulation } from './reference-simulation';

/** A clock that reads like the wall clock: milliseconds since the epoch. */
const EPOCH_MS = 1_700_000_000_000;

test('on-time wakes of an epoch-scale clock keep every tick and every publication', () => {
  // regression: simulation-epoch-clock-drops-snapshots
  const time = createHarnessClock({ startMs: EPOCH_MS });
  const simulation = raceSimulation({ tickRate: 30 });
  const published: number[] = [];
  const advanced: number[] = [];
  const errors: unknown[] = [];
  const driver = driveSimulation(simulation, {
    ...time,
    snapshotRate: 15,
    publish: (snapshot) => published.push(snapshot.tick),
    measure: () => advanced.push(simulation.snapshot().tick),
    onError: (error) => errors.push(error),
  });
  for (let tick = 0; tick < 30; tick++) time.clock.advance(1000 / 30);
  expect(errors).toEqual([]);
  // Every wake commits exactly the one tick that fell due.
  expect(advanced).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  expect(published).toEqual(Array.from({ length: 15 }, (_, i) => 2 * (i + 1)));
  driver.stop();
});
