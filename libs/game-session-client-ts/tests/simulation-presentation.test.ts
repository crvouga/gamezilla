import { expect, test } from 'bun:test';
import {
  connectSimulationPresentation,
  type SimulationPresentation,
} from '@libs/game-session-client-ts/simulation-presentation-session';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
} from '@libs/game-session-shared-ts/simulation-messages';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { raceGame } from './reference-race-game';

type Options = Parameters<typeof connectSimulationPresentation>[0];

function snapshot(epoch: string, paused: boolean) {
  return SimulationStateChanged({
    version: 1,
    epoch,
    revision: 1,
    tick: 2,
    paused,
    state: raceGame.registration.rules.initial(),
    acknowledged: {},
  });
}

test.each(['generation change', 'room resynchronization'] as const)(
  'a fresh running court resynchronizes after %s',
  (cause) => {
    // regression: pong-recovered-court-pause-not-observed
    const time = createHarnessClock();
    let generation = 'race:1';
    let ready = true;
    let receive: Parameters<Options['subscribeSignal']>[0] = () => {};
    let roomChanged = () => {};
    let view: SimulationPresentation = {
      position: null,
      paused: true,
      stale: true,
    };
    const requests: string[] = [];
    const position = raceGame.registration.rules.initial();
    const connection = connectSimulationPresentation({
      simulation: raceGame.registration.simulation!,
      ...time,
      generation: () => generation,
      isReady: () => ready,
      send: (message) => {
        if (RequestSimulationSnapshot.is(message)) requests.push(generation);
        return 'race-signal';
      },
      subscribeSignal: (listener) => {
        receive = listener;
        return () => {};
      },
      subscribeRoom: (listener) => {
        roomChanged = listener;
        return () => {};
      },
      measure: () => {},
      changed: (next) => (view = next),
    });
    try {
      connection.refresh();
      receive(snapshot(generation, false));
      time.clock.advance(20);
      expect(view).toEqual({ position, paused: false, stale: false });
      if (cause === 'generation change') {
        // The new signal can arrive before its durable room metadata.
        receive(snapshot('race:2', true));
        generation = 'race:2';
      } else {
        ready = false;
        roomChanged();
        // Room signals received while unsynced are intentionally discarded.
        ready = true;
      }
      roomChanged();
      expect(requests).toEqual(['race:1', generation]);
      expect(connection.replica.control('white', 1)).toBe(false);
      time.clock.advance(20);
      expect(view).toEqual({ position, paused: true, stale: true });
      receive(snapshot(generation, true));
      time.clock.advance(20);
      expect(view).toEqual({ position, paused: true, stale: false });
      roomChanged();
      expect(requests).toHaveLength(2);
    } finally {
      connection.dispose();
    }
    expect(time.clock.pendingOneShotCount()).toBe(0);
  }
);
