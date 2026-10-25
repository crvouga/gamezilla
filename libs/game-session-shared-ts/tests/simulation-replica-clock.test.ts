import { expect, test } from 'bun:test';
import { SimulationStateChanged } from '@libs/game-session-shared-ts/simulation-messages';
import { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { continuousRaceGame } from './reference-continuous-game';

test('a newly received snapshot cannot move playback behind already presented progress or reserve future playback', () => {
  // regression: simulation-presentation-clock-rewinds-on-snapshot
  const time = createHarnessClock();
  const simulation = continuousRaceGame.registration.simulation!;
  const replica = new SimulationReplica({
    simulation,
    clock: time.clock,
    send: () => null,
    measure: () => {},
  });
  const receive = (tick: number, distance: number, epoch = 'race:1') => {
    expect(
      replica.receive(
        SimulationStateChanged({
          version: 1,
          epoch,
          revision: tick + 1,
          tick,
          paused: false,
          state: simulation.codec.encode({ distance, luck: 0, inputs: [] }),
          acknowledged: {},
        }),
        epoch
      )
    ).toBe(true);
  };
  receive(27, 450);
  receive(30, 500);
  receive(33, 550);
  time.clock.advance(100);
  expect(replica.sample()).toMatchObject({ distance: 550 });
  receive(36, 600);
  expect(replica.sample()).toMatchObject({ distance: 550 });
  time.clock.advance(10_000);
  expect(replica.sample()).toMatchObject({ distance: 600 });
  receive(39, 650);
  expect(replica.sample()).toMatchObject({ distance: 600 });
  // A new execution has its own playback clock and may start from tick zero.
  receive(0, 0, 'race:2');
  receive(3, 50, 'race:2');
  expect(replica.sample()).toMatchObject({ distance: 0 });
});
