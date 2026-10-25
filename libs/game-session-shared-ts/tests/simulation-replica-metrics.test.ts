import { expect, test } from 'bun:test';
import { SimulationStateChanged } from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { continuousRaceGame } from './reference-continuous-game';

function errorsFor(
  presentation: NonNullable<RegisteredSimulation['presentation']>
) {
  const simulation = continuousRaceGame.registration.simulation!;
  const errors: number[] = [];
  const replica = new SimulationReplica({
    simulation: { ...simulation, presentation },
    clock: createHarnessClock().clock,
    send: () => 'input-1',
    measure: (sample) => errors.push(...sample.predictionErrors),
  });
  const initial = {
    version: 1 as const,
    epoch: 'race:1',
    revision: 1,
    tick: 0,
    paused: false,
    state: simulation.codec.encode(simulation.initialize('race:1')),
    acknowledged: {},
  };
  expect(replica.receive(SimulationStateChanged(initial), initial.epoch)).toBe(
    true
  );
  expect(replica.control('white', 4)).toBe(true);
  replica.pump();
  const confirmed = {
    ...initial,
    tick: 3,
    revision: 2,
    acknowledged: { white: 1 },
  };
  expect(
    replica.receive(SimulationStateChanged(confirmed), initial.epoch)
  ).toBe(true);
  // A same-tick revision and a later tick cannot measure the consumed projection again.
  replica.receive(
    SimulationStateChanged({ ...confirmed, revision: 3 }),
    initial.epoch
  );
  replica.receive(
    SimulationStateChanged({ ...confirmed, revision: 4, tick: 4 }),
    initial.epoch
  );
  return errors;
}

test.each([0, 0.25, 1, null, Number.NaN, Number.POSITIVE_INFINITY, -0.1, 1.1])(
  'prediction metric accepts only a normalized finite distance: %s',
  (error) => {
    const errors = errorsFor({
      predict: (state) => state,
      predictionError: () => error,
    });
    const valid =
      error !== null && Number.isFinite(error) && error >= 0 && error <= 1;
    expect(errors).toEqual(valid ? [error] : []);
  }
);

test('a game without prediction or without a distance comparator emits no fabricated error', () => {
  expect(errorsFor({ predictionError: () => 0.25 })).toEqual([]);
  expect(errorsFor({ predict: (state) => state })).toEqual([]);
});
